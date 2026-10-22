import React from 'react';
import { cleanup, render } from '@testing-library/react';

import { table } from './fixtures';
import ColumnElement from '../../../javascripts/SqlLab/components/ColumnElement';

describe('ColumnElement', () => {
  afterEach(cleanup);

  it('renders primary, foreign, index, and plain columns', () => {
    const view = render(<ColumnElement column={table.columns[0]} />);
    expect(view.container.querySelector('.col-name').textContent).to.contain('id');
    expect(view.container.querySelector('.fa-key')).not.to.equal(null);

    view.rerender(<ColumnElement column={table.columns[1]} />);
    expect(view.container.querySelector('.fa-link')).not.to.equal(null);
    expect(view.container.querySelector('.fa-bookmark')).not.to.equal(null);

    view.rerender(<ColumnElement column={table.columns[2]} />);
    expect(view.container.querySelectorAll('.col-name i')).to.have.length(0);
  });
});
