/* eslint-disable no-unused-expressions */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import DateFilterControl from '../../../../javascripts/explore/components/controls/DateFilterControl';

describe('DateFilterControl', () => {
  afterEach(cleanup);

  function renderControl(onChange = sinon.spy(), value = '90 days ago') {
    const view = render(
      <DateFilterControl
        animation={false}
        label="date"
        name="date"
        onChange={onChange}
        value={value}
      />,
    );
    return { ...view, onChange };
  }

  function openPopover() {
    fireEvent.click(screen.getByText('90 days ago'));
    return document.body.querySelector('[id$="-popover"]');
  }

  it('renders its control header', () => {
    const { container } = renderControl();
    expect(container.querySelector('.ControlHeader').textContent).to.contain('date');
  });

  it('renders three action buttons after opening', () => {
    renderControl();
    const popover = openPopover();
    expect(popover).to.exist;
    expect(popover.querySelectorAll('button')).to.have.length(3);
  });

  it('loads the relative number from the current value', () => {
    renderControl();
    const relativeInput = openPopover().querySelector('.input-inline input');
    expect(relativeInput.value).to.equal('90');
  });

  it('keeps now as a free-form value without parsing it as a date', () => {
    renderControl(sinon.spy(), 'now');
    fireEvent.click(screen.getByText('now'));
    expect(document.querySelector('input[name="date-free"]').value).to.equal('now');
  });

  it('sets now and closes the popover', () => {
    const { onChange } = renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'now' }));

    expect(onChange.calledWith('now')).to.be.true;
    expect(document.body.querySelector('[id$="-popover"]')).to.equal(null);
  });

  it('dims the two inactive date modes', () => {
    renderControl();
    const popover = openPopover();
    expect(popover.querySelectorAll('.PopoverSection.dimmed')).to.have.length(2);
  });

  it('activates the fixed date mode when its input receives focus', () => {
    renderControl();
    const popover = openPopover();
    const fixedInput = popover.querySelector('input[name="date-fixed"]');

    fireEvent.focus(fixedInput);

    expect(popover.querySelector('.PopoverSection.dimmed')).to.equal(
      popover.querySelectorAll('.PopoverSection')[1],
    );
  });

  it('closes and publishes the current value when confirmed', () => {
    const { onChange } = renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'Ok' }));

    expect(onChange.calledWith('90 days ago')).to.be.true;
    expect(document.body.querySelector('[id$="-popover"]')).to.equal(null);
  });

  it('assigns stable id and name attributes to its form fields', () => {
    renderControl();
    const popover = openPopover();
    Array.from(popover.querySelectorAll('input.form-control')).forEach((input) => {
      expect(input.id).not.to.equal('');
      expect(input.name).not.to.equal('');
    });
  });

  it('clears the value and closes the popover', () => {
    const { onChange } = renderControl();
    openPopover();
    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(onChange.calledWith('')).to.be.true;
    expect(document.body.querySelector('[id$="-popover"]')).to.equal(null);
  });
});
