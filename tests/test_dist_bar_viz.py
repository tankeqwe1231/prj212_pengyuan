from datetime import date
import unittest

import pandas as pd


class DistBarGroupbySumCompatTest(unittest.TestCase):
    """MSSQL DATE breakdowns differ by OS under pymssql; dist_bar must tolerate both."""

    def _frame(self, month_values):
        return pd.DataFrame({
            'strike': [3000, 3000, 3100],
            'option_type': ['C', 'P', 'C'],
            'month': month_values,
            'SUM(volume)': [1.0, 2.0, 4.0],
        })

    def test_legacy_sum_all_columns_fails_on_linux_dates(self):
        df = self._frame([date(2026, 9, 1), date(2026, 9, 1), date(2026, 10, 1)])

        with self.assertRaises(TypeError):
            df.groupby(['strike']).sum()

    def test_metric_only_sum_works_with_linux_dates(self):
        df = self._frame([date(2026, 9, 1), date(2026, 9, 1), date(2026, 10, 1)])

        row = df.groupby(['strike'])['SUM(volume)'].sum().sort_values(ascending=False)

        self.assertEqual([3100, 3000], row.index.tolist())
        self.assertEqual([4.0, 3.0], row.tolist())

    def test_metric_only_sum_works_with_windows_date_strings(self):
        df = self._frame(['2026-09-01', '2026-09-01', '2026-10-01'])

        row = df.groupby(['strike'])['SUM(volume)'].sum().sort_values(ascending=False)

        self.assertEqual([3100, 3000], row.index.tolist())
        self.assertEqual([4.0, 3.0], row.tolist())

    def test_pivot_with_date_breakdown_still_works(self):
        df = self._frame([date(2026, 9, 1), date(2026, 9, 1), date(2026, 10, 1)])

        pt = df.pivot_table(
            index=['strike'],
            columns=['option_type', 'month'],
            values=['SUM(volume)'],
        )

        self.assertEqual(3.0, float(pt.loc[3000].sum()))
        self.assertEqual(4.0, float(pt.loc[3100].sum()))


if __name__ == '__main__':
    unittest.main()
