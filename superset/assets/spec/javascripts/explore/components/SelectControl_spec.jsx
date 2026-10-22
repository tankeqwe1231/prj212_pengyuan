import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import SelectControl from '../../../../javascripts/explore/components/controls/SelectControl';

describe('SelectControl', () => {
  afterEach(cleanup);

  it('renders choices and publishes a selected primitive value', () => {
    const onChange = sinon.spy();
    const { container } = render(<SelectControl
      choices={[["1 year ago", "1 year ago"], ['today', 'today']]}
      label="Time range"
      name="time_range"
      onChange={onChange}
    />);
    fireEvent.mouseDown(container.querySelector('.Select__control'));
    fireEvent.click(screen.getByText('today'));
    expect(onChange.calledOnceWithExactly('today')).to.equal(true);
  });

  it('updates its menu when choices change and supports free-form values', () => {
    const { container, rerender } = render(<SelectControl
      choices={[["one", "one"]]}
      freeForm
      label="Value"
      name="value"
      onChange={() => {}}
      value="one"
    />);
    expect(container.querySelector('[role="combobox"]')).not.to.equal(null);
    rerender(<SelectControl
      choices={[["three", "three"], ['four', 'four']]}
      label="Value"
      name="value"
      onChange={() => {}}
    />);
    fireEvent.mouseDown(container.querySelector('.Select__control'));
    expect(screen.getByText('three')).not.to.equal(null);
    expect(screen.getByText('four')).not.to.equal(null);
  });
});
