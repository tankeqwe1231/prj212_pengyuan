/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Badge, OverlayTrigger, Popover, Tab, Tabs } from 'react-bootstrap';
import DataTable from '../../components/DataTable';
import $ from "jquery";
const propTypes = {
};

function PopoverMonitor(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(PopoverMonitor.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = PopoverMonitor.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    actThirdMenu: 'false',
    monitorData: {
      unread_list: [],
      read_list: []
    }
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
  function handleRowClick(warn_index, row) {
    console.log(`Clicked row with warn_index: ${warn_index}`);
    console.log(row);
    const getUrl = '/superset/update_monitor/' + row.id;
    const dash_url = `/superset/dashboard/${row.dashboard_id}/?slice_id=${row.slice_id}`;
    $.ajax({
      url: getUrl,
      type: 'GET',
      data: {},
      dataType: "json",
      success: data => {
        console.log('update_monitor success', data);
        window.open(dash_url);
      },
      error: err => {
        console.log(err);
        notify.error('加载失败');
      }
    });
  }
  function renderPopover() {
    return <Popover id="pop-myMonitors">
                <Popover.Body style={{
        width: 350,
        height: 300
      }}>
                    <Tabs defaultActiveKey={1} id="uncontrolled-tab-example" transition={false}>
                        <Tab eventKey={1} title="未读预警">
                            <DataTable columns={[{
              field: 'warn_index',
              label: '指标名',
              render: (warnIndex, row) => <a href="#" onClick={() => handleRowClick(warnIndex, row)}>
                                      {warnIndex + ' ' + row.warn_condition + ' ' + row.warn_value}
                                    </a>
            }, {
              field: 'warn_cause',
              label: '预警原因'
            }]} data={stateRef.current.monitorData.unread_list} keyField="id" />
                        </Tab>
                        <Tab eventKey={2} title="已读预警">
                            <DataTable columns={[{
              field: 'warn_index',
              label: '指标名',
              render: (warnIndex, row) => <span>{warnIndex + ' ' + row.warn_condition + ' ' + row.warn_value}</span>
            }, {
              field: 'warn_cause',
              label: '预警原因'
            }]} data={stateRef.current.monitorData.read_list} keyField="id" />
                        </Tab>
                    </Tabs>
                </Popover.Body>
            </Popover>;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    const postUrl = '/superset/fetch_monitor';
    $.ajax({
      url: postUrl,
      type: 'GET',
      data: {},
      dataType: "json",
      success: data => {
        console.log('fetch_monitor success', data);
        const monitorDataRtn = {
          unread_list: data.unread_list,
          read_list: data.read_list
        };
        updateState({
          monitorData: monitorDataRtn
        });
      },
      error: err => {
        console.log(err);
        notify.error('加载失败');
      }
    });
  }, []);
  return <OverlayTrigger trigger="click" placement="bottom" overlay={renderPopover()} transition={false}
  // onEntered={() => PopEntered(metric)}
  rootClose>
              <button className="nav-link position-relative" type="button" title="预警">
                  <i className="fa fa-bell"></i>
                  {stateRef.current.monitorData.unread_list.length > 0 && <Badge bg="danger" pill style={{
        position: 'absolute',
        top: '10px',
        right: '0px',
        padding: '1px 5px',
        borderRadius: '50%',
        backgroundColor: 'red',
        color: '#fff'
      }}>{stateRef.current.monitorData.unread_list.length}
                  </Badge>}

              </button>
          </OverlayTrigger>;
}


export default PopoverMonitor;

PopoverMonitor.propTypes = propTypes;
