import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import RefreshIntervalModal from '../../../javascripts/dashboard/components/RefreshIntervalModal';
import { t } from '../../../javascripts/locales';

describe('RefreshIntervalModal', () => {
  afterEach(cleanup);

  it('opens from its supplied trigger', () => {
    const { container } = render(
      <RefreshIntervalModal triggerNode={<i aria-label="edit-refresh" className="fa fa-edit" />} />,
    );
    fireEvent.click(container.querySelector('.fa-edit'));
    expect(screen.getByText(t('Refresh Interval'))).not.to.equal(null);
    expect(document.body.querySelector('.modal')).not.to.equal(null);
  });
});
