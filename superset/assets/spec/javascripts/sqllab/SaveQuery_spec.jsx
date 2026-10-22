import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import SaveQuery from '../../../javascripts/SqlLab/components/SaveQuery';
import { t } from '../../../javascripts/locales';

describe('SaveQuery', () => {
  afterEach(cleanup);

  it('opens the form and saves its label and description', () => {
    const onSave = sinon.spy();
    render(<SaveQuery dbId={1} defaultLabel="untitled" onSave={onSave} schema="main" sql="SELECT * FROM t" />);
    fireEvent.click(screen.getByText(t('Save Query')));
    const label = screen.getByPlaceholderText(t('Label for your query'));
    const description = screen.getByPlaceholderText(t('Write a description for your query'));
    fireEvent.change(label, { target: { value: 'saved query' } });
    fireEvent.change(description, { target: { value: 'description' } });
    fireEvent.click(screen.getByText(t('Save')));

    expect(onSave.calledOnceWithExactly({
      db_id: 1,
      description: 'description',
      label: 'saved query',
      schema: 'main',
      sql: 'SELECT * FROM t',
    })).to.equal(true);
  });
});
