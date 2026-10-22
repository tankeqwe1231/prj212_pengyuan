import { expect } from 'chai';

import { getHistogramHeight } from '../../../visualizations/histogram';

describe('Histogram', () => {
  it('only reserves the SVG margins when there is no x-axis label', () => {
    expect(getHistogramHeight(530, false)).to.equal(460);
  });

  it('reserves enough room for an optional x-axis label', () => {
    expect(getHistogramHeight(530, true)).to.equal(425);
  });

  it('does not return a negative plot height for a short slice', () => {
    expect(getHistogramHeight(40, false)).to.equal(0);
  });
});
