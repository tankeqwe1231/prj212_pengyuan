import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';

import URLShortLinkButton from '../../../../javascripts/explore/components/URLShortLinkButton';

describe('URLShortLinkButton', () => {
  afterEach(cleanup);

  it('opens its share popover', () => {
    const { container } = render(
      <URLShortLinkButton latestQueryFormData={{ datasource: '1__table' }} />,
    );
    fireEvent.click(container.querySelector('.fa-link'));

    expect(document.querySelector('#shorturl-popover')).not.to.equal(null);
    expect(document.querySelector('.fa-clipboard')).not.to.equal(null);
    expect(document.querySelector('a[href^="mailto:"]')).not.to.equal(null);
  });
});
