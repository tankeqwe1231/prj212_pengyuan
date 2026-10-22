import React, { useImperativeHandle, useLayoutEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';

const propTypes = {
  containerId: PropTypes.string.isRequired,
  vizType: PropTypes.string.isRequired,
  height: PropTypes.func.isRequired,
  width: PropTypes.func.isRequired,
  faded: PropTypes.bool,
  editMode: PropTypes.bool,
};

function ChartBodyWithRef(props, ref) {
  const { containerId, vizType, faded, editMode } = props;
  const elementRef = useRef(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const previousEditModeRef = useRef(editMode);
  const containerFacadeRef = useRef(null);

  if (containerFacadeRef.current === null) {
    containerFacadeRef.current = {
      html(data) {
        elementRef.current.innerHTML = data;
      },
      css(property, value) {
        elementRef.current.style[property] = value;
      },
      toggleClass(className, state) {
        return $(elementRef.current).toggleClass(className, state);
      },
      get(n) {
        return $(elementRef.current).get(n);
      },
      find(classname) {
        return $(elementRef.current).find(classname);
      },
      show() {
        return $(elementRef.current).show();
      },
      height() {
        return propsRef.current.height();
      },
      width() {
        return propsRef.current.width();
      },
    };
  }

  useImperativeHandle(ref, () => containerFacadeRef.current, []);

  useLayoutEffect(() => () => {
    // A refresh removes ChartBody while the next query is loading. Cancel
    // CKEditor's asynchronous initialization before React removes its node.
    if (vizType === 'ckeditor_slice' && typeof CKEDITOR !== 'undefined') {
      const editor = CKEDITOR.instances['ckeditor_' + containerId];
      if (editor) {
        editor.destroy(true);
      }
    }
  }, [containerId, vizType]);

  useLayoutEffect(() => {
    if (previousEditModeRef.current !== editMode) {
      if (editMode) {
        $('.markup .editdiv').show();
        $('.markup .showdiv').hide();
      } else {
        $('.markup .showdiv').show();
        $('.markup .editdiv').hide();
      }
      previousEditModeRef.current = editMode;
    }
  }, [editMode]);

  return <div id={containerId} name={editMode == null ? undefined : String(editMode)} className={`slice_container ${vizType}${faded ? ' faded' : ''}`} ref={elementRef} />;
}

const ChartBody = React.forwardRef(ChartBodyWithRef);

ChartBody.propTypes = propTypes;

export default ChartBody;
