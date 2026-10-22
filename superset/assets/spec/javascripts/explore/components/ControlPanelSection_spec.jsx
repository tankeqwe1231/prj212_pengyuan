import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import ControlPanelSection from '../../../../javascripts/explore/components/ControlPanelSection';

describe('ControlPanelSection', () => {
  afterEach(cleanup);

  it('renders a Bootstrap 5 card and toggles its collapsed body', async () => {
    const { container } = render(
      <ControlPanelSection label="my label" description="my description">
        <div>a child element</div>
      </ControlPanelSection>,
    );
    const collapse = container.querySelector('.collapse');

    expect(container.querySelector('.card.control-panel-section')).not.to.equal(null);
    expect(container.querySelector('.control-panel-section-header')).not.to.equal(null);
    expect(container.querySelector('.control-panel-section-titlebar')).not.to.equal(null);
    expect(container.querySelector('.control-panel-section-rule')).not.to.equal(null);
    expect(container.querySelector('.control-panel-section-label')).not.to.equal(null);
    expect(container.querySelector('.control-panel-section .fa.expander')).not.to.equal(null);
    expect(collapse.classList.contains('show')).to.equal(false);
    expect(container.querySelector('.control-panel-section-titlebar .fa-info-circle')).to.equal(null);
    const expander = container.querySelector('.control-panel-section .expander');
    expect(expander.classList.contains('collapsed')).to.equal(true);
    expect(expander.classList.contains('fa-angle-right')).to.equal(true);
    expect(expander.classList.contains('expanded')).to.equal(false);

    fireEvent.click(container.querySelector('.control-panel-section-titlebar'));
    await waitFor(() => expect(collapse.classList.contains('show')).to.equal(true));
    expect(expander.classList.contains('fa-angle-right')).to.equal(true);
    expect(expander.classList.contains('expanded')).to.equal(true);
    expect(expander.classList.contains('collapsed')).to.equal(false);
    expect(screen.getByText('a child element')).not.to.equal(null);
  });

  it('honors an initially expanded section', () => {
    const { container } = render(
      <ControlPanelSection label="expanded" startExpanded>content</ControlPanelSection>,
    );
    expect(container.querySelector('.collapse').classList.contains('show')).to.equal(true);
    const expander = container.querySelector('.control-panel-section .expander');
    expect(expander.classList.contains('collapsed')).to.equal(false);
    expect(expander.classList.contains('expanded')).to.equal(true);
    expect(expander.classList.contains('fa-angle-right')).to.equal(true);
  });
});
