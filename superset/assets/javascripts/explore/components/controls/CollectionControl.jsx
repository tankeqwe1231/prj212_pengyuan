import React from 'react';
import PropTypes from 'prop-types';
import shortid from 'shortid';

import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import SortableList from '../../../components/SortableList';
import ControlHeader from '../ControlHeader';
import controlMap from './';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  placeholder: PropTypes.string,
  addTooltip: PropTypes.string,
  itemGenerator: PropTypes.func,
  keyAccessor: PropTypes.func,
  onChange: PropTypes.func,
  value: PropTypes.array,
  controlName: PropTypes.string.isRequired,
};

function moveItem(items, oldIndex, newIndex) {
  const nextItems = items.slice();
  nextItems.splice(newIndex, 0, nextItems.splice(oldIndex, 1)[0]);
  return nextItems;
}

function CollectionControl(props) {
  const {
    addTooltip = 'Add an item',
    itemGenerator = () => ({ key: shortid.generate() }),
    keyAccessor = o => o.key,
    onChange = () => {},
    placeholder = 'Empty collection',
    value = [],
  } = props;
  const Control = controlMap[props.controlName];
  const changeItem = (index, itemValue) => {
    const nextValue = value.slice();
    nextValue[index] = { ...nextValue[index], ...itemValue };
    onChange(nextValue);
  };
  const content = value.length === 0 ? (
    <div className="text-muted">{placeholder}</div>
  ) : (
    <SortableList
      items={value}
      keyAccessor={keyAccessor}
      onMove={(oldIndex, newIndex) => onChange(moveItem(value, oldIndex, newIndex))}
    >
      {(item, index) => {
        const itemProps = { ...item };
        delete itemProps.key;
        return (
          <React.Fragment>
          <div className="float-start m-r-5">
            <i className="fa fa-bars text-primary" style={{ cursor: 'grab' }} />
          </div>
          <div className="float-start">
            <Control
              key={keyAccessor(item)}
              {...itemProps}
              onChange={itemValue => changeItem(index, itemValue)}
            />
          </div>
          <div className="float-end">
            <InfoTooltipWithTrigger
              variant="primary"
              icon="times"
              label="remove-item"
              onClick={() => onChange(value.filter((item, itemIndex) => index !== itemIndex))}
              tooltip="remove item"
            />
          </div>
          </React.Fragment>
        );
      }}
    </SortableList>
  );

  return (
    <div className="collection-control">
      <ControlHeader {...props} />
      {content}
      <div className="collection-control-add-item">
        <InfoTooltipWithTrigger
          addTooltip={addTooltip}
          variant="primary"
          className="fa-lg"
          icon="plus-circle"
          label="add-item"
          onClick={() => onChange(value.concat([itemGenerator()]))}
          tooltip={addTooltip}
        />
      </div>
    </div>
  );
}

CollectionControl.propTypes = propTypes;

export default CollectionControl;
