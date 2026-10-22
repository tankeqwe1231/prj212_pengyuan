import React from 'react';
import { cleanup, render } from '@testing-library/react';

import QueryStateLabel from '../../../javascripts/SqlLab/components/QueryStateLabel';

describe('QueryStateLabel', () => {
  afterEach(cleanup);

  it('renders the query state with mapped styling', () => {
    const { container } = render(<QueryStateLabel query={{ state: 'running' }} />);
    expect(container.textContent).to.equal('running');
    expect(container.querySelector('.badge')).not.to.equal(null);
  });
});
