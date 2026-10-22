import d3 from 'd3';
import dist from 'distributions';

import React, { useRef, useState } from 'react';
import { renderReact } from '../javascripts/modules/reactRoot';
import PropTypes from 'prop-types';

import AppTable from '../javascripts/components/AppTable/AppTable';
import './paired_ttest.css';

const legacySort = sortFunction => (left, right, columnId) => (
  sortFunction(left.getValue(columnId), right.getValue(columnId))
);

function TTestTable(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TTestTable.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TTestTable.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => computeTTestValues(props, 0));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  function getLiftStatus(row) {
    // Get a css class name for coloring
    if (row === stateRef.current.control) {
      return 'control';
    }
    const liftVal = stateRef.current.liftValues[row];
    if (isNaN(liftVal) || !isFinite(liftVal)) {
      return 'invalid'; // infinite or NaN values
    }
    return liftVal >= 0 ? 'true' : 'false'; // green on true, red on false
  }
  function getPValueStatus(row) {
    if (row === stateRef.current.control) {
      return 'control';
    }
    const pVal = stateRef.current.pValues[row];
    if (isNaN(pVal) || !isFinite(pVal)) {
      return 'invalid';
    }
    return ''; // p-values won't normally be colored
  }
  function getSignificance(row) {
    // Color significant as green, else red
    if (row === stateRef.current.control) {
      return 'control';
    }
    // p-values significant below set threshold
    return stateRef.current.pValues[row] <= propsRef.current.alpha;
  }
  function computeTTest(control) {
    updateState(computeTTestValues(propsRef.current, control));
  }
  propsRef.current = props;
  const data = propsRef.current.data;
  const metric = propsRef.current.metric;
  const groups = propsRef.current.groups;
  const rows = data.map((entry, index) => {
    const row = {
      index,
      liftValue: stateRef.current.liftValues[index],
      pValue: stateRef.current.pValues[index],
      significant: getSignificance(index),
    };
    groups.forEach((group, groupIndex) => { row[group] = entry.group[groupIndex]; });
    return row;
  });
  // When sorted ascending, 'control' will always be at top
  const columns = groups.map(group => ({
    accessorKey: group,
    enableSorting: true,
    header: group,
  })).concat([{
    accessorKey: 'pValue',
    enableSorting: true,
    header: 'p-value',
    sortFn: legacySort((a, b) => {
      if (a === 'control') {
        return -1;
      }
      if (b === 'control') {
        return 1;
      }
      return a > b ? 1 : -1; // p-values ascending
    })
  }, {
    accessorKey: 'liftValue',
    enableSorting: true,
    header: 'Lift %',
    sortFn: legacySort((a, b) => {
      if (a === 'control') {
        return -1;
      }
      if (b === 'control') {
        return 1;
      }
      return parseFloat(a) > parseFloat(b) ? -1 : 1; // lift values descending
    })
  }, {
    accessorKey: 'significant',
    enableSorting: true,
    header: 'Significant',
    sortFn: legacySort((a, b) => {
      if (a === 'control') {
        return -1;
      }
      if (b === 'control') {
        return 1;
      }
      return a > b ? -1 : 1; // significant values first
    })
  }]);
  return <div>
        <h3>{metric}</h3>
        <AppTable
          className="table"
          columns={columns}
          data={rows}
          getCellProps={(cell) => {
            const rowIndex = cell.row.original.index;
            if (cell.column.id === 'pValue') return { className: getPValueStatus(rowIndex) };
            if (cell.column.id === 'liftValue') return { className: getLiftStatus(rowIndex) };
            if (cell.column.id === 'significant') return { className: String(getSignificance(rowIndex)) };
            return {};
          }}
          getRowId={row => String(row.index)}
          getRowProps={row => ({
            className: row.original.index === stateRef.current.control ? 'control' : '',
            onClick: () => computeTTest(row.original.index),
          })}
          id={`table_${metric}`}
        />
      </div>;
}

function computeTTestValues(props, control) {
  const { data, liftValPrec, pValPrec } = props;
  const pValues = [];
  const liftValues = [];
  if (!data || !data[control]) {
    return { pValues, liftValues, control };
  }
  const computeLift = (values, controlValues) => {
    let sumValues = 0;
    let sumControl = 0;
    for (let i = 0; i < values.length; i++) {
      sumValues += values[i].y;
      sumControl += controlValues[i].y;
    }
    return ((sumValues - sumControl) / sumControl * 100).toFixed(liftValPrec);
  };
  const computePValue = (values, controlValues) => {
    let diffSum = 0;
    let diffSqSum = 0;
    let finiteCount = 0;
    for (let i = 0; i < values.length; i++) {
      const diff = controlValues[i].y - values[i].y;
      if (global.isFinite(diff)) {
        finiteCount++;
        diffSum += diff;
        diffSqSum += diff * diff;
      }
    }
    const tvalue = -Math.abs(diffSum * Math.sqrt((finiteCount - 1) / (finiteCount * diffSqSum - diffSum * diffSum)));
    try {
      return (2 * new dist.Studentt(finiteCount - 1).cdf(tvalue)).toFixed(pValPrec);
    } catch (err) {
      return NaN;
    }
  };
  for (let i = 0; i < data.length; i++) {
    if (i === control) {
      pValues.push('control');
      liftValues.push('control');
    } else {
      pValues.push(computePValue(data[i].values, data[control].values));
      liftValues.push(computeLift(data[i].values, data[control].values));
    }
  }
  return { pValues, liftValues, control };
}



TTestTable.propTypes = {
  metric: PropTypes.string.isRequired,
  groups: PropTypes.array.isRequired,
  data: PropTypes.array.isRequired,
  alpha: PropTypes.number.isRequired,
  liftValPrec: PropTypes.number.isRequired,
  pValPrec: PropTypes.number.isRequired,
};
TTestTable.defaultProps = {
  metric: '',
  groups: [],
  data: [],
  alpha: 0.05,
  liftValPrec: 4,
  pValPrec: 6,
};
export { TTestTable };

function pairedTTestVis(slice, payload) {
  const div = d3.select(slice.selector);
  const container = slice.container;
  const height = slice.container.height();
  const fd = slice.formData;
  const data = payload.data;
  const alpha = fd.significance_level;
  const pValPrec = fd.pvalue_precision;
  const liftValPrec = fd.liftvalue_precision;
  const tables = fd.metrics.map((metric, i) => ( // create a table for each metric
    <TTestTable
      key={i}
      metric={metric}
      groups={fd.groupby}
      data={data[metric]}
      alpha={alpha}
      pValPrec={pValPrec > 32 ? 32 : pValPrec}
      liftValPrec={liftValPrec > 32 ? 32 : liftValPrec}
    />
  ));
  div.html('');
  renderReact(
    <div className="row">
      <div className="col-sm-12">
        <div className="paired-ttest-table scrollbar-container">
          <div className="scrollbar-content">
            {tables}
          </div>
        </div>
      </div>
    </div>,
    div.node(),
  );
  container.find('.scrollbar-container').css('max-height', height);
}

export default pairedTTestVis;
