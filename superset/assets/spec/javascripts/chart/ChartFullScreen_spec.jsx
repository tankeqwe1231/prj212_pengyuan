import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import sinon from 'sinon';
import $ from 'jquery';

import ChartFullScreen from '../../../javascripts/chart/ChartFullScreen';
import visMap from '../../../visualizations/main';

describe('ChartFullScreen', () => {
  let ajaxStub;
  let visualizationStub;
  let dialog;

  afterEach(() => {
    cleanup();
    if (dialog) dialog.remove();
    dialog = null;
    if (ajaxStub) ajaxStub.restore();
    if (visualizationStub) visualizationStub.restore();
  });

  it('renders through the narrow facade and aborts its request on unmount', () => {
    const request = { abort: sinon.spy() };
    let requestOptions;
    let sliceFacade;
    ajaxStub = sinon.stub($, 'ajax').callsFake(options => {
      requestOptions = options;
      return request;
    });
    visualizationStub = sinon.stub(visMap, 'pie').callsFake(slice => {
      sliceFacade = slice;
    });
    dialog = document.createElement('div');
    dialog.className = 'ChartFullScreenDialog';
    document.body.appendChild(dialog);
    const view = render(<ChartFullScreen
      chartKey="slice_7"
      containerId="fullscreen-chart"
      datasource={{}}
      formData={{ annotation_layers: [], datasource: '1__table' }}
      sliceId={7}
      vizType="pie"
    />);

    act(() => requestOptions.success({ data: [] }));
    expect(sliceFacade.containerId).to.equal('fullscreen-chart');
    expect(sliceFacade.container.get(0).id).to.equal('fullscreen-chart');
    expect(sliceFacade).not.to.have.property('state');
    expect(sliceFacade).not.to.have.property('setState');
    expect(dialog.style.width).to.equal('90vw');
    expect(dialog.style.maxWidth).to.equal('90vw');
    expect(sliceFacade.width()).to.equal(Math.floor(document.documentElement.clientWidth * 0.9) - 10);
    expect(sliceFacade.height()).to.equal(Math.floor(window.innerHeight * 0.95) - 45);

    view.unmount();
    expect(request.abort.calledOnce).to.equal(true);
  });
});
