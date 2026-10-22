import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import AddSliceContainer from '../../../javascripts/addSlice/AddSliceContainer';
import { t } from '../../../javascripts/locales';

const datasources = [
  { label: 'my first table', value: '1__table' },
  { label: 'another great table', value: '2__table' },
];

describe('AddSliceContainer', () => {
  afterEach(cleanup);

  it('defaults to table and enables creation after choosing a datasource', () => {
    const { container } = render(<AddSliceContainer datasources={datasources} />);
    const button = screen.getByText(t('Create new slice'));
    expect(button.disabled).to.equal(true);
    expect(container.querySelectorAll('[role="combobox"]')).to.have.length(2);

    fireEvent.mouseDown(container.querySelectorAll('.Select__control')[0]);
    fireEvent.click(screen.getByText('my first table'));
    expect(button.disabled).to.equal(false);
    expect(container.querySelectorAll('.Select__single-value')[1].textContent).to.equal(
      screen.getByText(/表视图|Table/).textContent,
    );
  });
});
