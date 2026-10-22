import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import $ from 'jquery';
import sinon from 'sinon';

import PopoverMonitor from '../../../../javascripts/custom/components/PopoverMonitor';

describe('PopoverMonitor', () => {
  let ajaxStub;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax').callsFake(options => options.success({
      unread_list: [],
      read_list: [],
    }));
  });

  afterEach(() => {
    ajaxStub.restore();
    cleanup();
  });

  it('opens the Bootstrap 5 popover without transition timing', async () => {
    render(<PopoverMonitor />);

    fireEvent.click(screen.getByRole('button', { name: '预警' }));

    await waitFor(() => expect(document.getElementById('pop-myMonitors')).not.to.equal(null));
    const popover = document.getElementById('pop-myMonitors');
    expect(popover.classList.contains('show')).to.equal(true);
    expect(popover.classList.contains('fade')).to.equal(false);
    expect(popover.querySelector('.tab-pane.active').classList.contains('fade')).to.equal(false);
  });
});
