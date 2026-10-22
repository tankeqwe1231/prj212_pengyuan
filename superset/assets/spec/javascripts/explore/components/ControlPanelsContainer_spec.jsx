import React from 'react';
import { cleanup, render } from '@testing-library/react';
import {
  getControlsState,
  getFormDataFromControls,
} from '../../../../javascripts/explore/stores/store';
import { ControlPanelsContainer } from '../../../../javascripts/explore/components/ControlPanelsContainer';

const exploreState = {
  common: { conf: { ENABLE_JAVASCRIPT_CONTROLS: true } },
  datasource: {
    columns: [],
    database: { backend: 'mysql', name: 'main' },
    edit_url: '/datasource/1',
    metrics: [],
    name: 'birth_names',
    type: 'table',
  },
};
const controls = getControlsState(exploreState, { datasource: '1__table', viz_type: 'table' });
const defaultProps = {
  datasource_type: 'table',
  actions: {},
  controls,
  form_data: getFormDataFromControls(controls),
  isDatasourceMetaLoading: false,
  exploreState,
};

describe('ControlPanelsContainer', () => {
  afterEach(cleanup);

  it('renders all query and display control-panel sections', () => {
    const { container } = render(<ControlPanelsContainer {...defaultProps} />);
    expect(container.querySelectorAll('.control-panel-section').length).to.equal(7);
    expect(container.querySelectorAll('.filter-control-row')).to.have.length(1);
    expect(container.querySelectorAll('.filter-control-row.control-row')).to.have.length(0);
  });
});
