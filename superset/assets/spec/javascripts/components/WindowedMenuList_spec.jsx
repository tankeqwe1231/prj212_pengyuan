import React, { createRef } from 'react';
import { cleanup, render } from '@testing-library/react';

import WindowedMenuList, {
  WINDOWED_OPTION_HEIGHT,
} from '../../../javascripts/components/WindowedMenuList';

function TestOption({ data }) {
  return <div data-option={data.value}>{data.label}</div>;
}

function option(value) {
  return <TestOption key={value} data={{ value, label: value }} />;
}

describe('WindowedMenuList', () => {
  afterEach(cleanup);

  it('uses fixed option height and caps the list at maxHeight', () => {
    const { container, rerender } = render(<WindowedMenuList maxHeight={200}>
      {option('one')}
      {option('two')}
    </WindowedMenuList>);
    expect(container.firstChild.style.height).to.equal(`${WINDOWED_OPTION_HEIGHT * 2}px`);

    rerender(<WindowedMenuList maxHeight={50}>
      {option('one')}
      {option('two')}
    </WindowedMenuList>);
    expect(container.firstChild.style.height).to.equal('50px');
  });

  it('forwards menu props/ref and handles empty children', () => {
    const innerRef = createRef();
    const { container, rerender } = render(<WindowedMenuList
      innerProps={{ 'aria-label': 'windowed options', role: 'listbox' }}
      innerRef={innerRef}
      maxHeight={200}
    />);
    expect(container.querySelector('[role="listbox"]')).to.equal(innerRef.current);
    expect(innerRef.current.getAttribute('aria-label')).to.equal('windowed options');
    expect(container.firstChild.style.height).to.equal('0px');
    rerender(<WindowedMenuList maxHeight={200}>{option('one')}</WindowedMenuList>);
    expect(container.firstChild.style.height).to.equal(`${WINDOWED_OPTION_HEIGHT}px`);
  });

  it('preserves option keys across rows', () => {
    const { container, rerender } = render(<WindowedMenuList maxHeight={200}>
      {option('one')}
      {option('two')}
    </WindowedMenuList>);
    const originalOne = container.querySelector('[data-option="one"]');
    expect(container.textContent).to.equal('onetwo');
    rerender(<WindowedMenuList maxHeight={200}>
      {option('two')}
      {option('one')}
    </WindowedMenuList>);
    expect(container.textContent).to.equal('twoone');
    expect(container.querySelector('[data-option="one"]')).to.equal(originalOne);
  });

  it('scrolls the focused option into the rendered window', () => {
    const optionData = Array.from({ length: 20 }, (unused, index) => ({
      label: `option-${index}`,
      value: index,
    }));
    const children = optionData.map(item => (
      <TestOption key={item.value} data={item} />
    ));
    const { container } = render(<WindowedMenuList
      focusedOption={optionData[15]}
      maxHeight={WINDOWED_OPTION_HEIGHT * 2}
    >
      {children}
    </WindowedMenuList>);
    expect(container.textContent).to.contain('option-15');
  });
});
