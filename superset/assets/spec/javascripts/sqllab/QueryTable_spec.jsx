import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { queries } from './fixtures';
import QueryTable from '../../../javascripts/SqlLab/components/QueryTable';

describe('QueryTable', () => {
  afterEach(cleanup);

  it('renders one row for every query', () => {
    render(<QueryTable actions={{}} columns={['started', 'duration', 'rows']} queries={queries} />);
    expect(document.querySelector('.QueryTable table')).not.to.equal(null);
    expect(document.querySelectorAll('.QueryTable tbody tr')).to.have.length(queries.length);
    expect(document.querySelectorAll('.QueryTable tbody td')).to.have.length(queries.length * 3);
  });
});
