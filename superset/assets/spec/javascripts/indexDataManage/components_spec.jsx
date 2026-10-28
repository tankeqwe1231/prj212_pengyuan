import React from 'react';
import sinon from 'sinon';
import { cleanup, fireEvent, render, within } from '@testing-library/react';

import IndexDataPivotTable from '../../../javascripts/indexDataManage/components/IndexDataPivotTable';
import CategoryTreePicker from '../../../javascripts/indexDataManage/components/CategoryTreePicker';
import { CategoryNameModal, ConfirmModal } from '../../../javascripts/indexDataManage/modals/CategoryModals';
import FormulaModal from '../../../javascripts/indexDataManage/modals/FormulaModal';

describe('IndexDataPivotTable', () => {
  afterEach(cleanup);

  const timeSeriesData = {
    index: ['2025-01-01', '2025-01-02'],
    columns: ['甲', '乙'],
    data: [[1, 2], [3, '']],
  };
  const rows = [{ 指标名称: '甲', 品种: '锌' }, { 指标名称: '乙', 品种: '红枣' }];

  it('renders newest dates first and reorders indicators by drag', () => {
    const onIndicatorMove = sinon.spy();
    const { container, getByText } = render(<IndexDataPivotTable
      timeSeriesData={timeSeriesData}
      chartRows={rows}
      indicatorOrder={['甲', '乙']}
      onIndicatorMove={onIndicatorMove}
    />);
    const dates = Array.from(container.querySelectorAll('tbody th')).map(cell => cell.textContent);
    expect(dates).to.deep.equal(['2025-01-02', '2025-01-01']);

    const dataTransfer = { setData() {}, getData: () => '乙', effectAllowed: '', dropEffect: '' };
    fireEvent.dragStart(getByText('乙'), { dataTransfer });
    fireEvent.drop(getByText('甲'), { dataTransfer });
    expect(onIndicatorMove.calledWith('乙', '甲')).to.equal(true);
  });

  it('shows a range error and variety labels', () => {
    const { container, getByText, getByLabelText } = render(<IndexDataPivotTable
      timeSeriesData={timeSeriesData}
      chartRows={rows}
      showVarietyLabels
    />);
    expect(container.querySelectorAll('.pivot-variety-tag')).to.have.length(2);
    fireEvent.change(getByLabelText('开始日期'), { target: { value: '2025-02-01' } });
    fireEvent.change(getByLabelText('结束日期'), { target: { value: '2025-01-01' } });
    expect(getByText('开始日期不能晚于结束日期')).not.to.equal(null);
  });
});

describe('CategoryTreePicker', () => {
  afterEach(cleanup);

  const tree = {
    key: 'node_1',
    name: '目录',
    node_id: 1,
    parent_id: 0,
    children: [
      { key: 'node_2', name: '红枣', node_id: 2, parent_id: 1, children: [{ key: 'k', name: '指标' }] },
      { key: 'virtual_uncategorized', name: '未分类', is_virtual: true, children: [] },
    ],
  };
  const categoryMap = [{ node_id: 1, nodes_path: '目录' }, { node_id: 2, nodes_path: '目录|红枣' }];

  it('only allows selecting non-root real categories', () => {
    const onChange = sinon.spy();
    const { getByText, queryByText, container } = render(<CategoryTreePicker
      tree={tree}
      categoryMap={categoryMap}
      value={2}
      onChange={onChange}
    />);
    expect(queryByText('未分类')).to.equal(null);
    expect(getByText('目录').closest('button').disabled).to.equal(true);
    fireEvent.click(getByText('红枣'));
    expect(onChange.calledWith(2)).to.equal(true);
    expect(container.textContent).to.contain('目录 › 红枣');
  });

  it('filters categories by path keywords', () => {
    const { getByLabelText, getByText } = render(<CategoryTreePicker
      tree={tree}
      categoryMap={categoryMap}
      onChange={() => {}}
    />);
    fireEvent.change(getByLabelText('搜索节点名称'), { target: { value: '不存在' } });
    expect(getByText('没有匹配的节点')).not.to.equal(null);
  });
});

describe('CategoryNameModal', () => {
  afterEach(cleanup);

  const parentOptions = [
    { value: 1, label: '目录' },
    { value: 4, label: '目录|父节点|二层节点' },
  ];

  it('shows the complete fixed parent path when adding a child', () => {
    const onSubmit = sinon.spy();
    const { getByRole, getByLabelText } = render(<CategoryNameModal
      title="添加子节点"
      parentPath="目录|父节点|二层节点"
      onSubmit={onSubmit}
      onHide={() => {}}
    />);
    expect(getByRole('textbox', { name: '父节点' }).textContent).to.equal('目录|父节点|二层节点');
    expect(getByRole('textbox', { name: '父节点' }).getAttribute('aria-readonly')).to.equal('true');
    fireEvent.change(getByLabelText('节点名称'), { target: { value: ' 新子节点 ' } });
    fireEvent.click(getByRole('button', { name: '保存' }));
    expect(onSubmit.calledOnce).to.equal(true);
    expect(onSubmit.firstCall.args).to.deep.equal(['新子节点']);
  });

  it('submits the edited name and selected parent together', () => {
    const onSubmit = sinon.spy();
    const { getByRole, getByLabelText } = render(<CategoryNameModal
      title="修改节点"
      initialName="原节点"
      initialParentId={1}
      parentOptions={parentOptions}
      onSubmit={onSubmit}
      onHide={() => {}}
    />);
    const parent = getByRole('combobox', { name: '父节点' });
    fireEvent.keyDown(parent, { key: 'ArrowDown', code: 'ArrowDown' });
    expect(getByRole('option', { name: '目录' }).getAttribute('aria-selected')).to.equal('true');
    fireEvent.change(getByLabelText('节点名称'), { target: { value: ' 修改后 ' } });
    fireEvent.change(parent, { target: { value: '二层' } });
    fireEvent.click(getByRole('option', { name: '目录|父节点|二层节点' }));
    fireEvent.click(getByRole('button', { name: '保存' }));
    expect(onSubmit.calledWithExactly('修改后', 4)).to.equal(true);
  });

  it('validates name and parent and prevents repeated submissions while saving', () => {
    const onSubmit = sinon.spy();
    const props = { title: '修改节点', parentOptions, onSubmit, onHide: () => {} };
    const { getByRole, getByLabelText, rerender } = render(<CategoryNameModal {...props} />);
    fireEvent.click(getByRole('button', { name: '保存' }));
    expect(getByRole('alert').textContent).to.equal('请输入节点名称');
    fireEvent.change(getByLabelText('节点名称'), { target: { value: '名'.repeat(101) } });
    fireEvent.click(getByRole('button', { name: '保存' }));
    expect(getByRole('alert').textContent).to.equal('节点名称不能超过100个字符');
    fireEvent.change(getByLabelText('节点名称'), { target: { value: '新节点' } });
    fireEvent.click(getByRole('button', { name: '保存' }));
    expect(getByRole('alert').textContent).to.equal('请选择父节点');
    fireEvent.change(getByLabelText('父节点'), { target: { value: '二层' } });
    fireEvent.click(getByRole('option', { name: '目录|父节点|二层节点' }));
    rerender(<CategoryNameModal {...props} saving />);
    expect(getByLabelText('节点名称').disabled).to.equal(true);
    expect(getByLabelText('父节点').disabled).to.equal(true);
    expect(getByRole('button', { name: '保存中…' }).disabled).to.equal(true);
    fireEvent.submit(getByLabelText('节点名称').closest('form'));
    expect(onSubmit.called).to.equal(false);
  });

  it('filters by path keywords, handles no matches and selects with the keyboard', () => {
    const onSubmit = sinon.spy();
    const { getByRole, getByText, queryAllByRole } = render(<CategoryNameModal
      title="修改节点"
      initialName="子节点"
      initialParentId={1}
      parentOptions={parentOptions.concat({ value: 7, label: '目录|Copper|价格' })}
      onSubmit={onSubmit}
      onHide={() => {}}
    />);
    const parent = getByRole('combobox', { name: '父节点' });
    fireEvent.change(parent, { target: { value: ' 二层 目录 ' } });
    expect(queryAllByRole('option').map(option => option.textContent)).to.deep.equal(['目录|父节点|二层节点']);
    fireEvent.change(parent, { target: { value: '不存在' } });
    expect(getByText('没有匹配的父节点')).not.to.equal(null);
    expect(queryAllByRole('option')).to.have.length(0);
    fireEvent.change(parent, { target: { value: '' } });
    expect(queryAllByRole('option')).to.have.length(3);
    expect(getByRole('option', { name: '目录' }).getAttribute('aria-selected')).to.equal('true');
    fireEvent.change(parent, { target: { value: 'cOPPer 价格' } });
    fireEvent.keyDown(parent, { key: 'ArrowDown', code: 'ArrowDown' });
    fireEvent.keyDown(parent, { key: 'Enter', code: 'Enter' });
    expect(onSubmit.called).to.equal(false);
    expect(queryAllByRole('option')).to.have.length(0);
    fireEvent.click(getByRole('button', { name: '保存' }));
    expect(onSubmit.calledWithExactly('子节点', 7)).to.equal(true);
  });
});

describe('ConfirmModal', () => {
  afterEach(cleanup);

  [
    { title: '删除节点', message: '确定删除节点“空节点”吗？节点下不能有子节点或指标。' },
    { title: '删除指标', message: '确定从指标列表中删除“红枣现货价”吗？此操作不可恢复。' },
  ].forEach(({ title, message }) => {
    it(`preserves the ${title} message, cancel action and default delete action`, () => {
      const onConfirm = sinon.spy();
      const onHide = sinon.spy();
      const { getByRole, getByText, rerender } = render(<ConfirmModal
        title={title} message={message} onConfirm={onConfirm} onHide={onHide}
      />);
      expect(getByText(title)).not.to.equal(null);
      expect(getByText(message)).not.to.equal(null);
      fireEvent.click(getByRole('button', { name: '取消' }));
      expect(onHide.calledOnce).to.equal(true);
      expect(onConfirm.called).to.equal(false);
      fireEvent.click(getByRole('button', { name: '删除' }));
      expect(onConfirm.calledOnce).to.equal(true);

      rerender(<ConfirmModal
        title={title} message={message} saving onConfirm={onConfirm} onHide={onHide}
      />);
      expect(getByRole('button', { name: '删除' }).disabled).to.equal(true);
      fireEvent.click(getByRole('button', { name: '删除' }));
      expect(onConfirm.calledOnce).to.equal(true);
    });
  });
});

describe('FormulaModal', () => {
  afterEach(cleanup);

  const index = { key: 'TEST|index_list|index_data|1', 指标名称: '铜现货价' };
  const dependency = { ...index, letter: 'a' };
  const source = { database: 'TEST', list_table: 'index_list', variety: '铜' };
  const pageProps = { initial: {}, candidateIndexes: [], sources: [], tree: null, categoryMap: [], saving: false };
  const tree = {
    key: 'node_1', name: '目录', node_id: 1, parent_id: 0,
    children: [{ key: 'node_2', name: '价格', node_id: 2, parent_id: 1, children: [] }],
  };

  it('validates the name and keeps temporary formula submission intact', () => {
    const onSubmit = sinon.spy();
    const { getByRole, getByLabelText } = render(<FormulaModal
      {...pageProps}
      mode="create" initial={{ dependencies: [dependency] }} onSubmit={onSubmit} onHide={() => {}}
    />);
    fireEvent.click(getByRole('button', { name: '确定' }));
    expect(getByRole('alert').textContent).to.equal('请输入新指标名称');
    fireEvent.change(getByLabelText('新指标名：'), { target: { value: ' 两倍铜价 ' } });
    fireEvent.change(getByLabelText('计算公式：'), { target: { value: ' a * 2 ' } });
    fireEvent.click(getByRole('button', { name: '确定' }));
    expect(onSubmit.firstCall.args[0]).to.deep.equal({
      type: 'temporary', formula: 'a*2', dependencies: [dependency], name: '两倍铜价', source: undefined, nodeId: null,
    });
  });

  it('can add and remove dependencies through the styled selector', () => {
    const { getByRole, queryByTitle, getByTitle } = render(<FormulaModal
      {...pageProps}
      mode="create" candidateIndexes={[index]} onSubmit={() => {}} onHide={() => {}}
    />);
    fireEvent.change(getByRole('combobox', { name: '添加公式依赖' }), { target: { value: '铜' } });
    const option = getByRole('option', { name: '铜现货价' });
    expect(option.closest('.modal-body')).to.equal(null);
    expect(option.closest('[role="dialog"]')).to.equal(getByRole('dialog'));
    fireEvent.click(option);
    expect(getByTitle('铜现货价')).not.to.equal(null);
    fireEvent.click(getByTitle('移除依赖 铜现货价'));
    expect(queryByTitle('铜现货价')).to.equal(null);
  });

  it('requires a destination and preserves saved calculation payloads', () => {
    const onSubmit = sinon.spy();
    const { getByRole, getByText } = render(<FormulaModal
      {...pageProps}
      mode="create"
      initial={{ name: '两倍铜价', formula: 'a*2', dependencies: [dependency] }}
      sources={[source]}
      tree={tree}
      categoryMap={[{ node_id: 1, nodes_path: '目录' }, { node_id: 2, nodes_path: '目录|价格' }]}
      onSubmit={onSubmit}
      onHide={() => {}}
    />);
    fireEvent.click(getByRole('checkbox', { name: '保存为计算指标' }));
    const header = getByText('保存到节点：').closest('.category-picker-header');
    expect(within(header).getByText('尚未选择节点')).not.to.equal(null);
    fireEvent.click(getByRole('button', { name: '确定' }));
    expect(getByRole('alert').textContent).to.equal('请选择保存节点');
    expect(getByRole('button', { name: '目录' }).disabled).to.equal(true);
    fireEvent.click(getByRole('button', { name: '价格' }));
    expect(within(header).getByText('目录 › 价格')).not.to.equal(null);
    fireEvent.keyDown(getByRole('combobox', { name: '品种：' }), { key: 'ArrowDown', code: 'ArrowDown' });
    const sourceOption = getByRole('option', { name: '铜（TEST）' });
    expect(sourceOption.closest('.modal-body')).to.equal(null);
    expect(sourceOption.closest('[role="dialog"]')).to.equal(getByRole('dialog'));
    fireEvent.click(sourceOption);
    fireEvent.click(getByRole('button', { name: '确定' }));
    expect(onSubmit.firstCall.args[0]).to.deep.equal({
      type: 'create', formula: 'a*2', dependencies: [dependency], name: '两倍铜价', source, nodeId: 2,
    });
  });

  it('keeps every source selectable above the themed modal dialog', () => {
    const theme = document.createElement('style');
    theme.textContent = '.modal-dialog { position: relative; z-index: 1100; }';
    document.head.appendChild(theme);
    try {
      const sources = [
        source,
        { ...source, database: 'TEST_NI', variety: '镍' },
        { ...source, database: 'TEST_ZN', variety: '贵金属' },
      ];
      const onSubmit = sinon.spy();
      const { getByRole, getAllByRole } = render(<FormulaModal
        {...pageProps}
        mode="create"
        initial={{ name: '两倍铜价', formula: 'a*2', dependencies: [dependency] }}
        sources={sources}
        tree={tree}
        onSubmit={onSubmit}
        onHide={() => {}}
      />);
      fireEvent.click(getByRole('checkbox', { name: '保存为计算指标' }));
      fireEvent.click(getByRole('button', { name: '价格' }));
      const input = getByRole('combobox', { name: '品种：' });
      const control = input.closest('.Select__control');
      expect(control.textContent).to.contain('铜（TEST）');
      sources.forEach((item) => {
        fireEvent.mouseDown(control, { button: 0 });
        expect(getAllByRole('option').map(option => option.textContent)).to.deep.equal(
          sources.map(entry => `${entry.variety}（${entry.database}）`),
        );
        const option = getByRole('option', { name: `${item.variety}（${item.database}）` });
        const portal = option.closest('.Select__menu-portal');
        const dialog = getByRole('dialog');
        expect(portal.parentElement).to.equal(dialog);
        expect(Number(window.getComputedStyle(portal).zIndex)).to.be.greaterThan(
          Number(window.getComputedStyle(dialog.querySelector('.modal-dialog')).zIndex),
        );
        fireEvent.click(option);
        expect(control.textContent).to.contain(`${item.variety}（${item.database}）`);
      });
      fireEvent.click(getByRole('button', { name: '确定' }));
      expect(onSubmit.firstCall.args[0].source).to.deep.equal(sources[2]);
    } finally {
      theme.remove();
    }
  });

  it('preserves edit and save-as actions and restricts read-only formulas', () => {
    const onSubmit = sinon.spy();
    const onHide = sinon.spy();
    const initial = { name: '铜价', formula: 'a*2', dependencies: [dependency] };
    const { getByRole, getByLabelText, queryByRole, rerender } = render(<FormulaModal
      {...pageProps}
      mode="edit" initial={initial} onSubmit={onSubmit} onHide={onHide}
    />);
    fireEvent.click(getByRole('button', { name: '保存' }));
    expect(onSubmit.firstCall.args[0].type).to.equal('update');
    fireEvent.change(getByLabelText('另存指标名：'), { target: { value: '铜价副本' } });
    fireEvent.click(getByRole('button', { name: '另存为' }));
    expect(onSubmit.secondCall.args[0]).to.include({ type: 'saveAs', name: '铜价副本' });
    rerender(<FormulaModal
      {...pageProps}
      mode="edit"
      initial={{ ...initial, readOnlyReason: '公式不可编辑', rawSql: 'SELECT 1 FROM t' }}
      onSubmit={onSubmit}
      onHide={onHide}
    />);
    expect(getByLabelText('计算公式：').disabled).to.equal(true);
    expect(queryByRole('button', { name: '保存' })).to.equal(null);
    expect(queryByRole('button', { name: '另存为' })).to.equal(null);
    fireEvent.click(getByRole('button', { name: '查看 SQL ▾' }));
    expect(getByRole('button', { name: '收起 SQL ▴' })).not.to.equal(null);
    fireEvent.click(getByRole('button', { name: '取消' }));
    expect(onHide.calledOnce).to.equal(true);
  });
});
