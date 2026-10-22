import { getFormDataFromControlsAndRaw } from '../../../javascripts/explore/stores/store';

describe('explore form data serialization', () => {
  it('keeps non-control compatibility parameters without restoring old viz controls', () => {
    const controls = {
      viz_type: { value: 'line' },
      metrics: { value: ['sum__value'] },
    };
    const rawFormData = {
      viz_type: 'echarts_stat_line_2',
      echarts_options: [{ series: [] }],
      custom_url_param: 'keep-me',
    };

    expect(getFormDataFromControlsAndRaw(controls, rawFormData)).to.deep.equal({
      viz_type: 'line',
      metrics: ['sum__value'],
      custom_url_param: 'keep-me',
    });
  });
});
