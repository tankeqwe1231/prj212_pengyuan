#!/bin/sh
#
# Manage the Superset service of this installation (CentOS 7 / production).
#
# This file intentionally uses POSIX ``sh`` syntax, so it can be invoked either
# as ``./restart_service.sh`` or as ``sh restart_service.sh``.
#
# Usage:
#   sh restart_service.sh                  restart the service (default)
#   sh restart_service.sh start            start only if it is not running
#   sh restart_service.sh stop             stop the service
#   sh restart_service.sh status           show the current state
#   sh restart_service.sh restart -d       use the Flask debug server instead
#                                          of gunicorn (troubleshooting only,
#                                          it enables the Werkzeug debugger)
#
# Environment overrides (all optional):
#   APP_DIR LOG_FILE SERVICE_PORT START_TIMEOUT STOP_TIMEOUT LOG_MAX_MB LOG_KEEP

set -eu

# Default to the directory holding this script, so the same file works both in
# the repository checkout and in /data/prj212_fengyun_161.
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")" && pwd)}"
LOG_FILE="${LOG_FILE:-/root/log/superset212.log}"
# Listening port used for the readiness check.  Empty means "detect it from the
# gunicorn command line", which is only possible on the non-debug path.
SERVICE_PORT="${SERVICE_PORT:-}"
# Importing this application takes a while, so allow a generous budget.
START_TIMEOUT="${START_TIMEOUT:-90}"
STOP_TIMEOUT="${STOP_TIMEOUT:-20}"
# Rotate the log before starting once it grew beyond LOG_MAX_MB megabytes,
# keeping LOG_KEEP generations.  Set LOG_MAX_MB=0 to disable rotation.
LOG_MAX_MB="${LOG_MAX_MB:-200}"
LOG_KEEP="${LOG_KEEP:-5}"

PYTHON_BIN="$APP_DIR/.venv/bin/python"
SUPERSET_BIN="$APP_DIR/superset/bin/superset"
PID_FILE="$APP_DIR/.superset212.pid"
# Deliberately not ".superset212.restart.lock": a service started by the older
# version of this script inherited that lock and still holds it, which would
# block the first run of this version.
LOCK_FILE="$APP_DIR/.superset212.lock"

ACTION="restart"
DEBUG_MODE=0
KNOWN_PORT=""

say() {
    printf '%s\n' "$*"
}

die() {
    printf 'restart_service.sh: %s\n' "$*" >&2
    exit 1
}

usage() {
    cat <<'EOF'
Usage: sh restart_service.sh [start|stop|restart|status] [-d]

  start     start the service if it is not running
  stop      stop the service, including orphaned gunicorn processes
  restart   stop, then start (default)
  status    report the running processes and the listening port
  -d        start with the Flask debug server instead of gunicorn
EOF
}

for arg in "$@"; do
    case "$arg" in
        start|stop|restart|status) ACTION="$arg" ;;
        -d|--debug) DEBUG_MODE=1 ;;
        -h|--help) usage; exit 0 ;;
        *) die "unknown argument: $arg (try -h)" ;;
    esac
done

[ -d "$APP_DIR" ] || die "application directory does not exist: $APP_DIR"
[ -x "$PYTHON_BIN" ] || die "Python executable is not executable: $PYTHON_BIN"
[ -f "$SUPERSET_BIN" ] || die "Superset launcher does not exist: $SUPERSET_BIN"

cd "$APP_DIR"

# ``superset runserver`` delegates to the ``gunicorn`` executable by name, so
# put this installation's virtualenv first to avoid picking a system-wide one.
PATH="$APP_DIR/.venv/bin:$PATH"
export PATH

# --------------------------------------------------------------------------
# Concurrency guard
# --------------------------------------------------------------------------

# Only one restart may stop/start the service at a time.  The lock is released
# when this script exits, so the started service must NOT inherit file
# descriptor 9 (see start_service); otherwise the running service would hold
# the lock for its whole lifetime and every later restart would be refused.
acquire_lock() {
    if ! command -v flock > /dev/null 2>&1; then
        say "Warning: flock is unavailable, running without a concurrency guard."
        return 0
    fi
    exec 9> "$LOCK_FILE" || die "cannot open lock file: $LOCK_FILE"
    flock -n 9 || die "another restart operation is already in progress
  lock file: $LOCK_FILE
  inspect the holder with: fuser -v $LOCK_FILE"
}

# --------------------------------------------------------------------------
# Process inspection
# --------------------------------------------------------------------------

proc_cmdline() {
    tr '\0' ' ' < "/proc/$1/cmdline" 2>/dev/null || true
}

proc_cwd() {
    readlink -f "/proc/$1/cwd" 2>/dev/null || true
}

proc_exe() {
    readlink -f "/proc/$1/exe" 2>/dev/null || true
}

# Succeed only for processes belonging to this installation:
#   * the CLI launcher: the virtualenv python running "superset ... runserver"
#   * gunicorn master/workers serving "superset:app" from this directory; they
#     outlive the launcher when somebody killed it directly, and would keep the
#     port bound
# Comparing cwd/exe with APP_DIR keeps other Superset installations on the same
# host out of scope.
is_service_process() {
    _p="$1"
    case "$_p" in
        ''|*[!0-9]*) return 1 ;;
    esac
    [ "$_p" != "$$" ] || return 1
    [ -r "/proc/$_p/cmdline" ] || return 1

    # Cheap discriminator first: this runs for every process in /proc.
    _cmdline="$(proc_cmdline "$_p")"
    case "$_cmdline" in
        *superset*) ;;
        *) return 1 ;;
    esac

    _cwd="$(proc_cwd "$_p")"
    if [ "$_cwd" != "$APP_DIR" ]; then
        case "$_cmdline" in
            *"$APP_DIR/"*) ;;
            *) return 1 ;;
        esac
    fi

    case "$_cmdline" in
        *'superset:app'*) return 0 ;;
    esac

    case "$(proc_exe "$_p")" in
        "$APP_DIR/.venv/bin/"*) ;;
        *) return 1 ;;
    esac
    case "$_cmdline" in
        *'superset'*'runserver'*) return 0 ;;
    esac
    return 1
}

# Print every PID of this installation's service, space separated.
find_service_pids() {
    _found=""
    if [ -f "$PID_FILE" ]; then
        _hint="$(head -n 1 "$PID_FILE" 2>/dev/null || true)"
        if is_service_process "$_hint"; then
            _found=" $_hint"
        fi
    fi
    for _dir in /proc/[0-9]*; do
        _candidate="${_dir##*/}"
        if is_service_process "$_candidate"; then
            case "$_found " in
                *" $_candidate "*) ;;
                *) _found="$_found $_candidate" ;;
            esac
        fi
    done
    printf '%s' "${_found# }"
}

# Print the launcher PID, which is the process to record in the PID file.
# /proc is scanned in lexicographic order, so the first match is not
# necessarily the launcher.
find_launcher_pid() {
    for _p in $1; do
        case "$(proc_cmdline "$_p")" in
            *'superset:app'*) ;;
            *'runserver'*) printf '%s' "$_p"; return 0 ;;
        esac
    done
    return 1
}

# Extract the bind port from a gunicorn command line ("-b host:port").
detect_port_from_pids() {
    for _p in $1; do
        _value="$(proc_cmdline "$_p")"
        case "$_value" in
            *" -b "*)
                _value="${_value#* -b }"
                _value="${_value%% *}"
                _value="${_value##*:}"
                case "$_value" in
                    ''|*[!0-9]*) ;;
                    *) printf '%s' "$_value"; return 0 ;;
                esac
                ;;
        esac
    done
    return 1
}

port_is_open() {
    "$PYTHON_BIN" - "$1" > /dev/null 2>&1 <<'PY'
import socket
import sys

sock = socket.socket()
sock.settimeout(2)
try:
    sock.connect(('127.0.0.1', int(sys.argv[1])))
finally:
    sock.close()
PY
}

# --------------------------------------------------------------------------
# Stopping
# --------------------------------------------------------------------------

# Print descendants before their parent, so gunicorn and its workers are
# stopped before the launcher.  Recursion runs in a subshell because POSIX sh
# has no function-local variables.
descendants_of() {
    _children="$(pgrep -P "$1" 2>/dev/null || true)"
    for _child in $_children; do
        (descendants_of "$_child")
        printf '%s\n' "$_child"
    done
}

none_alive() {
    for _p in $1; do
        if kill -0 "$_p" 2>/dev/null; then
            return 1
        fi
    done
    return 0
}

stop_process_tree() {
    _tree="$(descendants_of "$1") $1"

    for _p in $_tree; do
        kill -TERM "$_p" 2>/dev/null || true
    done

    # Bounded grace period before force-killing whatever is left.
    _waited=0
    while [ "$_waited" -lt "$STOP_TIMEOUT" ]; do
        if none_alive "$_tree"; then
            return 0
        fi
        sleep 1
        _waited=$((_waited + 1))
    done

    say "Grace period expired, sending SIGKILL to the remaining processes."
    for _p in $_tree; do
        kill -KILL "$_p" 2>/dev/null || true
    done
    sleep 1
}

stop_service() {
    _pids="$(find_service_pids)"
    if [ -z "$_pids" ]; then
        say "No running Superset process found for $APP_DIR."
        rm -f "$PID_FILE"
        return 0
    fi

    # Remember the port while the old processes still exist, so the readiness
    # check below works even when SERVICE_PORT is not configured.
    if [ -z "$KNOWN_PORT" ]; then
        KNOWN_PORT="$(detect_port_from_pids "$_pids" || true)"
    fi

    for _p in $_pids; do
        if kill -0 "$_p" 2>/dev/null; then
            say "Stopping Superset process $_p ..."
            stop_process_tree "$_p"
        fi
    done

    _left="$(find_service_pids)"
    [ -z "$_left" ] || die "these processes could not be stopped: $_left"
    rm -f "$PID_FILE"

    # A lingering listening socket would make the new gunicorn fail to bind.
    if [ -n "$KNOWN_PORT" ]; then
        _waited=0
        while [ "$_waited" -lt 10 ] && port_is_open "$KNOWN_PORT"; do
            sleep 1
            _waited=$((_waited + 1))
        done
    fi
    say "Stopped."
}

# --------------------------------------------------------------------------
# Starting
# --------------------------------------------------------------------------

show_log_tail() {
    say "----- last $1 lines of $LOG_FILE -----"
    tail -n "$1" "$LOG_FILE" 2>/dev/null || true
    say "--------------------------------------"
}

prepare_log() {
    _log_dir="$(dirname "$LOG_FILE")"
    mkdir -p "$_log_dir" || die "cannot create log directory: $_log_dir"
    touch "$LOG_FILE" || die "cannot write to log file: $LOG_FILE"
}

# Rotate while the service is stopped, otherwise the old process keeps writing
# into the renamed file.
rotate_log_if_needed() {
    [ "$LOG_MAX_MB" -gt 0 ] || return 0
    [ -f "$LOG_FILE" ] || return 0
    _size_mb=$(( $(wc -c < "$LOG_FILE") / 1048576 ))
    [ "$_size_mb" -ge "$LOG_MAX_MB" ] || return 0

    _index="$LOG_KEEP"
    while [ "$_index" -gt 1 ]; do
        _previous=$((_index - 1))
        if [ -f "$LOG_FILE.$_previous" ]; then
            mv -f "$LOG_FILE.$_previous" "$LOG_FILE.$_index"
        fi
        _index="$_previous"
    done
    mv -f "$LOG_FILE" "$LOG_FILE.1"
    touch "$LOG_FILE"
    say "Log reached ${_size_mb}MB and was rotated to $LOG_FILE.1"
}

# Wait until the service accepts connections.  Returns 0 when ready, 1 when the
# service exited during startup, 2 on timeout, 3 when no port could be found.
wait_until_ready() {
    _bg_pid="$1"
    _waited=0
    _port="${SERVICE_PORT:-$KNOWN_PORT}"
    while [ "$_waited" -lt "$START_TIMEOUT" ]; do
        _pids="$(find_service_pids)"
        if [ -z "$_pids" ]; then
            # Give the launcher a few seconds to show up in /proc first.
            if [ "$_waited" -ge 3 ] && ! kill -0 "$_bg_pid" 2>/dev/null; then
                return 1
            fi
        else
            if [ -z "$_port" ]; then
                _port="$(detect_port_from_pids "$_pids" || true)"
                KNOWN_PORT="$_port"
            fi
            if [ -n "$_port" ] && port_is_open "$_port"; then
                KNOWN_PORT="$_port"
                return 0
            fi
        fi
        sleep 1
        _waited=$((_waited + 1))
    done
    [ -n "$_port" ] || return 3
    return 2
}

start_service() {
    _running="$(find_service_pids)"
    [ -z "$_running" ] || \
        die "Superset is already running (PID $_running); use 'restart' instead."

    prepare_log
    rotate_log_if_needed

    _port="${SERVICE_PORT:-$KNOWN_PORT}"
    if [ -n "$_port" ] && port_is_open "$_port"; then
        die "port $_port is still in use by another process."
    fi

    if [ "$DEBUG_MODE" -eq 1 ]; then
        say "Starting Superset with the Flask debug server (-d)."
        set -- runserver -d
    else
        set -- runserver
    fi

    printf '\n[%s] Starting Superset (%s)\n' \
        "$(date '+%Y-%m-%d %H:%M:%S %Z')" "$*" >> "$LOG_FILE"

    PYTHONUNBUFFERED=1
    export PYTHONUNBUFFERED

    # ``9>&-`` closes the restart lock in the child, so the service does not
    # keep it held.  ``setsid`` detaches the service from the SSH session, so
    # logging out cannot signal gunicorn.
    if command -v setsid > /dev/null 2>&1; then
        setsid nohup "$PYTHON_BIN" "$SUPERSET_BIN" "$@" \
            >> "$LOG_FILE" 2>&1 < /dev/null 9>&- &
    else
        nohup "$PYTHON_BIN" "$SUPERSET_BIN" "$@" \
            >> "$LOG_FILE" 2>&1 < /dev/null 9>&- &
    fi
    _bg_pid=$!

    say "Waiting for Superset to become ready (up to ${START_TIMEOUT}s) ..."
    _result=0
    wait_until_ready "$_bg_pid" || _result=$?

    _pids="$(find_service_pids)"
    _launcher="$(find_launcher_pid "$_pids" || true)"
    if [ -n "$_launcher" ]; then
        printf '%s\n' "$_launcher" > "$PID_FILE"
    fi

    case "$_result" in
        0)
            say "Superset started successfully (PID ${_launcher:-unknown}, port $KNOWN_PORT)."
            say "Logs: $LOG_FILE"
            ;;
        1)
            rm -f "$PID_FILE"
            show_log_tail 40
            die "Superset exited during startup; see $LOG_FILE for the traceback."
            ;;
        2)
            show_log_tail 40
            die "Superset did not answer on port $KNOWN_PORT within ${START_TIMEOUT}s."
            ;;
        *)
            say "Superset is running (PID ${_launcher:-unknown}), but no listening port was detected."
            say "Set SERVICE_PORT=<port> to enable the readiness check."
            say "Logs: $LOG_FILE"
            ;;
    esac
}

# --------------------------------------------------------------------------
# Status
# --------------------------------------------------------------------------

show_status() {
    _pids="$(find_service_pids)"
    if [ -z "$_pids" ]; then
        say "Superset is NOT running (directory: $APP_DIR)."
        return 3
    fi
    say "Superset is running (directory: $APP_DIR)."
    for _p in $_pids; do
        printf '  PID %-7s %s\n' "$_p" "$(proc_cmdline "$_p" | cut -c1-110)"
    done
    _port="${SERVICE_PORT:-$(detect_port_from_pids "$_pids" || true)}"
    if [ -n "$_port" ]; then
        if port_is_open "$_port"; then
            say "Port $_port: accepting connections."
        else
            say "Port $_port: NOT accepting connections."
        fi
    fi
    say "Logs: $LOG_FILE"
}

# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

case "$ACTION" in
    status)
        _status=0
        show_status || _status=$?
        exit "$_status"
        ;;
    stop)
        acquire_lock
        stop_service
        ;;
    start)
        acquire_lock
        start_service
        ;;
    restart)
        acquire_lock
        stop_service
        start_service
        ;;
esac
