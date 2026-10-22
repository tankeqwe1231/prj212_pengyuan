/* global notify */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import Select, { createFilter } from 'react-select';
import ReactAsyncSelect from 'react-select/async';

import TableElement from './TableElement';
import AsyncSelect from '../../components/AsyncSelect';
import WindowedMenuList from '../../components/WindowedMenuList';
import { normalizeSelectValue } from '../../components/selectUtils';
import { t } from '../../locales';

const $ = window.$ = require('jquery');
const tableFilterOption = createFilter({ ignoreAccents: false });
const windowedComponents = { MenuList: WindowedMenuList };

function renderDatabaseValue(option) {
  return <div><span className="text-muted">{t('Database:')}</span> {option.label}</div>;
}

function renderSchemaOption(option, meta) {
  return meta.context === 'value'
    ? <div><span className="text-muted">{t('Schema:')}</span> {option.label}</div>
    : option.label;
}

const propTypes = {
  queryEditor: PropTypes.object.isRequired,
  height: PropTypes.number.isRequired,
  tables: PropTypes.array,
  actions: PropTypes.object,
  database: PropTypes.object,
};

const defaultProps = {
  tables: [],
  actions: {},
};

function SqlEditorLeftBar(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SqlEditorLeftBar.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SqlEditorLeftBar.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    schemaLoading: false,
    schemaOptions: [],
    tableLoading: false,
    tableOptions: []
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
  const selectTableRef = useRef(null);
  function onDatabaseChange(db) {
    const val = db ? db.value : null;
    updateState({
      schemaOptions: []
    });
    propsRef.current.actions.queryEditorSetSchema(propsRef.current.queryEditor, null);
    propsRef.current.actions.queryEditorSetDb(propsRef.current.queryEditor, val);
    if (!db) {
      updateState({
        tableOptions: []
      });
    } else {
      fetchTables(val, propsRef.current.queryEditor.schema);
      fetchSchemas(val);
    }
  }
  function getTableNamesBySubStr(input) {
    if (!propsRef.current.queryEditor.dbId || !input) {
      return Promise.resolve([]);
    }
    const url = `/superset/tables/${propsRef.current.queryEditor.dbId}/` + `${propsRef.current.queryEditor.schema}/${input}`;
    return $.get(url).then(data => data.options);
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
  function resetState() {
    propsRef.current.actions.resetState();
  }
  function fetchTables(dbId, schema, substr) {
    // This can be large so it shouldn't be put in the Redux store
    if (dbId && schema) {
      updateState({
        tableLoading: true,
        tableOptions: []
      });
      const url = `/superset/tables/${dbId}/${schema}/${substr}/`;
      $.get(url).done(data => {
        updateState({
          tableLoading: false,
          tableOptions: data.options,
          tableLength: data.tableLength
        });
      }).fail(() => {
        updateState({
          tableLoading: false,
          tableOptions: [],
          tableLength: 0
        });
        notify.error(t('Error while fetching table list'));
      });
    } else {
      updateState({
        tableLoading: false,
        tableOptions: []
      });
    }
  }
  function changeTable(tableOpt) {
    if (!tableOpt) {
      updateState({
        tableName: ''
      });
      return;
    }
    const namePieces = tableOpt.value.split('.');
    let tableName = namePieces[0];
    let schemaName = propsRef.current.queryEditor.schema;
    if (namePieces.length === 1) {
      updateState({
        tableName
      });
    } else {
      schemaName = namePieces[0];
      tableName = namePieces[1];
      updateState({
        tableName
      });
      propsRef.current.actions.queryEditorSetSchema(propsRef.current.queryEditor, schemaName);
      fetchTables(propsRef.current.queryEditor.dbId, schemaName);
    }
    propsRef.current.actions.addTable(propsRef.current.queryEditor, tableName, schemaName);
  }
  function changeSchema(schemaOpt) {
    const schema = schemaOpt ? schemaOpt.value : null;
    propsRef.current.actions.queryEditorSetSchema(propsRef.current.queryEditor, schema);
    fetchTables(propsRef.current.queryEditor.dbId, schema);
  }
  function fetchSchemas(dbId) {
    const actualDbId = dbId || propsRef.current.queryEditor.dbId;
    if (actualDbId) {
      updateState({
        schemaLoading: true
      });
      const url = `/superset/schemas/${actualDbId}/`;
      $.get(url).done(data => {
        const schemaOptions = data.schemas.map(s => ({
          value: s,
          label: s
        }));
        updateState({
          schemaOptions,
          schemaLoading: false
        });
      }).fail(() => {
        updateState({
          schemaLoading: false,
          schemaOptions: []
        });
        notify.error(t('Error while fetching schema list'));
      });
    }
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    fetchSchemas(propsRef.current.queryEditor.dbId);
    fetchTables(propsRef.current.queryEditor.dbId, propsRef.current.queryEditor.schema);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const shouldShowReset = window.location.search === '?reset=1';
  const tableMetaDataHeight = propsRef.current.height - 130; // 130 is the height of the selects above
  let tableSelectPlaceholder;
  let tableSelectDisabled = false;
  if (propsRef.current.database && propsRef.current.database.allow_multi_schema_metadata_fetch) {
    tableSelectPlaceholder = t('Type to search ...');
  } else {
    tableSelectPlaceholder = t('Select table ');
    tableSelectDisabled = true;
  }
  return <div className="clearfix sql-toolbar">
        <div>
          <AsyncSelect dataEndpoint={'/databaseasync/api/' + 'read?_flt_0_expose_in_sqllab=1&' + '_oc_DatabaseAsync=database_name&' + '_od_DatabaseAsync=asc'} onChange={onDatabaseChange.bind(undefined)} onAsyncError={() => notify.error(t('Error while fetching database list'))} value={propsRef.current.queryEditor.dbId} databaseId={propsRef.current.queryEditor.dbId} actions={propsRef.current.actions} valueRenderer={renderDatabaseValue} mutator={dbMutator.bind(undefined)} placeholder={t('Select a database')} autoSelect />
        </div>
        <div className="m-t-5">
          <Select classNamePrefix="Select" components={windowedComponents} name="select-schema" placeholder={t('Select a schema (%s)', stateRef.current.schemaOptions.length)} options={stateRef.current.schemaOptions} value={normalizeSelectValue(propsRef.current.queryEditor.schema, stateRef.current.schemaOptions)} formatOptionLabel={renderSchemaOption} isLoading={stateRef.current.schemaLoading} onChange={changeSchema.bind(undefined)} />
        </div>
        <div className="m-t-5">
          {propsRef.current.queryEditor.schema && <Select name="select-table" ref={ref => {
        selectTableRef.current = ref;
      }} classNamePrefix="Select" components={windowedComponents} isLoading={stateRef.current.tableLoading} placeholder={t('Add a table (%s)', stateRef.current.tableOptions.length)} onChange={changeTable.bind(undefined)} filterOption={tableFilterOption} options={stateRef.current.tableOptions} />}
          {!propsRef.current.queryEditor.schema && <ReactAsyncSelect name="async-select-table" ref={ref => {
        selectTableRef.current = ref;
      }} classNamePrefix="Select" components={windowedComponents} placeholder={tableSelectPlaceholder} isDisabled={tableSelectDisabled} onChange={changeTable.bind(undefined)} loadOptions={getTableNamesBySubStr.bind(undefined)} />}
        </div>
        <hr />
        <div className="m-t-5">
          <div className="scrollbar-container">
            <div className="scrollbar-content" style={{
          height: tableMetaDataHeight
        }}>
              {propsRef.current.tables.map(table => <TableElement table={table} key={table.id} actions={propsRef.current.actions} />)}
            </div>
          </div>
        </div>
        {shouldShowReset && <Button size="sm" variant="danger" onClick={resetState.bind(undefined)}>
            <i className="fa fa-bomb" /> {t('Reset State')}
          </Button>}
      </div>;
}


SqlEditorLeftBar.propTypes = propTypes;
SqlEditorLeftBar.defaultProps = defaultProps;

export default SqlEditorLeftBar;
