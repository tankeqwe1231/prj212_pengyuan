import { it, describe } from 'mocha';
import { expect } from 'chai';

import { ALL_COLOR_SCHEMES, getColorFromScheme, getForcedColor, hexToRGB } from '../../../javascripts/modules/colors';

describe('colors', () => {
  it('default to bnbColors', () => {
    const color1 = getColorFromScheme('CA');
    expect(color1).to.equal(ALL_COLOR_SCHEMES.bnbColors[0]);
  });
  it('getColorFromScheme series with same scheme should have the same color', () => {
    const color1 = getColorFromScheme('CA', 'bnbColors');
    const color2 = getColorFromScheme('CA', 'googleCategory20c');
    const color3 = getColorFromScheme('CA', 'bnbColors');
    const color4 = getColorFromScheme('NY', 'bnbColors');

    expect(color1).to.equal(ALL_COLOR_SCHEMES.bnbColors[0]);
    expect(color2).to.equal(ALL_COLOR_SCHEMES.googleCategory20c[0]);
    expect(color1).to.equal(color3);
    expect(color4).to.equal(ALL_COLOR_SCHEMES.bnbColors[1]);
  });
  it('getColorFromScheme forcing colors persists through calls', () => {
    const boysKey = '__test_forced_boys__';
    const girlsKey = '__test_forced_girls__';
    expect(getColorFromScheme(boysKey, 'bnbColors', 'blue')).to.equal('blue');
    expect(getColorFromScheme(boysKey, 'bnbColors')).to.equal('blue');
    expect(getColorFromScheme(boysKey, 'googleCategory20c')).to.equal('blue');

    expect(getColorFromScheme(girlsKey, 'bnbColors', 'pink')).to.equal('pink');
    expect(getColorFromScheme(girlsKey, 'bnbColors')).to.equal('pink');
    expect(getColorFromScheme(girlsKey, 'googleCategory20c')).to.equal('pink');
  });
  it('getForcedColor only reads forced colors, it does not register them', () => {
    const key = '__test_forced_lookup__';
    expect(getForcedColor(key)).to.equal(undefined);

    getColorFromScheme(key, 'bnbColors');
    expect(getForcedColor(key)).to.equal(undefined);

    getColorFromScheme(key, 'bnbColors', 'blue');
    expect(getForcedColor(key)).to.equal('blue');
    expect(getForcedColor('__TEST_FORCED_LOOKUP__')).to.equal('blue');
  });
  it('getColorFromScheme is not case sensitive', () => {
    const c1 = getColorFromScheme('__test_mixed_case__', 'bnbColors');
    const c2 = getColorFromScheme('__Test_Mixed_Case__', 'bnbColors');
    const c3 = getColorFromScheme('__TEST_MIXED_CASE__', 'bnbColors');
    expect(c1).to.equal(c2);
    expect(c3).to.equal(c2);
  });
  it('hexToRGB converts properly', () => {
    expect(hexToRGB('#FFFFFF')).to.have.same.members([255, 255, 255, 255]);
    expect(hexToRGB('#000000')).to.have.same.members([0, 0, 0, 255]);
    expect(hexToRGB('#FF0000')).to.have.same.members([255, 0, 0, 255]);
    expect(hexToRGB('#00FF00')).to.have.same.members([0, 255, 0, 255]);
    expect(hexToRGB('#0000FF')).to.have.same.members([0, 0, 255, 255]);
    expect(hexToRGB('#FF0000', 128)).to.have.same.members([255, 0, 0, 128]);
  });
});
