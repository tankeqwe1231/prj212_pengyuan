import React from 'react';
import { cleanup, render } from '@testing-library/react';
import sinon from 'sinon';

import CollectionControl from '../../../../javascripts/explore/components/controls/CollectionControl';

describe('CollectionControl', () => {
  let consoleError;

  afterEach(() => {
    cleanup();
    if (consoleError) consoleError.restore();
  });

  it('renders the add control on a separate spaced line for an empty collection', () => {
    const { container } = render(
      <CollectionControl
        controlName="TimeSeriesColumnControl"
        name="column_collection"
        value={[]}
      />,
    );

    const placeholder = container.querySelector('.text-muted');
    const addItem = container.querySelector('.collection-control-add-item');
    expect(placeholder.textContent).to.equal('Empty collection');
    expect(addItem.previousElementSibling).to.equal(placeholder);
    expect(addItem.querySelector('.fa-plus-circle')).not.to.equal(null);
  });

  it('passes collection keys directly instead of spreading them into the item control', () => {
    consoleError = sinon.stub(console, 'error');

    const { container } = render(
      <CollectionControl
        controlName="TimeSeriesColumnControl"
        name="column_collection"
        value={[{
          colType: 'time',
          comparisonType: 'value',
          key: 'series-column-1',
          label: '20260412',
        }]}
      />,
    );

    const keySpreadWarning = consoleError.args.some(args => String(args[0]).includes(
      'A props object containing a "key" prop is being spread into JSX',
    ));
    expect(container.querySelector('.fa-edit')).not.to.equal(null);
    expect(keySpreadWarning).to.equal(false);
  });
});
