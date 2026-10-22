import React from 'react';
import { cleanup, render } from '@testing-library/react';

import ChartBody from '../../../javascripts/chart/ChartBody';

describe('ChartBody', () => {
  afterEach(cleanup);

  it('keeps a stable narrow container facade and applies edit mode changes', () => {
    const markup = document.createElement('div');
    markup.className = 'markup';
    markup.innerHTML = '<div class="editdiv"></div><div class="showdiv"></div>';
    document.body.appendChild(markup);
    const bodyRef = React.createRef();
    const view = render(<ChartBody
      ref={bodyRef}
      containerId="chart-body-test"
      vizType="table"
      height={() => 300}
      width={() => 400}
      editMode={false}
    />);
    const facade = bodyRef.current;

    facade.html('<span class="rendered">content</span>');
    facade.css('height', '300px');
    facade.toggleClass('reduce-x-ticks-disabled', true);
    expect(facade.get(0).id).to.equal('chart-body-test');
    expect(facade.get(0).classList.contains('reduce-x-ticks-disabled')).to.equal(true);
    expect(facade.find('.rendered').text()).to.equal('content');
    expect(facade.height()).to.equal(300);
    expect(facade.width()).to.equal(400);

    view.rerender(<ChartBody
      ref={bodyRef}
      containerId="chart-body-test"
      vizType="table"
      height={() => 300}
      width={() => 400}
      editMode
    />);
    expect(bodyRef.current).to.equal(facade);
    facade.toggleClass('reduce-x-ticks-disabled', false);
    expect(facade.get(0).classList.contains('reduce-x-ticks-disabled')).to.equal(false);
    expect(markup.querySelector('.editdiv').style.display).not.to.equal('none');
    expect(markup.querySelector('.showdiv').style.display).to.equal('none');

    view.unmount();
    markup.remove();
  });
});
