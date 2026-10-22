"""Session regression tests without importing Superset or accessing a database."""

import ast
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from flask import Flask
from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.sqla.models import User
from flask_appbuilder.security.views import AuthDBView
from flask_login import current_user, login_required
from flask_login.utils import encode_cookie


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'security.py'


def load_security_manager():
    # Load the actual class while avoiding Superset's application startup.
    tree = ast.parse(MODULE_PATH.read_text(encoding='utf-8'))
    manager = next(
        node for node in tree.body
        if isinstance(node, ast.ClassDef)
        and node.name == 'SupersetSecurityManager'
    )
    isolated_module = ast.Module(body=[manager], type_ignores=[])
    namespace = {
        'SecurityManager': SecurityManager,
        'UserCustom': User,
        'UserCustomModelView': None,
        'RoleCustomModelView': None,
        'AuthDBViewCustom': AuthDBView,
    }
    exec(compile(isolated_module, str(MODULE_PATH), 'exec'), namespace)
    return namespace['SupersetSecurityManager']


SUPERSET_SECURITY_MANAGER = load_security_manager()


class SecuritySessionTest(unittest.TestCase):

    def setUp(self):
        self.manager = object.__new__(SUPERSET_SECURITY_MANAGER)
        self.manager.get_user_by_id = Mock(return_value=None)
        self.app = Flask(__name__)
        self.app.config.update(
            TESTING=True,
            SECRET_KEY='isolated-session-regression-test-key',
        )
        self.manager.create_login_manager(self.app)
        self.app.before_request(self.manager.before_request)
        self.app.add_url_rule('/login/', 'login', lambda: 'login')
        self.app.add_url_rule(
            '/protected', 'protected',
            login_required(lambda: current_user.get_id()),
        )

        # Exercise FAB's real logout endpoint with its normal user loader.
        auth_view = AuthDBView()
        auth_view.appbuilder = SimpleNamespace(
            app=self.app, get_url_for_index='/login/',
        )
        self.app.add_url_rule('/logout/', 'logout', auth_view.logout)
        self.client = self.app.test_client()

    def set_session_user(self, user_id):
        with self.client.session_transaction() as session:
            session['_user_id'] = user_id
            session['_fresh'] = True

    def test_missing_user_is_anonymous(self):
        self.assertIsNone(self.manager.load_user('42'))
        self.manager.get_user_by_id.assert_called_once_with(42)

    def test_invalid_user_id_is_anonymous_without_query(self):
        for user_id in (None, '', 'invalid', '1.5', [], {}):
            with self.subTest(user_id=user_id):
                self.assertIsNone(self.manager.load_user(user_id))
        self.manager.get_user_by_id.assert_not_called()

    def test_inactive_user_is_anonymous(self):
        self.manager.get_user_by_id.return_value = User(id=42, active=False)
        self.assertIsNone(self.manager.load_user('42'))

    def test_active_user_is_preserved(self):
        user = User(id=42, active=True)
        self.manager.get_user_by_id.return_value = user
        self.assertIs(user, self.manager.load_user('42'))

    def test_database_errors_are_not_hidden_as_anonymous(self):
        self.manager.get_user_by_id.side_effect = RuntimeError('test database error')
        with self.assertRaisesRegex(RuntimeError, 'test database error'):
            self.manager.load_user('42')

    def test_anonymous_request_requires_login(self):
        response = self.client.get('/protected')
        self.assertEqual(302, response.status_code)
        self.assertTrue(response.location.startswith('/login/'))
        self.manager.get_user_by_id.assert_not_called()

    def test_stale_session_redirects_to_login(self):
        self.set_session_user('42')
        response = self.client.get('/protected', follow_redirects=True)
        self.assertEqual(200, response.status_code)
        self.assertEqual(b'login', response.data)
        self.assertEqual(302, response.history[0].status_code)

    def test_malformed_session_redirects_to_login(self):
        self.set_session_user('invalid')
        response = self.client.get('/protected')
        self.assertEqual(302, response.status_code)
        self.assertTrue(response.location.startswith('/login/'))
        self.manager.get_user_by_id.assert_not_called()

    def test_inactive_session_redirects_to_login(self):
        self.manager.get_user_by_id.return_value = User(id=42, active=False)
        self.set_session_user('42')
        response = self.client.get('/protected')
        self.assertEqual(302, response.status_code)
        self.assertTrue(response.location.startswith('/login/'))

    def test_active_session_still_authenticates(self):
        self.manager.get_user_by_id.return_value = User(id=42, active=True)
        self.set_session_user('42')
        response = self.client.get('/protected')
        self.assertEqual(200, response.status_code)
        self.assertEqual(b'42', response.data)

    def test_logout_with_stale_session_succeeds(self):
        self.set_session_user('42')
        response = self.client.get('/logout/')
        self.assertEqual(302, response.status_code)
        self.assertEqual('/login/', response.location)
        with self.client.session_transaction() as session:
            self.assertNotIn('_user_id', session)

    def test_stale_remember_cookie_requires_login(self):
        with self.app.app_context():
            cookie = encode_cookie('42')
        self.client.set_cookie('remember_token', cookie)
        response = self.client.get('/protected')
        self.assertEqual(302, response.status_code)
        self.assertTrue(response.location.startswith('/login/'))


if __name__ == '__main__':
    unittest.main()
