import React from 'react';
import $ from 'jquery';
import sinon from 'sinon';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';

import IndexDataManageMain from '../../../javascripts/indexDataManage/components/IndexDataManageMain';
import * as VirtualList from '../../../javascripts/components/VirtualList';

const indexKey = 'TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|1';

describe('IndexDataManageMain', () => {
  let container;
  let ajaxStub;
  let autoSizerStub;
  let previousNotify;
  let catalogResponse;

  beforeEach(() => {
    previousNotify = global.notify;
    autoSizerStub = sinon.stub(VirtualList, 'AutoSizer').callsFake(({ children }) => children({ width: 300, height: 500 }));
    container = document.createElement('div');
    container.id = 'main_contain';
    container.setAttribute('data-index_manage', JSON.stringify({
      dateField: '报价日期', indexNameField: '品名', valueField: '价格', indexTypeField: '商品',
    }));
    container.setAttribute('data-user-id', '1');
    document.body.appendChild(container);
    ajaxStub = sinon.stub($, 'ajax').callsFake((options) => {
      const payload = JSON.parse(options.data);
      if (payload.action === 'get_index_list') {
        catalogResponse = {
          indexDataList: [{ key: indexKey, 指标名称: '红枣现货价', 品种: '红枣', 指标来源: '钢联', 计算配置: {} }],
          treeNodeDict: {
            key: 'node_1',
            name: '目录',
            node_id: 1,
            parent_id: 0,
            children: [{
              key: 'node_2',
              name: '红枣',
              node_id: 2,
              parent_id: 1,
              children: [{ key: indexKey, name: '红枣现货价', searchText: '红枣现货价' }],
            }, {
              key: 'node_3', name: '空节点', node_id: 3, parent_id: 1, children: [],
            }, {
              key: 'node_4', name: '父节点', node_id: 4, parent_id: 1,
              children: [{ key: 'node_5', name: '二层节点', node_id: 5, parent_id: 4,
                children: [{ key: 'node_6', name: '三级节点', node_id: 6, parent_id: 5, children: [] }],
              }],
            }],
          },
          categoryMap: [{ node_id: 1, nodes_path: '目录' }, { node_id: 2, nodes_path: '目录|红枣' }],
          sources: [],
        };
        options.success(catalogResponse);
      } else if (['update_category', 'add_category'].includes(payload.action)) {
        options.success({});
      }
    });
  });

  afterEach(() => {
    cleanup();
    ajaxStub.restore();
    autoSizerStub.restore();
    global.notify = previousNotify;
    document.body.removeChild(container);
  });

  it('loads the category tree through get_index_list', async () => {
    const { container: page, getByText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(page.querySelector('.tree-container')).not.to.equal(null));
    expect(ajaxStub.firstCall.args[0].type).to.equal('POST');
    expect(JSON.parse(ajaxStub.firstCall.args[0].data).action).to.equal('get_index_list');
    expect(getByText('提取数据')).not.to.equal(null);
  });

  it('distinguishes empty categories from indicators and retains search highlighting', async () => {
    const { getByText, getByLabelText, queryByText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('空节点')).not.to.equal(null));
    const emptyRow = getByText('空节点').closest('[draggable]');
    expect(within(emptyRow).getByRole('img', { name: '空目录' }).querySelector('.fa-folder-o')).not.to.equal(null);
    expect(emptyRow.textContent).to.equal('空节点');
    fireEvent.doubleClick(getByText('空节点'));
    expect(queryByText('该指标已添加')).to.equal(null);
    expect(ajaxStub.callCount).to.equal(1);

    const categoryRow = getByText('红枣').closest('[draggable]');
    expect(within(categoryRow).getByRole('img', { name: '目录' }).querySelector('.fa-folder-o')).not.to.equal(null);
    fireEvent.click(getByText('红枣'));
    expect(within(categoryRow).getByRole('img', { name: '目录' }).querySelector('.fa-folder-open-o')).not.to.equal(null);
    const indicatorRow = getByText('红枣现货价').closest('[draggable]');
    expect(within(indicatorRow).getByRole('img', { name: '指标' }).querySelector('.fa-line-chart')).not.to.equal(null);

    fireEvent.change(getByLabelText('搜索指标'), { target: { value: '空节点' } });
    await waitFor(() => expect(queryByText('红枣')).to.equal(null));
    const filteredRow = getByText('空节点').closest('[draggable]');
    expect(within(filteredRow).getByRole('img', { name: '空目录' })).not.to.equal(null);
    expect(getByText('空节点').style.fontWeight).to.equal('bold');
  });

  it('shows action icons in category and indicator menus and retains their actions', async () => {
    const { baseElement, getByText, getByRole } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('空节点')).not.to.equal(null));
    fireEvent.click(getByText('红枣'));
    fireEvent.contextMenu(getByText('红枣现货价'));
    let menu = baseElement.querySelector('.tree-context-menu');
    expect(Array.from(menu.querySelectorAll('.tree-context-menu-item')).map(item => item.textContent)).to.deep.equal([
      '添加到操作列表', '新建节点并移入', '删除指标',
    ]);
    expect(menu.querySelectorAll('.tree-context-menu-item > i[aria-hidden="true"]')).to.have.length(3);
    expect(menu.querySelectorAll('.tree-context-menu-divider')).to.have.length(1);
    fireEvent.mouseDown(document.body);

    fireEvent.contextMenu(getByText('空节点'));
    menu = baseElement.querySelector('.tree-context-menu');
    expect(Array.from(menu.querySelectorAll('.tree-context-menu-item')).map(item => item.textContent)).to.deep.equal([
      '添加子节点', '修改节点', '删除节点',
    ]);
    fireEvent.click(within(menu).getByText('修改节点').parentElement.querySelector('.fa-edit'));
    expect(within(getByRole('dialog')).getByLabelText('节点名称').value).to.equal('空节点');
    expect(baseElement.querySelector('.tree-context-menu')).to.equal(null);
  });

  it('only shows delete for empty non-root nodes, including during search', async () => {
    const { getByText, queryByText, getByLabelText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('红枣')).not.to.equal(null));
    for (const name of ['红枣', '父节点', '目录']) {
      fireEvent.contextMenu(getByText(name));
      expect(queryByText('删除节点')).to.equal(null);
      expect(queryByText('重命名')).to.equal(null);
      expect(Boolean(queryByText('修改节点'))).to.equal(name !== '目录');
      fireEvent.mouseDown(document.body);
    }
    fireEvent.contextMenu(getByText('空节点'));
    expect(getByText('删除节点')).not.to.equal(null);
    fireEvent.mouseDown(document.body);
    fireEvent.change(getByLabelText('搜索指标'), { target: { value: '父节点' } });
    await waitFor(() => expect(queryByText('红枣')).to.equal(null));
    fireEvent.contextMenu(getByText('父节点'));
    expect(queryByText('删除节点')).to.equal(null);
  });

  it('opens the edit form with valid parents and sends one atomic update request', async () => {
    const { getByText, getByRole } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('父节点')).not.to.equal(null));
    fireEvent.contextMenu(getByText('父节点'));
    fireEvent.click(getByText('修改节点'));
    const dialog = within(getByRole('dialog'));
    expect(dialog.getByLabelText('节点名称').value).to.equal('父节点');
    const parent = dialog.getByLabelText('父节点');
    fireEvent.keyDown(parent, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(dialog.getByRole('option', { name: '目录' }).getAttribute('aria-selected')).to.equal('true');
    expect(dialog.getAllByRole('option').map(option => option.textContent)).to.deep.equal(['目录', '目录|红枣', '目录|空节点']);
    fireEvent.change(dialog.getByLabelText('节点名称'), { target: { value: '新名称' } });
    fireEvent.change(parent, { target: { value: '目录 红枣' } });
    fireEvent.click(dialog.getByRole('option', { name: '目录|红枣' }));
    fireEvent.click(dialog.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(getByText('节点已修改')).not.to.equal(null));
    const payloads = ajaxStub.getCalls().map(call => JSON.parse(call.args[0].data));
    expect(payloads.filter(payload => payload.action !== 'get_index_list')).to.deep.equal([
      { node_id: 4, node_name: '新名称', parent_node_id: 2, action: 'update_category' },
    ]);
    expect(payloads.filter(payload => payload.action === 'get_index_list')).to.have.length(2);
  });

  it('shows the full path when adding a nested child and submits its fixed parent', async () => {
    const { getByText, getByRole, getByLabelText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('父节点')).not.to.equal(null));
    fireEvent.change(getByLabelText('搜索指标'), { target: { value: '二层节点' } });
    await waitFor(() => expect(getByText('二层节点')).not.to.equal(null));
    fireEvent.contextMenu(getByText('二层节点'));
    fireEvent.click(getByText('添加子节点'));
    const dialog = within(getByRole('dialog'));
    expect(dialog.getByRole('textbox', { name: '父节点' }).textContent).to.equal('目录|父节点|二层节点');
    fireEvent.change(dialog.getByLabelText('节点名称'), { target: { value: '新子节点' } });
    fireEvent.click(dialog.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(getByText('节点已创建')).not.to.equal(null));
    expect(JSON.parse(ajaxStub.secondCall.args[0].data)).to.deep.equal({
      node_name: '新子节点', parent_node_id: 5, action: 'add_category',
    });
  });

  it('keeps the edited values open when the update is rejected', async () => {
    const { getByText, getByRole, queryByText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('空节点')).not.to.equal(null));
    ajaxStub.onSecondCall().callsFake(options => options.error({ responseJSON: { error: '父节点下已存在同名节点' } }));
    fireEvent.contextMenu(getByText('空节点'));
    fireEvent.click(getByText('修改节点'));
    const dialog = within(getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('节点名称'), { target: { value: '重复名称' } });
    fireEvent.click(dialog.getByRole('button', { name: '保存' }));
    await waitFor(() => expect(getByText('父节点下已存在同名节点')).not.to.equal(null));
    expect(dialog.getByLabelText('节点名称').value).to.equal('重复名称');
    expect(dialog.getByRole('button', { name: '保存' }).disabled).to.equal(false);
    expect(queryByText('节点已修改')).to.equal(null);
  });

  function moveNode(getByText, source, target) {
    const dataTransfer = { setData() {}, getData() { return ''; }, effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(getByText(source), { dataTransfer });
    fireEvent.dragOver(getByText(target), { dataTransfer });
    fireEvent.drop(getByText(target), { dataTransfer });
  }

  it('locks the whole tree until a category move and catalog refresh both finish', async () => {
    const { container: page, getByText, getByRole, getByLabelText, queryByText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('空节点')).not.to.equal(null));
    fireEvent.click(getByText('父节点'));
    const treeContent = page.querySelector('.tree-content');
    const search = getByLabelText('搜索指标');
    let moveRequest;
    let refreshRequest;
    ajaxStub.onSecondCall().callsFake(options => { moveRequest = options; });
    ajaxStub.onThirdCall().callsFake(options => { refreshRequest = options; });

    fireEvent.contextMenu(getByText('空节点'));
    expect(getByText('修改节点')).not.to.equal(null);
    moveNode(getByText, '空节点', '红枣');
    expect(JSON.parse(moveRequest.data)).to.deep.equal({
      action: 'move_category', node_id: 3, new_parent_id: 2, new_order: null,
    });
    expect(getByRole('status').textContent).to.contain('正在保存移动，请稍候…');
    expect(search.disabled).to.equal(true);
    expect(treeContent.hasAttribute('inert')).to.equal(true);
    expect(treeContent.getAttribute('aria-busy')).to.equal('true');
    expect(queryByText('修改节点')).to.equal(null);
    expect(Array.from(treeContent.querySelectorAll('[draggable]')).every(row => row.draggable === false)).to.equal(true);

    fireEvent.click(getByText('父节点'));
    expect(getByText('二层节点')).not.to.equal(null);
    fireEvent.contextMenu(getByText('空节点'));
    expect(queryByText('修改节点')).to.equal(null);
    moveNode(getByText, '父节点', '红枣');
    expect(ajaxStub.callCount).to.equal(2);

    await act(async () => moveRequest.success({}));
    expect(JSON.parse(refreshRequest.data).action).to.equal('get_index_list');
    expect(search.disabled).to.equal(true);
    expect(getByRole('status')).not.to.equal(null);

    const refreshed = JSON.parse(JSON.stringify(catalogResponse));
    const children = refreshed.treeNodeDict.children;
    const moved = children.splice(1, 1)[0];
    children[0].children.push(moved);
    await act(async () => refreshRequest.success(refreshed));
    expect(queryByText('正在保存移动，请稍候…')).to.equal(null);
    expect(search.disabled).to.equal(false);
    expect(treeContent.hasAttribute('inert')).to.equal(false);
    expect(treeContent.getAttribute('aria-busy')).to.equal('false');
    expect(getByText('二层节点')).not.to.equal(null);
    expect(getByText('空节点')).not.to.equal(null);
    expect(getByText('红枣现货价')).not.to.equal(null);
    expect(page.querySelector('.tree-content')).to.equal(treeContent);
    fireEvent.click(getByText('父节点'));
    expect(queryByText('二层节点')).to.equal(null);
    fireEvent.contextMenu(getByText('空节点'));
    expect(getByText('修改节点')).not.to.equal(null);
  });

  it('uses the same lock for indicator moves and preserves the search filter', async () => {
    const { getByText, getByRole, getByLabelText, queryByText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('红枣')).not.to.equal(null));
    const search = getByLabelText('搜索指标');
    fireEvent.change(search, { target: { value: '红枣' } });
    await waitFor(() => expect(queryByText('空节点')).to.equal(null));
    fireEvent.change(search, { target: { value: '' } });
    await waitFor(() => expect(getByText('空节点')).not.to.equal(null));
    // 清空筛选后仍保留搜索展开的指标目录。
    expect(getByText('红枣现货价')).not.to.equal(null);
    let moveRequest;
    ajaxStub.onSecondCall().callsFake(options => { moveRequest = options; });
    moveNode(getByText, '红枣现货价', '空节点');
    expect(JSON.parse(moveRequest.data)).to.deep.equal({
      action: 'move_indexes', node_keys: [indexKey], new_parent_id: 3, new_order: null,
    });
    expect(getByRole('status')).not.to.equal(null);
    fireEvent.doubleClick(getByText('红枣现货价'));
    fireEvent.change(search, { target: { value: '不能修改筛选' } });
    expect(ajaxStub.callCount).to.equal(2);
    await act(async () => moveRequest.success({}));
    await waitFor(() => expect(search.disabled).to.equal(false));
    expect(queryByText('正在保存移动，请稍候…')).to.equal(null);
    expect(getByText('空节点')).not.to.equal(null);
    fireEvent.contextMenu(getByText('红枣现货价'));
    expect(getByText('添加到操作列表')).not.to.equal(null);
  });

  ['http', 'business'].forEach(failure => {
    it(`unlocks the tree after a ${failure} move error and allows retrying`, async () => {
      const { getByText, getByLabelText, queryByText } = render(<IndexDataManageMain />);
      await waitFor(() => expect(getByText('空节点')).not.to.equal(null));
      let moveRequest;
      ajaxStub.onSecondCall().callsFake(options => { moveRequest = options; });
      moveNode(getByText, '空节点', '红枣');
      await act(async () => {
        if (failure === 'http') moveRequest.error({ responseJSON: { error: '移动失败，请重试' } });
        else moveRequest.success({ error: '移动失败，请重试' });
      });
      await waitFor(() => expect(getByLabelText('搜索指标').disabled).to.equal(false));
      expect(getByText('移动失败，请重试')).not.to.equal(null);
      expect(queryByText('正在保存移动，请稍候…')).to.equal(null);
      expect(ajaxStub.callCount).to.equal(2);
      ajaxStub.onThirdCall().callsFake(options => options.success({}));
      moveNode(getByText, '空节点', '红枣');
      await waitFor(() => expect(ajaxStub.callCount).to.equal(4));
      await waitFor(() => expect(getByLabelText('搜索指标').disabled).to.equal(false));
    });
  });

  it('unlocks and reports the error if the catalog refresh fails after moving', async () => {
    const { getByText, getByLabelText, queryByText } = render(<IndexDataManageMain />);
    await waitFor(() => expect(getByText('空节点')).not.to.equal(null));
    ajaxStub.onSecondCall().callsFake(options => options.success({}));
    ajaxStub.onThirdCall().callsFake(options => options.error({ responseJSON: { error: '刷新失败' } }));
    moveNode(getByText, '空节点', '红枣');
    await waitFor(() => expect(getByLabelText('搜索指标').disabled).to.equal(false));
    expect(getByText('获取指标列表失败: 刷新失败')).not.to.equal(null);
    expect(queryByText('正在保存移动，请稍候…')).to.equal(null);
    expect(getByText('空节点')).not.to.equal(null);
  });
});
