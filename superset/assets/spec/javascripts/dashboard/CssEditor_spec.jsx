import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import CssEditor from '../../../javascripts/dashboard/components/CssEditor';
import { t } from '../../../javascripts/locales';
import {
  isDashboardResizeSuppressed,
  resumeDashboardResize,
} from '../../../javascripts/dashboard/resizeUtils';

describe('CssEditor', () => {
  afterEach(() => {
    cleanup();
    resumeDashboardResize();
  });

  it('opens the live CSS editor from its supplied trigger', () => {
    const { container } = render(
      <CssEditor triggerNode={<i aria-label="edit-css" className="fa fa-edit" />} />,
    );
    fireEvent.click(container.querySelector('.fa-edit'));
    expect(screen.getByText(t('Live CSS Editor'))).not.to.equal(null);
    expect(document.body.querySelector('.modal')).not.to.equal(null);
  });

  it('suppresses dashboard resize while the modal is closing', async () => {
    const { container } = render(
      <CssEditor triggerNode={<i aria-label="edit-css" className="fa fa-edit" />} />,
    );
    fireEvent.click(container.querySelector('.fa-edit'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(isDashboardResizeSuppressed()).to.equal(true);
    await waitFor(() => expect(isDashboardResizeSuppressed()).to.equal(false));
  });
});
