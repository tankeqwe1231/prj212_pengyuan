import React from 'react';
import PropTypes from 'prop-types';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule } from 'ag-grid-enterprise';

const AG_GRID_MODULES = [AllEnterpriseModule];

function CellRenderer({ value }) {
  return <span>{`row:${value}`}</span>;
}

CellRenderer.propTypes = {
  value: PropTypes.string,
};

function renderGrid(rowData) {
  return (
    <div className="ag-theme-balham" style={{ width: 400 }}>
      <AgGridReact
        modules={AG_GRID_MODULES}
        theme="legacy"
        columnDefs={[{ field: 'name', cellRenderer: CellRenderer }]}
        rowData={rowData}
        domLayout="autoHeight"
        animateRows={false}
      />
    </div>
  );
}

describe('AgGridReact React 19 integration', () => {
  afterEach(cleanup);

  it('renders React cell components, updates rows, and unmounts cleanly', async () => {
    const view = render(renderGrid([{ name: 'first' }]));

    await waitFor(() => expect(screen.getByText('row:first')).to.exist);

    view.rerender(renderGrid([{ name: 'second' }]));
    await waitFor(() => expect(screen.getByText('row:second')).to.exist);

    view.unmount();
    expect(view.container.querySelector('.ag-root-wrapper')).to.equal(null);
  });
});
