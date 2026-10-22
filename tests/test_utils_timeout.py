import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'utils.py'


class TimeoutError(Exception):
    pass


def load_timeout_class(signal_module):
    module = ast.parse(MODULE_PATH.read_text(encoding='utf-8'))
    timeout_node = next(
        node
        for node in module.body
        if isinstance(node, ast.ClassDef) and node.name == 'timeout'
    )
    isolated_module = ast.Module(body=[timeout_node], type_ignores=[])
    ast.fix_missing_locations(isolated_module)
    namespace = {
        'logging': Mock(),
        'signal': signal_module,
        'SupersetTimeoutException': TimeoutError,
    }
    exec(compile(isolated_module, str(MODULE_PATH), 'exec'), namespace)
    return namespace['timeout']


class TimeoutContextTest(unittest.TestCase):

    def test_is_noop_when_sigalrm_is_unavailable(self):
        timeout_class = load_timeout_class(SimpleNamespace())

        with timeout_class(seconds=30) as context:
            self.assertIsInstance(context, timeout_class)

    def test_sets_and_cancels_alarm_when_supported(self):
        alarms = []
        signal_module = SimpleNamespace(
            SIGALRM=14,
            alarm=alarms.append,
            signal=Mock(),
        )
        timeout_class = load_timeout_class(signal_module)

        with timeout_class(seconds=30):
            self.assertEqual([30], alarms)

        self.assertEqual([30, 0], alarms)


if __name__ == '__main__':
    unittest.main()
