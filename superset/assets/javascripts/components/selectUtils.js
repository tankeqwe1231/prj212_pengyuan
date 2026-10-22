export function normalizeSelectValue(
  value,
  options = [],
  valueKey = 'value',
  labelKey = 'label',
  isMulti = false,
) {
  if (value == null || value === '') {
    return isMulti ? [] : null;
  }

  const values = isMulti && Array.isArray(value) ? value : [value];
  const normalized = values.map((item) => {
    if (item && typeof item === 'object') {
      return item;
    }
    return options.find(option => option[valueKey] === item) || {
      [valueKey]: item,
      [labelKey]: String(item),
    };
  });
  return isMulti ? normalized : normalized[0];
}

export function renderSelectLabel(option, context, optionRenderer, valueRenderer) {
  if (context === 'menu' && optionRenderer) {
    return optionRenderer(option);
  }
  if (context === 'value' && valueRenderer) {
    return valueRenderer(option);
  }
  return option && option.label;
}
