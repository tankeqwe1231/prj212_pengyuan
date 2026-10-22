import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Popover, OverlayTrigger } from 'react-bootstrap';
import CopyToClipboard from './../../components/CopyToClipboard';
import { getShortUrl } from '../../utils/common';
import { getExploreLongUrl } from '../exploreUtils';
import { t } from '../../locales';

const propTypes = {
  latestQueryFormData: PropTypes.object.isRequired,
};

function URLShortLinkButton(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(URLShortLinkButton.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = URLShortLinkButton.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    shortUrl: ''
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
  function onShortUrlSuccess(data) {
    updateState({
      shortUrl: data
    });
  }
  function getCopyUrl() {
    const longUrl = getExploreLongUrl(propsRef.current.latestQueryFormData);
    getShortUrl(longUrl, onShortUrlSuccess.bind(undefined));
  }
  function renderPopover() {
    const emailBody = t('Check out this slice: %s', stateRef.current.shortUrl);
    return <Popover id="shorturl-popover">
        <Popover.Body>
        <CopyToClipboard text={stateRef.current.shortUrl} copyNode={<i className="fa fa-clipboard" title={t('Copy to clipboard')} />} />
        &nbsp;&nbsp;
        <a href={`mailto:?Subject=Superset%20Slice%20&Body=${emailBody}`}>
          <i className="fa fa-envelope" />
        </a>
        </Popover.Body>
      </Popover>;
  }
  propsRef.current = props;
  return <OverlayTrigger trigger="click" rootClose placement="left" onEnter={getCopyUrl.bind(undefined)} overlay={renderPopover()}>
        <span className="btn btn-outline-secondary btn-sm">
          <i className="fa fa-link" />&nbsp;
        </span>
      </OverlayTrigger>;
}


export default URLShortLinkButton;

URLShortLinkButton.propTypes = propTypes;
