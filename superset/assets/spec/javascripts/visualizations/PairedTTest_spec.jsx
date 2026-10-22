import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';

import { TTestTable } from '../../../visualizations/paired_ttest';

describe('TTestTable', () => {
  afterEach(cleanup);

  it('computes its initial values and changes the selected control row', () => {
    const { container, getByText } = render(<TTestTable
      metric="price"
      groups={['variant']}
      data={[
        { group: ['Control'], values: [{ y: 10 }, { y: 12 }, { y: 14 }] },
        { group: ['Experiment'], values: [{ y: 12 }, { y: 14 }, { y: 16 }] },
      ]}
      alpha={0.05}
      liftValPrec={2}
      pValPrec={4}
    />);

    expect(container.textContent).to.contain('16.67');
    expect(getByText('Control').closest('tr').className).to.contain('control');
    fireEvent.click(getByText('Experiment'));
    expect(getByText('Experiment').closest('tr').className).to.contain('control');
  });

  it('uses the lift comparator while preserving original row indexes for clicks', () => {
    render(<TTestTable
      metric="price"
      groups={['variant']}
      data={[
        { group: ['Control'], values: [{ y: 10 }, { y: 10 }, { y: 10 }] },
        { group: ['Low lift'], values: [{ y: 12 }, { y: 12 }, { y: 12 }] },
        { group: ['High lift'], values: [{ y: 15 }, { y: 15 }, { y: 15 }] },
      ]}
      alpha={0.05}
      liftValPrec={2}
      pValPrec={4}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Lift %' }));
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Control')).not.to.equal(null);
    expect(within(rows[1]).getByText('High lift')).not.to.equal(null);
    expect(within(rows[2]).getByText('Low lift')).not.to.equal(null);

    fireEvent.click(screen.getByText('Low lift'));
    rows = screen.getAllByRole('row').slice(1);
    expect(rows.find(row => row.textContent.includes('Low lift')).className).to.contain('control');
  });
});
