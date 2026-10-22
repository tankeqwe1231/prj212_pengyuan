import React from 'react';
import { cleanup, render } from '@testing-library/react';

import OptionDescription from '../../../javascripts/components/OptionDescription';

describe('OptionDescription', () => {
  afterEach(cleanup);

  it('renders the option label and description affordance', () => {
    const { container } = render(<OptionDescription option={{
      label: 'Some option',
      description: 'Description for some option',
    }} />);
    expect(container.querySelector('.option-label').textContent.trim()).to.equal('Some option');
    expect(container.querySelector('.fa-question-circle-o')).not.to.equal(null);
  });
});
