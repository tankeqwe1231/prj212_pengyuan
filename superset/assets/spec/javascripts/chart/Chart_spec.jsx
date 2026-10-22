import React from 'react';
import { cleanup, render } from '@testing-library/react';
import sinon from 'sinon';

import Chart from '../../../javascripts/chart/Chart';
import visMap from '../../../visualizations/main';

const actions = {
  chartRenderingFailed: sinon.spy(),
  chartRenderingSucceeded: sinon.spy(),
  runQuery: sinon.spy(),
};
const baseProps = {
  actions,
  chartKey: 'slice_223',
  containerId: 'slice-container-223',
  datasource: {},
  formData: {},
  height: 300,
  vizType: 'pie',
  width: 400,
};
let visualizationStub;

describe('Chart', () => {
  afterEach(() => {
    cleanup();
    if (visualizationStub) {
      visualizationStub.restore();
      visualizationStub = null;
    }
    Object.values(actions).forEach(action => action.resetHistory());
  });

  it('transitions from loading to a rendered visualization container', () => {
    const chartRef = React.createRef();
    const { container, rerender } = render(
      <Chart {...baseProps} chartStatus="loading" ref={chartRef} />,
    );
    expect(container.querySelector('.loading')).not.to.equal(null);
    expect(container.querySelector('.slice_container')).to.equal(null);
    const renderViz = sinon.stub(chartRef.current, 'renderViz');

    rerender(<Chart
      {...baseProps}
      chartStatus="success"
      queryResponse={{ data: [], error: null, form_data: {}, status: 'success' }}
      ref={chartRef}
    />);
    expect(container.querySelector('#slice-container-223')).not.to.equal(null);
    expect(renderViz.calledOnce).to.equal(true);
  });

  it('runs the initial query when requested', () => {
    render(<Chart {...baseProps} timeout={30} triggerQuery />);
    expect(actions.runQuery.calledOnceWithExactly({}, false, 30, 'slice_223')).to.equal(true);
  });

  it('passes a narrow stable facade to legacy visualizations', () => {
    let sliceFacade;
    visualizationStub = sinon.stub(visMap, 'pie').callsFake(slice => {
      sliceFacade = slice;
    });
    const chartRef = React.createRef();
    render(<Chart
      {...baseProps}
      chartStatus="success"
      queryResponse={{ data: [], error: null }}
      ref={chartRef}
    />);

    chartRef.current.renderViz();
    expect(sliceFacade.containerId).to.equal(baseProps.containerId);
    expect(sliceFacade.container.get(0).id).to.equal(baseProps.containerId);
    expect(sliceFacade.width()).to.equal(baseProps.width);
    expect(sliceFacade.height()).to.equal(baseProps.height);
    expect(sliceFacade).not.to.have.property('state');
    expect(sliceFacade).not.to.have.property('setState');
    expect(sliceFacade).not.to.have.property('forceUpdate');
    expect(sliceFacade).not.to.have.property('renderViz');
  });
});
