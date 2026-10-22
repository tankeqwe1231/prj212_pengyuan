/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import sinon from 'sinon';

import BoundsControl from '../../../../javascripts/explore/components/controls/BoundsControl';
import { t } from '../../../../javascripts/locales';

describe('BoundsControl', () => {
  afterEach(cleanup);

  function renderControl(onChange = sinon.spy()) {
    const view = render(
      <BoundsControl
        label="Bounds of the y axis"
        name="y_axis_bounds"
        onChange={onChange}
      />,
    );
    return { ...view, onChange };
  }

  it('renders minimum and maximum inputs', () => {
    const { getByPlaceholderText } = renderControl();
    expect(getByPlaceholderText(t('Min'))).to.exist;
    expect(getByPlaceholderText(t('Max'))).to.exist;
  });

  it('reports localized validation errors for non-numeric input', () => {
    const { getByPlaceholderText, onChange } = renderControl();
    fireEvent.change(getByPlaceholderText(t('Min')), { target: { value: 's' } });

    expect(onChange.calledWith([null, null])).to.be.true;
    expect(onChange.firstCall.args[1]).to.deep.equal([
      t('`Min` value should be numeric or empty'),
    ]);
  });

  it('casts valid bounds to numbers', () => {
    const { getByPlaceholderText, onChange } = renderControl();
    fireEvent.change(getByPlaceholderText(t('Min')), { target: { value: '1' } });
    fireEvent.change(getByPlaceholderText(t('Max')), { target: { value: '5' } });

    expect(onChange.calledWith([1, 5], [])).to.be.true;
  });
});
