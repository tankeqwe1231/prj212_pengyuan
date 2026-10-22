import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import CodeModal from '../../../javascripts/dashboard/components/CodeModal';
import { t } from '../../../javascripts/locales';

describe('CodeModal', () => {
  afterEach(cleanup);

  it('opens and displays dashboard filter code', () => {
    const { container } = render(
      <CodeModal code="region=CN" triggerNode={<i aria-label="show-code" className="fa fa-edit" />} />,
    );
    fireEvent.click(container.querySelector('.fa-edit'));
    expect(screen.getByText(t('Active Dashboard Filters'))).not.to.equal(null);
    expect(screen.getByText('region=CN')).not.to.equal(null);
  });
});
