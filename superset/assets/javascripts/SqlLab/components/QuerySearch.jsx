import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import Select from 'react-select';
import QueryTable from './QueryTable';
import { now, epochTimeXHoursAgo,
  epochTimeXDaysAgo, epochTimeXYearsAgo } from '../../modules/dates';
import { STATUS_OPTIONS, TIME_OPTIONS } from '../constants';
import AsyncSelect from '../../components/AsyncSelect';
import { t } from '../../locales';
import { normalizeSelectValue } from '../../components/selectUtils';

const $ = window.$ = require('jquery');

const propTypes = {
  actions: PropTypes.object.isRequired,
  height: PropTypes.string.isRequired,
};

function QuerySearch(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(QuerySearch.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = QuerySearch.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    userLoading: false,
    userOptions: [],
    databaseId: null,
    userId: null,
    searchText: null,
    from: '28 days ago',
    to: 'now',
    status: 'success',
    queriesArray: [],
    queriesLoading: true
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
  function onUserClicked(userId) {
    updateState({
      userId
    }, () => {
      refreshQueries();
    });
  }
  function onDbClicked(dbId) {
    updateState({
      databaseId: dbId
    }, () => {
      refreshQueries();
    });
  }
  function onChange(db) {
    const val = db ? db.value : null;
    updateState({
      databaseId: val
    });
  }
  function getTimeFromSelection(selection) {
    switch (selection) {
      case 'now':
        return now();
      case '1 hour ago':
        return epochTimeXHoursAgo(1);
      case '1 day ago':
        return epochTimeXDaysAgo(1);
      case '7 days ago':
        return epochTimeXDaysAgo(7);
      case '28 days ago':
        return epochTimeXDaysAgo(28);
      case '90 days ago':
        return epochTimeXDaysAgo(90);
      case '1 year ago':
        return epochTimeXYearsAgo(1);
      default:
        return null;
    }
  }
  function changeFrom(user) {
    const val = user ? user.value : null;
    updateState({
      from: val
    });
  }
  function changeTo(status) {
    const val = status ? status.value : null;
    updateState({
      to: val
    });
  }
  function changeUser(user) {
    const val = user ? user.value : null;
    updateState({
      userId: val
    });
  }
  function insertParams(baseUrl, params) {
    const validParams = params.filter(function (p) {
      return p !== '';
    });
    return baseUrl + '?' + validParams.join('&');
  }
  function changeStatus(status) {
    const val = status ? status.value : null;
    updateState({
      status: val
    });
  }
  function changeSearch(event) {
    updateState({
      searchText: event.target.value
    });
  }
  function userLabel(user) {
    if (user.first_name && user.last_name) {
      return user.first_name + ' ' + user.last_name;
    }
    return user.username;
  }
  function userMutator(data) {
    const options = [];
    for (let i = 0; i < data.pks.length; i++) {
      options.push({
        value: data.pks[i],
        label: userLabel(data.result[i])
      });
    }
    return options;
  }
  function dbMutator(data) {
    const options = data.result.map(db => ({
      value: db.id,
      label: db.database_name
    }));
    propsRef.current.actions.setDatabases(data.result);
    if (data.result.length === 0) {
      propsRef.current.actions.addAlert({
        variant: 'danger',
        msg: t('It seems you don\'t have access to any database')
      });
    }
    return options;
  }
  function refreshQueries() {
    updateState({
      queriesLoading: true
    });
    const params = [stateRef.current.userId ? `user_id=${stateRef.current.userId}` : '', stateRef.current.databaseId ? `database_id=${stateRef.current.databaseId}` : '', stateRef.current.searchText ? `search_text=${stateRef.current.searchText}` : '', stateRef.current.status ? `status=${stateRef.current.status}` : '', stateRef.current.from ? `from=${getTimeFromSelection(stateRef.current.from)}` : '', stateRef.current.to ? `to=${getTimeFromSelection(stateRef.current.to)}` : ''];
    const url = insertParams('/superset/search_queries', params);
    $.getJSON(url, (data, status) => {
      if (status === 'success') {
        updateState({
          queriesArray: data,
          queriesLoading: false
        });
      }
    });
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    refreshQueries();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const fromOptions = TIME_OPTIONS.slice(1).map(value => ({
    value,
    label: value
  }));
  const toOptions = TIME_OPTIONS.map(value => ({
    value,
    label: value
  }));
  const statusOptions = STATUS_OPTIONS.map(value => ({
    value,
    label: value
  }));
  return <div>
        <div id="search-header" className="row space-1">
          <div className="col-sm-2">
            <AsyncSelect dataEndpoint="/users/api/read" mutator={userMutator} value={stateRef.current.userId} onChange={changeUser} />
          </div>
          <div className="col-sm-2">
            <AsyncSelect onChange={onChange} dataEndpoint="/databaseasync/api/read?_flt_0_expose_in_sqllab=1" value={stateRef.current.databaseId} mutator={dbMutator} />
          </div>
          <div className="col-sm-4">
            <input type="text" onChange={changeSearch} className="form-control form-control-sm" placeholder={t('Search Results')} />
          </div>
          <div className="col-sm-4 search-date-filter-container">
            <Select classNamePrefix="Select" name="select-from" placeholder={t('[From]-')} options={fromOptions} value={normalizeSelectValue(stateRef.current.from, fromOptions)} onChange={changeFrom} />

            <Select classNamePrefix="Select" name="select-to" placeholder={t('[To]-')} options={toOptions} value={normalizeSelectValue(stateRef.current.to, toOptions)} onChange={changeTo} />

            <Select classNamePrefix="Select" name="select-status" placeholder={t('[Query Status]')} options={statusOptions} value={normalizeSelectValue(stateRef.current.status, statusOptions)} isLoading={false} onChange={changeStatus} />

            <Button size="sm" variant="success" onClick={refreshQueries}>
              {t('Search')}
            </Button>
          </div>
        </div>
        {stateRef.current.queriesLoading ? <img className="loading" alt="Loading..." src="/static/assets/images/loading.gif" /> : <div className="scrollbar-container">
              <div className="scrollbar-content" style={{
        height: propsRef.current.height
      }}>
                <QueryTable columns={['state', 'db', 'user', 'time', 'progress', 'rows', 'sql', 'querylink']} onUserClicked={onUserClicked} onDbClicked={onDbClicked} queries={stateRef.current.queriesArray} actions={propsRef.current.actions} />
              </div>
            </div>}
      </div>;
}


QuerySearch.propTypes = propTypes;
export default QuerySearch;
