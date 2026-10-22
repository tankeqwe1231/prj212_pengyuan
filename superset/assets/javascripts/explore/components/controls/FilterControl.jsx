import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'react-bootstrap';
import Filter from './Filter';
import { t } from '../../../locales';

const $ = window.$ = require('jquery');

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.array,
  datasource: PropTypes.object,
};

const defaultProps = {
  onChange: () => {},
  value: [],
};

function FilterControl(incomingProps) {
  const props = { ...incomingProps };
  Object.keys(FilterControl.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = FilterControl.defaultProps[key];
  });
  const propsRef = useRef(props);
  propsRef.current = props;
  const [state, setState] = useState(() => ({
    filters: props.value.map(() => ({
      valuesLoading: false,
      valueChoices: []
    })),
    activeRequest: null
  }));
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
  function fetchFilterValues(index, column) {
    const datasource = propsRef.current.datasource;
    const col = column || propsRef.current.value[index].col;
    const having = propsRef.current.name === 'having_filters';
    if (col && propsRef.current.datasource && propsRef.current.datasource.filter_select && !having) {
      updateState(prevState => {
        const newStateFilters = Object.assign([], prevState.filters);
        newStateFilters[index].valuesLoading = true;
        return {
          filters: newStateFilters
        };
      });
      // if there is an outstanding request to fetch values, cancel it.
      if (stateRef.current.activeRequest) {
        stateRef.current.activeRequest.abort();
      }
      updateState({
        activeRequest: $.ajax({
          type: 'GET',
          url: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
          success: data => {
            updateState(prevState => {
              const newStateFilters = Object.assign([], prevState.filters);
              newStateFilters[index] = {
                valuesLoading: false,
                valueChoices: data
              };
              return {
                filters: newStateFilters,
                activeRequest: null
              };
            });
          }
        })
      });
    }
  }
  function addFilter() {
    const newFilters = Object.assign([], propsRef.current.value);
    const col = propsRef.current.datasource && propsRef.current.datasource.filterable_cols.length > 0 ? propsRef.current.datasource.filterable_cols[0][0] : null;
    newFilters.push({
      col,
      op: 'in',
      val: propsRef.current.datasource.filter_select ? [] : ''
    });
    propsRef.current.onChange(newFilters);
    const nextIndex = stateRef.current.filters.length;
    updateState(prevState => {
      const newStateFilters = Object.assign([], prevState.filters);
      newStateFilters.push({
        valuesLoading: false,
        valueChoices: []
      });
      return {
        filters: newStateFilters
      };
    });
    fetchFilterValues(nextIndex, col);
  }
  function changeFilter(index, control, value) {
    const newFilters = Object.assign([], propsRef.current.value);
    const modifiedFilter = Object.assign({}, newFilters[index]);
    if (typeof control === 'string') {
      modifiedFilter[control] = value;
    } else {
      control.forEach((c, i) => {
        modifiedFilter[c] = value[i];
      });
    }
    // Clear selected values and refresh upon column change
    if (control === 'col') {
      if (modifiedFilter.val.constructor === Array) {
        modifiedFilter.val = [];
      } else if (typeof modifiedFilter.val === 'string') {
        modifiedFilter.val = '';
      }
      fetchFilterValues(index, value);
    }
    newFilters.splice(index, 1, modifiedFilter);
    propsRef.current.onChange(newFilters);
  }
  function removeFilter(index) {
    propsRef.current.onChange(propsRef.current.value.filter((f, i) => i !== index));
    updateState(prevState => {
      const newStateFilters = Object.assign([], prevState.filters);
      newStateFilters.splice(index, 1);
      return {
        filters: newStateFilters
      };
    });
  }
  // Lifecycle-equivalent mount effect intentionally runs once.
  useLayoutEffect(() => {
    stateRef.current.filters.forEach((filter, index) => fetchFilterValues(index));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const filters = propsRef.current.value.map((filter, i) => <div key={i}>
        <Filter having={propsRef.current.name === 'having_filters'} filter={filter} datasource={propsRef.current.datasource} removeFilter={removeFilter.bind(undefined, i)} changeFilter={changeFilter.bind(undefined, i)} valuesLoading={stateRef.current.filters[i].valuesLoading} valueChoices={stateRef.current.filters[i].valueChoices} />
      </div>);
  return <div className="filter-control">
        {filters}
        <Row className="space-2 filter-add-row">
          <Col md={2} className="filter-add-col">
            <Button id="add-button" variant="outline-secondary" size="sm" onClick={addFilter.bind(undefined)}>
              <i className="fa fa-plus" /> &nbsp; {t('Add Filter')}
            </Button>
          </Col>
        </Row>
      </div>;
}


export default FilterControl;

FilterControl.propTypes = propTypes;
FilterControl.defaultProps = defaultProps;
