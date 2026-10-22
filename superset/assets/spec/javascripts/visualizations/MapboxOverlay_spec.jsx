import React from 'react';
import Immutable from 'immutable';
import { cleanup, render } from '@testing-library/react';

import { ScatterPlotGlowOverlay } from '../../../visualizations/mapbox';

describe('ScatterPlotGlowOverlay', () => {
  let getContextStub;

  beforeEach(() => {
    getContextStub = sinon.stub(window.HTMLCanvasElement.prototype, 'getContext').returns({
      clearRect: sinon.spy(),
      restore: sinon.spy(),
      save: sinon.spy(),
      scale: sinon.spy(),
    });
  });

  afterEach(() => {
    getContextStub.restore();
  });
  afterEach(cleanup);

  it('uses explicit dimensions and an object canvas ref without legacy context', () => {
    const { container, rerender, unmount } = render(<ScatterPlotGlowOverlay
      width={320}
      height={180}
      longitude={0}
      latitude={0}
      zoom={1}
      locations={Immutable.List()}
      rgb={['rgb(1, 2, 3)', '1', '2', '3']}
    />);
    const canvas = container.querySelector('canvas');
    expect(canvas.width).to.equal(320);
    expect(canvas.height).to.equal(180);
    expect(canvas.style.width).to.equal('320px');
    expect(canvas.style.height).to.equal('180px');

    rerender(<ScatterPlotGlowOverlay
      width={640}
      height={360}
      longitude={0}
      latitude={0}
      zoom={1}
      locations={Immutable.List()}
      rgb={['rgb(1, 2, 3)', '1', '2', '3']}
    />);
    expect(canvas.width).to.equal(640);
    expect(canvas.height).to.equal(360);
    unmount();
  });
});
