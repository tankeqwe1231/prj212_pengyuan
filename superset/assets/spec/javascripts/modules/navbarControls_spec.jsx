import $ from 'jquery';
import sinon from 'sinon';

import mountStandardNavbarControls from '../../../javascripts/modules/navbarControls';
import { unmountReact } from '../../../javascripts/modules/reactRoot';

describe('standard navbar controls', () => {
  let ajaxStub;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax');
  });

  afterEach(() => {
    ['search-slices', 'myMonitors'].forEach(id => {
      const container = document.getElementById(id);
      if (container) unmountReact(container);
    });
    ajaxStub.restore();
    document.body.innerHTML = '';
  });

  it('mounts search and monitor controls for the standard shell', () => {
    document.body.innerHTML = '<div id="search-slices"></div><div id="myMonitors"></div>';

    mountStandardNavbarControls();

    expect(document.querySelector('#search-slices button').title).to.equal('全局搜索');
    expect(document.querySelector('#myMonitors button').title).to.equal('预警');
    expect(document.querySelectorAll('.search-global-modal')).to.have.length(1);
  });

  it('leaves client shell containers to custom.js', () => {
    document.body.innerHTML = '<div id="navbar"></div><div id="search-slices"></div><div id="myMonitors"></div>';

    mountStandardNavbarControls();

    expect(document.querySelector('#search-slices button')).to.equal(null);
    expect(document.querySelector('#myMonitors button')).to.equal(null);
  });
});
