import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import sinon from 'sinon';

import PPTTaskManage from '../../../javascripts/profile/components/PPTTaskManage';

const $ = window.$ = require('jquery');

describe('PPTTaskManage', () => {
  let ajaxStub;

  beforeEach(() => {
    ajaxStub = sinon.stub($, 'ajax').callsFake((options) => {
      if (options.url === '/superset/ppt/tasks/' && options.data.type === 'all') {
        options.success({
          tasks: Array.from({ length: 11 }, (_, index) => ({
            task_email: '',
            task_file_name: '',
            task_name: `Task ${index + 1}`,
            task_node_list: '',
            task_status: 'created',
            taskid: index + 1,
          })),
          ppt_templates: Array.from({ length: 11 }, (_, index) => ({
            created_time: `2026-08-${String(index + 1).padStart(2, '0')}`,
            template_id: index + 1,
            template_name: `Template ${index + 1}`,
          })),
        });
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

  it('paginates task and template tables independently at ten rows', () => {
    const { container } = render(<PPTTaskManage user={{ username: 'alpha' }} />);
    const taskBody = container.querySelector('.task-body');
    const templateBody = container.querySelector('.template-body');

    expect(taskBody.querySelectorAll('tbody tr')).to.have.length(10);
    expect(templateBody.querySelectorAll('tbody tr')).to.have.length(10);

    fireEvent.click(within(taskBody).getByRole('button', { name: '2' }));
    expect(within(taskBody).getByText('Task 11')).not.to.equal(null);
    expect(within(templateBody).queryByText('Template 11')).to.equal(null);

    fireEvent.click(within(templateBody).getByRole('button', { name: '2' }));
    expect(within(templateBody).getByText('Template 11')).not.to.equal(null);
    expect(screen.getAllByRole('navigation', { name: 'Table pagination' })).to.have.length(2);
  });
});
