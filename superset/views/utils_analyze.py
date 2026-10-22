import pandas as pd
LABELS = {
    "unknown": "未知",
    "daily": "日度",
    "weekly": "周度",
    "monthly": "月度",
    "quarterly": "季度",
    "yearly": "年度",
    "irregular": "不规则",
    "name": "指标名称",
    "frequency": "数据频率",
    "avg_days": "平均间隔天数",
    "latest_value": "最新值",
    "latest_date": "最新日期",
    "mom_change": "月度环比增减",
    "mom_date": "月度环比日期",
    "previous_change": "较上期增减",
    "previous_date": "上期日期",
    "yoy_change": "年同比增减",
    "yoy_pct": "同比百分比",
    "yoy_date": "年同比日期",
    "high_value": "历史最高",
    "high_date": "最高日期",
    "low_value": "历史最低",
    "low_date": "最低日期",
    "range_position": "当前数据区间位置",
}


def detect_frequency(series):
    dates = series.dropna().sort_index().index
    if len(dates) < 2:
        return LABELS["unknown"], None

    avg_days = dates.to_series().diff().dt.days.dropna().mean()

    if avg_days <= 2:
        frequency = LABELS["daily"]
    elif avg_days <= 10:
        frequency = LABELS["weekly"]
    elif avg_days <= 45:
        frequency = LABELS["monthly"]
    elif avg_days <= 120:
        frequency = LABELS["quarterly"]
    elif avg_days <= 450:
        frequency = LABELS["yearly"]
    else:
        frequency = LABELS["irregular"]

    return frequency, round(float(avg_days), 2)


def find_on_or_before(series: pd.Series, target_date: pd.Timestamp):
    candidates = series[series.index <= target_date].dropna()
    if candidates.empty:
        return None, None

    date = candidates.index[-1]
    return date, float(candidates.iloc[-1])


def date_text(date):
    if date is None:
        return None
    return date.date().isoformat()


def pct_change(new_value, old_value):
    if old_value is None or old_value == 0:
        return None
    return f"{(new_value - old_value) / old_value:.2%}"


def round_value(value):
    if value is None:
        return None
    return round(float(value), 6)


def summarize_series(name, raw_series):
    series = raw_series.dropna().sort_index()

    if series.empty:
        return {LABELS["name"]: name, LABELS["frequency"]: LABELS["unknown"]}

    frequency, avg_days = detect_frequency(series)

    latest_date = series.index[-1]
    latest_value = float(series.iloc[-1])

    previous_date = series.index[-2] if len(series) >= 2 else None
    previous_value = float(series.iloc[-2]) if len(series) >= 2 else None

    include_mom = frequency not in (LABELS["quarterly"], LABELS["yearly"])
    include_previous = frequency != LABELS["monthly"]

    if not include_mom:
        mom_date, mom_value = None, None
    elif frequency == LABELS["monthly"]:
        mom_date, mom_value = previous_date, previous_value
    else:
        mom_date, mom_value = find_on_or_before(series, latest_date - pd.DateOffset(months=1))

    yoy_date, yoy_value = find_on_or_before(series, latest_date - pd.DateOffset(years=1))

    high_date = series.idxmax()
    low_date = series.idxmin()
    high_value = float(series.loc[high_date])
    low_value = float(series.loc[low_date])

    if high_value == low_value:
        range_position = 1.0
    else:
        range_position = (latest_value - low_value) / (high_value - low_value)

    previous_change = latest_value - previous_value if previous_value is not None else None
    mom_change = latest_value - mom_value if mom_value is not None else None
    yoy_change = latest_value - yoy_value if yoy_value is not None else None

    def _set_if_valid(d, key, value):
        """仅当 value 不为 None 时写入字典"""
        if value is not None:
            d[key] = value

    result = {
        LABELS["name"]: name,
        LABELS["frequency"]: frequency,
    }

    _set_if_valid(result, LABELS["avg_days"], avg_days)
    _set_if_valid(result, LABELS["latest_value"], round_value(latest_value))
    _set_if_valid(result, LABELS["latest_date"], date_text(latest_date))

    if yoy_change is not None:
        _set_if_valid(result, LABELS["yoy_change"], f"{yoy_change:.6g}")
    _set_if_valid(result, LABELS["yoy_pct"], pct_change(latest_value, yoy_value))
    _set_if_valid(result, LABELS["yoy_date"], date_text(yoy_date))

    _set_if_valid(result, LABELS["high_value"], round_value(high_value))
    _set_if_valid(result, LABELS["high_date"], date_text(high_date))
    _set_if_valid(result, LABELS["low_value"], round_value(low_value))
    _set_if_valid(result, LABELS["low_date"], date_text(low_date))

    if high_value != low_value:
        _set_if_valid(result, LABELS["range_position"], f"{range_position:.2%}")

    if include_mom and mom_change is not None:
        _set_if_valid(result, LABELS["mom_change"], f"{mom_change:.6g}")
        _set_if_valid(result, LABELS["mom_date"], date_text(mom_date))

    if include_previous:
        _set_if_valid(result, LABELS["previous_change"], round_value(previous_change))
        _set_if_valid(result, LABELS["previous_date"], date_text(previous_date))

    return result