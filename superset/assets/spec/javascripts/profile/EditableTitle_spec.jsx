import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import EditableTitle from '../../../javascripts/components/EditableTitle';

describe('EditableTitle', () => {
  afterEach(cleanup);

  it('edits and saves a changed title on blur', () => {
    const onSaveTitle = sinon.spy();
    render(<EditableTitle canEdit onSaveTitle={onSaveTitle} showTooltip={false} title="my title" />);
    const input = screen.getByDisplayValue('my title');

    expect(input.type).to.equal('button');
    fireEvent.click(input);
    expect(input.type).to.equal('text');
    fireEvent.change(input, { target: { value: 'new title' } });
    fireEvent.blur(input);

    expect(input.type).to.equal('button');
    expect(onSaveTitle.calledOnceWithExactly('new title')).to.equal(true);
  });

  it('does not edit without permission and restores an empty title', () => {
    const onSaveTitle = sinon.spy();
    const { rerender } = render(
      <EditableTitle onSaveTitle={onSaveTitle} showTooltip={false} title="my title" />,
    );
    const readonly = screen.getByDisplayValue('my title');
    fireEvent.click(readonly);
    expect(readonly.type).to.equal('button');

    rerender(<EditableTitle canEdit onSaveTitle={onSaveTitle} showTooltip={false} title="my title" />);
    const editable = screen.getByDisplayValue('my title');
    fireEvent.click(editable);
    fireEvent.change(editable, { target: { value: '' } });
    fireEvent.blur(editable);
    expect(editable.value).to.equal('my title');
    expect(onSaveTitle.called).to.equal(false);
  });
});
