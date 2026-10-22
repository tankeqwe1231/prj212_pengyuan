"""Migration regression checks and an opt-in isolated PostgreSQL 18 CLI test.

Set SUPERSET_TEST_POSTGRES_BIN to the PostgreSQL 18 bin directory to run the
integration test. It starts its own temporary server and never uses the
database configured in superset.config.
"""

import io
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import unittest

from alembic import command
from flask import Flask
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine, inspect, text


ROOT = Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / 'superset' / 'migrations'


class MigrationSQLTest(unittest.TestCase):
    def test_revision_sql_uses_public_with_encoded_password(self):
        app = Flask(__name__)
        app.config.update(
            SQLALCHEMY_DATABASE_URI=(
                'postgresql+psycopg2://test:p%25ss%40word@localhost/test'),
            SQLALCHEMY_TRACK_MODIFICATIONS=False,
        )
        db = SQLAlchemy(app)
        migrate = Migrate(app, db, directory=str(MIGRATIONS))
        output = io.StringIO()
        with app.app_context():
            config = migrate.get_config()
            config.output_buffer = output
            command.stamp(config, 'head', sql=True)
            self.assertEqual(app.config['SQLALCHEMY_DATABASE_URI'],
                             config.get_main_option('sqlalchemy.url'))
        sql = output.getvalue()
        self.assertIn('CREATE TABLE public.alembic_version (', sql)
        self.assertIn('INSERT INTO public.alembic_version', sql)
        self.assertIn('20260905_postgresql18', sql)


@unittest.skipUnless(os.environ.get('SUPERSET_TEST_POSTGRES_BIN'),
                     'Set SUPERSET_TEST_POSTGRES_BIN for isolated PostgreSQL 18 tests')
class PostgreSQLInitializationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bin = Path(os.environ['SUPERSET_TEST_POSTGRES_BIN']).resolve()
        cls.env = os.environ.copy()
        cls.env.update(PYTHONUTF8='1', PYTHONDONTWRITEBYTECODE='1')
        cls.env.pop('PGOPTIONS', None)
        cls.env.pop('PGSERVICE', None)
        version = cls.run_process([str(cls.bin / 'postgres'), '--version'])
        if 'PostgreSQL) 18.' not in version:
            raise RuntimeError('The initialization test requires PostgreSQL 18')

        artifact_root = ROOT / '.superset212.initialization-tests'
        artifact_root.mkdir(exist_ok=True)
        cls.temporary = tempfile.TemporaryDirectory(dir=artifact_root)
        cls.directory = Path(cls.temporary.name).resolve()
        if cls.directory.parent != artifact_root.resolve():
            raise RuntimeError('Unexpected temporary database directory')
        cls.addClassCleanup(cls.temporary.cleanup)
        cls.cluster = cls.directory / 'pgdata'
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            cls.port = listener.getsockname()[1]
        cls.run_process([
            str(cls.bin / 'initdb'), '-D', str(cls.cluster), '-U', 'postgres',
            '--auth=trust', '--encoding=UTF8', '--locale=C',
        ])
        cls.addClassCleanup(cls.stop_server)
        cls.run_process([
            str(cls.bin / 'pg_ctl'), '-D', str(cls.cluster),
            '-l', str(cls.directory / 'postgres.log'), '-w', '-t', '30',
            '-o', '-h 127.0.0.1 -p {}'.format(cls.port), 'start',
        ])
        cls.run_process([
            str(cls.bin / 'createdb'), '-h', '127.0.0.1', '-p', str(cls.port),
            '-U', 'postgres', 'superset',
        ])
        cls.uri = 'postgresql+psycopg2://postgres@127.0.0.1:{}/superset'.format(cls.port)
        cls.engine = create_engine(cls.uri)
        cls.addClassCleanup(cls.engine.dispose)

        # Inherit application defaults, but isolate every resource used by
        # these commands and reject any attempted HTTP integration request.
        (cls.directory / 'initialization_test_config.py').write_text('''\
import os
from unittest.mock import patch
from superset.config import *

SQLALCHEMY_DATABASE_URI = os.environ['INITIALIZATION_TEST_URI']
SQLALCHEMY_BINDS = {}
SECRET_KEY = os.environ['INITIALIZATION_TEST_SECRET']
UPLOAD_FOLDER = os.path.join(os.environ['SUPERSET_HOME'], 'uploads')
IMG_UPLOAD_FOLDER = os.path.join(os.environ['SUPERSET_HOME'], 'images')
CACHE_CONFIG = {'CACHE_TYPE': 'null'}
TABLE_NAMES_CACHE_CONFIG = {'CACHE_TYPE': 'null'}
RESULTS_BACKEND = None
CELERY_CONFIG = {'broker_url': 'memory://', 'result_backend': 'cache+memory://'}
ENABLE_TIME_ROTATE = False
BLUEPRINTS = []
ADDITIONAL_MIDDLEWARE = []
FLASK_APP_MUTATOR = None
TESTING = True
WTF_CSRF_ENABLED = True
PUBLIC_ROLE_LIKE_GAMMA = True
FAB_UPDATE_PERMS = True
_http_guard = patch('requests.sessions.Session.request',
                    side_effect=AssertionError('External HTTP is disabled in this test'))
_http_guard.start()
''', encoding='utf-8')
        cls.env.update(
            SUPERSET_CONFIG='initialization_test_config',
            SUPERSET_HOME=str(cls.directory / 'app-data'),
            SUPERSET_UPDATE_PERMS='1',
            INITIALIZATION_TEST_URI=cls.uri,
            INITIALIZATION_TEST_SECRET=secrets.token_hex(32),
            INITIALIZATION_TEST_PASSWORD=secrets.token_hex(16),
            PYTHONPATH=os.pathsep.join((str(cls.directory), str(ROOT))),
        )

    @classmethod
    def run_process(cls, args, input=None):
        # PostgreSQL's background processes can inherit Windows pipe handles.
        # A file lets us wait for pg_ctl itself without waiting for pipe EOF.
        with tempfile.TemporaryFile() as captured:
            result = subprocess.run(
                args, cwd=ROOT, env=cls.env, input=input, stdout=captured,
                stderr=subprocess.STDOUT, text=True, encoding='utf-8',
                errors='replace', timeout=90,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            )
            captured.seek(0)
            output = captured.read().decode('utf-8', errors='replace')
        if result.returncode:
            raise AssertionError('Initialization test process failed:\n' + output)
        return output

    @classmethod
    def stop_server(cls):
        if (cls.cluster / 'postmaster.pid').exists():
            cls.run_process([
                str(cls.bin / 'pg_ctl'), '-D', str(cls.cluster),
                '-m', 'fast', '-w', '-t', '30', 'stop',
            ])

    def cli(self, *args):
        return self.run_process([sys.executable, 'superset/bin/superset', *args])

    def scalar(self, sql):
        with self.engine.connect() as connection:
            return connection.execute(text(sql)).scalar()

    def test_empty_database_to_admin_and_repeatable_role_initialization(self):
        self.run_process([sys.executable, '-c', 'import superset'])
        self.assertEqual([], inspect(self.engine).get_table_names(schema='public'))

        self.cli('db', 'upgrade')
        self.assertEqual('20260905_postgresql18', self.scalar(
            'SELECT version_num FROM public.alembic_version'))
        self.assertEqual(42, len(inspect(self.engine).get_table_names(schema='public')))

        # Click's runner supplies the hidden password prompt without relying
        # on an interactive Windows console or putting a password in argv.
        output = self.run_process([sys.executable, '-c', '''
import os
import sys
from click.testing import CliRunner
from flask.cli import cli
result = CliRunner().invoke(cli, [
    '--app', 'superset:app', 'fab', 'create-admin',
    '--username', 'bootstrap_admin', '--firstname', 'Test', '--lastname', 'Admin',
    '--email', 'bootstrap@example.invalid',
], input=(os.environ['INITIALIZATION_TEST_PASSWORD'] + '\\n') * 2)
print(result.output)
if result.exception:
    raise result.exception
sys.exit(result.exit_code)
'''])
        self.assertIn('Admin User bootstrap_admin created.', output)
        self.assertEqual(1, self.scalar('''
            SELECT count(*) FROM ab_user u
            JOIN ab_user_role ur ON ur.user_id = u.id
            JOIN ab_role r ON r.id = ur.role_id
            WHERE u.username = 'bootstrap_admin' AND r.name = 'Admin'
        '''))
        self.cli('init')
        self.assertEqual(1, self.scalar("SELECT count(*) FROM dbs WHERE database_name = 'main'"))
        self.assertEqual(6, self.scalar('''
            SELECT count(*) FROM ab_role
            WHERE name IN ('Admin', 'Alpha', 'Gamma', 'granter', 'sql_lab', 'Public')
        '''))
        self.assertGreater(self.scalar('SELECT count(*) FROM ab_permission_view_role'), 0)
        self.check_login_and_permissions()
        counts = [self.scalar('SELECT count(*) FROM ' + table) for table in (
            'ab_user', 'ab_role', 'ab_permission', 'ab_view_menu', 'ab_permission_view',
            'ab_permission_view_role', 'dbs')]
        # Reproduce the old initialization's excessive grants. Re-running init
        # must remove these while preserving self-service and custom roles.
        with self.engine.begin() as connection:
            result = connection.execute(text('''
                INSERT INTO ab_permission_view_role (permission_view_id, role_id)
                SELECT pv.id, r.id FROM ab_permission_view pv
                JOIN ab_view_menu v ON v.id = pv.view_menu_id
                CROSS JOIN ab_role r
                WHERE v.name = 'UserCustomModelView'
                  AND r.name IN ('Alpha', 'Gamma', 'Public')
                  AND NOT EXISTS (
                      SELECT 1 FROM ab_permission_view_role existing
                      WHERE existing.permission_view_id = pv.id
                        AND existing.role_id = r.id)
            '''))
            self.assertEqual(24, result.rowcount)
        self.cli('db', 'upgrade')
        self.cli('init')
        self.assertEqual(counts, [self.scalar('SELECT count(*) FROM ' + table) for table in (
            'ab_user', 'ab_role', 'ab_permission', 'ab_view_menu', 'ab_permission_view',
            'ab_permission_view_role', 'dbs')])
        self.check_login_and_permissions()
        self.assertIn('20260905_postgresql18 (head)', self.cli('db', 'current'))
        self.cli('db', 'downgrade', 'base')
        self.assertEqual(['alembic_version'],
                         inspect(self.engine).get_table_names(schema='public'))

    def check_login_and_permissions(self):
        self.run_process([sys.executable, '-c', '''
import base64
from datetime import datetime, timedelta
import os
from bs4 import BeautifulSoup
from flask import url_for
from superset import app, db, security_manager as sm

password = os.environ['INITIALIZATION_TEST_PASSWORD']
with app.app_context():
    for name, role in [('bootstrap_gamma', 'Gamma'), ('bootstrap_alpha', 'Alpha'),
                       ('bootstrap_public', 'Public'), ('bootstrap_expired', 'Gamma')]:
        if not sm.find_user(username=name):
            user = sm.add_user(name, 'Test', 'User', name + '@example.invalid',
                               sm.find_role(role), password)
            assert user
            if name == 'bootstrap_expired':
                user.expire_date = datetime.now() - timedelta(days=1)
                db.session.commit()
    if not sm.find_role('BootstrapCustom'):
        sm.add_role('BootstrapCustom', permissions=[
            sm.find_permission_view_menu('can_list', 'RoleModelView')])
    assert len(sm.find_role('BootstrapCustom').permissions) == 1
    if not sm.find_user(username='bootstrap_custom'):
        assert sm.add_user('bootstrap_custom', 'Test', 'User',
                           'bootstrap_custom@example.invalid',
                           sm.find_role('BootstrapCustom'), password)
    admin_permissions = {
        'can_show', 'can_add', 'can_edit', 'can_list', 'can_delete',
        'can_download', 'resetpasswords',
    }
    personal_permissions = {'can_userinfo', 'resetmypassword', 'userinfoedit'}
    expected = {
        'Admin': admin_permissions | personal_permissions,
        'Alpha': personal_permissions,
        'Gamma': personal_permissions,
        'Public': set(),
        'BootstrapCustom': set(),
    }
    for role_name, permissions in expected.items():
        actual = {pv.permission.name for pv in sm.find_role(role_name).permissions
                  if pv.view_menu.name == 'UserCustomModelView'}
        assert actual == permissions, (role_name, actual)
    admin_id = sm.find_user(username='bootstrap_admin').id

with app.test_request_context():
    role_list = url_for(sm.rolemodelview.__name__ + '.list')
    user_view = sm.userdbmodelview.__name__
    user_management = [url_for(user_view + '.' + method, **params)
                       for method, params in [
                           ('list', {}), ('add', {}),
                           ('show', {'pk': admin_id}), ('edit', {'pk': admin_id}),
                       ]]
    userinfo = url_for(user_view + '.userinfo')
    personal_forms = [url_for(view.__name__ + '.this_form_get') for view in
                      (sm.resetmypasswordview, sm.userinfoeditview)]
anonymous = app.test_client()
assert anonymous.get(role_list).status_code in (302, 403)
for path in user_management + [userinfo]:
    assert anonymous.get(path).status_code in (302, 403), path

for name in ['bootstrap_admin', 'bootstrap_gamma', 'bootstrap_alpha',
             'bootstrap_public', 'bootstrap_custom', 'bootstrap_expired']:
    client = app.test_client()
    page = client.get('/login/')
    token = BeautifulSoup(page.data, 'html.parser').select_one('[name=csrf_token]')['value']
    response = client.post('/login/', data={
        'csrf_token': token,
        'username': base64.b64encode(name.encode()).decode(),
        'password': base64.b64encode(password.encode()).decode(),
    })
    assert response.status_code == 302
    with client.session_transaction() as session:
        assert bool(session.get('_user_id')) == (name != 'bootstrap_expired'), name
    result = client.get(role_list)
    if name in ('bootstrap_admin', 'bootstrap_custom'):
        assert result.status_code == 200, result.status_code
    else:
        assert result.status_code in (302, 403), (name, result.status_code)
    for path in user_management:
        result = client.get(path)
        if name == 'bootstrap_admin':
            assert result.status_code == 200, (path, result.status_code)
        else:
            assert result.status_code in (302, 403), (name, path, result.status_code)
    result = client.get(userinfo)
    if name in ('bootstrap_admin', 'bootstrap_gamma', 'bootstrap_alpha'):
        assert result.status_code == 200, (name, result.status_code)
        for path in personal_forms:
            assert client.get(path).status_code == 200, (name, path)
    else:
        assert result.status_code in (302, 403), (name, result.status_code)
'''])


if __name__ == '__main__':
    unittest.main()
