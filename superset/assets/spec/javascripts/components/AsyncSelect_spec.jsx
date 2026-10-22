import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import AsyncSelect from '../../../javascripts/components/AsyncSelect';

const options = [{ value: 1, label: 'main' }, { value: 2, label: 'another' }];

describe('AsyncSelect', () => {
  let server;
  beforeEach(() => {
    server = sinon.fakeServer.create();
    server.respondWith([200, { 'Content-Type': 'application/json' }, JSON.stringify({})]);
  });
  afterEach(() => { cleanup(); server.restore(); });

  it('loads options and auto-selects the first one when requested', () => {
    const onChange = sinon.spy();
    const { container } = render(<AsyncSelect
      autoSelect
      dataEndpoint="/slicemodelview/api/read"
      mutator={() => options}
      onChange={onChange}
    />);
    act(() => server.respond());
    expect(container.querySelector('[role="combobox"]')).not.to.equal(null);
    expect(onChange.calledOnceWithExactly(options[0])).to.equal(true);
  });

  it('does not auto-select when a value already exists', () => {
    const onChange = sinon.spy();
    render(<AsyncSelect
      autoSelect
      dataEndpoint="/slicemodelview/api/read"
      mutator={() => options}
      onChange={onChange}
      value={2}
    />);
    act(() => server.respond());
    expect(onChange.called).to.equal(false);
    expect(screen.getByText('another')).not.to.equal(null);
  });

  it('normalizes multiple primitive values to selected options', () => {
    const { container } = render(<AsyncSelect
      dataEndpoint="/slicemodelview/api/read"
      isMulti
      mutator={() => options}
      onChange={() => {}}
      value={[1, 2]}
    />);
    act(() => server.respond());
    expect(container.querySelectorAll('.Select__multi-value')).to.have.length(2);
  });
});
