/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import QueryAndSaveButtons from '../../../../javascripts/explore/components/QueryAndSaveBtns';
import { t } from '../../../../javascripts/locales';

describe('QueryAndSaveButtons', () => {
  afterEach(cleanup);

  it('renders query/save actions and publishes clicks', () => {
    const onQuery = sinon.spy();
    const onSave = sinon.spy();
    render(<QueryAndSaveButtons canAdd="True" onQuery={onQuery} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('Run Query')) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('Save')) }));
    expect(onQuery.calledOnce).to.be.true;
    expect(onSave.calledOnce).to.be.true;
  });
});
