"""Load the index data manage helper modules without importing ``superset``."""
import importlib
from pathlib import Path
import sys
import types

PACKAGE_NAME = '_index_data_views'
VIEWS_DIR = Path(__file__).parents[1] / 'superset' / 'views'


def load_module(name):
    if PACKAGE_NAME not in sys.modules:
        package = types.ModuleType(PACKAGE_NAME)
        package.__path__ = [str(VIEWS_DIR)]
        sys.modules[PACKAGE_NAME] = package
    return importlib.import_module('{}.{}'.format(PACKAGE_NAME, name))


class FakeResult(object):

    def __init__(self, rows=None, scalar=None, rowcount=None):
        self._rows = rows or []
        self._scalar = scalar
        self.rowcount = len(self._rows) if rowcount is None else rowcount

    def fetchall(self):
        return list(self._rows)

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def scalar(self):
        return self._scalar


class FakeConnection(object):
    """Record executed statements; ``responder(sql, params)`` returns results."""

    def __init__(self, responder):
        self.responder = responder
        self.statements = []

    def execute(self, sql, params=None):
        self.statements.append((sql, params))
        return self.responder(sql, params) or FakeResult()
