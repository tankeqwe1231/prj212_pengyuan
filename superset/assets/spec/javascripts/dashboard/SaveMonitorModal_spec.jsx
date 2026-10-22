import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import SaveMonitorModal from '../../../javascripts/dashboard/components/SaveMonitorModal';

describe('SaveMonitorModal', () => {
  afterEach(cleanup);

  it('keeps monitor labels on one line and renders native select controls', () => {
    render(
      <SaveMonitorModal
        triggerNode={<button type="button">Open monitor</button>}
        slice={{
          slice_id: 1,
          formData: {
            datasource: '1__table',
            viz_type: 'table',
          },
        }}
        warnIndexList={['指标']}
        warnCol="指标"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open monitor' }));

    expect(screen.getByLabelText(/到期时间/).className).to.include('form-control');
    expect(screen.getByLabelText(/指标名/).className).to.include('form-select');
    expect(screen.getByLabelText(/条件/).className).to.include('form-select');
    expect(screen.getByText(/到期时间/).className).to.include('text-nowrap');
    expect(screen.getByText('预警原因').className).to.include('text-nowrap');
  });
});
