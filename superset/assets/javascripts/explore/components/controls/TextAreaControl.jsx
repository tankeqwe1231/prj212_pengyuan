import React from 'react';
import PropTypes from 'prop-types';
import { Button, FormGroup, FormControl } from 'react-bootstrap';

import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-sql';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/mode-javascript';

import 'ace-builds/src-noconflict/theme-textmate';
import 'ace-builds/src-noconflict/ext-language_tools';

import ControlHeader from '../ControlHeader';
import ModalTrigger from '../../../components/ModalTrigger';
import { t } from '../../../locales';

const propTypes = {
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  value: PropTypes.string,
  height: PropTypes.number,
  minLines: PropTypes.number,
  maxLines: PropTypes.number,
  offerEditInModal: PropTypes.bool,
  language: PropTypes.oneOf([null, 'json', 'html', 'sql', 'markdown', 'javascript']),
  aboveEditorSection: PropTypes.node,
  readOnly: PropTypes.bool,
};

function TextAreaControl({ onChange = () => {}, value = '', height = 250, minLines = 3, maxLines = 10, offerEditInModal = true, readOnly = false, language, aboveEditorSection, ...props }) {
  const onControlChange = event => onChange(event.target.value);
  const renderEditor = (inModal = false) => {
    if (language) {
      return <AceEditor mode={language} theme="textmate" style={{
        border: '1px solid #CCC'
      }} minLines={inModal ? 40 : minLines} maxLines={inModal ? 1000 : maxLines} onChange={onChange} width="100%" editorProps={{
        $blockScrolling: true
      }} enableLiveAutocompletion setOptions={{ useWorker: false }} value={value} readOnly={readOnly} />;
    }
    return <FormGroup controlId="formControlsTextarea">
        <FormControl as="textarea" placeholder={t('textarea')} onChange={onControlChange} value={value} disabled={readOnly} style={{
        height
      }} />
      </FormGroup>;
  };
  const renderModalBody = () => {
    return <div>
        <div>{aboveEditorSection}</div>
        {renderEditor(true)}
      </div>;
  };
    const controlHeader = <ControlHeader {...props} value={value} />;
    return <div>
        {controlHeader}
        {renderEditor()}
        {offerEditInModal && <ModalTrigger size="lg" modalTitle={controlHeader} triggerNode={<Button size="sm" className="m-t-5">
                {t('Edit')} <strong>{language}</strong> {t('in modal')}
              </Button>} modalBody={renderModalBody()} />}
      </div>;
}
export default TextAreaControl;

TextAreaControl.propTypes = propTypes;
