import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import CheckboxControl from '../../../../javascripts/explore/components/controls/CheckboxControl';

describe('CheckboxControl', () => {
  afterEach(cleanup);

  it('renders its label and publishes the toggled value', () => {
    const onChange = sinon.spy();
    render(
      <CheckboxControl
        label="checkbox label"
        name="show_legend"
        onChange={onChange}
        value={false}
      />,
    );

    expect(screen.getByText('checkbox label')).not.to.equal(null);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange.calledOnceWithExactly(true)).to.equal(true);
  });
});
