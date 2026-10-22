import { describe, it } from 'mocha';
import { expect } from 'chai';

import {
  formatLabel,
  getBarTickValues,
  getLastValue,
  getPinnedSvgWidth,
  getStaggeredXAxisBottomMargin,
  buildAnnotationData,
} from '../../../visualizations/nvd3_vis';

describe('nvd3 viz', () => {
  const verboseMap = {
    foo: 'Foo',
    bar: 'Bar',
  };
  describe('formatLabel', () => {
    it('formats simple labels', () => {
      expect(formatLabel('foo')).to.equal('foo');
      expect(formatLabel(['foo'])).to.equal('foo');
      expect(formatLabel(['foo', 'bar'])).to.equal('foo, bar');
    });
    it('formats simple labels with lookups', () => {
      expect(formatLabel('foo', verboseMap)).to.equal('Foo');
      expect(formatLabel('baz', verboseMap)).to.equal('baz');
      expect(formatLabel(['foo'], verboseMap)).to.equal('Foo');
      expect(formatLabel(['foo', 'bar', 'baz'], verboseMap)).to.equal('Foo, Bar, baz');
    });
    it('deals with --- properly', () => {
      expect(formatLabel(['foo', '---'], verboseMap)).to.equal('Foo ---');
      expect(formatLabel(['foo', 'bar', 'baz', '---'], verboseMap)).to.equal('Foo, Bar, baz ---');
    });
  });

  describe('getLastValue', () => {
    const values = [
      { x: 10, y: 1 },
      { x: 20, y: 2 },
      { x: 30, y: 3 },
    ];

    it('returns the latest point and handles an empty series', () => {
      expect(getLastValue(values)).to.deep.equal(values[2]);
      expect(getLastValue([])).to.equal(null);
      expect(getLastValue(undefined)).to.equal(null);
    });

    it('returns the point at or immediately before the brush position', () => {
      expect(getLastValue(values, 20)).to.deep.equal(values[1]);
      expect(getLastValue(values, 25)).to.deep.equal(values[1]);
      expect(getLastValue(values, 5)).to.deep.equal(values[0]);
    });
  });

  describe('getBarTickValues', () => {
    const values = Array.from({ length: 8 }, (value, x) => ({ x }));

    it('keeps readable spacing and leaves the last tick to showMaxMin', () => {
      expect(getBarTickValues(values, 200)).to.deep.equal([0, 4]);
      expect(getBarTickValues(values, 800)).to.deep.equal(values.map(d => d.x));
    });

    it('keeps both endpoints when x-axis bounds are enabled', () => {
      expect(getBarTickValues(values, 200, true)).to.deep.equal([0, 4, 7]);
    });

    it('handles empty values and unavailable width', () => {
      expect(getBarTickValues([], 200)).to.deep.equal([]);
      expect(getBarTickValues(values, 0)).to.deep.equal([]);
    });
  });

  describe('getStaggeredXAxisBottomMargin', () => {
    it('adds room only for bar charts with all ticks retained', () => {
      expect(getStaggeredXAxisBottomMargin('bar', false)).to.equal(60);
      expect(getStaggeredXAxisBottomMargin('bar', true)).to.equal(40);
      expect(getStaggeredXAxisBottomMargin('line', false)).to.equal(40);
    });
  });

  describe('getPinnedSvgWidth', () => {
    it('pins the width only when the chart overflows its container', () => {
      expect(getPinnedSvgWidth(5775, 661)).to.equal('5775px');
      expect(getPinnedSvgWidth(661, 661)).to.equal(null);
      expect(getPinnedSvgWidth(400, 661)).to.equal(null);
      expect(getPinnedSvgWidth(0, 661)).to.equal(null);
    });
  });

  describe('buildAnnotationData', () => {
    it('adds form-data events without mutating the facade data', () => {
      const existing = { layer: { records: [] } };
      const result = buildAnnotationData(existing, '2024-01-02|事件一\n2024-01-03|事件二');

      expect(result).to.not.equal(existing);
      expect(existing).to.deep.equal({ layer: { records: [] } });
      expect(result.selfEvent).to.deep.equal({
        columns: ['发生时间', '基本面事件'],
        records: [
          { 发生时间: '2024-01-02T00:00:00', 基本面事件: '事件一' },
          { 发生时间: '2024-01-03T00:00:00', 基本面事件: '事件二' },
        ],
      });
    });

    it('returns an empty object when no annotation data or events exist', () => {
      expect(buildAnnotationData(undefined, '')).to.deep.equal({});
    });
  });
});
