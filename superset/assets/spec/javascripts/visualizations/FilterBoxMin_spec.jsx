import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import filterBoxMin, { FilterBoxMin } from '../../../visualizations/filter_box_min';
import { unmountReact } from '../../../javascripts/modules/reactRoot';

describe('FilterBoxMin', () => {
  afterEach(cleanup);

  it('uses the gray background until an option is selected', () => {
    const onChange = sinon.spy();
    render(<FilterBoxMin
      datasource={{}}
      filtersChoices={{
        country: [
          { filter: 'country', id: 'China', metric: 10 },
          { filter: 'country', id: 'Canada', metric: 5 },
        ],
      }}
      origSelectedValues={{}}
      onChange={onChange}
    />);

    const china = screen.getByText('China');
    expect(china.classList.contains('bg-primary')).to.equal(false);
    expect(china.style.backgroundColor).to.equal('rgb(156, 156, 156)');

    fireEvent.click(china);

    expect(china.style.backgroundColor).to.equal('rgb(0, 166, 153)');
    expect(onChange.calledOnceWith('country', ['China'], false, true)).to.equal(true);
  });

  it('keeps its content when the visualization is rendered again after resize', async () => {
    const container = document.createElement('div');
    container.id = 'filter-box-min-resize';
    document.body.appendChild(container);
    const slice = {
      containerId: container.id,
      formData: {
        groupby: ['country'],
        instant_filtering: true,
      },
      datasource: {},
      getFilters: () => ({}),
      addFilter: sinon.spy(),
    };
    const payload = {
      data: {
        country: [
          { filter: 'country', id: 'China', metric: 10 },
        ],
      },
    };

    filterBoxMin(slice, payload);
    await waitFor(() => expect(container.textContent).to.contain('China'));

    filterBoxMin(slice, payload);
    await waitFor(() => expect(container.textContent).to.contain('China'));

    unmountReact(container);
    container.remove();
  });
});
