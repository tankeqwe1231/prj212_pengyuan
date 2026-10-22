import importlib.util
from pathlib import Path
import unittest

from sqlalchemy.engine.url import make_url


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'sqlalchemy_uri.py'
SPEC = importlib.util.spec_from_file_location('sqlalchemy_uri', MODULE_PATH)
SQLALCHEMY_URI = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SQLALCHEMY_URI)


class NormalizeSqlalchemyUriTest(unittest.TestCase):

    def test_encodes_raw_at_sign_in_password(self):
        uri = 'mssql+pymssql://user:password@@192.0.2.1/database'

        normalized = SQLALCHEMY_URI.normalize_sqlalchemy_uri(uri)
        parsed = make_url(normalized)

        self.assertEqual(
            'mssql+pymssql://user:password%40@192.0.2.1/database',
            normalized,
        )
        self.assertEqual('password@', parsed.password)
        self.assertEqual('192.0.2.1', parsed.host)

    def test_encodes_every_raw_at_sign_before_host_separator(self):
        uri = 'mysql://user:p@@ss@db.example/database'

        normalized = SQLALCHEMY_URI.normalize_sqlalchemy_uri(uri)
        parsed = make_url(normalized)

        self.assertEqual('p@@ss', parsed.password)
        self.assertEqual('db.example', parsed.host)

    def test_keeps_already_encoded_password_unchanged(self):
        uri = 'mssql+pymssql://user:password%40@192.0.2.1/database'

        self.assertEqual(
            uri,
            SQLALCHEMY_URI.normalize_sqlalchemy_uri(uri),
        )

    def test_password_survives_masked_storage_round_trip(self):
        normalized = SQLALCHEMY_URI.normalize_sqlalchemy_uri(
            'mssql+pymssql://user:password@@192.0.2.1/database',
        )
        submitted = make_url(normalized)
        masked = submitted.set(password='XXXXXXXXXX')
        decrypted = masked.set(password=submitted.password)
        restored = make_url(str(decrypted))

        self.assertEqual('password@', restored.password)
        self.assertEqual('192.0.2.1', restored.host)

    def test_does_not_change_at_sign_outside_authority(self):
        uri = 'mysql://user:password@db.example/database?label=a@b'

        self.assertEqual(
            uri,
            SQLALCHEMY_URI.normalize_sqlalchemy_uri(uri),
        )


if __name__ == '__main__':
    unittest.main()
