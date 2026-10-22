import React from 'react';
import { cleanup, render } from '@testing-library/react';
import ExploreActionButtons from '../../../../javascripts/explore/components/ExploreActionButtons';

describe('ExploreActionButtons', () => {
  afterEach(cleanup);

  it('renders the five share, export, and query actions', () => {
    const { container } = render(
      <ExploreActionButtons canDownload latestQueryFormData={{ datasource: '1__table' }} />,
    );
    expect(container.querySelector('.btn-group.results').children).to.have.length(5);
    expect(container.querySelector('.fa-link')).not.to.equal(null);
    expect(container.querySelector('.fa-code')).not.to.equal(null);
    expect(container.querySelector('.fa-file-code-o')).not.to.equal(null);
    expect(container.querySelector('.fa-file-text-o')).not.to.equal(null);
  });
});
