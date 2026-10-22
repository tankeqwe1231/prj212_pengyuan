import React, { forwardRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, FormLabel, Popover } from 'react-bootstrap';

import { AGGREGATES } from '../constants';
import { t } from '../../locales';
import OnPasteSelect from '../../components/OnPasteSelect';
import WindowedMenuList from '../../components/WindowedMenuList';
import { normalizeSelectValue } from '../../components/selectUtils';
import AdhocMetricEditPopoverTitle from './AdhocMetricEditPopoverTitle';
import columnType from '../propTypes/columnType';
import AdhocMetric from '../AdhocMetric';
import ColumnOption from '../../components/ColumnOption';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  datasourceType: PropTypes.string,
};

const selectProps = {
  isMulti: false,
  name: 'select-column',
  isClearable: true,
  components: { MenuList: WindowedMenuList },
};

function formatColumnOption(column, meta) {
  return meta.context === 'menu'
    ? <ColumnOption column={column} showType />
    : column.column_name;
}

function formatAggregateOption(aggregate) {
  return aggregate.aggregate;
}

const AdhocMetricEditPopover = forwardRef(function AdhocMetricEditPopoverWithRef({
  adhocMetric,
  onChange,
  onClose,
  columns = [],
  datasourceType,
  ...popoverProps
}, ref) {
  const [editedMetric, setEditedMetric] = useState(adhocMetric);

  const onColumnChange = column => setEditedMetric(currentMetric => (
    currentMetric.duplicateWith({ column })
  ));
  const onAggregateChange = aggregate => setEditedMetric(currentMetric => (
    currentMetric.duplicateWith({ aggregate: aggregate && aggregate.aggregate })
  ));
  const onLabelChange = event => setEditedMetric(currentMetric => (
    currentMetric.duplicateWith({
      label: event.target.value,
      hasCustomLabel: true,
    })
  ));
  const onSave = () => {
    onChange(editedMetric);
    onClose();
  };

  const columnSelectProps = {
    placeholder: t('%s column(s)', columns.length),
    options: columns,
    value: normalizeSelectValue(
      editedMetric.column,
      columns,
      'column_name',
      'column_name',
    ),
    onChange: onColumnChange,
    formatOptionLabel: formatColumnOption,
    getOptionLabel: column => column.column_name,
    valueKey: 'column_name',
  };
  const aggregateOptions = Object.keys(AGGREGATES).map(aggregate => ({ aggregate }));
  const aggregateSelectProps = {
    placeholder: t('%s aggregates(s)', Object.keys(AGGREGATES).length),
    options: aggregateOptions,
    value: normalizeSelectValue(
      editedMetric.aggregate,
      aggregateOptions,
      'aggregate',
      'aggregate',
    ),
    onChange: onAggregateChange,
    formatOptionLabel: formatAggregateOption,
    getOptionLabel: aggregate => aggregate.aggregate,
    valueKey: 'aggregate',
  };
  if (datasourceType === 'druid') {
    aggregateSelectProps.options = aggregateSelectProps.options
      .filter(option => option.aggregate !== 'AVG');
  }

  const stateIsValid = editedMetric.column && editedMetric.aggregate;
  const hasUnsavedChanges = !editedMetric.equals(adhocMetric);

  return (
    <Popover
      id="metrics-edit-popover"
      ref={ref}
      {...popoverProps}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
    >
      <Popover.Header as="h3">
        <AdhocMetricEditPopoverTitle
          adhocMetric={editedMetric}
          onChange={onLabelChange}
        />
      </Popover.Header>
      <Popover.Body>
        <FormGroup className="mb-3">
          <FormLabel><strong>column</strong></FormLabel>
          <OnPasteSelect {...selectProps} {...columnSelectProps} />
        </FormGroup>
        <FormGroup className="mb-3">
          <FormLabel><strong>aggregate</strong></FormLabel>
          <OnPasteSelect {...selectProps} {...aggregateSelectProps} />
        </FormGroup>
        <Button
          disabled={!stateIsValid}
          variant={hasUnsavedChanges && stateIsValid ? 'primary' : 'outline-secondary'}
          size="sm"
          className="m-r-5"
          onClick={onSave}
        >
          Save
        </Button>
        <Button size="sm" variant="outline-secondary" onClick={onClose}>Close</Button>
      </Popover.Body>
    </Popover>
  );
});

AdhocMetricEditPopover.propTypes = propTypes;

export default AdhocMetricEditPopover;
