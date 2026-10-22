import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import sinon from 'sinon';
import $ from 'jquery';

import SliceAdder from '../../../javascripts/dashboard/components/SliceAdder';
import {
  isDashboardResizeSuppressed,
  resumeDashboardResize,
} from '../../../javascripts/dashboard/resizeUtils';

function getSlices() {
  return Array.from({ length: 11 }, (_, index) => ({
    datasource_link: index === 0
      ? '<a class="datasource" href="javascript:bad()" onclick="bad()"><img src=x>Datasource 1</a><a class="safe-datasource" href="/superset/explore/table/1/">Datasource 1</a>'
      : `<a href="/superset/explore/table/${index + 1}/">Datasource ${index + 1}</a>`,
    id: index + 1,
    modified: index === 0
      ? '<span class="modified">Today</span><script>bad()</script>'
      : `<span>${index + 1} days ago</span>`,
    slice_name: `Slice ${index + 1}`,
    viz_type: 'line',
  }));
}

describe('SliceAdder', () => {
  let ajaxStub;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax').callsFake(options => {
      options.success({ result: getSlices() });
      return { abort() {} };
    });
  });

  afterEach(() => {
    cleanup();
    resumeDashboardResize();
    ajaxStub.restore();
  });

  it('shows owned slices in a safe, paginated table', () => {
    render(
      <SliceAdder
        addSlicesToDashboard={() => ({ fail() {} })}
        dashboard={{}}
        triggerNode={<span>Open slices</span>}
        userId="6"
      />,
    );

    fireEvent.click(screen.getByText('Open slices'));

    expect(ajaxStub.calledOnce).to.equal(true);
    expect(ajaxStub.firstCall.args[0].url).to.equal(
      '/sliceaddview/api/read?_flt_0_created_by=6',
    );
    expect(screen.getAllByRole('row')).to.have.length(11);
    expect(document.querySelector('[data-column="modified"]')).not.to.equal(null);
    expect(document.querySelector('script')).to.equal(null);
    expect(document.querySelector('img[src="x"]')).to.equal(null);
    expect(document.querySelector('[onclick]')).to.equal(null);
    expect(document.querySelector('a.datasource').hasAttribute('href')).to.equal(false);
    expect(document.querySelector('a.safe-datasource').getAttribute('href')).to.equal(
      '/superset/explore/table/1/',
    );
    expect(screen.getByText('Today')).not.to.equal(null);

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('Slice 11')).not.to.equal(null);
    expect(screen.queryByText('Slice 1')).to.equal(null);
  });

  it('reuses loaded slices when the modal is opened again', async () => {
    render(
      <SliceAdder
        addSlicesToDashboard={() => ({ fail() {} })}
        dashboard={{}}
        triggerNode={<span>Open slices</span>}
        userId="6"
      />,
    );

    fireEvent.click(screen.getByText('Open slices'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(isDashboardResizeSuppressed()).to.equal(true);
    await waitFor(() => expect(screen.queryByText('Slice 1')).to.equal(null));
    await waitFor(() => expect(isDashboardResizeSuppressed()).to.equal(false));
    fireEvent.click(screen.getByText('Open slices'));

    expect(ajaxStub.calledOnce).to.equal(true);
  });
});
