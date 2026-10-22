/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import echarts from 'echarts';
import $ from 'jquery';
import debounce from 'lodash.debounce';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import '../../../stylesheets/index_data_manage.css';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';
import OnPasteSelect from '../../components/OnPasteSelect';
import WindowedMenuList from '../../components/WindowedMenuList';
import AlertsWrapper from '../../components/AlertsWrapper';
import ReactTreeVirtualized from '../../modules/ReactTreeVirtualized';
import { Button } from 'react-bootstrap';
import { aesEncrypt } from '../../modules/utils';
import { aggridlicense } from '../../../visualizations/constants';

// 设置ag-grid企业版许可证
LicenseManager.setLicenseKey(aggridlicense);
const AG_GRID_MODULES = [AllEnterpriseModule];
const dbDictData = document.getElementById('main_contain').getAttribute('data-db_dict');
const indexManageData = document.getElementById('main_contain').getAttribute('data-index_manage');

function IndexDataManageMain(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(IndexDataManageMain.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = IndexDataManageMain.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    // 树数据
    treeData: {},
    originalTreeData: {},
    cursor: null,
    // 搜索文本
    searchText: '',
    // 选中的指标信息数组
    selectedIndexes: [],
    // 当前选中的tab: 'data' or 'chart'
    currentTab: 'data',
    // 时序数据
    timeSeriesData: null,
    // 计算指标弹出层
    showCalcModal: false,
    calcFormData: {
      newIndexName: '',
      formula: ''
    },
    availableIndices: [],
    // 提取数据按钮禁用状态
    isExtractingData: false,
    // 保存指标弹出层
    showSaveModal: false,
    currentSavingIndex: null,
    selectedVariety: null,
    selectedCategory: null,
    isSavingIndex: false,
    // 编辑指标弹出层
    showEditModal: false,
    editFormData: {
      originalIndexName: '',
      formula: '',
      saveAsName: ''
    },
    editAvailableIndices: [],
    currentEditingIndex: null,
    // 删除确认弹出层
    showDeleteConfirm: false,
    deletingNode: null
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const mountedRef = useRef(true);
  const timersRef = useRef(new Set());
  const updateState = (update, callback) => {
    if (!mountedRef.current) return;
    const previous = stateRef.current;
    const partial = typeof update === 'function' ? update(previous, propsRef.current) : update;
    if (partial == null) return;
    const next = {
      ...previous,
      ...partial
    };
    stateRef.current = next;
    setState(next);
    if (typeof callback === 'function') callback();
  };
  const scheduleTimeout = (callback, delay) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      if (mountedRef.current) callback();
    }, delay);
    timersRef.current.add(timer);
    return timer;
  };
  const lettersStringRef = useRef('abcdefghijklmno');
  const indexDataListRef = useRef([]);
  const checkedRowIndicesRef = useRef(new Set());
  const rowSelectionRef = useRef({
    mode: 'multiRow',
    checkboxes: true,
    headerCheckbox: true,
    enableClickSelection: false
  });
  const selectionColumnDefRef = useRef({
    width: 50,
    minWidth: 50,
    maxWidth: 50,
    sortable: false,
    resizable: true,
    suppressSizeToFit: true
  });
  const defaultIndexListColDefRef = useRef({
    sortable: false,
    suppressHeaderMenuButton: true,
    // 隐藏列右上角菜单
    resizable: true,
    cellStyle: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }
  });
  const indexListColumnDefsRef = useRef([{
    headerName: '指标名称',
    field: '指标名称',
    width: 300,
    wrapText: true,
    autoHeight: true,
    cellStyle: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      lineHeight: '1.2',
      whiteSpace: 'normal',
      wordBreak: 'break-word'
    }
  }, {
    headerName: '品种',
    field: '品种',
    width: 100
  }, {
    headerName: '指标来源',
    field: '指标来源',
    width: 100
  }, {
    headerName: '栏目类别',
    field: '栏目类别',
    width: 200
  }, {
    headerName: '操作',
    field: 'action',
    width: 80,
    cellRenderer: renderActionButton,
    resizable: false,
    suppressSizeToFit: true,
    cellStyle: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '1px 2px'
    }
  }]);
  const db_dictRef = useRef(dbDictData ? JSON.parse(dbDictData) : {});
  const varicodeRef = useRef(location.href.split('/').pop());
  const index_manageRef = useRef(indexManageData ? JSON.parse(indexManageData) : {});
  const dbinfoRef = useRef(db_dictRef.current[varicodeRef.current]);
  const typeListRef = useRef([]);
  const db_mapRef = useRef({});
  const throttledOnFilterMouseUpRef = useRef(debounce(onFilterMouseUp, 350));
  const gridApiRef = useRef(undefined);
  const dataGridApiRef = useRef(undefined);
  const timeSeriesChartRef = useRef(undefined);
  function onToggle(node, toggled) {
    const {
      cursor,
      treeData
    } = stateRef.current;
    if (cursor) {
      cursor.active = false;
    }
    node.active = true;
    if (node.children) {
      // 有子节点，展开/折叠
      node.toggled = toggled;
    } else {
      // 没有子节点，触发点击事件
      handleNodeClick(node);
    }
    updateState({
      cursor: node,
      treeData: Object.assign({}, treeData)
    });
  }
  function handleNodeClick(node) {
    const {
      selectedIndexes
    } = stateRef.current;
    const key = node.key;
    const indexData = indexDataListRef.current.find(item => item.key === key);
    if (!indexData) {
      notify.error('未找到对应的指标数据');
      return;
    }

    // 检查是否已经添加过
    const exists = selectedIndexes.some(item => item.key === key);
    if (exists) {
      notify.error('该指标已添加');
      return;
    }

    // 添加到选中数组
    const newSelectedIndexes = [...selectedIndexes, indexData];
    updateState({
      selectedIndexes: newSelectedIndexes
    }, () => {
      // 在状态更新后恢复选中状态
      scheduleTimeout(() => {
        restoreSelection();
      }, 50);
    });
  }
  function onFilterMouseUp(e) {
    const filterInput = document.getElementById('tree_search_input').value.trim();
    updateState({
      searchText: filterInput
    });
  }
  function handleDeleteRow(key) {
    const {
      selectedIndexes
    } = stateRef.current;
    const newSelectedIndexes = selectedIndexes.filter(item => item.key !== key);
    checkedRowIndicesRef.current.delete(key);
    updateState({
      selectedIndexes: newSelectedIndexes
    }, () => {
      scheduleTimeout(() => {
        restoreSelection();
      }, 50);
    });
  }
  function getContextMenuItems(node) {
    // 只有叶子节点（没有 children 或 children 为空）才显示删除菜单
    if (node.children && node.children.length > 0) {
      return [];
    }
    return [{
      label: '删除',
      icon: 'fa fa-trash',
      onClick: () => openDeleteConfirm(node)
    }];
  }
  function openDeleteConfirm(node) {
    updateState({
      showDeleteConfirm: true,
      deletingNode: node
    });
  }
  function closeDeleteConfirm() {
    updateState({
      showDeleteConfirm: false,
      deletingNode: null
    });
  }
  function confirmDelete() {
    const {
      deletingNode
    } = stateRef.current;
    if (deletingNode) {
      handleDeleteIndexFromTree(deletingNode);
    }
    closeDeleteConfirm();
  }
  function handleDeleteIndexFromTree(node) {
    const nodeKey = node.key;
    if (!nodeKey) {
      notify.error('节点信息不完整');
      return;
    }
    const indexCurrent = indexDataListRef.current.find(item => item.key === nodeKey);
    $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'delete_index',
        indexinfo: {
          key: nodeKey,
          index_name: indexCurrent['指标名称']
        }
      }),
      success: response => {
        if (response.error) {
          notify.error(`删除失败: ${response.error}`);
          return;
        }

        // 从树中移除节点
        const {
          originalTreeData,
          selectedIndexes
        } = stateRef.current;
        const removeNodeFromTree = treeNode => {
          if (!treeNode.children) {
            return treeNode;
          }
          const newChildren = treeNode.children.filter(child => child.key !== nodeKey).map(child => removeNodeFromTree(child));
          return {
            ...treeNode,
            children: newChildren
          };
        };
        const newTreeData = removeNodeFromTree(originalTreeData);

        // 从 indexDataList 中移除
        indexDataListRef.current = indexDataListRef.current.filter(item => item.key !== nodeKey);

        // 从 selectedIndexes 中移除（如果存在）
        const newSelectedIndexes = selectedIndexes.filter(item => item.key !== nodeKey);
        checkedRowIndicesRef.current.delete(nodeKey);
        updateState({
          originalTreeData: newTreeData,
          treeData: newTreeData,
          selectedIndexes: newSelectedIndexes
        }, () => {
          scheduleTimeout(() => {
            restoreSelection();
            notify.success('删除成功');
          }, 50);
        });
      },
      error: (xhr, status, error) => {
        notify.error(`删除请求失败: ${error}`);
      }
    });
  }
  function handleExtractData() {
    if (!gridApiRef.current) {
      notify.error('表格未初始化');
      return;
    }
    const selectedRows = gridApiRef.current.getSelectedRows();
    if (selectedRows.length === 0) {
      notify.error('请至少选择一个指标');
      return;
    }
    updateState({
      isExtractingData: true
    });
    const indexList = selectedRows.map(row => ({
      index_name: row.指标名称,
      is_calculate: row.isCalculate || false,
      指标语句: row.指标语句,
      数据表: `${row.数据库}.dbo.${row.数据表}`
    }));
    $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'get_index_data',
        dbinfo: dbinfoRef.current,
        indexlist: indexList.map(item => ({
          ...item,
          指标语句: item.指标语句 ? aesEncrypt(item.指标语句) : ''
        }))
      }),
      success: response => {
        updateState({
          isExtractingData: false
        });
        if (response.error) {
          notify.error(`提取数据失败: ${response.error}`);
          return;
        }
        const data = response.dataDict;
        if (data.length === 0) {
          notify.error('暂无数据');
          return;
        }
        updateState({
          timeSeriesData: data,
          currentTab: 'data'
        }, () => {
          // 如果在图形tab，需要绘制图表
          if (stateRef.current.currentTab === 'chart') {
            renderChart();
          } else {
            renderDataTab();
          }
        });
      },
      error: (xhr, status, error) => {
        updateState({
          isExtractingData: false
        });
        notify.error(`请求失败: ${error}`);
      }
    });
  }
  function handleEditFormula() {
    if (!gridApiRef.current) {
      notify.error('表格未初始化');
      return;
    }
    const selectedRows = gridApiRef.current.getSelectedRows();
    if (selectedRows.length === 0) {
      notify.error('请至少勾选一个指标');
      return;
    }
    const isCalculate = selectedRows.some(row => row.isCalculate);
    if (isCalculate) {
      notify.error('不能依赖计算指标，请先将计算指标保存为普通指标', {
        time: 3000
      });
      return;
    }

    // 生成可用指标列表（最多15个，a-o）
    const letters = lettersStringRef.current.split('');
    const availableIndices = selectedRows.slice(0, 15).map((row, index) => ({
      letter: letters[index],
      name: row.指标名称,
      data: row
    }));
    updateState({
      showCalcModal: true,
      availableIndices,
      calcFormData: {
        newIndexName: '',
        formula: ''
      }
    });
  }
  function onSelectionGridReady(params) {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }
  function restoreSelection() {
    if (!gridApiRef.current) {
      return;
    }
    // 遍历所有行，根据保存的索引恢复选中状态
    gridApiRef.current.forEachNode(node => {
      if (checkedRowIndicesRef.current.has(node.data.key)) {
        node.setSelected(true);
      }
    });
  }
  function onSelectionChanged() {
    if (!gridApiRef.current) {
      return;
    }
    // 更新保存的选中行索引
    const selectedRows = gridApiRef.current.getSelectedRows();
    checkedRowIndicesRef.current.clear();
    selectedRows.forEach(row => {
      checkedRowIndicesRef.current.add(row.key);
    });
  }
  function onDataGridReady(params) {
    dataGridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }
  function switchTab(tab) {
    updateState({
      currentTab: tab
    }, () => {
      if (tab === 'chart' && stateRef.current.timeSeriesData) {
        // 延迟绘制图表，确保DOM已渲染
        scheduleTimeout(() => {
          renderChart();
        }, 100);
      }
    });
  }
  function handleCalcInputChange(field, value) {
    const {
      calcFormData
    } = stateRef.current;
    updateState({
      calcFormData: Object.assign({}, calcFormData, {
        [field]: value
      })
    });
  }
  function handleCalcCancel() {
    updateState({
      showCalcModal: false,
      calcFormData: {
        newIndexName: '',
        formula: ''
      },
      availableIndices: []
    });
  }
  function handleCalcConfirm() {
    const {
      calcFormData,
      availableIndices,
      selectedIndexes
    } = stateRef.current;
    const {
      newIndexName,
      formula
    } = calcFormData;
    if (!newIndexName || !newIndexName.trim()) {
      notify.error('请输入新指标名称');
      return;
    }
    if (!formula || !formula.trim()) {
      notify.error('请输入计算公式');
      return;
    }

    // 清除空格，替换中文括号
    const cleanFormula = formula.replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')');

    // 提取公式中使用的字母
    const usedLetters = cleanFormula.match(/[a-o]/g) || [];
    const uniqueLetters = [...new Set(usedLetters)];

    // 验证：计算公式中的字母必须在可用字母列表中
    const availableLetters = availableIndices.map(item => item.letter);
    const invalidLetters = uniqueLetters.filter(letter => !availableLetters.includes(letter));
    if (invalidLetters.length > 0) {
      notify.error(`公式中包含无效的字母: ${invalidLetters.join(', ')}`);
      return;
    }
    if (uniqueLetters.length === 0) {
      notify.error('公式中至少需要包含一个指标字母（a-o）');
      return;
    }

    // 构建 childIndex
    const childIndex = {};
    uniqueLetters.forEach(letter => {
      const indexItem = availableIndices.find(item => item.letter === letter);
      if (indexItem) {
        childIndex[letter] = indexItem.data;
      }
    });
    const sql = generateSqlFromFormula(cleanFormula, childIndex, uniqueLetters);
    const uuid = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建新指标对象
    const newIndex = {
      table_id: `calc_${uuid}`,
      key: `calc_${uuid}`,
      指标id: newIndexName.trim(),
      指标名称: newIndexName.trim(),
      指标来源: '计算指标',
      栏目类别: '',
      数据库: '',
      品种: '',
      指标列表: '',
      数据表: '',
      isCalculate: true,
      计算配置: {
        formula: cleanFormula,
        childIndex
      },
      指标语句: sql
    };

    // 添加到 selectedIndexes
    const newSelectedIndexes = [...selectedIndexes, newIndex];
    checkedRowIndicesRef.current.add(newIndex.key);
    updateState({
      selectedIndexes: newSelectedIndexes,
      showCalcModal: false,
      calcFormData: {
        newIndexName: '',
        formula: ''
      },
      availableIndices: []
    }, () => {
      scheduleTimeout(() => {
        restoreSelection();
        notify.success('计算指标添加成功');
      }, 50);
    });
  }
  function generateSqlFromFormula(formula, childIndex, usedLetters) {
    const {
      dateField,
      indexNameField,
      valueField
    } = index_manageRef.current;
    // const dbName = this.dbinfo.db_name;
    // const tableName = this.dbinfo.data_table_name;

    // 第一个字母
    const firstLetter = usedLetters[0];
    const firstChildIndex = childIndex[firstLetter];
    const firstChildIndexKeyList = firstChildIndex.key.split('|');
    let valueExpression = formula;
    usedLetters.forEach(letter => {
      const regex = new RegExp(letter, 'g');
      valueExpression = valueExpression.replace(regex, `${letter}.${valueField}`);
    });

    // 构建 FROM 子句
    const fromClause = `${firstChildIndexKeyList[0]}.dbo.${firstChildIndexKeyList[2]} as ${firstLetter}`;

    // 构建 JOIN 子句
    const joinClauses = [];
    for (let i = 1; i < usedLetters.length; i++) {
      const letter = usedLetters[i];
      const childIndexKeyList = childIndex[letter].key.split('|');
      joinClauses.push(`join ${childIndexKeyList[0]}.dbo.${childIndexKeyList[2]} as ${letter} on ${firstLetter}.${dateField}=${letter}.${dateField}`);
    }

    // 构建 WHERE 子句
    const whereClauses = usedLetters.map(letter => {
      const indexName = childIndex[letter].指标名称;
      // 转义单引号
      const escapedName = indexName.replace(/'/g, "''");
      return `${letter}.${indexNameField}='${escapedName}'`;
    });

    // 完整 SQL
    const sql = `SELECT ${firstLetter}.${dateField} as 日期, ${valueExpression} as 价格 FROM ${fromClause} ${joinClauses.join(' ')} WHERE ${whereClauses.join(' and ')}`;
    return sql;
  }
  function handleSaveIndex(indexData) {
    updateState({
      showSaveModal: true,
      currentSavingIndex: indexData,
      selectedVariety: null,
      selectedCategory: null
    });
  }
  function handleSaveCancel() {
    updateState({
      showSaveModal: false,
      currentSavingIndex: null,
      selectedVariety: null,
      selectedCategory: null
    });
  }
  function handleSaveConfirm() {
    const {
      currentSavingIndex,
      selectedVariety,
      selectedCategory,
      selectedIndexes
    } = stateRef.current;
    if (!selectedVariety) {
      notify.error('请选择品种');
      return;
    }
    if (!selectedCategory) {
      notify.error('请选择栏目类别');
      return;
    }
    const varietyData = db_mapRef.current[selectedVariety];
    const updatedIndex = Object.assign({}, currentSavingIndex, {
      品种: selectedVariety,
      数据库: varietyData['数据库'],
      指标列表: varietyData['指标列表'],
      数据表: varietyData['数据表'],
      栏目类别: selectedCategory
    });

    // 禁用按钮
    updateState({
      isSavingIndex: true
    });
    $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'add_index',
        dbinfo: dbinfoRef.current,
        indexinfo: {
          ...updatedIndex,
          '指标语句': aesEncrypt(updatedIndex.指标语句)
        }
      }),
      success: response => {
        // 恢复按钮状态
        updateState({
          isSavingIndex: false
        });
        if (response.error) {
          notify.error(`保存失败: ${response.error}`);
          return;
        }
        const newTableId = response.table_id;
        const newKey = `${varietyData['数据库']}|${varietyData['指标列表']}|${varietyData['数据表']}|${newTableId}`;
        const oldKey = currentSavingIndex.key;
        const afterUpdateIndex = Object.assign({}, updatedIndex, {
          key: newKey,
          table_id: newTableId,
          isCalculate: false
        });

        // 更新selectedIndexes中的对应指标
        const newSelectedIndexes = selectedIndexes.map(index => {
          if (index.key === oldKey) {
            return Object.assign({}, index, afterUpdateIndex);
          }
          return index;
        });

        // 更新checkedRowIndices
        if (checkedRowIndicesRef.current.has(oldKey)) {
          checkedRowIndicesRef.current.delete(oldKey);
          checkedRowIndicesRef.current.add(newKey);
        }

        // 将指标插入到树中
        insertIndexToTree(afterUpdateIndex.指标名称, newKey, selectedCategory);
        // 更新indexDataList
        indexDataListRef.current.push(afterUpdateIndex);
        updateState({
          selectedIndexes: newSelectedIndexes,
          showSaveModal: false,
          currentSavingIndex: null,
          selectedVariety: null,
          selectedCategory: null
        }, () => {
          // 恢复选中状态
          scheduleTimeout(() => {
            restoreSelection();
            notify.success('保存成功');
          }, 50);
        });
      },
      error: (xhr, status, error) => {
        // 恢复按钮状态
        updateState({
          isSavingIndex: false
        });
        notify.error(`请求失败: ${error}`);
      }
    });
  }
  function insertIndexToTree(indexName, tableId, category) {
    const {
      originalTreeData
    } = stateRef.current;
    const categories = category.split('|');

    // 结构共享：只拷贝从根到目标节点路径上的节点，其他分支保持原引用
    const treeRoot = {
      ...originalTreeData
    };
    let currentNode = treeRoot;
    for (let i = 0; i < categories.length; i++) {
      const categoryName = categories[i];
      const childIndex = currentNode.children.findIndex(node => node.name === categoryName);
      // 浅拷贝 children 数组和目标子节点
      currentNode.children = [...currentNode.children];
      currentNode.children[childIndex] = {
        ...currentNode.children[childIndex]
      };
      currentNode = currentNode.children[childIndex];
    }

    // 浅拷贝最后一级的 children 数组，然后添加新节点
    currentNode.children = [...(currentNode.children || []), {
      name: indexName,
      key: tableId
    }];
    updateState({
      originalTreeData: treeRoot,
      treeData: treeRoot
    });
  }
  function handleEditIndex(indexData) {
    const {
      计算配置
    } = indexData;
    const {
      childIndex,
      formula
    } = 计算配置;

    // 构建可用指标列表
    const editAvailableIndices = Object.keys(childIndex).map((letter, index) => ({
      letter,
      name: childIndex[letter].指标名称,
      data: childIndex[letter]
    }));
    updateState({
      showEditModal: true,
      currentEditingIndex: indexData,
      editFormData: {
        originalIndexName: indexData.指标名称,
        formula,
        saveAsName: ''
      },
      editAvailableIndices
    });
  }
  function handleEditInputChange(field, value) {
    const {
      editFormData
    } = stateRef.current;
    updateState({
      editFormData: Object.assign({}, editFormData, {
        [field]: value
      })
    });
  }
  function handleEditCancel() {
    updateState({
      showEditModal: false,
      currentEditingIndex: null,
      editFormData: {
        originalIndexName: '',
        formula: '',
        saveAsName: ''
      },
      editAvailableIndices: []
    });
  }
  function handleEditConfirm() {
    const {
      currentEditingIndex,
      editFormData,
      editAvailableIndices,
      selectedIndexes
    } = stateRef.current;
    const {
      formula
    } = editFormData;
    if (!formula || !formula.trim()) {
      notify.error('请输入计算公式');
      return;
    }

    // 清除空格，替换中文括号
    const cleanFormula = formula.replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')');

    // 检查公式是否修改
    const originalFormula = currentEditingIndex.计算配置.formula;
    if (cleanFormula === originalFormula) {
      handleEditCancel();
      return;
    }

    // 提取公式中使用的字母
    const usedLetters = cleanFormula.match(/[a-o]/g) || [];
    const uniqueLetters = [...new Set(usedLetters)];

    // 验证公式中的字母
    const availableLetters = editAvailableIndices.map(item => item.letter);
    const invalidLetters = uniqueLetters.filter(letter => !availableLetters.includes(letter));
    if (invalidLetters.length > 0) {
      notify.error(`公式中包含无效的字母: ${invalidLetters.join(', ')}`);
      return;
    }
    if (uniqueLetters.length === 0) {
      notify.error('公式中至少需要包含一个指标字母（a-o）');
      return;
    }

    // 构建 childIndex
    const childIndex = {};
    uniqueLetters.forEach(letter => {
      const indexItem = editAvailableIndices.find(item => item.letter === letter);
      if (indexItem) {
        childIndex[letter] = indexItem.data;
      }
    });

    // 生成新的 SQL
    const sql = generateSqlFromFormula(cleanFormula, childIndex, uniqueLetters);

    // 更新selectedIndexes中对应指标的属性
    const newSelectedIndexes = selectedIndexes.map(index => {
      if (index.key === currentEditingIndex.key) {
        return Object.assign({}, index, {
          计算配置: {
            formula: cleanFormula,
            childIndex
          },
          指标语句: sql
        });
      }
      return index;
    });

    // 如果当前指标isCalculate=false，更新indexDataList
    if (!currentEditingIndex.isCalculate) {
      const indexInList = indexDataListRef.current.find(item => item.key === currentEditingIndex.key);
      if (indexInList) {
        indexInList.计算配置.formula = cleanFormula;
        indexInList.指标语句 = sql;
      }
      $.ajax({
        url: '',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          action: 'edit_index',
          dbinfo: dbinfoRef.current,
          indexinfo: {
            ...indexInList,
            指标语句: aesEncrypt(indexInList.指标语句)
          }
        }),
        success: response => {
          notify.success('编辑成功');
        },
        error: (xhr, status, error) => {
          notify.error(`请求失败: ${error}`);
        }
      });
    }
    updateState({
      selectedIndexes: newSelectedIndexes,
      showEditModal: false,
      currentEditingIndex: null,
      editFormData: {
        originalIndexName: '',
        formula: '',
        saveAsName: ''
      },
      editAvailableIndices: []
    }, () => {
      scheduleTimeout(() => {
        restoreSelection();
      }, 50);
    });
  }
  function handleEditSaveAs() {
    const {
      currentEditingIndex,
      editFormData,
      editAvailableIndices,
      selectedIndexes
    } = stateRef.current;
    const {
      formula,
      saveAsName
    } = editFormData;
    if (!saveAsName || !saveAsName.trim()) {
      notify.error('请输入另存指标名');
      return;
    }
    if (!formula || !formula.trim()) {
      notify.error('请输入计算公式');
      return;
    }

    // 清除空格，替换中文括号
    const cleanFormula = formula.replace(/\s/g, '').replace(/（/g, '(').replace(/）/g, ')');

    // 提取公式中使用的字母
    const usedLetters = cleanFormula.match(/[a-o]/g) || [];
    const uniqueLetters = [...new Set(usedLetters)];

    // 验证公式中的字母
    const availableLetters = editAvailableIndices.map(item => item.letter);
    const invalidLetters = uniqueLetters.filter(letter => !availableLetters.includes(letter));
    if (invalidLetters.length > 0) {
      notify.error(`公式中包含无效的字母: ${invalidLetters.join(', ')}`);
      return;
    }
    if (uniqueLetters.length === 0) {
      notify.error('公式中至少需要包含一个指标字母（a-o）');
      return;
    }

    // 构建 childIndex
    const childIndex = {};
    uniqueLetters.forEach(letter => {
      const indexItem = editAvailableIndices.find(item => item.letter === letter);
      if (indexItem) {
        childIndex[letter] = indexItem.data;
      }
    });

    // 生成 SQL
    const sql = generateSqlFromFormula(cleanFormula, childIndex, uniqueLetters);

    // 生成 UUID
    const uuid = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 创建新指标对象
    const newIndex = {
      key: `calc_${uuid}`,
      table_id: `calc_${uuid}`,
      指标id: saveAsName.trim(),
      指标名称: saveAsName.trim(),
      指标来源: '计算指标',
      栏目类别: '',
      isCalculate: true,
      计算配置: {
        formula: cleanFormula,
        childIndex
      },
      指标语句: sql
    };

    // 添加到 selectedIndexes
    const newSelectedIndexes = [...selectedIndexes, newIndex];

    // 添加到勾选集合
    checkedRowIndicesRef.current.add(newIndex.key);
    updateState({
      selectedIndexes: newSelectedIndexes,
      showEditModal: false,
      currentEditingIndex: null,
      editFormData: {
        originalIndexName: '',
        formula: '',
        saveAsName: ''
      },
      editAvailableIndices: []
    }, () => {
      scheduleTimeout(() => {
        restoreSelection();
        notify.success('另存为成功');
      }, 50);
    });
  }
  function renderChart() {
    const {
      timeSeriesData
    } = stateRef.current;
    if (!timeSeriesData || !timeSeriesData.data) {
      return;
    }
    const chartDom = document.getElementById('time_series_chart');
    if (!chartDom) {
      return;
    }
    timeSeriesChartRef.current = echarts.getInstanceByDom(chartDom);
    if (timeSeriesChartRef.current) {
      timeSeriesChartRef.current.clear();
    } else {
      timeSeriesChartRef.current = echarts.init(chartDom);
    }

    // 处理数据
    const dates = timeSeriesData.index || [];
    const columns = timeSeriesData.columns || [];
    const data = timeSeriesData.data || [];
    const series = columns.map((col, index) => ({
      name: col,
      type: 'line',
      data: data.map(row => row[index]),
      connectNulls: true
    }));
    const option = {
      title: {
        text: ''
      },
      tooltip: {
        trigger: 'axis'
      },
      legend: {
        data: columns,
        top: 15
      },
      grid: {},
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates
      },
      yAxis: {
        type: 'value'
      },
      series,
      dataZoom: [{
        type: 'inside'
      }, {
        show: true,
        type: 'slider'
      }]
    };
    timeSeriesChartRef.current.setOption(option);
  }
  function renderActionButton(props) {
    const {
      data
    } = props;
    return <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      gap: '10px'
    }}>
        {data.计算配置 && data.计算配置.childIndex && <i className="fa fa-edit" style={{
        cursor: 'pointer',
        color: '#007bff',
        fontSize: '16px'
      }} onClick={() => handleEditIndex(data)} title="指标编辑" />}
        {data.isCalculate && <i className="fa fa-save" style={{
        cursor: 'pointer',
        color: '#28a745',
        fontSize: '16px'
      }} onClick={() => handleSaveIndex(data)} title="保存为普通指标" />}
        <i className="fa fa-trash" style={{
        cursor: 'pointer',
        color: 'red',
        fontSize: '16px'
      }} onClick={() => handleDeleteRow(data.key)} />
      </div>;
  }
  function renderTreeMenu() {
    const {
      originalTreeData,
      searchText
    } = stateRef.current;
    if (!originalTreeData || Object.keys(originalTreeData).length === 0) {
      return <div className="tree-empty-message">
          暂无数据
        </div>;
    }
    return <div className="tree-container">
        <div>
          <input className="Select-control" id="tree_search_input" style={{
          cursor: 'text'
        }} onKeyUp={throttledOnFilterMouseUpRef.current} placeholder="输入关键字(多个以空格分隔)" type="text" />
        </div>
        <div style={{
        width: '100%',
        paddingTop: '6px',
        height: 'calc(100%)'
      }}>
          <ReactTreeVirtualized data={originalTreeData} toggled searchText={searchText} onNodeDoubleClick={handleNodeClick} contextMenuItems={getContextMenuItems} />
        </div>
      </div>;
  }
  function renderSelectionGrid() {
    const {
      selectedIndexes
    } = stateRef.current;
    return <div className="ag-theme-balham" style={{
      height: '200px',
      width: '100%'
    }}>
        <AgGridReact modules={AG_GRID_MODULES} theme="legacy" defaultColDef={defaultIndexListColDefRef.current} columnDefs={indexListColumnDefsRef.current} rowData={selectedIndexes} rowSelection={rowSelectionRef.current} selectionColumnDef={selectionColumnDefRef.current} onGridReady={onSelectionGridReady} onSelectionChanged={onSelectionChanged} />
      </div>;
  }
  function renderDataTab() {
    const {
      timeSeriesData
    } = stateRef.current;
    if (!timeSeriesData || !timeSeriesData.data) {
      return <div className="empty-message">
          暂无数据，请先提取数据
        </div>;
    }
    const dates = timeSeriesData.index || [];
    const columns = timeSeriesData.columns || [];
    const data = timeSeriesData.data || [];
    const columnDefs = [{
      headerName: '日期',
      field: '日期',
      width: 145,
      pinned: 'left',
      cellStyle: {
        textAlign: 'center'
      },
      sort: 'desc'
    }, ...columns.map(col => {
      const colDef = {
        headerName: col,
        field: col,
        width: 150,
        cellStyle: {
          textAlign: 'center'
        }
      };
      if (col.includes('.')) {
        colDef.valueGetter = params => params.data[col];
      }
      return colDef;
    })];
    const defaultColDef = {
      sortable: true,
      filter: false,
      resizable: true,
      suppressHeaderMenuButton: true,
      cellStyle: {
        textAlign: 'center'
      }
    };
    const rowData = dates.map((date, index) => {
      const row = {
        日期: date
      };
      columns.forEach((col, colIndex) => {
        row[col] = data[index][colIndex];
      });
      return row;
    });
    return <div className="ag-theme-balham" style={{
      height: '100%',
      width: '100%'
    }}>
        <AgGridReact modules={AG_GRID_MODULES} theme="legacy" columnDefs={columnDefs} defaultColDef={defaultColDef} rowData={rowData} onGridReady={onDataGridReady} />
      </div>;
  }
  function renderChartTab() {
    const {
      timeSeriesData
    } = stateRef.current;
    if (!timeSeriesData || !timeSeriesData.data) {
      return <div className="empty-message">
          暂无数据，请先提取数据
        </div>;
    }
    return <div id="time_series_chart" style={{
      width: '100%',
      height: '100%'
    }} />;
  }
  function renderCalcModal() {
    const {
      showCalcModal,
      calcFormData,
      availableIndices
    } = stateRef.current;
    if (!showCalcModal) {
      return null;
    }
    return <div className="modal-overlay">
        <div className="calc-modal-content">
          <div className="modal-title">新增计算指标</div>
          <div className="calc-modal-body">
            {/* 左侧：指标列表 */}
            <div className="calc-modal-left">
              <div className="index-list-label">指标列表</div>
              <div className="index-list-box">
                {availableIndices.map(item => <div key={item.letter} className="index-list-item">
                    {item.letter}：{item.name}
                  </div>)}
              </div>
            </div>

            {/* 右侧：表单 */}
            <div className="calc-modal-right">
              <div className="calc-form-group">
                <label className="calc-form-label">新指标名：</label>
                <input type="text" className="calc-form-input" value={calcFormData.newIndexName} onChange={e => handleCalcInputChange('newIndexName', e.target.value)} placeholder="" />
              </div>

              <div className="calc-form-group">
                <label className="calc-form-label">计算公式：</label>
                <input type="text" className="calc-form-input" value={calcFormData.formula} onChange={e => handleCalcInputChange('formula', e.target.value)} placeholder="" />
              </div>

              <div className="calc-form-hint">
                注：计算公式(仅支持 加减乘除 和 英文括号)：+-*/()，例如：(a*2/5+b)*c-3
              </div>
            </div>
          </div>

          <div className="calc-modal-footer">
            <button onClick={handleCalcConfirm} className='btn-confirm'>
              确定
            </button>
            <button onClick={handleCalcCancel} style={{
            marginLeft: '10px'
          }} className='btn-cancel'>
              取消
            </button>
          </div>
        </div>
      </div>;
  }
  function renderSaveModal() {
    const {
      showSaveModal,
      currentSavingIndex,
      selectedVariety,
      selectedCategory,
      isSavingIndex
    } = stateRef.current;
    if (!showSaveModal) {
      return null;
    }

    // 品种下拉选项来源于 db_map 的 keys
    const varietyOptions = Object.keys(db_mapRef.current).map(key => ({
      value: key,
      label: key
    }));
    // 栏目类别选项根据选中的品种动态获取
    const categoryOptions = selectedVariety && db_mapRef.current[selectedVariety] ? db_mapRef.current[selectedVariety]['栏目类别'].map(item => ({
      value: item,
      label: item
    })) : [];
    return <div className="modal-overlay">
        <div className="save-modal-content">
          <div className="modal-title">保存为普通指标</div>
          <div className="save-modal-body">
            <div className="save-form-group">
              <label className="save-form-label">指标名称：</label>
              <div className="save-form-text">{currentSavingIndex ? currentSavingIndex.指标名称 : ''}</div>
            </div>

            <div className="save-form-group">
              <label className="save-form-label">品种：</label>
              <OnPasteSelect placeholder="请选择品种" options={varietyOptions} value={selectedVariety ? {
              value: selectedVariety,
              label: selectedVariety
            } : null} onChange={option => updateState({
              selectedVariety: option ? option.value : null,
              selectedCategory: null
            })} isClearable components={{
              MenuList: WindowedMenuList
            }} maxMenuHeight={150} />
            </div>

            <div className="save-form-group">
              <label className="save-form-label">栏目类别：</label>
              <OnPasteSelect placeholder="请选择栏目类别" options={categoryOptions} value={selectedCategory ? {
              value: selectedCategory,
              label: selectedCategory
            } : null} onChange={option => updateState({
              selectedCategory: option ? option.value : null
            })} isClearable components={{
              MenuList: WindowedMenuList
            }} maxMenuHeight={150} />
            </div>
          </div>

          <div className="save-modal-footer">
            <button onClick={handleSaveConfirm} className="btn-confirm" disabled={isSavingIndex}>
              确定
            </button>
            <button onClick={handleSaveCancel} style={{
            marginLeft: '10px'
          }} className="btn-cancel">
              取消
            </button>
          </div>
        </div>
      </div>;
  }
  function renderEditModal() {
    const {
      showEditModal,
      editFormData,
      editAvailableIndices
    } = stateRef.current;
    if (!showEditModal) {
      return null;
    }
    return <div className="modal-overlay">
        <div className="calc-modal-content">
          <div className="modal-title">指标编辑</div>

          <div className="calc-modal-body">
            {/* 左侧：指标列表 */}
            <div className="calc-modal-left">
              <div className="index-list-label">指标列表</div>
              <div className="index-list-box">
                {editAvailableIndices.map(item => <div key={item.letter} className="index-list-item">
                    {item.letter}：{item.name}
                  </div>)}
              </div>
            </div>

            {/* 右侧：表单 */}
            <div className="calc-modal-right">
              <div className="calc-form-group">
                <label className="calc-form-label">指标名：</label>
                <div className="calc-form-text">{editFormData.originalIndexName}</div>
              </div>

              <div className="calc-form-group">
                <label className="calc-form-label">计算公式：</label>
                <input type="text" className="calc-form-input" value={editFormData.formula} onChange={e => handleEditInputChange('formula', e.target.value)} placeholder="" />
              </div>

              <div className="calc-form-hint">
                注：计算公式(仅支持 加减乘除 和 英文括号)：+-*/()，例如：(a*2/5+b)*c-3
              </div>

              <div className="calc-form-group">
                <label className="calc-form-label">另存指标名：</label>
                <input type="text" className="calc-form-input" value={editFormData.saveAsName} onChange={e => handleEditInputChange('saveAsName', e.target.value)} placeholder="" />
              </div>
            </div>
          </div>

          <div className="calc-modal-footer">
            <button onClick={handleEditConfirm} className='btn-confirm'>
              确定
            </button>
            <button onClick={handleEditSaveAs} style={{
            marginLeft: '10px'
          }} className='btn-save-as'>
              另存为
            </button>
            <button onClick={handleEditCancel} style={{
            marginLeft: '10px'
          }} className='btn-cancel'>
              取消
            </button>
          </div>
        </div>
      </div>;
  }
  function renderDeleteConfirmModal() {
    const {
      showDeleteConfirm,
      deletingNode
    } = stateRef.current;
    if (!showDeleteConfirm) {
      return null;
    }
    return <div className="modal-overlay">
        <div className="delete-confirm-modal-content">
          <div className="delete-confirm-modal-title">删除确认</div>
          <div className="delete-confirm-modal-body">
            <p>确定要删除指标 <strong>{deletingNode ? deletingNode.name : ''}</strong> 吗？</p>
          </div>
          <div className="delete-confirm-modal-footer">
            <Button variant="danger" onClick={confirmDelete}>
              确定
            </Button>
            <Button onClick={closeDeleteConfirm} style={{
            marginLeft: '10px'
          }}>
              取消
            </Button>
          </div>
        </div>
      </div>;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    const throttledOnFilterMouseUp = throttledOnFilterMouseUpRef.current;
    const request = $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'get_index_list',
        dbinfo: dbinfoRef.current
      }),
      success: response => {
        if (response.error) {
          notify.error(`获取指标列表失败: ${response.error}`);
          return;
        }
        const treeData = response.treeNodeDict || {};
        indexDataListRef.current = response.indexDataList || [];
        db_mapRef.current = response.db_map || {};
        // this.typeList = response.typeList.map(item => ({ value: item, label: item })) || [];
        updateState({
          treeData,
          originalTreeData: treeData
        });
      },
      error: (xhr, status, error) => {
        if (status === 'abort') return;
        notify.error(`请求失败: ${error}`);
      }
    });
    return () => {
      mountedRef.current = false;
      request.abort();
      throttledOnFilterMouseUp.cancel();
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
      if (timeSeriesChartRef.current) {
        timeSeriesChartRef.current.dispose();
        timeSeriesChartRef.current = null;
      }
    };
  }, []);
  const {
    currentTab,
    isExtractingData
  } = stateRef.current;
  console.log('render 触发了');
  return <div className="index-data-manage-container">
        <AlertsWrapper />
        {/* 左侧树区域 */}
        <div className="left-panel">
          {renderTreeMenu()}
        </div>

        {/* 右侧区域 */}
        <div className="right-panel">
          {/* 按钮区域 */}
          <div className="button-area">
            <Button variant="primary" onClick={handleExtractData} disabled={isExtractingData}>
              提取数据
            </Button>
            <Button variant="outline-secondary" onClick={handleEditFormula} style={{
          marginLeft: '10px'
        }}>
              编辑公式
            </Button>
          </div>

          {/* 选中指标信息展示区域 */}
          <div className="selection-grid-area">
            {renderSelectionGrid()}
          </div>

          {/* 时序数据展示区域 */}
          <div className="data-display-area">
            {/* Tab标签 */}
            <div className="tab-header">
              <div className={`tab-item ${currentTab === 'data' ? 'active' : ''}`} onClick={() => switchTab('data')}>
                数据
              </div>
              <div className={`tab-item ${currentTab === 'chart' ? 'active' : ''}`} onClick={() => switchTab('chart')}>
                图形
              </div>
            </div>

            {/* Tab内容 */}
            <div className="tab-content">
              {currentTab === 'data' ? renderDataTab() : renderChartTab()}
            </div>
          </div>
        </div>

        {/* 计算指标弹出层 */}
        {renderCalcModal()}

        {/* 保存指标弹出层 */}
        {renderSaveModal()}

        {/* 编辑指标弹出层 */}
        {renderEditModal()}

        {/* 删除确认弹出层 */}
        {renderDeleteConfirmModal()}
      </div>;
}



export default IndexDataManageMain;
