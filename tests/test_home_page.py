import ast
import json
from pathlib import Path
import unittest
from unittest.mock import Mock

from flask import Flask, Response, request
import requests


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'views' / 'core.py'


def load_home_page():
    # Load the view without importing Superset or accessing configured services.
    tree = ast.parse(MODULE_PATH.read_text(encoding='utf-8'))
    view = next(node for node in tree.body
                if isinstance(node, ast.ClassDef) and node.name == 'Superset')
    method = next(node for node in view.body
                  if isinstance(node, ast.FunctionDef) and node.name == 'home_page')
    method.decorator_list = []
    success = next(node for node in tree.body
                   if isinstance(node, ast.FunctionDef) and node.name == 'json_success')
    module = ast.Module(body=[success, method], type_ignores=[])
    namespace = {
        'config': {
            'FENGYUN_PUBLIC_API': 'https://market.example.invalid/api',
            'API_TOKEN': 'isolated-test-token',
        },
        'json': json,
        'json_error_response': lambda message, status=500: Response(
            json.dumps({'error': message}), status=status,
            mimetype='application/json'),
        'logging': Mock(),
        'request': request,
        'requests': Mock(RequestException=requests.RequestException),
        'Response': Response,
        'print': Mock(),
    }
    exec(compile(module, str(MODULE_PATH), 'exec'), namespace)
    return namespace['home_page'], namespace


class HomePageMarketDataTest(unittest.TestCase):

    def setUp(self):
        self.app = Flask(__name__)
        self.home_page, self.namespace = load_home_page()
        self.post = self.namespace['requests'].post
        self.upstream = self.post.return_value

    def fetch(self):
        with self.app.test_request_context('/superset/home_page/', method='POST', json={
            'action': 'get_risefallcount_treemap_data',
            'token': 'untrusted-client-token',
        }):
            return self.home_page(object())

    def assert_safe_failure(self, response):
        self.assertEqual(502, response.status_code)
        self.assertEqual({'error': '获取数据失败，请稍后重试'}, response.get_json())
        self.namespace['logging'].warning.assert_called_once()
        log_output = str(self.namespace['logging'].mock_calls)
        self.assertNotIn(self.namespace['config']['API_TOKEN'], log_output)
        self.assertNotIn(self.namespace['config']['FENGYUN_PUBLIC_API'], log_output)

    def test_posts_configured_token_and_returns_lists_unchanged(self):
        data = {
            'riseFallData': [{
                'trade_time': '2026-10-13 09:00:00',
                'rise_count_presettle': 12,
                'fall_count_presettle': 8,
            }],
            'snapshotData': [{'underlying_symbol': '玉米', 'change_pct': 1.2}],
        }
        self.upstream.json.return_value = data

        response = self.fetch()

        self.assertEqual(200, response.status_code)
        self.assertEqual(data, response.get_json())
        self.post.assert_called_once_with(
            self.namespace['config']['FENGYUN_PUBLIC_API'],
            json={'token': 'isolated-test-token',
                  'action': 'get_risefallcount_treemap_data'},
            timeout=30,
        )

    def test_accepts_empty_lists(self):
        data = {'riseFallData': [], 'snapshotData': []}
        self.upstream.json.return_value = data

        response = self.fetch()

        self.assertEqual(200, response.status_code)
        self.assertEqual(data, response.get_json())

    def test_timeout_returns_safe_error(self):
        self.post.side_effect = requests.Timeout(
            self.namespace['config']['FENGYUN_PUBLIC_API'])

        self.assert_safe_failure(self.fetch())

    def test_http_error_does_not_return_upstream_body(self):
        self.upstream.raise_for_status.side_effect = requests.HTTPError(
            self.namespace['config']['API_TOKEN'])

        self.assert_safe_failure(self.fetch())
        self.upstream.json.assert_not_called()

    def test_invalid_json_returns_safe_error(self):
        self.upstream.json.side_effect = requests.exceptions.JSONDecodeError(
            'Invalid JSON', '<html>error</html>', 0)

        self.assert_safe_failure(self.fetch())

    def test_rejects_missing_or_non_list_data(self):
        for data in (None, [], {}, {'error': 'upstream error'},
                     {'riseFallData': [], 'snapshotData': None},
                     {'riseFallData': '[]', 'snapshotData': []}):
            with self.subTest(data=data):
                self.namespace['logging'].reset_mock()
                self.upstream.json.return_value = data

                self.assert_safe_failure(self.fetch())


if __name__ == '__main__':
    unittest.main()
