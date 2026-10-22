import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Tooltip, OverlayTrigger, DropdownItem } from 'react-bootstrap';
import { t } from '../locales';

const propTypes = {
  copyNode: PropTypes.node,
  getText: PropTypes.func,
  onCopyEnd: PropTypes.func,
  shouldShowText: PropTypes.bool,
  text: PropTypes.string,
  inMenu: PropTypes.bool,
  tooltipText: PropTypes.string,
};

function CopyToClipboard({ copyNode = <span>Copy</span>, getText, onCopyEnd = () => {}, shouldShowText = true, text, inMenu = false, tooltipText = t('Copy to clipboard') }) {
  const [hasCopied, setHasCopied] = useState(false);
  const resetTimeoutRef = useRef(null);
  const resetTooltipText = () => setHasCopied(false);
  const onMouseOut = () => {
    // delay to avoid flash of text change on tooltip
    clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(resetTooltipText, 200);
  };
  useLayoutEffect(() => () => clearTimeout(resetTimeoutRef.current), []);
  const copyToClipboard = textToCopy => {
    const selection = document.getSelection();
    selection.removeAllRanges();
    document.activeElement.blur();
    const range = document.createRange();
    const span = document.createElement('span');
    span.textContent = textToCopy;
    span.style.all = 'unset';
    span.style.position = 'fixed';
    span.style.top = 0;
    span.style.clip = 'rect(0, 0, 0, 0)';
    span.style.whiteSpace = 'pre';
    document.body.appendChild(span);
    range.selectNode(span);
    selection.addRange(range);
    try {
      if (!document.execCommand('copy')) {
        throw new Error(t('Not successful'));
      }
    } catch (err) {
      window.alert(t('Sorry, your browser does not support copying. Use Ctrl / Cmd + C!')); // eslint-disable-line
    }
    document.body.removeChild(span);
    if (selection.removeRange) {
      selection.removeRange(range);
    } else {
      selection.removeAllRanges();
    }
    setHasCopied(true);
    onCopyEnd();
  };
  const onClick = () => {
    if (getText) getText(copyToClipboard);
    else copyToClipboard(text);
  };
  const getTooltipText = () => {
    if (hasCopied) {
      return t('Copied!');
    }
    return tooltipText;
  };
  const renderLink = () => {
    return <span>
        {shouldShowText && <span>
            {text}
            &nbsp;&nbsp;&nbsp;&nbsp;
          </span>}
        <OverlayTrigger placement="top" overlay={renderTooltip()} trigger={['hover', 'focus']}>
          <span style={{ cursor: 'pointer' }} onClick={onClick} onMouseOut={onMouseOut}>
            {copyNode}
          </span>
        </OverlayTrigger>
      </span>;
  };
  const renderInMenu = () => {
    return <OverlayTrigger placement="top" overlay={renderTooltip()} trigger={['hover', 'focus']}>
        <DropdownItem as="span">
          <span onClick={onClick} onMouseOut={onMouseOut}>
            {copyNode}
          </span>
        </DropdownItem>
      </OverlayTrigger>;
  };
  const renderTooltip = () => {
    return <Tooltip id="copy-to-clipboard-tooltip">
        {getTooltipText()}
      </Tooltip>;
  };
  return inMenu ? renderInMenu() : renderLink();
}
export default CopyToClipboard;

CopyToClipboard.propTypes = propTypes;
