import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { ButtonGroup, Card, Collapse } from 'react-bootstrap';

import CopyToClipboard from '../../components/CopyToClipboard';
import Link from './Link';
import ColumnElement from './ColumnElement';
import ModalTrigger from '../../components/ModalTrigger';
import Loading from '../../components/Loading';
import { t } from '../../locales';

const propTypes = {
  table: PropTypes.object,
  actions: PropTypes.object,
  timeout: PropTypes.number,  // used for tests
};

const defaultProps = {
  actions: {},
  table: null,
  timeout: 500,
};

function TableElement(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(TableElement.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = TableElement.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    sortColumns: false,
    expanded: true
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
  function toggleTable(e) {
    e.preventDefault();
    if (propsRef.current.table.expanded) {
      propsRef.current.actions.collapseTable(propsRef.current.table);
    } else {
      propsRef.current.actions.expandTable(propsRef.current.table);
    }
  }
  function removeTable() {
    updateState({
      expanded: false
    });
    propsRef.current.actions.removeDataPreview(propsRef.current.table);
  }
  function toggleSortColumns() {
    updateState({
      sortColumns: !stateRef.current.sortColumns
    });
  }
  function removeFromStore() {
    propsRef.current.actions.removeTable(propsRef.current.table);
  }
  function renderWell() {
    const table = propsRef.current.table;
    let header;
    if (table.partitions) {
      let partitionQuery;
      let partitionClipBoard;
      if (table.partitions.partitionQuery) {
        partitionQuery = table.partitions.partitionQuery;
        const tt = t('Copy partition query to clipboard');
        partitionClipBoard = <CopyToClipboard text={partitionQuery} shouldShowText={false} tooltipText={tt} copyNode={<i className="fa fa-clipboard" />} />;
      }
      let latest = [];
      for (const k in table.partitions.latest) {
        latest.push(`${k}=${table.partitions.latest[k]}`);
      }
      latest = latest.join('/');
      header = <Card className="bg-light mb-2"><Card.Body className="p-2">
          <div>
            <small>
              {t('latest partition:')} {latest}
            </small> {partitionClipBoard}
          </div>
        </Card.Body></Card>;
    }
    return header;
  }
  function renderControls() {
    let keyLink;
    const table = propsRef.current.table;
    if (table.indexes && table.indexes.length > 0) {
      keyLink = <ModalTrigger modalTitle={<div>
              {t('Keys for table')} <strong>{table.name}</strong>
            </div>} modalBody={table.indexes.map((ix, i) => <pre key={i}>{JSON.stringify(ix, null, '  ')}</pre>)} triggerNode={<Link className="fa fa-key float-start" tooltip={t('View keys & indexes (%s)', table.indexes.length)} />} />;
    }
    return <ButtonGroup className="ws-el-controls float-end">
        {keyLink}
        <Link className={`fa fa-sort-${!stateRef.current.sortColumns ? 'alpha' : 'numeric'}-asc ` + 'float-start sort-cols'} onClick={toggleSortColumns.bind(undefined)} tooltip={!stateRef.current.sortColumns ? t('Sort columns alphabetically') : t('Original table column order')} href="#" />
        {table.selectStar && <CopyToClipboard copyNode={<a className="fa fa-clipboard float-start" />} text={table.selectStar} shouldShowText={false} tooltipText={t('Copy SELECT statement to clipboard')} />}
        <Link className="fa fa-times table-remove float-start" onClick={removeTable.bind(undefined)} tooltip={t('Remove table preview')} href="#" />
      </ButtonGroup>;
  }
  function renderHeader() {
    const table = propsRef.current.table;
    return <div className="clearfix">
        <div className="float-start">
          <a href="#" className="table-name" onClick={e => {
          toggleTable(e);
        }}>
            <strong>{table.name}</strong>
            <small className="m-l-5">
              <i className={`fa fa-${table.expanded ? 'minus' : 'plus'}-square-o`} />
            </small>
          </a>
        </div>
        <div className="float-end">
          {table.isMetadataLoading || table.isExtraMetadataLoading ? <Loading size={20} /> : renderControls()}
        </div>
      </div>;
  }
  function renderBody() {
    const table = propsRef.current.table;
    let cols;
    if (table.columns) {
      cols = table.columns.slice();
      if (stateRef.current.sortColumns) {
        cols.sort((a, b) => a.name.localeCompare(b.name, undefined, {
          sensitivity: 'base'
        }));
      }
    }
    const metadata = <Collapse in={table.expanded} timeout={propsRef.current.timeout}>
        <div>
          {renderWell()}
          <div className="table-columns">
            {cols && cols.map(col => <ColumnElement column={col} key={col.name} />)}
            <hr />
          </div>
        </div>
      </Collapse>;
    return metadata;
  }
  propsRef.current = props;
  return <Collapse in={stateRef.current.expanded} timeout={propsRef.current.timeout} onExited={removeFromStore.bind(undefined)}>
        <div className="TableElement">
          {renderHeader()}
          <div>
            {renderBody()}
          </div>
        </div>
      </Collapse>;
}


TableElement.propTypes = propTypes;
TableElement.defaultProps = defaultProps;

export default TableElement;
