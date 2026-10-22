import React from 'react';
import { Provider } from 'react-redux';
import { cleanup, render, waitFor } from '@testing-library/react';
import { legacy_createStore as createStore } from 'redux';
import sinon from 'sinon';

import GridCell from '../../../javascripts/dashboard/components/GridCell';
import { Logger } from '../../../javascripts/logger';
import visMap from '../../../visualizations/main';

describe('GridCell', () => {
  let offsetHeightDescriptor;
  let offsetWidthDescriptor;
  let visualizationStub;
  let loggerStub;

  beforeEach(() => {
    loggerStub = sinon.stub(Logger, 'append');
    offsetHeightDescriptor = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      'offsetHeight',
    );
    offsetWidthDescriptor = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      'offsetWidth',
    );
    Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        if (this.classList.contains('widget')) return 480;
        if (this.querySelector && this.querySelector('.chart-header')) return 30;
        return 0;
      },
    });
    Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return this.classList.contains('widget') ? 620 : 0;
      },
    });
  });

  afterEach(() => {
    cleanup();
    if (visualizationStub) {
      visualizationStub.restore();
      visualizationStub = null;
    }
    if (loggerStub) {
      loggerStub.restore();
      loggerStub = null;
    }
    if (offsetHeightDescriptor) {
      Object.defineProperty(
        window.HTMLElement.prototype,
        'offsetHeight',
        offsetHeightDescriptor,
      );
    } else {
      delete window.HTMLElement.prototype.offsetHeight;
    }
    if (offsetWidthDescriptor) {
      Object.defineProperty(
        window.HTMLElement.prototype,
        'offsetWidth',
        offsetWidthDescriptor,
      );
    } else {
      delete window.HTMLElement.prototype.offsetWidth;
    }
  });

  it('renders a chart using the actual grid item dimensions', async () => {
    let sliceFacade;
    visualizationStub = sinon.stub(visMap, 'pie').callsFake(slice => {
      sliceFacade = slice;
    });
    const chart = {
      annotationData: {},
      chartKey: 'slice_22',
      chartStatus: 'success',
      lastRendered: 0,
      queryResponse: { data: [], error: null },
      triggerQuery: false,
    };
    const store = createStore(state => state, { charts: { slice_22: chart } });
    const slice = {
      description_markeddown: '',
      formData: { filters: [], viz_type: 'pie' },
      slice_id: 22,
      slice_name: 'Measured chart',
    };

    render(
      <Provider store={store}>
        <div className="widget">
          <GridCell
            chartKey="slice_22"
            datasource={{}}
            formData={slice.formData}
            slice={slice}
          />
        </div>
      </Provider>,
    );

    await waitFor(() => expect(sliceFacade).not.to.equal(undefined));
    expect(sliceFacade.width()).to.equal(610);
    expect(sliceFacade.height()).to.equal(450);
  });

});
