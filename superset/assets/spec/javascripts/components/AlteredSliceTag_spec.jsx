import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import AlteredSliceTag from '../../../javascripts/components/AlteredSliceTag';
import { t } from '../../../javascripts/locales';

const origFormData = {
  filters: [{ col: 'a', op: '==', val: 'hello' }],
  y_axis_bounds: [10, 20],
  column_collection: [{ 1: 'a', b: ['6', 'g'] }],
  bool: false,
  gucci: [1, 2, 3, 4],
  never: 5,
  ever: { a: 'b', c: 'd' },
};
const currentFormData = {
  filters: [{ col: 'b', op: 'in', val: ['hello', 'my', 'name'] }],
  y_axis_bounds: [15, 16],
  column_collection: [{ 1: 'a', b: [9, '15'], t: 'gggg' }],
  bool: true,
  gucci: ['a', 'b', 'c', 'd'],
  never: 10,
  ever: { x: 'y', z: 'z' },
};

describe('AlteredSliceTag', () => {
  afterEach(cleanup);

  it('renders nothing when form data is unchanged', () => {
    const { container } = render(
      <AlteredSliceTag currentFormData={origFormData} origFormData={origFormData} />,
    );
    expect(container.firstChild).to.equal(null);
  });

  it('opens a table with every formatted difference', async () => {
    render(
      <AlteredSliceTag currentFormData={currentFormData} origFormData={origFormData} />,
    );
    fireEvent.click(screen.getByText(t('Altered')));
    await waitFor(() => {
      expect(document.querySelectorAll('.modal-body tbody tr')).to.have.length(7);
    });
    expect(document.querySelectorAll('.modal-body tbody td')).to.have.length(21);
    expect(screen.getByText('Min: 10, Max: 20')).not.to.equal(null);
    expect(screen.getByText('b in [hello, my, name]')).not.to.equal(null);
    expect(screen.getByText('{"x":"y","z":"z"}')).not.to.equal(null);

    const next = { ...currentFormData, beta: 10 };
    cleanup();
    render(<AlteredSliceTag currentFormData={next} origFormData={origFormData} />);
    fireEvent.click(screen.getByText(t('Altered')));
    await waitFor(() => {
      expect(document.querySelectorAll('.modal-body tbody tr')).to.have.length(8);
    });
    expect(screen.getByText('N/A')).not.to.equal(null);
  });
});
