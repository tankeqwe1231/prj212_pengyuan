import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

import { unmountReact } from '../../../javascripts/modules/reactRoot';
import filterBox, { FilterBox } from '../../../visualizations/filter_box';

describe('FilterBox', () => {
  afterEach(cleanup);

  const defaultProps = {
    datasource: { verbose_map: {} },
    filtersChoices: {
      country: [
        { filter: 'country', id: 'China', metric: 10 },
        { filter: 'country', id: 'Canada', metric: 5 },
      ],
    },
    origSelectedValues: { country: [] },
  };

  it('keeps filter search text controlled across blur', () => {
    render(<FilterBox
      {...defaultProps}
      showTreeNode
    />);
    const combobox = screen.getByRole('combobox');
    fireEvent.change(combobox, { target: { value: 'Chi' } });
    expect(combobox.value).to.equal('Chi');
    fireEvent.blur(combobox);
    expect(combobox.value).to.equal('Chi');
  });

  it('keeps Apply disabled when the changed select value is empty', () => {
    render(<FilterBox {...defaultProps} instantFiltering={false} />);
    const applyButton = screen.getByRole('button', { name: '应用' });
    expect(applyButton.disabled).to.equal(true);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'China' } });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter', code: 'Enter' });
    expect(applyButton.disabled).to.equal(false);

    fireEvent.mouseDown(document.querySelector('.Select__clear-indicator'));
    expect(applyButton.disabled).to.equal(true);
  });

  it('uses bounded layout regions when the tree is shown', () => {
    const { container } = render(<FilterBox {...defaultProps} showTreeNode />);
    expect(container.querySelector('.filter-box-layout.has-tree')).not.to.equal(null);
    expect(container.querySelector('.filter-box-controls')).not.to.equal(null);
    expect(container.querySelector('.filter-box-tree-scroll')).not.to.equal(null);
  });

  describe('filterBox visualization', () => {
    const containerId = 'slice-container-filter-box-spec';
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);
    });

    afterEach(() => {
      unmountReact(container);
      document.body.removeChild(container);
      container = null;
    });

    const buildSlice = height => ({
      selector: `#${containerId}`,
      containerId,
      height: () => height,
      formData: { groupby: ['country'], instant_filtering: true },
      datasource: defaultProps.datasource,
      addFilter: () => {},
      getFilters: () => ({ country: [] }),
    });

    it('keeps its content after a resize triggers another render', () => {
      const payload = { data: { country: defaultProps.filtersChoices.country } };
      act(() => {
        filterBox(buildSlice(400), payload);
      });
      expect(container.querySelector('.filter-box-layout')).not.to.equal(null);

      act(() => {
        filterBox(buildSlice(260), payload);
      });
      expect(container.style.height).to.equal('260px');
      expect(container.querySelector('.filter-box-layout')).not.to.equal(null);
    });
  });
});
