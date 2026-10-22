import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';

import EmbedCodeButton from '../../../../javascripts/explore/components/EmbedCodeButton';

describe('EmbedCodeButton', () => {
  afterEach(cleanup);

  it('opens and updates generated iframe code', () => {
    const { container } = render(
      <EmbedCodeButton latestQueryFormData={{ datasource: '107__table' }} />,
    );
    fireEvent.click(container.querySelector('.fa-code'));
    const height = document.querySelector('input[name="height"]');
    const width = document.querySelector('input[name="width"]');
    fireEvent.change(height, { target: { name: 'height', value: '1000' } });
    fireEvent.change(width, { target: { name: 'width', value: '2000' } });

    const code = document.querySelector('textarea[name="embedCode"]').value;
    expect(code).to.contain('width="2000"');
    expect(code).to.contain('height="1000"');
    expect(code).to.contain('107__table');
  });
});
