import React from 'react';
import PropTypes from 'prop-types';
import ModalTrigger from '../../components/ModalTrigger';
import ChartFullScreen from "../../chart/ChartFullScreen";

const propTypes = {
  triggerNode: PropTypes.node.isRequired,
};

function ChartFullScreenModal(props) {
  function renderModalTitle(sliceName) {
    return <div style={{
      fontSize: '22px',
      fontFamily: '思源宋体 CN Heavy',
      fontWeight: 'bold',
      textAlign: 'center'
    }}>
            <span>{sliceName}</span>
          </div>;
  }
  // console.log('ChartFullScreenModal render-------------');
  return <ModalTrigger triggerNode={props.triggerNode} modalTitle={renderModalTitle(props.slice.slice_name)} dialogClassName="ChartFullScreenDialog" componentClassTitle="div"
  // style={{width:'1500px', height:'750px'}}
  // onExit={()=>this.handleModalHide()}
  modalBody={<ChartFullScreen chartKey={`slice_${props.slice.slice_id}`} sliceId={props.slice.slice_id} containerId="chartFullScreenModal" datasource={props.datasource} formData={props.formData} vizType={props.slice.formData.viz_type} />} />;
}


ChartFullScreenModal.propTypes = propTypes;

export default ChartFullScreenModal;
