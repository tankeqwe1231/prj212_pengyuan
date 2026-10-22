import React from 'react';
import {
  cleanup, fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import sinon from 'sinon';

import timeTableViz, { TimeTable } from '../../../visualizations/time_table';
import { unmountReact } from '../../../javascripts/modules/reactRoot';

describe('TimeTable', () => {
  let offsetWidthDescriptor;

  beforeEach(() => {
    offsetWidthDescriptor = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      'offsetWidth',
    );
    Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        if (this.matches && this.matches('.second-timetb7')) return 320;
        if (this.dataset && this.dataset.column === 'metric') return 80;
        if (this.dataset && this.dataset.column === 'value0') return 120;
        return 0;
      },
    });
  });

  afterEach(() => {
    cleanup();
    if (offsetWidthDescriptor) {
      Object.defineProperty(
        window.HTMLElement.prototype,
        'offsetWidth',
        offsetWidthDescriptor,
      );
    } else {
      delete window.HTMLElement.prototype.offsetWidth;
    }
  });

  it('sorts raw values, redraws charts, and synchronizes grouped header widths', () => {
    const drawGraph = sinon.spy();
    render(<TimeTable
      aliasLabels={{ metric_a: 'Metric A' }}
      columnCollection={[{
        colType: 'number',
        key: 'value',
        label: 'Value',
        width: 120,
      }]}
      defaultSort={false}
      drawGraph={drawGraph}
      fontWeightClass="font_weight_bold"
      metricCaption="Metric"
      sliceId={7}
      tableData={[[
        { metric: 'metric_a', value: { data: 10, display: <span>Ten</span> } },
        { metric: 'metric_b', value: { data: 2, display: <span>Two</span> } },
      ]]}
      topColumns={['Period']}
    />);

    expect(drawGraph.calledOnce).to.equal(true);
    expect(document.querySelector('#top-timetb7').style.width).to.equal('320px');
    expect(document.querySelector('#top_timeth7').style.width).to.equal('80px');
    expect(document.querySelector('#top_timeth7Period').style.width).to.equal('120px');

    fireEvent.click(screen.getByRole('button', { name: 'Value' }));
    const rows = screen.getAllByRole('row').slice(2);
    expect(within(rows[0]).getByText('Two')).not.to.equal(null);
    expect(within(rows[1]).getByText('Ten')).not.to.equal(null);
    expect(drawGraph.calledTwice).to.equal(true);
  });

  it('renders the chart description immediately after the table', () => {
    render(<TimeTable
      aliasLabels={{}}
      chartDescription={'First line\nSecond line'}
      columnCollection={[{
        colType: 'number',
        key: 'value',
        label: 'Value',
      }]}
      defaultSort={false}
      drawGraph={() => {}}
      metricCaption="Metric"
      sliceId={8}
      tableData={[[
        { metric: 'metric_a', value: { data: 10, display: <span>Ten</span> } },
      ]]}
      topColumns={[]}
    />);

    const description = screen.getByText(/First line/);
    const tableWrapper = description.previousElementSibling;
    const headers = tableWrapper.querySelectorAll('thead th');

    expect(description.className).to.equal('time-table-description');
    expect(description.textContent).to.equal('First line\nSecond line');
    expect(tableWrapper.className).to.equal('app-table-wrapper');
    expect(tableWrapper.querySelector('table')).not.to.equal(null);
    expect(headers).to.have.length(2);
    headers.forEach((header) => {
      expect(header.style.backgroundColor).to.equal('rgb(255, 255, 255)');
      expect(header.style.position).to.equal('sticky');
      expect(header.style.top).to.equal('0px');
      expect(header.style.zIndex).to.equal('3');
    });
  });

  it('updates an existing visualization root without clearing React-owned nodes', async () => {
    const container = document.createElement('div');
    container.id = 'time-table-viz-root';
    document.body.appendChild(container);
    const formData = {
      alias_labels: '',
      chart_description: '',
      column_collection: [{
        colType: 'time',
        key: 'value',
        label: 'Value',
        timeLag: 0,
      }],
      excel_style: '.timetable { color: rgb(1, 2, 3); }',
      index_order: null,
      metric_caption: 'Metric',
      metrics: ['metric_a'],
      order_type: null,
      slice_id: 9,
      table_column_num: null,
    };
    const slice = {
      container: {
        css(property, value) {
          container.style[property] = value;
        },
        html(value) {
          container.innerHTML = value;
        },
      },
      containerId: container.id,
      datasource: {
        metrics: [{ metric_name: 'metric_a' }],
      },
      formData,
      height: () => 300,
      selector: `#${container.id}`,
    };
    const createPayload = value => ({
      data: {
        is_group_by: false,
        records: [{ '2026-08-27': { metric_a: value } }],
        topcolumn: [],
      },
    });

    try {
      timeTableViz(slice, createPayload(10));
      await waitFor(() => {
        expect(container.textContent).to.contain('10');
      });

      timeTableViz(slice, createPayload(20));
      await waitFor(() => {
        expect(container.textContent).to.contain('20');
        expect(container.textContent).not.to.contain('10');
      });

      expect(container.querySelectorAll('style')).to.have.length(1);
    } finally {
      unmountReact(container);
      container.remove();
    }
  });

  it('calculates a zero difference when both time values are zero', async () => {
    const container = document.createElement('div');
    container.id = 'time-table-diff-viz-root';
    document.body.appendChild(container);
    const formData = {
      alias_labels: '',
      chart_description: '',
      column_collection: [{
        colType: 'time',
        comparisonType: 'diff',
        key: 'value',
        label: 'Difference',
        timeLag: 1,
      }],
      excel_style: '',
      index_order: null,
      metric_caption: 'Metric',
      metrics: ['metric_a'],
      order_type: null,
      slice_id: 10,
      table_column_num: null,
    };
    const slice = {
      container: {
        css(property, value) {
          container.style[property] = value;
        },
        html(value) {
          container.innerHTML = value;
        },
      },
      containerId: container.id,
      datasource: {
        metrics: [{ metric_name: 'metric_a' }],
      },
      formData,
      height: () => 300,
      selector: `#${container.id}`,
    };

    try {
      timeTableViz(slice, {
        data: {
          is_group_by: false,
          records: [{
            '2026-08-26': { metric_a: 0 },
            '2026-08-27': { metric_a: 0 },
          }],
          topcolumn: [],
        },
      });
      await waitFor(() => {
        const valueCell = container.querySelector('tbody tr td:nth-child(2)');
        expect(valueCell.textContent).to.equal('0');
      });
    } finally {
      unmountReact(container);
      container.remove();
    }
  });
});
