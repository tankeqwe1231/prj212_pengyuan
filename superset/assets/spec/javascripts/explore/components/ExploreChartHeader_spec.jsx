import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

import ExploreChartHeader from '../../../../javascripts/explore/components/ExploreChartHeader';
import { t } from '../../../../javascripts/locales';

describe('ExploreChartHeader', () => {
  afterEach(cleanup);

  it('renders an editable untitled chart and its action group', () => {
    const { container } = render(<ExploreChartHeader
      actions={{}}
      can_download
      can_overwrite
      chart={{ chartStatus: 'success', latestQueryFormData: { datasource: '1__table' } }}
      form_data={{}}
      isStarred
      table_name="foo"
      timeout={1000}
    />);
    expect(document.querySelector('.editable-title input').value).to.contain('foo');
    expect(container.querySelector('#slice-header .btn-group.results')).not.to.equal(null);
  });
});
