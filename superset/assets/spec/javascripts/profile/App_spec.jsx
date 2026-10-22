import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';

import { user } from './fixtures';
import App from '../../../javascripts/profile/components/App';

const $ = window.$ = require('jquery');

describe('Profile App', () => {
  let ajaxStub;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax').callsFake((options) => {
      if (options.url === '/superset/ppt/tasks/') {
        options.success({ tasks: [], ppt_templates: [] });
      } else if (options.url === '/superset/api/dashboard/list/') {
        options.success([]);
      }
      return { abort() {} };
    });
  });

  afterEach(() => {
    cleanup();
    ajaxStub.restore();
  });

  it('renders three profile tabs and the active user panel', () => {
    const { container } = render(<App user={user} />);
    expect(container.querySelectorAll('[role="tablist"] li')).to.have.length(3);
    expect(screen.getByText(user.email, { exact: false })).not.to.equal(null);
  });

  it('renders the PPT manager after selecting the PPT tab', () => {
    const { container } = render(<App user={user} />);

    fireEvent.click(screen.getByRole('tab', { name: /生成PPT/ }));

    expect(container.querySelector('.ppt-task-container')).not.to.equal(null);
    expect(screen.getByRole('button', { name: '新建任务' })).not.to.equal(null);
    expect(screen.getByRole('button', { name: '上传模版' })).not.to.equal(null);
  });
});
