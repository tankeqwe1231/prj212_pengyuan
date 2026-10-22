# -*- coding: utf-8 -*-
"""Helpers for exporting pandas DataFrames."""

import io

import pandas as pd


def dataframe_to_excel(df, export_config):
    """Return an xlsx workbook without applying CSV-only options."""
    byte_file = io.BytesIO()
    include_index = not isinstance(df.index, pd.RangeIndex)
    excel_export_options = export_config.get('EXCEL_EXPORT', {}) or {}

    with pd.ExcelWriter(byte_file, engine='xlsxwriter') as writer:
        df.to_excel(
            excel_writer=writer,
            index=include_index,
            **excel_export_options
        )

    return byte_file.getvalue()
