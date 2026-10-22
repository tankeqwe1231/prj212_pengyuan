import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axios from 'axios';
import sinon from 'sinon';

describe('ReportsDataManage local report uploads', () => {
  let ReportsDataManage;
  let post;
  let savedFormData;
  let reports;

  before(function loadComponent() {
    this.timeout(10000);
    const bootstrap = document.createElement('div');
    bootstrap.id = 'row-main-container';
    bootstrap.setAttribute('init-data-dict', JSON.stringify({
      variety_sections: { '板块A': ['品种A'] },
      report_types: ['类别A'],
    }));
    document.body.appendChild(bootstrap);
    // This legacy entry reads the Jinja bootstrap data at import time.
    // eslint-disable-next-line global-require
    ReportsDataManage = require('../../../javascripts/reportsData/components/ReportsDataManage').default;
    bootstrap.remove();
  });

  beforeEach(() => {
    // Use matching browser File/FormData objects, rather than Node's fetch types.
    savedFormData = global.FormData;
    global.FormData = window.FormData;
    reports = [];
    post = sinon.stub(axios, 'post').callsFake((url, data) => {
      if (data.action === 'get_reports') {
        return Promise.resolve({ data: { reports_data: reports } });
      }
      if (data instanceof window.FormData) {
        if (data.get('action') === 'upload_cover') {
          return Promise.resolve({ data: { success: true, file_url: '/custom.png' } });
        }
        return Promise.resolve({ data: {
          success: true, file_uuid: 'a'.repeat(32),
          file_origin_name: '季度报告.pdf', file_suffix: 'pdf',
        } });
      }
      return Promise.resolve({ data: { success: true } });
    });
  });

  afterEach(() => {
    cleanup();
    post.restore();
    global.FormData = savedFormData;
  });

  function openForm() {
    const view = render(<ReportsDataManage />);
    fireEvent.click(screen.getByRole('button', { name: '新增报告' }));
    return view;
  }

  function fillForm(container) {
    const textInputs = container.querySelectorAll('input.rdm-form-input[type="text"]');
    fireEvent.change(textInputs[0], { target: { value: '季度报告' } });
    fireEvent.change(textInputs[2], { target: { value: '测试作者' } });
    fireEvent.change(container.querySelector('input[type="date"]'), { target: { value: '2026-10-12' } });
    ['板块A', '品种A', '类别A'].forEach((option, index) => {
      fireEvent.keyDown(screen.getAllByRole('combobox')[index], { key: 'ArrowDown', code: 'ArrowDown' });
      fireEvent.click(screen.getByText(option));
    });
  }

  async function chooseReport(container, filename, type) {
    const file = new window.File(['test file'], filename, { type });
    fireEvent.change(container.querySelector('input[accept=".pdf"]'), {
      target: { files: [file] },
    });
    await screen.findByText(filename);
    return file;
  }

  function reportUploadCalls() {
    return post.getCalls().filter(call => call.args[1] instanceof window.FormData
      && call.args[1].get('action') === 'upload_report_file');
  }

  it('uploads a PDF with an uppercase extension and submits the returned metadata', async () => {
    const { container } = openForm();
    fillForm(container);
    const file = await chooseReport(container, '季度报告.PDF', 'application/pdf');
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => expect(post.getCalls().some(call => call.args[1].action === 'add_report')).to.equal(true));
    const upload = reportUploadCalls()[0];
    expect(upload.args[0]).to.equal('/reportsdatamanage/list');
    expect(upload.args[1].get('file')).to.equal(file);
    expect(upload.args[1].has('file_ext')).to.equal(false);
    const submit = post.getCalls().find(call => call.args[1].action === 'add_report').args[1];
    expect(submit).to.include({
      report_file_url: 'a'.repeat(32), report_file_origin_name: '季度报告.pdf', report_file_suffix: 'pdf',
    });
    expect(post.getCalls().every(call => call.args[0] === '/reportsdatamanage/list')).to.equal(true);
    await waitFor(() => expect(container.querySelector('.rdm-modal-overlay')).to.equal(null));
  });

  it('accepts PDF and preserves an explicitly uploaded cover', async () => {
    const { container } = openForm();
    fillForm(container);
    await chooseReport(container, '季度报告.pdf', 'application/pdf');
    const cover = new window.File(['image'], 'cover.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[accept="image/jpeg,image/jpg,image/png"]'), {
      target: { files: [cover] },
    });
    await screen.findByText('cover.png');
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => expect(post.getCalls().some(call => call.args[1].action === 'add_report')).to.equal(true));
    const submit = post.getCalls().find(call => call.args[1].action === 'add_report').args[1];
    expect(submit.cover_img_url).to.equal('/custom.png');
    await waitFor(() => expect(container.querySelector('.rdm-modal-overlay')).to.equal(null));
  });

  it('rejects MP4 and oversized PDF before uploading', async () => {
    const { container } = openForm();
    const input = container.querySelector('input[accept=".pdf"]');
    fireEvent.change(input, { target: { files: [new window.File(['video'], 'report.mp4', { type: 'video/mp4' })] } });
    await screen.findByText('报告文件只支持 PDF 格式');
    const largePdf = new window.File(['pdf'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(largePdf, 'size', { value: 20 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [largePdf] } });
    await screen.findByText('PDF文件大小不能超过 20MB');
    expect(reportUploadCalls()).to.have.length(0);
  });

  ['file picker', 'drag and drop'].forEach(method => {
    it(`rejects PPTX through ${method} before uploading`, async () => {
      const { container } = openForm();
      fillForm(container);
      const input = container.querySelector('input[accept=".pdf"]');
      const file = new window.File(['presentation'], '季度报告.PPTX', {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      if (method === 'file picker') {
        fireEvent.change(input, { target: { files: [file] } });
      } else {
        fireEvent.drop(input.closest('.rdm-dropzone'), {
          dataTransfer: {
            files: [file], types: ['Files'],
            items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
          },
        });
      }
      await screen.findByText('报告文件只支持 PDF 格式');
      expect(screen.queryByText(file.name)).to.equal(null);
      expect(screen.getByText('点击或拖拽上传报告文件（PDF，≤20MB）')).not.to.equal(null);
      fireEvent.click(screen.getByRole('button', { name: '确定' }));
      await screen.findByText('请填写所有必填字段并选择报告文件');
      expect(reportUploadCalls()).to.have.length(0);
      expect(post.getCalls().some(call => call.args[1].action === 'add_report')).to.equal(false);
    });
  });

  it('shows backend upload errors and allows retry without creating a report', async () => {
    const { container } = openForm();
    fillForm(container);
    await chooseReport(container, '季度报告.pdf', 'application/pdf');
    post.callsFake((url, data) => {
      if (data instanceof window.FormData) {
        const error = new Error('Request failed');
        error.response = { data: { error: '报告文件上传失败' } };
        return Promise.reject(error);
      }
      return Promise.resolve({ data: { reports_data: [] } });
    });
    const consoleError = sinon.stub(console, 'error');
    try {
      fireEvent.click(screen.getByRole('button', { name: '确定' }));
      await screen.findByText('报告文件上传失败');
      expect(screen.getByRole('button', { name: '确定' }).disabled).to.equal(false);
      expect(container.querySelector('.rdm-modal-overlay')).not.to.equal(null);
      expect(post.getCalls().some(call => call.args[1].action === 'add_report')).to.equal(false);
    } finally {
      consoleError.restore();
    }
  });

  it('uses the same direct upload when replacing an existing report', async () => {
    reports = [{
      id: 4, report_title: '原报告', variety_section: '板块A', variety: '品种A',
      report_type: '类别A', author: '测试作者', report_public_date: '2026-10-12',
    }];
    const { container } = render(<ReportsDataManage />);
    fireEvent.click(await screen.findByTitle('编辑'));
    await chooseReport(container, '季度报告.pdf', 'application/pdf');
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => expect(post.getCalls().some(call => call.args[1].action === 'update_report')).to.equal(true));
    const submit = post.getCalls().find(call => call.args[1].action === 'update_report').args[1];
    expect(submit).to.include({
      id: 4, report_file_origin_name: '季度报告.pdf', report_file_suffix: 'pdf',
    });
    expect(reportUploadCalls()).to.have.length(1);
    await waitFor(() => expect(container.querySelector('.rdm-modal-overlay')).to.equal(null));
  });

  it('waits for backend upload completion before saving, with finite upload progress', async () => {
    const { container } = openForm();
    fillForm(container);
    await chooseReport(container, '季度报告.pdf', 'application/pdf');
    let finishUpload;
    post.withArgs('/reportsdatamanage/list', sinon.match.instanceOf(window.FormData))
      .returns(new Promise(resolve => { finishUpload = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    await waitFor(() => expect(reportUploadCalls()).to.have.length(1));
    const { onUploadProgress } = reportUploadCalls()[0].args[2];
    act(() => {
      onUploadProgress({ loaded: 10, total: 10 });
      onUploadProgress({ loaded: 10 });
    });
    expect(screen.getByText('文件已上传，正在处理，请稍候…')).not.to.equal(null);
    expect(screen.getByText('85%')).not.to.equal(null);
    expect(screen.getByRole('button', { name: '确定' }).disabled).to.equal(true);
    expect(post.getCalls().some(call => call.args[1].action === 'add_report')).to.equal(false);
    await act(async () => finishUpload({ data: {
      success: true, file_uuid: 'a'.repeat(32),
      file_origin_name: '季度报告.pdf', file_suffix: 'pdf',
    } }));
    expect(post.getCalls().some(call => call.args[1].action === 'add_report')).to.equal(true);
  });
});
