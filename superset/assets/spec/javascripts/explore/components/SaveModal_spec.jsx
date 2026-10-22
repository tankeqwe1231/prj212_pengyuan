import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import { SaveModal } from '../../../../javascripts/explore/components/SaveModal';
import { t } from '../../../../javascripts/locales';

function actions() {
  return {
    fetchDashboards: sinon.spy(),
    removeSaveModalAlert: sinon.spy(),
    saveSlice: sinon.stub().returns(new Promise(() => {})),
  };
}

const baseProps = {
  can_overwrite: true,
  dashboards: [{ value: 100, label: 'Dashboard 100' }],
  form_data: { datasource: '107__table' },
  onHide: () => {},
  slice: { slice_id: 1, slice_name: 'title' },
  userId: '1',
};

describe('SaveModal', () => {
  afterEach(cleanup);

  it('loads dashboards and overwrites an owned chart', () => {
    const modalActions = actions();
    const onHide = sinon.spy();
    render(<SaveModal {...baseProps} actions={modalActions} onHide={onHide} />);
    expect(modalActions.fetchDashboards.calledOnceWithExactly('1')).to.equal(true);
    expect(document.querySelectorAll('input[type="radio"]')).to.have.length(5);
    fireEvent.click(screen.getByText(t('Save')));
    expect(modalActions.saveSlice.calledOnceWithExactly(baseProps.form_data, {
      action: 'overwrite',
      add_to_dash: 'noSave',
      goto_dash: false,
      slice_id: 1,
      slice_name: 'title',
    })).to.equal(true);
    expect(onHide.calledOnce).to.equal(true);
  });

  it('validates a new chart name before saving a copy', () => {
    const modalActions = actions();
    render(<SaveModal
      {...baseProps}
      actions={modalActions}
      can_overwrite={false}
      slice={null}
    />);
    expect(document.querySelector('#overwrite-radio')).to.equal(null);
    fireEvent.click(screen.getByText(t('Save')));
    expect(screen.getByText(t('Please enter a slice name'))).not.to.equal(null);
    fireEvent.change(screen.getByPlaceholderText(t('[chart name]')), {
      target: { value: 'new chart' },
    });
    fireEvent.click(screen.getByText(t('Save')));
    expect(modalActions.saveSlice.lastCall.args[1]).to.include({
      action: 'saveas', slice_name: 'new chart',
    });
  });

  it('requires a name when adding the chart to a new dashboard', () => {
    const modalActions = actions();
    render(<SaveModal {...baseProps} actions={modalActions} />);
    fireEvent.click(screen.getByText(t('Add to new dashboard')));
    fireEvent.click(screen.getByText(t('Save & go to dashboard')));
    expect(screen.getByText(t('Please enter a dashboard name'))).not.to.equal(null);
    fireEvent.change(screen.getByPlaceholderText(t('[dashboard name]')), {
      target: { value: 'new dashboard' },
    });
    fireEvent.click(screen.getByText(t('Save & go to dashboard')));
    expect(modalActions.saveSlice.lastCall.args[1]).to.include({
      add_to_dash: 'new', goto_dash: true, new_dashboard_name: 'new dashboard',
    });
  });
});
