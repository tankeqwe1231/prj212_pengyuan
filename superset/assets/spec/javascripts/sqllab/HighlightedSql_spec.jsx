import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import HighlightedSql from '../../../javascripts/SqlLab/components/HighlightedSql';
import { t } from '../../../javascripts/locales';

describe('HighlightedSql', () => {
  afterEach(cleanup);

  it('shrinks preview SQL and opens source/raw SQL in a modal', () => {
    const sql = "SELECT * FROM test WHERE something='a long value'";
    const { container } = render(
      <HighlightedSql maxWidth={10} rawSql="SELECT * FROM raw_table" shrink sql={sql} />,
    );
    expect(container.textContent).to.contain('{...}');
    fireEvent.click(container.querySelector('pre'));
    expect(screen.getByText(t('Source SQL'))).not.to.equal(null);
    expect(screen.getByText(t('Raw SQL'))).not.to.equal(null);
  });
});
