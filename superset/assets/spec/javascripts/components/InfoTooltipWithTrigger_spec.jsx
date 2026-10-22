import React, { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';

import InfoTooltipWithTrigger from '../../../javascripts/components/InfoTooltipWithTrigger';

describe('InfoTooltipWithTrigger', () => {
  afterEach(cleanup);

  it('forwards its ref to the icon element', () => {
    const ref = createRef();

    render(<InfoTooltipWithTrigger ref={ref} label="edit-column" icon="edit" />);

    expect(ref.current).to.be.instanceOf(HTMLElement);
    expect(ref.current.classList.contains('fa-edit')).to.equal(true);
  });
});
