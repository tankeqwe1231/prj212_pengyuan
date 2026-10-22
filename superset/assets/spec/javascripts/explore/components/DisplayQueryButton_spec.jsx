import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import DisplayQueryButton from '../../../../javascripts/explore/components/DisplayQueryButton';
import { t } from '../../../../javascripts/locales';

describe('DisplayQueryButton', () => {
  afterEach(cleanup);

  it('opens a modal with the latest query', () => {
    render(
      <DisplayQueryButton
        animation={false}
        chartStatus="success"
        latestQueryFormData={{ datasource: '1__table' }}
        queryResponse={{ language: 'sql', query: 'SELECT * FROM foo' }}
      />,
    );
    const trigger = screen.getByRole('button', { name: t('View Query') });
    expect(trigger.classList.contains('btn-outline-secondary')).to.equal(true);
    fireEvent.click(trigger);
    expect(screen.getByText(t('Query'))).not.to.equal(null);
    expect(document.querySelector('.modal-body code').textContent).to.equal('SELECT * FROM foo');
  });
});
