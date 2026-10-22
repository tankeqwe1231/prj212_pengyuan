import React from 'react';
import { cleanup, render } from '@testing-library/react';
import sinon from 'sinon';

import App from '../../../javascripts/welcome/App';
import { t } from '../../../javascripts/locales';

const $ = window.$ = require('jquery');

describe('Welcome App', () => {
  let getJSONStub;
  beforeEach(() => { getJSONStub = sinon.stub($, 'getJSON'); });
  afterEach(() => { cleanup(); getJSONStub.restore(); });

  it('renders navigation without loading the dashboard list', () => {
    const { container } = render(<App user={{ userId: 5 }} />);
    expect(container.querySelectorAll('[role="tablist"] li')).to.have.length(2);
    const tabLabels = Array.from(container.querySelectorAll('[role="tab"]')).map(tab => tab.textContent);
    expect(tabLabels).to.deep.equal([t('Recently Viewed'), t('Favorites')]);
    expect(getJSONStub.called).to.equal(false);
  });
});
