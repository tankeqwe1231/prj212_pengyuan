import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-css';
import 'ace-builds/src-noconflict/theme-github';
import 'ace-builds/src-noconflict/ext-language_tools';

import ModalTrigger from '../../components/ModalTrigger';
import { t } from '../../locales';
import {
  resumeDashboardResize,
  suppressDashboardResize,
} from '../resizeUtils';

const propTypes = {
  initialCss: PropTypes.string,
  triggerNode: PropTypes.node.isRequired,
  onChange: PropTypes.func,
  templates: PropTypes.array,
};

const defaultProps = {
  initialCss: '',
  onChange: () => {},
  templates: [],
};

function CssEditor(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(CssEditor.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = CssEditor.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    css: props.initialCss,
    cssTemplateOptions: []
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const resizeResumeFrameRef = useRef(undefined);
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
  function changeCss(css) {
    updateState({
      css
    }, () => {
      propsRef.current.onChange(css);
    });
  }
  function changeCssTemplate(opt) {
    changeCss(opt.css);
  }
  function cancelResizeResume() {
    if (resizeResumeFrameRef.current !== undefined) {
      cancelAnimationFrame(resizeResumeFrameRef.current);
      resizeResumeFrameRef.current = undefined;
    }
  }
  function onModalExit() {
    cancelResizeResume();
    // Bootstrap restores the page scrollbar after the exit transition. Keep
    // chart resize handlers paused for that transient width change.
    suppressDashboardResize();
  }
  function onModalExited() {
    // Wait for the scrollbar and ResizeObserver callbacks to settle before
    // allowing dashboard charts to react to resize events again.
    resizeResumeFrameRef.current = requestAnimationFrame(() => {
      resizeResumeFrameRef.current = requestAnimationFrame(() => {
        resizeResumeFrameRef.current = undefined;
        resumeDashboardResize();
      });
    });
  }
  function renderTemplateSelector() {
    if (propsRef.current.templates) {
      return <div style={{
        zIndex: 10
      }}>
          <h5>{t('Load a template')}</h5>
          <Select classNamePrefix="Select" options={propsRef.current.templates} placeholder={t('Load a CSS template')} onChange={changeCssTemplate.bind(undefined)} />
        </div>;
    }
    return null;
  }
  propsRef.current = props;
  useLayoutEffect(() => () => {
    cancelResizeResume();
    resumeDashboardResize();
  }, []);
  return <ModalTrigger triggerNode={propsRef.current.triggerNode} modalTitle={t('CSS')} isMenuItem modalBody={<div>
            {renderTemplateSelector()}
            <div style={{
      zIndex: 1
    }}>
              <h5>{t('Live CSS Editor')}</h5>
              <div style={{
        border: 'solid 1px grey'
      }}>
                <AceEditor mode="css" theme="github" minLines={8} maxLines={30} onChange={changeCss.bind(undefined)} height="200px" width="100%" setOptions={{
          useWorker: false
        }} editorProps={{
          $blockScrolling: true
        }} enableLiveAutocompletion value={stateRef.current.css || ''} />
              </div>
            </div>
          </div>} onExit={onModalExit} onExited={onModalExited} />;
}


CssEditor.propTypes = propTypes;
CssEditor.defaultProps = defaultProps;

export default CssEditor;
