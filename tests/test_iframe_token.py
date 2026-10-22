import ast
import base64
from datetime import datetime
import json
from pathlib import Path
import unittest

from superset.aes_utils import aes_decrypt, aes_encrypt


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'viz.py'
TEST_CONFIG = {
    'AES_KEY': base64.b64encode(b'a' * 32).decode('ascii'),
}


def load_token_builder():
    tree = ast.parse(MODULE_PATH.read_text(encoding='utf-8'))
    builder = next(
        node for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name == 'build_iframe_access_token'
    )
    isolated_module = ast.Module(body=[builder], type_ignores=[])
    ast.fix_missing_locations(isolated_module)
    namespace = {
        'json': json,
        'aes_encrypt': aes_encrypt,
    }
    exec(compile(isolated_module, str(MODULE_PATH), 'exec'), namespace)
    return namespace['build_iframe_access_token']


class IFrameAccessTokenTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.build_token = load_token_builder()

    def test_skips_token_when_disabled(self):
        now = datetime(2026, 10, 16, 14, 3, 5)

        self.assertIsNone(type(self).build_token(False, TEST_CONFIG, now))
        self.assertIsNone(type(self).build_token(None, TEST_CONFIG, now))

    def test_encrypts_app_and_second_precision_time(self):
        now = datetime(2026, 10, 16, 14, 3, 5, 987654)

        token = type(self).build_token(True, TEST_CONFIG, now)
        plain_text = aes_decrypt(token, TEST_CONFIG)

        self.assertEqual(
            '{"app":"market_flash_zijin", "issuance_time":"2026-10-16 14:03:05"}',
            plain_text,
        )
        self.assertNotIn('987654', plain_text)

    def test_issues_a_new_ciphertext_each_time(self):
        now = datetime(2026, 10, 16, 14, 3, 5)

        first = type(self).build_token(True, TEST_CONFIG, now)
        second = type(self).build_token(True, TEST_CONFIG, now)

        self.assertNotEqual(first, second)
        self.assertEqual(
            aes_decrypt(first, TEST_CONFIG),
            aes_decrypt(second, TEST_CONFIG),
        )


if __name__ == '__main__':
    unittest.main()
