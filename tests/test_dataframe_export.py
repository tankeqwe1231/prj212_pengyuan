import importlib.util
import io
from pathlib import Path
import unittest

import pandas as pd


MODULE_PATH = Path(__file__).parents[1] / 'superset' / 'dataframe_export.py'
SPEC = importlib.util.spec_from_file_location('dataframe_export', MODULE_PATH)
DATAFRAME_EXPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DATAFRAME_EXPORT)


class DataframeExcelExportTest(unittest.TestCase):

    def test_csv_encoding_is_not_passed_to_excel_writer(self):
        dataframe = pd.DataFrame({
            '指标名称': ['示例指标'],
            '指标分类': ['玉米'],
        })
        export_config = {
            'CSV_EXPORT': {'encoding': 'gbk'},
            'EXCEL_EXPORT': {},
        }

        workbook = DATAFRAME_EXPORT.dataframe_to_excel(
            dataframe,
            export_config,
        )
        restored = pd.read_excel(io.BytesIO(workbook))

        pd.testing.assert_frame_equal(dataframe, restored)

    def test_non_range_index_is_included(self):
        dataframe = pd.DataFrame(
            {'value': [10]},
            index=pd.Index(['row-1'], name='row'),
        )

        workbook = DATAFRAME_EXPORT.dataframe_to_excel(dataframe, {})
        restored = pd.read_excel(io.BytesIO(workbook), index_col='row')

        pd.testing.assert_frame_equal(dataframe, restored)


if __name__ == '__main__':
    unittest.main()
