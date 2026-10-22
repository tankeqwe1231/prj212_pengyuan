import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { Modal } from 'react-bootstrap';

const propTypes = {
  animation: PropTypes.bool,
  showModal: PropTypes.bool,
  onHide: PropTypes.func,
  onExit: PropTypes.func,
  modalTitle: PropTypes.node,
  modalBody: PropTypes.node,
  modalFooter: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'lg', 'xl']),
  className: PropTypes.string,
  dialogClassName: PropTypes.string,
  backdrop: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf(['static'])]),
};

const ModalTriggerCustom = forwardRef(function ModalTriggerCustomWithRef({
  animation = true,
  showModal = false,
  onHide = () => {},
  onExit = () => {},
  modalTitle = null,
  modalBody = null,
  modalFooter = null,
  size = undefined,
  className = '',
  dialogClassName = undefined,
  backdrop = true,
}, ref) {
  return (
    <div ref={ref}>
      <Modal
        animation={animation}
        show={showModal}
        onHide={onHide}
        onExit={onExit}
        size={size}
        className={className}
        dialogClassName={dialogClassName}
        backdrop={backdrop}
      >
        {modalTitle && (
          <Modal.Header closeButton>
            <Modal.Title>{modalTitle}</Modal.Title>
          </Modal.Header>
        )}
        <Modal.Body>{modalBody}</Modal.Body>
        {modalFooter && <Modal.Footer>{modalFooter}</Modal.Footer>}
      </Modal>
    </div>
  );
});

ModalTriggerCustom.propTypes = propTypes;

export default ModalTriggerCustom;
