from pathlib import Path
import unittest


SOURCE_PATH = (
    Path(__file__).parents[1]
    / 'superset'
    / 'connectors'
    / 'sqla'
    / 'views.py'
)


class TableModelViewRelationshipFilterTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.source = SOURCE_PATH.read_text(encoding='utf-8')

    def test_edit_form_filters_slices_by_table_datasource(self):
        self.assertIn(
            "['datasource_id', FilterEqualFunction, _current_table_id]",
            self.source,
        )
        self.assertIn(
            "['datasource_type', FilterEqual, 'table']",
            self.source,
        )

    def test_table_id_callback_does_not_fallback_to_all_slices(self):
        self.assertIn("return -1", self.source)


if __name__ == '__main__':
    unittest.main()
