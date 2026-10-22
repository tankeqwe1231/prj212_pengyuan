import React from 'react';
import { cleanup, render } from '@testing-library/react';

import MetricOption from '../../../javascripts/components/MetricOption';

describe('MetricOption', () => {
  const defaultProps = {
    metric: {
      metric_name: 'foo',
      verbose_name: 'Foo',
      expression: 'SUM(foo)',
      description: 'Foo is the greatest metric of all',
      warning_text: 'Be careful when using foo',
    },
    showType: false,
  };

  afterEach(cleanup);

  it('shows the verbose name and all metric help icons', () => {
    const { container } = render(<MetricOption {...defaultProps} />);
    expect(container.querySelector('.option-label').textContent).to.equal('Foo');
    expect(container.querySelectorAll('i.fa')).to.have.length(3);
  });

  it('omits the description icon when no description is provided', () => {
    const metric = { ...defaultProps.metric, description: null };
    const { container } = render(<MetricOption {...defaultProps} metric={metric} />);
    expect(container.querySelectorAll('i.fa')).to.have.length(2);
  });

  it('uses metric_name when verbose_name is absent', () => {
    const metric = { ...defaultProps.metric, verbose_name: null };
    const { container } = render(<MetricOption {...defaultProps} metric={metric} />);
    expect(container.querySelector('.option-label').textContent).to.equal('foo');
  });

  it('shows only the formula icon when description and warning are absent', () => {
    const metric = { ...defaultProps.metric, description: null, warning_text: null };
    const { container } = render(<MetricOption {...defaultProps} metric={metric} />);
    expect(container.querySelectorAll('i.fa')).to.have.length(1);
  });

  it('opens a metric link in a new window only when requested', () => {
    const url = 'https://github.com/apache/incubator-superset';
    const view = render(<MetricOption {...defaultProps} url={url} />);
    expect(view.container.querySelector('a').getAttribute('target')).to.equal(null);

    view.rerender(<MetricOption {...defaultProps} openInNewWindow url={url} />);
    expect(view.container.querySelector('a').getAttribute('target')).to.equal('_blank');
    expect(view.container.querySelector('a').getAttribute('rel')).to.equal('noopener noreferrer');
  });

  it('shows a metric type label when requested', () => {
    const { container } = render(<MetricOption {...defaultProps} showType />);
    expect(container.querySelector('.type-label').textContent).to.equal('ƒ');
  });
});
