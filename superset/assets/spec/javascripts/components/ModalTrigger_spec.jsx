import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import sinon from 'sinon';

import ModalTrigger from '../../../javascripts/components/ModalTrigger';
import TooltipWrapper from '../../../javascripts/components/TooltipWrapper';

describe('ModalTrigger', () => {
  const defaultProps = {
    triggerNode: <i className="fa fa-link" />,
    modalTitle: 'My Modal Title',
    modalBody: <div>Modal Body</div>,
  };

  afterEach(cleanup);

  it('opens and closes a controlled React-Bootstrap modal', async () => {
    const beforeOpen = sinon.spy();
    const onExit = sinon.spy();
    const onExited = sinon.spy();
    render(<ModalTrigger {...defaultProps} beforeOpen={beforeOpen} onExit={onExit} onExited={onExited} triggerNode={<button type="button">Open</button>} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(beforeOpen.calledOnce).to.equal(true);
    expect(screen.getByText('Modal Body')).not.to.equal(null);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onExit.calledOnce).to.equal(true);
    await waitFor(() => expect(screen.queryByText('Modal Body')).to.equal(null));
    expect(onExited.calledOnce).to.equal(true);
  });

  it('preserves the imperative close method used by existing callers', async () => {
    const ref = React.createRef();
    render(<ModalTrigger {...defaultProps} ref={ref} triggerNode={<button type="button">Open</button>} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Modal Body')).not.to.equal(null);

    ref.current.close();
    await waitFor(() => expect(screen.queryByText('Modal Body')).to.equal(null));
  });

  it('opens when a TooltipWrapper is used as the trigger node', () => {
    render(
      <ModalTrigger
        {...defaultProps}
        triggerNode={(
          <TooltipWrapper label="open-modal" tooltip="Open modal">
            <i data-testid="tooltip-modal-trigger" className="fa fa-link" />
          </TooltipWrapper>
        )}
      />,
    );

    fireEvent.click(screen.getByTestId('tooltip-modal-trigger'));
    expect(screen.getByText('Modal Body')).not.to.equal(null);
  });
});
