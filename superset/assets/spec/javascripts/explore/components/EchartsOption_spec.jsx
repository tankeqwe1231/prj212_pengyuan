import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import { EchartsOption } from '../../../../javascripts/explore/components/controls/EchartsOption';
import { t } from '../../../../javascripts/locales';

describe('EchartsOption', () => {
  afterEach(cleanup);

  it('renders the add control on a separate spaced line for an empty collection', () => {
    const { container } = render(
      <EchartsOption
        label={t('图表配置面板')}
        value={[]}
        vizType="echarts_combine"
      />,
    );

    const placeholder = container.querySelector('.text-muted');
    const addItem = container.querySelector('.echarts-option-add-item');
    expect(placeholder.textContent).to.equal(t('暂无配置项'));
    expect(addItem.previousElementSibling).to.equal(placeholder);
    expect(addItem.querySelector('.fa-plus-circle')).not.to.equal(null);
  });

  it('opens the editor after adding a configuration item', async () => {
    const onChange = sinon.spy();
    const props = {
      label: t('图表配置面板'),
      onChange,
      value: [],
      vizType: 'echarts_combine',
    };
    const { container, rerender } = render(<EchartsOption {...props} />);

    fireEvent.click(container.querySelector('.echarts-option-add-item .fa-plus-circle'));
    const nextValue = onChange.firstCall.args[0];
    rerender(<EchartsOption {...props} value={nextValue} />);
    fireEvent.click(container.querySelector('.fa-edit'));

    expect(await screen.findByText(t('配置项编辑'))).not.to.equal(null);
    expect(screen.getByDisplayValue(t('新配置项'))).not.to.equal(null);
    ['Label', 'Type'].forEach((label) => {
      const labelColumn = screen.getByText(label).closest('.col-md-3');
      expect(labelColumn).not.to.equal(null);
      expect(labelColumn.nextElementSibling.classList.contains('col-md-9')).to.equal(true);
    });
  });
});
