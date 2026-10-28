import {
  buildMoveRequest,
  canDragNode,
  canDropNode,
  getParentCategoryOptions,
  getSaveCategoryOptions,
  matchTreeNode,
  parseIndexKey,
} from '../../../javascripts/indexDataManage/utils/treeUtils';
import {
  addDependency,
  generateSqlFromFormula,
  normalizeFormulaDependencies,
  validateFormula,
} from '../../../javascripts/indexDataManage/utils/formulaUtils';
import {
  buildPivotTable,
  buildSeasonData,
  buildSeriesOption,
  buildVarietyColorMap,
  getVisibleRows,
  moveIndicator,
} from '../../../javascripts/indexDataManage/utils/chartUtils';

const keyA1 = 'TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|1';
const keyA2 = 'TFFY_CF|行情_商品价格指标列表_红枣|行情_商品报价表_红枣|2';
const keyB1 = 'TFFY_ZN|行情_贵金属指标列表|行情_贵金属报价表|7';

const tree = {
  key: 'node_1',
  name: '目录',
  node_id: 1,
  parent_id: 0,
  children: [
    {
      key: 'node_2',
      name: '红枣',
      node_id: 2,
      parent_id: 1,
      children: [
        { key: 'node_4', name: '子类', node_id: 4, parent_id: 2, children: [] },
        { key: keyA1, name: '价格1' },
        { key: keyB1, name: '黄金' },
        { key: keyA2, name: '价格2' },
      ],
    },
    { key: 'node_3', name: '锌', node_id: 3, parent_id: 1, children: [] },
    { key: 'virtual_uncategorized', name: '未分类', node_id: 'virtual_uncategorized', is_virtual: true, children: [] },
  ],
};

describe('indexDataManage treeUtils', () => {
  it('builds full parent paths and excludes the edited subtree and virtual nodes', () => {
    expect(getParentCategoryOptions(tree)).to.deep.equal([
      { value: 1, label: '目录' },
      { value: 2, label: '目录|红枣' },
      { value: 4, label: '目录|红枣|子类' },
      { value: 3, label: '目录|锌' },
    ]);
    expect(getParentCategoryOptions(tree, 2)).to.deep.equal([
      { value: 1, label: '目录' },
      { value: 3, label: '目录|锌' },
    ]);
    expect(getParentCategoryOptions(null)).to.deep.equal([]);
  });

  it('parses index keys', () => {
    expect(parseIndexKey(keyB1)).to.deep.equal({
      database: 'TFFY_ZN',
      listTable: '行情_贵金属指标列表',
      dataTable: '行情_贵金属报价表',
      tableId: '7',
    });
    expect(parseIndexKey('node_2')).to.equal(null);
  });

  it('restricts dragging and dropping by node kind', () => {
    expect(canDragNode(tree)).to.equal(false);
    expect(canDragNode(tree.children[2])).to.equal(false);
    expect(canDragNode(tree.children[0])).to.equal(true);
    expect(canDragNode({ key: keyA1, name: 'x' })).to.equal(true);

    const leaf = { key: keyA1, name: '价格1' };
    expect(canDropNode(tree, leaf, tree, 'inside')).to.equal(false);
    expect(canDropNode(tree, leaf, tree.children[1], 'inside')).to.equal(true);
    expect(canDropNode(tree, leaf, tree.children[2], 'inside')).to.equal(false);
    expect(canDropNode(tree, leaf, { key: keyA2 }, 'before')).to.equal(true);

    const category = tree.children[0];
    expect(canDropNode(tree, category, category.children[0], 'inside')).to.equal(false);
    expect(canDropNode(tree, category, tree.children[1], 'before')).to.equal(true);
    expect(canDropNode(tree, category, tree, 'before')).to.equal(false);
    expect(canDropNode(tree, category, tree, 'inside')).to.equal(true);
  });

  it('computes move orders among siblings of the same list table', () => {
    expect(buildMoveRequest(tree, { key: keyA1 }, { key: keyA2 }, 'after')).to.deep.equal({
      action: 'move_indexes', node_keys: [keyA1], new_parent_id: 2, new_order: 2,
    });
    expect(buildMoveRequest(tree, { key: keyA2 }, { key: keyB1 }, 'before')).to.deep.equal({
      action: 'move_indexes', node_keys: [keyA2], new_parent_id: 2, new_order: 2,
    });
    expect(buildMoveRequest(tree, tree.children[1], tree.children[0], 'before')).to.deep.equal({
      action: 'move_category', node_id: 3, new_parent_id: 1, new_order: 1,
    });
    expect(buildMoveRequest(tree, { key: keyB1 }, tree.children[1], 'inside')).to.deep.equal({
      action: 'move_indexes', node_keys: [keyB1], new_parent_id: 3, new_order: null,
    });
  });

  it('matches search text and lists non-root save categories', () => {
    expect(matchTreeNode({ name: '价格', searchText: '价格 ID01 计算指标' }, ['id01', '计算'])).to.equal(true);
    expect(matchTreeNode({ name: '价格' }, ['黄金'])).to.equal(false);
    const options = getSaveCategoryOptions([
      { node_id: 1, nodes_path: '目录' },
      { node_id: 2, nodes_path: '目录|红枣' },
    ], tree);
    expect(options).to.deep.equal([{ value: 2, label: '目录|红枣' }]);
  });
});

describe('indexDataManage formulaUtils', () => {
  it('validates formulas', () => {
    expect(validateFormula('', ['a'])).to.equal('请输入计算公式');
    expect(validateFormula('(a+b', ['a', 'b'])).to.equal('计算公式括号不匹配');
    expect(validateFormula('a+c', ['a', 'b'])).to.contain('c');
    expect(validateFormula('ab', ['a', 'b'])).to.equal('指标字母之间缺少运算符');
    expect(validateFormula('a+x', ['a'])).to.contain('只能包含');
    expect(validateFormula('（a + b）*2', ['a', 'b'])).to.equal('');
  });

  it('generates cross-database SQL in the backend recovery format', () => {
    const sql = generateSqlFromFormula('(a-b)/2', {
      a: { key: keyA1, 指标名称: "红枣'现货" },
      b: { key: keyB1, 指标名称: '黄金' },
    }, { dateField: '报价日期', indexNameField: '品名', valueField: '价格' });
    expect(sql).to.equal(
      'SELECT a.[报价日期] as 日期, (a.[价格]-b.[价格])/2 as 价格 ' +
      'FROM [TFFY_CF].dbo.[行情_商品报价表_红枣] as a ' +
      'join [TFFY_ZN].dbo.[行情_贵金属报价表] as b on a.[报价日期]=b.[报价日期] ' +
      "WHERE a.[品名]='红枣''现货' and b.[品名]='黄金'",
    );
  });

  it('assigns free letters and compacts unused dependencies', () => {
    let deps = addDependency([], { key: keyA1, 指标名称: 'x' });
    deps = addDependency(deps, { key: keyB1, 指标名称: 'y' });
    deps = addDependency(deps, { key: keyB1, 指标名称: 'y' });
    expect(deps.map(item => item.letter)).to.deep.equal(['a', 'b']);
    const normalized = normalizeFormulaDependencies('b*2', deps);
    expect(normalized.formula).to.equal('a*2');
    expect(normalized.dependencies).to.deep.equal([{ letter: 'a', key: keyB1, 指标名称: 'y' }]);
  });
});

describe('indexDataManage chartUtils', () => {
  const data = {
    index: ['2024-01-02', '2025-01-02', '2025-03-01'],
    columns: ['甲', '乙'],
    data: [[1, ''], [2, 5], [3, 6]],
  };
  const rows = [{ 指标名称: '甲', 品种: '锌' }, { 指标名称: '乙', 品种: '红枣' }];

  it('filters visible rows and keeps one row for season charts', () => {
    expect(getVisibleRows(rows, { 甲: { visible: false } }, 'line')).to.deep.equal([rows[1]]);
    expect(getVisibleRows(rows, {}, 'season')).to.deep.equal([rows[0]]);
  });

  it('builds series with right axis and nulls for missing values', () => {
    const option = buildSeriesOption(data, rows, { 乙: { yAxisIndex: 1, chartType: 'area' } }, 'line', false);
    expect(option.yAxis).to.have.length(2);
    expect(option.series[1]).to.include({ name: '乙(右轴)', type: 'line', yAxisIndex: 1 });
    expect(option.series[1].data).to.deep.equal([null, 5, 6]);
    expect(option.series[1].areaStyle).to.deep.equal({});
  });

  it('aligns season data by day of year', () => {
    const season = buildSeasonData(data, '甲');
    expect(season.axis).to.have.length(366);
    expect(season.years).to.deep.equal(['2024', '2025']);
    expect(season.seriesData['2025'][season.axis.indexOf('03-01')]).to.equal(3);
  });

  it('builds pivot tables ordered by date desc and indicator order', () => {
    const pivot = buildPivotTable(data, rows, {}, ['乙', '甲'], { startDate: '2025-01-01' });
    expect(pivot.indicators).to.deep.equal(['乙', '甲']);
    expect(pivot.rows.map(row => row.date)).to.deep.equal(['2025-03-01', '2025-01-02']);
    expect(pivot.rows[0].values).to.deep.equal([6, 3]);
    expect(moveIndicator(['a', 'b', 'c'], 'c', 'a')).to.deep.equal(['c', 'a', 'b']);
    expect(buildVarietyColorMap(rows)).to.deep.equal({ 红枣: 0, 锌: 1 });
  });
});
