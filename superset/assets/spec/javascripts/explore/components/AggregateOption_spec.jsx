import React from 'react';
import { cleanup, render } from '@testing-library/react';

import AggregateOption from '../../../../javascripts/explore/components/AggregateOption';

describe('AggregateOption', () => {
  afterEach(cleanup);

  it('renders the aggregate name and optional type', () => {
    const view = render(<AggregateOption aggregate={{ aggregate_name: 'SUM' }} showType />);
    expect(view.container.querySelector('.option-label').textContent.trim()).to.equal('SUM');
    expect(view.container.querySelector('.type-label').textContent).to.equal('AGG');
  });
});
