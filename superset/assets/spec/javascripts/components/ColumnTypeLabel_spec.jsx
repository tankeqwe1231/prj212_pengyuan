import React from 'react';
import { cleanup, render } from '@testing-library/react';

import ColumnTypeLabel from '../../../javascripts/components/ColumnTypeLabel';

describe('ColumnTypeLabel', () => {
  afterEach(cleanup);

  [['string', 'ABC'], ['int(164)', '#'], ['BOOL', 'T/F'], ['expression', 'ƒ'], ['unknown', '?']]
    .forEach(([type, label]) => {
      it(`renders ${label} for ${type}`, () => {
        const { container } = render(<ColumnTypeLabel type={type} />);
        expect(container.querySelector('.type-label').textContent).to.equal(label);
      });
    });

  it('renders a clock for datetime columns', () => {
    const { container } = render(<ColumnTypeLabel type="datetime" />);
    expect(container.querySelector('.fa-clock-o')).not.to.equal(null);
  });
});
