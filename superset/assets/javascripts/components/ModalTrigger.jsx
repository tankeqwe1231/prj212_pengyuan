import React, {
  cloneElement,
  forwardRef,
  Fragment,
  isValidElement,
  useCallback,
  useImperativeHandle,
  useState,
} from 'react';
import PropTypes from 'prop-types';
import { DropdownItem, Modal } from 'react-bootstrap';

import Button from './Button';

const propTypes = {
  animation: PropTypes.bool,
  triggerNode: PropTypes.node.isRequired,
  modalTitle: PropTypes.node.isRequired,
  modalBody: PropTypes.node,
  modalFooter: PropTypes.node,
  beforeOpen: PropTypes.func,
  onExit: PropTypes.func,
  onExited: PropTypes.func,
  onEntered: PropTypes.func,
  onEntering: PropTypes.func,
  isButton: PropTypes.bool,
  isMenuItem: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'lg', 'xl']),
  className: PropTypes.string,
  dialogClassName: PropTypes.string,
  componentClassTitle: PropTypes.elementType,
  backdrop: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(['static'])]),
  tooltip: PropTypes.node,
};

const ModalTrigger = forwardRef(function ModalTriggerWithRef({
  animation = true,
  triggerNode,
  modalTitle,
  modalBody = null,
  modalFooter = null,
  beforeOpen = () => {},
  onExit = () => {},
  onExited = undefined,
  onEntered = undefined,
  onEntering = undefined,
  isButton = false,
  isMenuItem = false,
  size = undefined,
  className = '',
  dialogClassName = undefined,
  componentClassTitle = 'h4',
  backdrop = true,
  tooltip = null,
}, ref) {
  const [showModal, setShowModal] = useState(false);

  const close = useCallback(() => setShowModal(false), []);
  const open = useCallback((event) => {
    if (event) {
      event.preventDefault();
    }
    beforeOpen();
    setShowModal(true);
  }, [beforeOpen]);

  useImperativeHandle(ref, () => ({ close, open }), [close, open]);

  const modal = (
    <Modal
      animation={animation}
      show={showModal}
      onHide={close}
      onExit={onExit}
      onExited={onExited}
      onEntered={onEntered}
      onEntering={onEntering}
      size={size}
      className={className}
      dialogClassName={dialogClassName}
      backdrop={backdrop}
    >
      <Modal.Header closeButton>
        <Modal.Title as={componentClassTitle}>{modalTitle}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{modalBody}</Modal.Body>
      {modalFooter && <Modal.Footer>{modalFooter}</Modal.Footer>}
    </Modal>
  );

  if (isButton) {
    return (
      <Fragment>
        <Button className="modal-trigger" tooltip={tooltip} onClick={open}>{triggerNode}</Button>
        {modal}
      </Fragment>
    );
  }
  if (isMenuItem) {
    return (
      <Fragment>
        <DropdownItem onClick={open}>{triggerNode}</DropdownItem>
        {modal}
      </Fragment>
    );
  }
  const trigger = isValidElement(triggerNode)
    ? cloneElement(triggerNode, {
      onClick: (event) => {
        if (triggerNode.props.onClick) {
          triggerNode.props.onClick(event);
        }
        if (!event.defaultPrevented) {
          open(event);
        }
      },
    })
    : <Button className="modal-trigger" onClick={open}>{triggerNode}</Button>;
  return (
    <Fragment>
      {trigger}
      {modal}
    </Fragment>
  );
});

ModalTrigger.propTypes = propTypes;

export default ModalTrigger;
