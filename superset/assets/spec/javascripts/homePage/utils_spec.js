import { ensureArray } from '../../../javascripts/homePage/utils';

describe('homePage utils', () => {
  it('preserves arrays and converts invalid API collection values to empty arrays', () => {
    const rows = [{ id: 1 }];

    expect(ensureArray(rows)).to.equal(rows);
    expect(ensureArray(null)).to.deep.equal([]);
    expect(ensureArray({ inputs: {} })).to.deep.equal([]);
  });
});
