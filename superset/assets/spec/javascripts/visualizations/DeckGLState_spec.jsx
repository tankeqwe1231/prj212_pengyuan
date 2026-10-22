import {
  getScatterState,
} from '../../../visualizations/deckgl/layers/scatter';
import {
  getScreenGridState,
} from '../../../visualizations/deckgl/layers/screengrid';

function props() {
  return {
    slice: {
      formData: {
        color_picker: { r: 10, g: 20, b: 30, a: 1 },
        dimension: 'category',
        time_grain_sqla: 'PT1M',
      },
    },
    payload: {
      data: {
        features: [
          { __timestamp: 60000, cat_color: 'one' },
          { __timestamp: 120000, cat_color: 'two' },
        ],
      },
    },
  };
}

describe('Deck.gl Hook state derivation', () => {
  it('derives animation bounds and scatter categories from props', () => {
    const state = getScatterState(props());
    expect(state.start).to.equal(60000);
    expect(state.end).to.equal(180000);
    expect(state.values).to.deep.equal([60000, 120000]);
    expect(Object.keys(state.categories)).to.deep.equal(['one', 'two']);
  });

  it('derives animation bounds for screen grid layers', () => {
    const state = getScreenGridState(props());
    expect(state.step).to.equal(60000);
    expect(state.disabled).to.equal(false);
  });
});
