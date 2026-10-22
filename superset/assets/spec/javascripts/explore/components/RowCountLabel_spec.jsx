import React from 'react';
import { cleanup, render } from '@testing-library/react';

import RowCountLabel from '../../../../javascripts/explore/components/RowCountLabel';

describe('RowCountLabel', () => {
  afterEach(cleanup);

  it('renders the count and warns when the row limit is reached', () => {
    const view = render(<RowCountLabel limit={100} rowcount={51} />);
    expect(view.container.textContent).to.contain('51 rows');
    view.rerender(<RowCountLabel limit={100} rowcount={100} />);
    expect(view.container.querySelector('.badge.bg-warning')).not.to.equal(null);
  });
});
