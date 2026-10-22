import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { isEqual, isEmpty } from 'underscore';

import TooltipWrapper from './TooltipWrapper';
import { controls } from '../explore/stores/controls';
import ModalTrigger from './ModalTrigger';
import { t } from '../locales';
import AppTable from './AppTable/AppTable';

const propTypes = {
  origFormData: PropTypes.object.isRequired,
  currentFormData: PropTypes.object.isRequired,
};

function AlteredSliceTag(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(AlteredSliceTag.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = AlteredSliceTag.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => (() => {
    const diffs = getDiffs(props);
    return {
      diffs,
      hasDiffs: !isEmpty(diffs)
    };
  })());
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
  function getDiffs(props) {
    // Returns all properties that differ in the
    // current form data and the saved form data
    const ofd = props.origFormData;
    const cfd = props.currentFormData;
    const fdKeys = Object.keys(cfd);
    const diffs = {};
    for (const fdKey of fdKeys) {
      // Ignore values that are undefined/nonexisting in either
      if (!ofd[fdKey] && !cfd[fdKey]) {
        continue;
      }
      if (!isEqual(ofd[fdKey], cfd[fdKey])) {
        diffs[fdKey] = {
          before: ofd[fdKey],
          after: cfd[fdKey]
        };
      }
    }
    return diffs;
  }
  function formatValue(value, key) {
    // Format display value based on the control type
    // or the value type
    if (value === undefined) {
      return 'N/A';
    } else if (value === null) {
      return 'null';
    } else if (controls[key] && controls[key].type === 'FilterControl') {
      if (!value.length) {
        return '[]';
      }
      return value.map(v => {
        const filterVal = v.val.constructor === Array ? `[${v.val.join(', ')}]` : v.val;
        return `${v.col} ${v.op} ${filterVal}`;
      }).join(', ');
    } else if (controls[key] && controls[key].type === 'BoundsControl') {
      return `Min: ${value[0]}, Max: ${value[1]}`;
    } else if (controls[key] && controls[key].type === 'CollectionControl') {
      return value.map(v => JSON.stringify(v)).join(', ');
    } else if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    } else if (value.constructor === Array) {
      return value.length ? value.join(', ') : '[]';
    } else if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return JSON.stringify(value);
  }
  function getRows() {
    const diffs = stateRef.current.diffs;
    const rows = [];
    for (const key in diffs) {
      rows.push({
        after: formatValue(diffs[key].after, key),
        before: formatValue(diffs[key].before, key),
        control: controls[key] && controls[key].label || key,
        key,
      });
    }
    return rows;
  }
  function renderModalBody() {
    const columns = [
      { accessorKey: 'control', enableSorting: true, header: 'Control' },
      { accessorKey: 'before', enableSorting: true, header: 'Before' },
      { accessorKey: 'after', enableSorting: true, header: 'After' },
    ];
    return <AppTable
      className="table"
      columns={columns}
      data={getRows()}
      getRowId={row => row.key}
    />;
  }
  function renderTriggerNode() {
    return <span className="badge text-bg-warning m-l-5" style={{
      fontSize: '12px'
    }}>
        <TooltipWrapper label="difference" tooltip={t('Click to see difference')}>
          <span>{t('Altered')}</span>
        </TooltipWrapper>
      </span>;
  }
  function receiveProps(newProps) {
    // Update differences if need be
    if (isEqual(propsRef.current, newProps)) {
      return;
    }
    const diffs = getDiffs(newProps);
    updateState({
      diffs,
      hasDiffs: !isEmpty(diffs)
    });
  }
  const previousIncomingPropsRef = useRef(incomingProps);
  const incomingKeys = Object.keys(incomingProps);
  const previousIncomingProps = previousIncomingPropsRef.current;
  const incomingPropsChanged = incomingKeys.length !== Object.keys(previousIncomingProps).length || incomingKeys.some(key => incomingProps[key] !== previousIncomingProps[key]);
  if (incomingPropsChanged) {
    receiveProps(props);
    previousIncomingPropsRef.current = incomingProps;
  }
  propsRef.current = props;
  // Return nothing if there are no differences
  if (!stateRef.current.hasDiffs) {
    return null;
  }
  // Render the label-warning 'Altered' tag which the user may
  // click to open a modal containing a table summarizing the
  // differences in the slice
  return <ModalTrigger animation triggerNode={renderTriggerNode()} modalTitle={t('Slice changes')} size="lg" modalBody={renderModalBody()} />;
}


export default AlteredSliceTag;

AlteredSliceTag.propTypes = propTypes;
