import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import sinon from 'sinon';

import $ from 'jquery';
import { table, defaultQueryEditor, databases, tables } from './fixtures';
import SqlEditorLeftBar from '../../../javascripts/SqlLab/components/SqlEditorLeftBar';

describe('SqlEditorLeftBar', () => {
  let getStub;
  let notifyError;
  let actions;

  beforeEach(() => {
    notifyError = sinon.spy();
    global.notify = { error: notifyError };
    actions = {
      addAlert: sinon.spy(),
      addTable: sinon.spy(),
      queryEditorSetDb: sinon.spy(),
      queryEditorSetSchema: sinon.spy(),
      resetState: sinon.spy(),
      setDatabases: sinon.spy(),
    };
    getStub = sinon.stub($, 'get').callsFake((url) => {
      const request = $.Deferred();
      if (url.startsWith('/databaseasync/api/')) {
        request.resolve(databases);
      } else if (url === '/superset/schemas/1/') {
        request.resolve({ schemas: ['main', 'superset'] });
      } else if (url === '/superset/tables/1/main/undefined/') {
        request.resolve(tables);
      } else if (url === '/superset/tables/1/null/birth') {
        request.resolve({
          options: [{ value: 'main.birth_names', label: 'main.birth_names' }],
        });
      } else {
        request.reject({ responseText: 'unexpected request' });
      }
      return request.promise();
    });
  });

  afterEach(() => {
    cleanup();
    getStub.restore();
  });

  it('loads schema and table choices and adds the selected table', () => {
    const queryEditor = { ...defaultQueryEditor, dbId: 1, schema: 'main' };
    const { container } = render(<SqlEditorLeftBar
      actions={actions}
      database={{ allow_multi_schema_metadata_fetch: false }}
      height={500}
      queryEditor={queryEditor}
      tables={[table]}
    />);

    expect(getStub.calledWith('/superset/schemas/1/')).to.equal(true);
    expect(getStub.calledWith('/superset/tables/1/main/undefined/')).to.equal(true);
    expect(actions.setDatabases.calledWith(databases.result)).to.equal(true);
    expect(container.querySelector('.TableElement')).not.to.equal(null);

    const tableControl = container.querySelectorAll('.Select__control')[2];
    fireEvent.change(tableControl.querySelector('[role="combobox"]'), {
      target: { value: 'birth' },
    });
    expect(screen.queryByRole('option', { name: 'energy_usage' })).to.equal(null);
    fireEvent.click(screen.getByRole('option', { name: 'birth_names' }));

    expect(actions.addTable.calledOnceWithExactly(queryEditor, 'birth_names', 'main'))
      .to.equal(true);
  });

  it('loads async table options as an array when no schema is selected', async () => {
    const queryEditor = { ...defaultQueryEditor, dbId: 1, schema: null };
    const { container } = render(<SqlEditorLeftBar
      actions={actions}
      database={{ allow_multi_schema_metadata_fetch: true }}
      height={500}
      queryEditor={queryEditor}
      tables={[]}
    />);
    const tableControl = container.querySelectorAll('.Select__control')[2];
    fireEvent.change(tableControl.querySelector('[role="combobox"]'), {
      target: { value: 'birth' },
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'main.birth_names' })).not.to.equal(null);
    });
    fireEvent.click(screen.getByRole('option', { name: 'main.birth_names' }));
    expect(actions.addTable.calledOnceWithExactly(queryEditor, 'birth_names', 'main'))
      .to.equal(true);
  });

  it('clears the selected database and reports an async loading error', () => {
    const queryEditor = { ...defaultQueryEditor, dbId: 1, schema: 'main' };
    getStub.restore();
    getStub = sinon.stub($, 'get').callsFake(() => $.Deferred().reject({
      responseText: 'database unavailable',
    }).promise());

    const { container } = render(<SqlEditorLeftBar
      actions={actions}
      height={500}
      queryEditor={queryEditor}
      tables={[]}
    />);

    expect(notifyError.called).to.equal(true);
    const databaseControl = container.querySelectorAll('.Select__control')[0];
    const clearIndicator = databaseControl.querySelector('.Select__clear-indicator');
    if (clearIndicator) fireEvent.mouseDown(clearIndicator);
    expect(container.querySelectorAll('.Select__control')).to.have.length(3);
  });
});
