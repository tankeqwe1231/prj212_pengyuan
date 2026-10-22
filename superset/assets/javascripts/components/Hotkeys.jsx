import React, { useLayoutEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Popover } from 'react-bootstrap';

import Mousetrap from 'mousetrap';
import AppTable from './AppTable/AppTable';

const propTypes = {
  hotkeys: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string.isRequired,
    descr: PropTypes.string.isRequired,
    func: PropTypes.func.isRequired,
  })).isRequired,
  header: PropTypes.string,
};

function Hotkeys({ hotkeys = [], header }) {
  useLayoutEffect(() => {
    hotkeys.forEach(keyConfig => {
      Mousetrap.bind([keyConfig.key], keyConfig.func);
    });
    return () => hotkeys.forEach(keyConfig => Mousetrap.unbind([keyConfig.key]));
  }, [hotkeys]);
  const columns = useMemo(() => [{
    accessorKey: 'key',
    header: 'Key',
  }, {
    accessorKey: 'action',
    header: 'Action',
  }], []);
  const tableData = useMemo(() => hotkeys.map(keyConfig => ({
    action: keyConfig.descr,
    key: keyConfig.key,
  })), [hotkeys]);
  const renderPopover = () => (
    <Popover id="popover-hotkeys" style={{
      width: '300px'
    }}>
        <Popover.Header as="h3">{header}</Popover.Header>
        <Popover.Body>
        <AppTable className="table table-sm" columns={columns} data={tableData} />
        </Popover.Body>
      </Popover>
  );
  return <OverlayTrigger overlay={renderPopover()} trigger={['hover', 'focus']} placement="top">
        <i className="fa fa-keyboard-o fa-lg" />
      </OverlayTrigger>;
}
export default Hotkeys;

Hotkeys.propTypes = propTypes;
