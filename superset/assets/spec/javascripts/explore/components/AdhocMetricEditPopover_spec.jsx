import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import AdhocMetric from '../../../../javascripts/explore/AdhocMetric';
import AdhocMetricEditPopover from '../../../../javascripts/explore/components/AdhocMetricEditPopover';
import { AGGREGATES } from '../../../../javascripts/explore/constants';

const columns = [
  { type: 'VARCHAR(255)', column_name: 'source' },
  { type: 'DOUBLE', column_name: 'value' },
];
const metric = new AdhocMetric({ column: columns[1], aggregate: AGGREGATES.SUM });

describe('AdhocMetricEditPopover', () => {
  afterEach(cleanup);

  it('edits the metric label and saves a valid metric', () => {
    const onChange = sinon.spy();
    const onClose = sinon.spy();
    const { container } = render(<AdhocMetricEditPopover
      adhocMetric={metric}
      columns={columns}
      onChange={onChange}
      onClose={onClose}
    />);
    expect(container.querySelectorAll('.mb-3')).to.have.length(2);
    fireEvent.click(screen.getByText('My Metric'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new label' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onChange.calledOnce).to.equal(true);
    expect(onChange.firstCall.args[0].label).to.equal('new label');
    expect(onChange.firstCall.args[0].hasCustomLabel).to.equal(true);
    expect(onClose.calledOnce).to.equal(true);
  });

  it('keeps popover controls from bubbling focus clicks to the select trigger', () => {
    const parentMouseDown = sinon.spy();
    const parentClick = sinon.spy();
    const { container } = render(
      <div onMouseDown={parentMouseDown} onClick={parentClick}>
        <AdhocMetricEditPopover
          adhocMetric={metric}
          columns={columns}
          onChange={() => {}}
          onClose={() => {}}
        />
      </div>,
    );

    fireEvent.mouseDown(container.querySelector('#metrics-edit-popover button'));
    fireEvent.click(container.querySelector('#metrics-edit-popover button'));

    expect(parentMouseDown.called).to.equal(false);
    expect(parentClick.called).to.equal(false);
  });
});
