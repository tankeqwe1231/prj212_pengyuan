import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { FormControl, FormLabel, OverlayTrigger, Popover } from 'react-bootstrap';
import Button from '../../components/Button';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getExploreLongUrl } from '../exploreUtils';
import { t } from '../../locales';

const propTypes = {
  latestQueryFormData: PropTypes.object.isRequired,
};

function EmbedCodeButton(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(EmbedCodeButton.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = EmbedCodeButton.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    height: '400',
    width: '600'
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
  function handleInputChange(e) {
    const value = e.currentTarget.value;
    const name = e.currentTarget.name;
    const data = {};
    data[name] = value;
    updateState(data);
  }
  function generateEmbedHTML() {
    const srcLink = window.location.origin + getExploreLongUrl(propsRef.current.latestQueryFormData, 'standalone') + `&height=${stateRef.current.height}`;
    return '<iframe\n' + `  width="${stateRef.current.width}"\n` + `  height="${stateRef.current.height}"\n` + '  seamless\n' + '  frameBorder="0"\n' + '  scrolling="no"\n' + `  src="${srcLink}"\n` + '>\n' + '</iframe>';
  }
  function renderPopover() {
    const html = generateEmbedHTML();
    return <Popover id="embed-code-popover">
        <Popover.Body>
          <div className="row embed-code-popover__code-row">
            <div className="col-sm-10">
              <FormControl name="embedCode" value={html} rows={4} readOnly as="textarea" size="sm" />
            </div>
            <div className="col-sm-2">
              <CopyToClipboard shouldShowText={false} text={html} copyNode={<Button
                className="embed-code-popover__copy"
                variant="outline-secondary"
                aria-label={t('Copy to clipboard')}
              >
                <i className="fa fa-clipboard" aria-hidden="true" />
              </Button>} />
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 col-sm-12">
              <div className="embed-code-popover__dimension">
                <small>
                  <FormLabel htmlFor="embed-height">{t('Height')}</FormLabel>
                </small>
                <FormControl id="embed-height" size="sm" type="text" defaultValue={stateRef.current.height} name="height" onChange={handleInputChange} />
              </div>
            </div>
            <div className="col-md-6 col-sm-12">
              <div className="embed-code-popover__dimension">
                <small>
                  <FormLabel htmlFor="embed-width">{t('Width')}</FormLabel>
                </small>
                <FormControl id="embed-width" size="sm" type="text" defaultValue={stateRef.current.width} name="width" onChange={handleInputChange} />
              </div>
            </div>
          </div>
        </Popover.Body>
      </Popover>;
  }
  propsRef.current = props;
  return <OverlayTrigger trigger="click" rootClose placement="left" overlay={renderPopover()}>
        <span className="btn btn-outline-secondary btn-sm">
          <i className="fa fa-code" />&nbsp;
        </span>
      </OverlayTrigger>;
}


export default EmbedCodeButton;

EmbedCodeButton.propTypes = propTypes;
