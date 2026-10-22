from types import SimpleNamespace
import unittest

import sqlalchemy as sa
from sqlalchemy.dialects import mssql

from superset.connectors.sqla.models import _resolve_orderby_expression


class SqlaOrderByExpressionTest(unittest.TestCase):

    def test_non_ascii_column_name_compiles_for_mssql(self):
        column_name = '指标日期'
        datasource_column = SimpleNamespace(
            sqla_col=sa.column(column_name).label(column_name),
        )
        expression = _resolve_orderby_expression(
            column_name,
            {column_name: datasource_column},
            {},
        )

        # The timestamp expression selected by a timeseries query is labelled
        # ``__timestamp``; the original column is therefore not a selected
        # label and must be rendered as an identifier in ORDER BY.
        statement = sa.select([sa.column('__timestamp')]).order_by(
            sa.desc(expression),
        )
        sql = str(statement.compile(dialect=mssql.dialect()))

        self.assertIn('ORDER BY', sql)
        self.assertNotIn('Textual SQL expression', sql)
        self.assertIn('[指标日期]', sql)

    def test_metric_name_is_resolved_before_sorting(self):
        metric_name = '销售额'
        metric = SimpleNamespace(
            sqla_col=sa.literal_column('SUM([amount])').label(metric_name),
        )

        expression = _resolve_orderby_expression(
            metric_name,
            {},
            {metric_name: metric},
        )

        self.assertIs(expression, metric.sqla_col)


if __name__ == '__main__':
    unittest.main()
