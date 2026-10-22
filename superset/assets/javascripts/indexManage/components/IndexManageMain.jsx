/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import echarts from 'echarts';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import '../../../stylesheets/index_manage.css';
import OnPasteSelect from '../../components/OnPasteSelect';
import WindowedMenuList from '../../components/WindowedMenuList';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';
import AlertsWrapper from '../../components/AlertsWrapper';
import { aesEncrypt } from '../../modules/utils';
import { aggridlicense } from '../../../visualizations/constants';

// 设置ag-grid企业版许可证
LicenseManager.setLicenseKey(aggridlicense);
const AG_GRID_MODULES = [AllEnterpriseModule];

function IndexManageMain(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(IndexManageMain.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = IndexManageMain.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    // 表格数据
    rowData: [],
    // 弹出层状态
    showModal: false,
    modalType: '',
    // 'add', 'edit', 'copy'
    currentRow: null,
    // 快捷新增计算指标弹出层状态
    showQuickCalcModal: false,
    quickCalcFormData: {
      newIndexName: '',
      calculateFormula: '',
      指标a: {
        数据表: '',
        指标名: ''
      },
      指标b: {
        数据表: '',
        指标名: ''
      },
      指标c: {
        数据表: '',
        指标名: ''
      },
      指标d: {
        数据表: '',
        指标名: ''
      }
    },
    // 各指标的指标名选项数据
    indicatorOptions: {
      指标a: [],
      指标b: [],
      指标c: [],
      指标d: []
    },
    // 表单数据
    formData: {
      指标分类: '',
      指标id: '',
      指标名称: '',
      指标来源: '',
      指标说明: '',
      指标语句: '',
      增加方式: '',
      更新次序: '',
      更新时间: '',
      刷新语句: '',
      wind指标项: '',
      栏目类别: ''
    },
    // 按钮禁用状态
    buttonDisabled: {
      submitButton: false,
      quickCalcAddButton: false,
      quickCalcCalculateButton: false,
      updateButtons: {},
      // 存储各个Update按钮的禁用状态，key为table_id
      deleteIndexDataButton: false,
      // 指标数据删除按钮
      previewDataButton: false // 预览数据按钮
    },
    deleteIndexName: '',
    // 预览数据弹出层状态
    showPreviewModal: false,
    previewData: []
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
  const doneIndexTableRef = useRef({});
  const columnDefsRef = useRef([{
    headerName: 'ID',
    field: 'table_id',
    width: 32,
    filter: 'agNumberColumnFilter',
    sort: 'desc'
  }, {
    headerName: '指标分类',
    field: '指标分类',
    width: 60,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '指标id',
    field: '指标id',
    width: 90,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '指标名称',
    field: '指标名称',
    width: 90,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '指标来源',
    field: '指标来源',
    width: 50,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '指标说明',
    field: '指标说明',
    width: 50,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '指标语句',
    field: '指标语句',
    width: 300,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    },
    // cellStyle: {
    //   'white-space': 'normal',
    // },
    autoHeight: true
  }, {
    headerName: '增加方式',
    field: '增加方式',
    width: 55,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '顺序',
    field: '更新次序',
    width: 30
  }, {
    headerName: '更新时间',
    field: '更新时间',
    width: 70,
    filter: 'agDateColumnFilter',
    filterParams: {
      browserDatePicker: true,
      comparator(filterLocalDateAtMidnight, cellValue) {
        const dateAsString = cellValue;
        if (dateAsString == null) return -1;
        const dateParts = dateAsString.split(' ')[0].split('-');
        const cellDate = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
        if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
          return 0;
        }
        if (cellDate < filterLocalDateAtMidnight) {
          return -1;
        }
        if (cellDate > filterLocalDateAtMidnight) {
          return 1;
        }
      }
    },
    cellRenderer(params) {
      if (!params.value) return '';
      try {
        const dateStr = params.value.split(' ')[0]; // 获取日期部分，去掉时间
        const dateParts = dateStr.split('-');
        if (dateParts.length === 3) {
          return `${dateParts[0]}/${dateParts[1]}/${dateParts[2]}`;
        }
        return params.value;
      } catch (e) {
        return params.value;
      }
    }
  }, {
    headerName: '刷新语句',
    field: '刷新语句',
    width: 50,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '指标项',
    field: 'wind指标项',
    width: 50,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '栏目类别',
    field: '栏目类别',
    width: 80,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '操作',
    field: 'actions',
    width: 95,
    cellRenderer: renderActionButtons,
    cellRendererParams: {
      // 传递禁用状态数据
      buttonDisabled: stateRef.current.buttonDisabled.updateButtons
    },
    sortable: false,
    filter: false,
    resizable: false,
    suppressSizeToFit: true,
    // cellStyle: {
    //   paddingTop: '1px',
    //   paddingBottom: '1px',
    // },
    autoHeight: true
  }]);
  const defaultColDefRef = useRef({
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: true,
    suppressHeaderMenuButton: true // 隐藏列右上角菜单
  });
  const paginationPageSizeRef = useRef(10);
  const pageDataRef = useRef(null);
  if (pageDataRef.current === null) {
    const container = document.getElementById('ag_grid_container');
    const dbDictData = container.getAttribute('data-db_dict');
    const indexManageData = container.getAttribute('data-index_manage');
    const dbDict = dbDictData ? JSON.parse(dbDictData) : {};
    let varicode = location.href.split('/').pop();
    if (varicode.includes('?')) {
      varicode = varicode.split('?')[0];
    }
    const indexDataMap = {};
    const dataTableOptions = Object.values(dbDict).map(item => {
      const tableFullName = `${item.db_name}.dbo.${item.index_table_name}`;
      indexDataMap[tableFullName] = `${item.db_name}.dbo.${item.data_table_name}`;
      return {
        value: tableFullName,
        label: tableFullName
      };
    });
    pageDataRef.current = {
      dbDict,
      indexManage: indexManageData ? JSON.parse(indexManageData) : {},
      varicode,
      indexDataMap,
      dataTableOptions
    };
  }
  const db_dictRef = useRef(pageDataRef.current.dbDict);
  const index_manageRef = useRef(pageDataRef.current.indexManage);
  const varicodeRef = useRef(pageDataRef.current.varicode);
  const index_data_mapRef = useRef(pageDataRef.current.indexDataMap);
  const dataTableOptionsRef = useRef(pageDataRef.current.dataTableOptions);
  const gridApiRef = useRef(undefined);
  const previewChartRef = useRef(undefined);
  const resizeTimerRef = useRef(undefined);
  function renderActionButtons(props) {
    const {
      data,
      node
    } = props;
    const tableId = data.table_id;
    const isUpdateDisabled = props.buttonDisabled[tableId] || false;
    return <div className="action-buttons-container">
        <div className="action-buttons-row">
          <button className="btn-action action-btn-edit" onClick={() => handleEdit(node)}>
            Edit
          </button>
          <button className="btn-action action-btn-copy" onClick={() => handleCopy(node)}>
            Copy
          </button>
        </div>
        <div className="action-buttons-row">
          <button className={`btn-action action-btn-update ${isUpdateDisabled ? 'disabled' : ''}`} onClick={() => handleUpdate(node)} disabled={isUpdateDisabled} id={`update-${tableId}`}>
            Update
          </button>
          <button className="btn-action action-btn-delete" onClick={() => handleDelete(node)}>
            Delete
          </button>
        </div>
      </div>;
  }
  function onGridReady(params) {
    gridApiRef.current = params.api;
    // 列宽自适应
    params.api.sizeColumnsToFit();
  }
  function handleEdit(node) {
    if (node && node.data) {
      const rowData = node.data;
      updateState({
        showModal: true,
        modalType: 'edit',
        currentRow: rowData,
        formData: {
          ...rowData
        }
      });
    }
  }
  function handleDelete(node) {
    if (node && node.data) {
      const rowData = node.data;
      if (window.confirm(`确认删除指标 "${rowData.指标名称}" 吗？`)) {
        const dbInfo = db_dictRef.current[varicodeRef.current];
        $.ajax({
          url: '',
          type: 'POST',
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify({
            action: 'delete_index',
            dbinfo: dbInfo,
            table_id: rowData.table_id
          }),
          success: response => {
            if (response.error) {
              notify.error(`删除失败: ${response.error}`);
              return;
            }
            notify.success('指标删除成功！');
            // 保存当前筛选器状态
            const filterModel = gridApiRef.current ? gridApiRef.current.getFilterModel() : null;

            // 从前端删除
            const newRowData = stateRef.current.rowData.filter(row => row.table_id !== rowData.table_id);
            updateState({
              rowData: newRowData
            }, () => {
              // 数据更新后重新调整列宽并恢复筛选器
              if (gridApiRef.current) {
                scheduleTimeout(() => {
                  gridApiRef.current.sizeColumnsToFit();
                  // 恢复筛选器状态
                  if (filterModel) {
                    gridApiRef.current.setFilterModel(filterModel);
                  }
                }, 100);
              }
            });
            const tableFullName = `${dbInfo.db_name}.dbo.${dbInfo.index_table_name}`;
            // if (this.doneIndexTable[tableFullName]) {
            //   this.doneIndexTable[tableFullName] = [];
            // }
          },
          error: (xhr, status, error) => {
            notify.error('删除请求失败');
          }
        });
      }
    }
  }
  function handleCopy(node) {
    if (node && node.data) {
      const rowData = node.data;
      const copyData = {
        ...rowData
      };
      delete copyData.table_id; // 复制时不包含id

      updateState({
        showModal: true,
        modalType: 'copy',
        currentRow: rowData,
        formData: copyData
      });
    }
  }
  function handleUpdate(node) {
    if (node && node.data) {
      const rowData = node.data;
      // 禁用Update按钮
      const updateButton = document.getElementById(`update-${rowData.table_id}`);
      if (updateButton) {
        updateButton.disabled = true;
      }
      // this.setState({
      //   buttonDisabled: {
      //     ...this.state.buttonDisabled,
      //     updateButtons: {
      //       ...this.state.buttonDisabled.updateButtons,
      //       [rowData.table_id]: true,
      //     },
      //   },
      // }, () => {
      //   this.gridApi.refreshCells({
      //     rowNodes: [node],
      //     columns: ['actions'],
      //     force: true,
      //   });
      // });

      const dbInfo = db_dictRef.current[varicodeRef.current];
      $.ajax({
        url: '',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          action: 'update_index',
          dbinfo: dbInfo,
          rowData: {
            ...rowData,
            '指标语句': aesEncrypt(rowData.指标语句)
          }
        }),
        success: response => {
          // 启用Update按钮
          // this.setState({
          //   buttonDisabled: {
          //     ...this.state.buttonDisabled,
          //     updateButtons: {
          //       ...this.state.buttonDisabled.updateButtons,
          //       [rowData.table_id]: false,
          //     },
          //   },
          // });
          updateButton.disabled = false;
          notify.success('更新成功');
          const tableFullName = `${dbInfo.db_name}.dbo.${dbInfo.index_table_name}`;
          if (doneIndexTableRef.current[tableFullName]) {
            doneIndexTableRef.current[tableFullName] = [];
          }
        },
        error: (xhr, status, error) => {
          // 启用Update按钮
          updateState({
            buttonDisabled: {
              ...stateRef.current.buttonDisabled,
              updateButtons: {
                ...stateRef.current.buttonDisabled.updateButtons,
                [rowData.table_id]: false
              }
            }
          });
          notify.error(`请求失败: ${error}`);
        }
      });
    }
  }
  function handleAdd() {
    updateState({
      showModal: true,
      modalType: 'add',
      currentRow: null,
      formData: {
        指标分类: '',
        指标id: '',
        指标名称: '',
        指标来源: '',
        指标说明: '',
        指标语句: '',
        增加方式: '',
        更新次序: '',
        更新时间: '',
        刷新语句: '',
        wind指标项: '',
        栏目类别: ''
      }
    });
  }
  function handleInputChange(field, value) {
    updateState({
      formData: {
        ...stateRef.current.formData,
        [field]: value
      }
    });
  }
  function handleSubmit() {
    const {
      formData,
      modalType
    } = stateRef.current;
    const requiredFields = ['指标分类', '指标id', '指标名称', '增加方式', '指标来源'];
    const missingFields = requiredFields.filter(field => !formData[field] || !formData[field].toString().trim());
    if (missingFields.length > 0) {
      notify.error(`请填写必填项: ${missingFields.join(', ')}`);
      return;
    }

    // 禁用确认按钮
    updateState({
      buttonDisabled: {
        ...stateRef.current.buttonDisabled,
        submitButton: true
      }
    });
    const dbInfo = db_dictRef.current[varicodeRef.current];
    const tableFullName = `${dbInfo.db_name}.dbo.${dbInfo.index_table_name}`;
    if (modalType === 'add' || modalType === 'copy') {
      $.ajax({
        url: '',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          action: 'add_index',
          dbinfo: dbInfo,
          formData: {
            ...formData,
            '指标语句': aesEncrypt(formData.指标语句)
          }
        }),
        success: response => {
          // 启用确认按钮
          updateState({
            buttonDisabled: {
              ...stateRef.current.buttonDisabled,
              submitButton: false
            }
          });
          const tableId = response.table_id;
          const newRow = {
            ...formData,
            table_id: tableId
          };
          notify.success('新增成功');
          if (doneIndexTableRef.current[tableFullName]) {
            doneIndexTableRef.current[tableFullName].push({
              value: formData.指标名称,
              label: formData.指标名称
            });
          }

          // 保存当前筛选器状态
          const filterModel = gridApiRef.current ? gridApiRef.current.getFilterModel() : null;
          updateState({
            rowData: [...stateRef.current.rowData, newRow],
            showModal: false
          }, () => {
            // 数据更新后重新调整列宽并恢复筛选器
            if (gridApiRef.current) {
              scheduleTimeout(() => {
                gridApiRef.current.sizeColumnsToFit();
                // 恢复筛选器状态
                if (filterModel) {
                  gridApiRef.current.setFilterModel(filterModel);
                }
              }, 100);
            }
          });
        },
        error: (xhr, status, error) => {
          // 启用确认按钮
          updateState({
            buttonDisabled: {
              ...stateRef.current.buttonDisabled,
              submitButton: false
            }
          });
          notify.error(`请求失败: ${error}`);
        }
      });
    } else if (modalType === 'edit') {
      $.ajax({
        url: '',
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          action: 'edit_index',
          dbinfo: db_dictRef.current[varicodeRef.current],
          formData: {
            ...formData,
            '指标语句': aesEncrypt(formData.指标语句)
          },
          table_id: stateRef.current.currentRow.table_id
        }),
        success: response => {
          // 启用确认按钮
          updateState({
            buttonDisabled: {
              ...stateRef.current.buttonDisabled,
              submitButton: false
            }
          });
          if (response.error) {
            notify.error(`操作失败: ${response.error}`);
            return;
          }
          notify.success('更新成功');

          // 更新前端数据，直接定位到目标行进行更新
          const updatedRowData = [...stateRef.current.rowData];
          const targetIndex = updatedRowData.findIndex(row => row.table_id === stateRef.current.currentRow.table_id);
          if (targetIndex !== -1) {
            updatedRowData[targetIndex] = {
              ...formData,
              table_id: stateRef.current.currentRow.table_id
            };
          }
          // 保存当前筛选器状态
          const filterModel = gridApiRef.current ? gridApiRef.current.getFilterModel() : null;
          updateState({
            rowData: updatedRowData,
            showModal: false
          }, () => {
            // 数据更新后重新调整列宽和刷新grid并恢复筛选器
            if (gridApiRef.current) {
              scheduleTimeout(() => {
                gridApiRef.current.sizeColumnsToFit();
                // 恢复筛选器状态
                if (filterModel) {
                  gridApiRef.current.setFilterModel(filterModel);
                }
              }, 100);
            }
          });
          // if (this.doneIndexTable[tableFullName]) {
          //   this.doneIndexTable[tableFullName] = [];
          // }
          // if (this.doneIndexTable[tableFullName]) {
          //   const targetIndex = this.doneIndexTable[tableFullName].findIndex(row => row.value === formData.指标名称);
          //   if (targetIndex !== -1) {
          //     this.doneIndexTable[tableFullName][targetIndex] = { value: formData.指标名称, label: formData.指标名称 };
          //   }
          // }
        },
        error: (xhr, status, error) => {
          // 启用确认按钮
          updateState({
            buttonDisabled: {
              ...stateRef.current.buttonDisabled,
              submitButton: false
            }
          });
          notify.error(`请求失败: ${error}`);
        }
      });
    }

    // console.log('提交数据:', formData);
  }
  function handleCancel() {
    updateState({
      showModal: false,
      formData: {
        指标分类: '',
        指标id: '',
        指标名称: '',
        指标来源: '',
        指标说明: '',
        指标语句: '',
        增加方式: '',
        更新次序: '',
        更新时间: '',
        刷新语句: '',
        wind指标项: '',
        栏目类别: ''
      }
    });
  }
  function handleQuickCalcAdd(shouldCalculate = false) {
    const {
      quickCalcFormData
    } = stateRef.current;
    if (!quickCalcFormData.newIndexName.trim()) {
      notify.error('请填写新指标名');
      return;
    }
    if (!quickCalcFormData.calculateFormula.trim()) {
      notify.error('请填写计算公式');
      return;
    }
    const sqlStatement = generateSqlFromFormula();
    if (!sqlStatement) {
      // notify.error('生成SQL语句失败');
      return;
    }

    // 禁用对应的按钮
    const buttonKey = shouldCalculate ? 'quickCalcCalculateButton' : 'quickCalcAddButton';
    updateState({
      buttonDisabled: {
        ...stateRef.current.buttonDisabled,
        [buttonKey]: true
      }
    });

    // 创建新行数据
    const formData = {
      指标分类: '计算指标',
      指标id: quickCalcFormData.newIndexName,
      指标名称: quickCalcFormData.newIndexName,
      指标语句: sqlStatement,
      增加方式: '覆盖',
      更新次序: '',
      更新时间: '',
      刷新语句: '',
      wind指标项: '',
      栏目类别: '',
      指标说明: '',
      指标来源: 'FYDB'
    };
    const dbInfo = db_dictRef.current[varicodeRef.current];
    $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'add_index',
        dbinfo: dbInfo,
        formData: {
          ...formData,
          '指标语句': aesEncrypt(formData.指标语句)
        },
        shouldCalculate
      }),
      success: response => {
        // 启用对应的按钮
        updateState({
          buttonDisabled: {
            ...stateRef.current.buttonDisabled,
            [buttonKey]: false
          }
        });
        const tableId = response.table_id;
        const newRow = {
          ...formData,
          table_id: tableId
        };
        notify.success('新增成功');
        const tableFullName = `${dbInfo.db_name}.dbo.${dbInfo.index_table_name}`;
        if (doneIndexTableRef.current[tableFullName]) {
          doneIndexTableRef.current[tableFullName].push({
            value: quickCalcFormData.newIndexName,
            label: quickCalcFormData.newIndexName
          });
        }

        // 保存当前筛选器状态
        const filterModel = gridApiRef.current ? gridApiRef.current.getFilterModel() : null;
        updateState({
          rowData: [...stateRef.current.rowData, newRow],
          showQuickCalcModal: false,
          quickCalcFormData: {
            newIndexName: '',
            calculateFormula: '',
            指标a: {
              数据表: '',
              指标名: ''
            },
            指标b: {
              数据表: '',
              指标名: ''
            },
            指标c: {
              数据表: '',
              指标名: ''
            },
            指标d: {
              数据表: '',
              指标名: ''
            }
          },
          indicatorOptions: {
            指标a: [],
            指标b: [],
            指标c: [],
            指标d: []
          }
        }, () => {
          // 数据更新后重新调整列宽并恢复筛选器
          if (gridApiRef.current) {
            scheduleTimeout(() => {
              gridApiRef.current.sizeColumnsToFit();
              // 恢复筛选器状态
              if (filterModel) {
                gridApiRef.current.setFilterModel(filterModel);
              }
            }, 100);
          }
        });
      },
      error: (xhr, status, error) => {
        // 启用对应的按钮
        updateState({
          buttonDisabled: {
            ...stateRef.current.buttonDisabled,
            [buttonKey]: false
          }
        });
        notify.error(`请求失败: ${error}`);
      }
    });
  }
  function handleQuickCalcCancel() {
    updateState({
      showQuickCalcModal: false,
      quickCalcFormData: {
        newIndexName: '',
        calculateFormula: '',
        指标a: {
          数据表: '',
          指标名: ''
        },
        指标b: {
          数据表: '',
          指标名: ''
        },
        指标c: {
          数据表: '',
          指标名: ''
        },
        指标d: {
          数据表: '',
          指标名: ''
        }
      },
      indicatorOptions: {
        指标a: [],
        指标b: [],
        指标c: [],
        指标d: []
      }
    });
  }
  function handleQuickCalcInputChange(field, value, subField = null) {
    const {
      quickCalcFormData
    } = stateRef.current;
    let newFormData;
    if (subField) {
      // 处理嵌套字段，如指标a.数据表
      newFormData = {
        ...quickCalcFormData,
        [field]: {
          ...quickCalcFormData[field],
          [subField]: value
        }
      };
    } else {
      // 处理普通字段
      newFormData = {
        ...quickCalcFormData,
        [field]: value
      };
    }
    updateState({
      quickCalcFormData: newFormData
    });
  }
  function handleDataTableChange(indicator, dataTable) {
    // console.log(`数据表变化: ${indicator} -> ${dataTable}`);

    if (stateRef.current.quickCalcFormData[indicator]['数据表'] === dataTable) {
      return;
    }
    // 一次性更新数据表选择并清空指标名选择
    const {
      quickCalcFormData
    } = stateRef.current;
    const newFormData = {
      ...quickCalcFormData,
      [indicator]: {
        数据表: dataTable,
        指标名: ''
      }
    };

    // console.log('数据表变化 - 更新前的数据:', quickCalcFormData);
    // console.log('数据表变化 - 更新后的数据:', newFormData);

    updateState({
      quickCalcFormData: newFormData
    });
    loadIndicatorNameOptions(indicator, dataTable);
  }
  function loadIndicatorNameOptions(indicator, dataTable) {
    if (!dataTable) {
      updateState({
        indicatorOptions: {
          ...stateRef.current.indicatorOptions,
          [indicator]: []
        }
      });
      return;
    }
    // 检查dataTable是否之前已经成功请求过
    if (doneIndexTableRef.current[dataTable] && doneIndexTableRef.current[dataTable].length > 0) {
      updateState({
        indicatorOptions: {
          ...stateRef.current.indicatorOptions,
          [indicator]: doneIndexTableRef.current[dataTable]
        }
      });
      return;
    }
    $.ajax({
      url: '',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        table_name: dataTable,
        dbinfo: db_dictRef.current[varicodeRef.current],
        action: 'get_index_by_tablename'
      }),
      success: data => {
        updateState({
          indicatorOptions: {
            ...stateRef.current.indicatorOptions,
            [indicator]: data
          }
        });
        doneIndexTableRef.current[dataTable] = data;
      },
      error: (xhr, status, error) => {
        notify.error(`获取指标名失败: ${error}`);
      }
    });
  }
  function handleDeleteIndexNameChange(e) {
    updateState({
      deleteIndexName: e.target.value
    });
  }
  function handlePreviewData() {
    const {
      quickCalcFormData
    } = stateRef.current;
    if (!quickCalcFormData.newIndexName.trim()) {
      notify.error('请填写新指标名');
      return;
    }
    if (!quickCalcFormData.calculateFormula.trim()) {
      notify.error('请填写计算公式');
      return;
    }
    const sqlStatement = generateSqlFromFormula();
    if (!sqlStatement) {
      return;
    }

    // 禁用预览按钮
    updateState({
      buttonDisabled: {
        ...stateRef.current.buttonDisabled,
        previewDataButton: true
      },
      showPreviewModal: true,
      previewData: []
    });
    const dbInfo = db_dictRef.current[varicodeRef.current];
    $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'preview_data',
        dbinfo: dbInfo,
        sqlStatement: aesEncrypt(sqlStatement)
      }),
      success: response => {
        // 启用预览按钮
        updateState({
          buttonDisabled: {
            ...stateRef.current.buttonDisabled,
            previewDataButton: false
          },
          previewData: response || []
        });

        // 如果有数据，初始化echarts图表
        if (response && response.length > 0) {
          scheduleTimeout(() => {
            initPreviewChart(response);
          }, 100);
        }
      },
      error: (xhr, status, error) => {
        // 启用预览按钮
        updateState({
          buttonDisabled: {
            ...stateRef.current.buttonDisabled,
            previewDataButton: false
          }
        });
        notify.error(`请求失败: ${error}`);
      }
    });
  }
  function handleClosePreviewModal() {
    // 销毁echarts实例
    if (previewChartRef.current) {
      previewChartRef.current.dispose();
      previewChartRef.current = null;
    }
    updateState({
      showPreviewModal: false,
      previewData: []
    });
  }
  function initPreviewChart(data) {
    const chartDom = document.getElementById('preview-chart');
    if (!chartDom) return;

    // 如果已存在图表实例，先销毁
    if (previewChartRef.current) {
      previewChartRef.current.dispose();
    }
    previewChartRef.current = echarts.init(chartDom);

    // 准备图表数据
    const dates = data.map(item => item['日期']);
    const values = data.map(item => item['价格']);
    const option = {
      title: {
        text: stateRef.current.quickCalcFormData.newIndexName,
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: {
          interval: 'auto'
        }
      },
      yAxis: {
        type: 'value',
        min: 'dataMin',
        max: 'dataMax',
        axisLabel: {
          // formatter: (value) => {
          //   return value.toFixed(3);
          // },
        }
      },
      series: [{
        data: values,
        type: 'line',
        smooth: true
      }],
      grid: {
        // bottom: 50,
        left: 70,
        right: 30,
        top: 50
      },
      dataZoom: [{
        type: 'inside'
      }, {
        show: true,
        type: 'slider'
      }]
    };
    previewChartRef.current.setOption(option);
  }
  function handleDeleteIndexData() {
    const {
      deleteIndexName
    } = stateRef.current;
    if (!deleteIndexName.trim()) {
      notify.error('请输入指标名');
      return;
    }

    // 禁用按钮
    updateState({
      buttonDisabled: {
        ...stateRef.current.buttonDisabled,
        deleteIndexDataButton: true
      }
    });
    const dbInfo = db_dictRef.current[varicodeRef.current];
    $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'delete_index_data',
        dbinfo: dbInfo,
        indexName: deleteIndexName.trim()
      }),
      success: response => {
        // 启用按钮
        updateState({
          buttonDisabled: {
            ...stateRef.current.buttonDisabled,
            deleteIndexDataButton: false
          },
          deleteIndexName: '' // 清空输入框
        });
        if (response.error) {
          notify.error(`删除失败: ${response.error}`);
        } else {
          notify.success('指标数据删除成功！');
        }
      },
      error: (xhr, status, error) => {
        // 启用按钮
        updateState({
          buttonDisabled: {
            ...stateRef.current.buttonDisabled,
            deleteIndexDataButton: false
          }
        });
        notify.error(`请求失败: ${error}`);
      }
    });
  }
  function generateSqlFromFormula() {
    const {
      quickCalcFormData
    } = stateRef.current;
    const {
      calculateFormula
    } = quickCalcFormData;

    // const sqlFields = {
    //   dateField: '报价日期',
    //   indexNameField: '品名',
    //   valueField: '价格',
    // };

    const validIndicators = [];
    ['指标a', '指标b', '指标c', '指标d'].forEach((key, index) => {
      const indicator = quickCalcFormData[key];
      if (indicator['数据表'] && indicator['指标名']) {
        validIndicators.push({
          letter: String.fromCharCode(97 + index),
          // a, b, c, d
          table: index_data_mapRef.current[indicator['数据表']],
          name: indicator['指标名']
        });
      }
    });
    if (validIndicators.length < 1) {
      notify.error('至少需要填写1个完整的指标信息（数据表和指标名）');
      return false;
    }

    // 使用第一个有效指标作为主表的日期字段
    const primaryIndicator = validIndicators[0];
    let calculationExpression = calculateFormula;
    // 将 calculationExpression 里的 中文括号转换为英文括号
    calculationExpression = calculationExpression.replace(/（/g, '(').replace(/）/g, ')');
    // 替换计算公式中的字母为对应的字段引用
    validIndicators.forEach(indicator => {
      const regex = new RegExp(`\\b${indicator.letter}\\b`, 'g');
      calculationExpression = calculationExpression.replace(regex, `${indicator.letter}.${index_manageRef.current.valueField}`);
    });

    // 构建SELECT子句
    const selectClause = `SELECT ${primaryIndicator.letter}.${index_manageRef.current.dateField} as 日期, ${calculationExpression} as 价格`;

    // 构建FROM子句
    const fromClause = `from ${validIndicators[0].table} as ${validIndicators[0].letter}`;

    // 构建JOIN子句
    const joinClauses = [];
    for (let i = 1; i < validIndicators.length; i++) {
      const indicator = validIndicators[i];
      joinClauses.push(`join ${indicator.table} as ${indicator.letter} on ${primaryIndicator.letter}.${index_manageRef.current.dateField}=${indicator.letter}.${index_manageRef.current.dateField}`);
    }

    // 构建WHERE子句
    const whereConditions = validIndicators.map(indicator => `${indicator.letter}.${index_manageRef.current.indexNameField}='${indicator.name}'`);
    const whereClause = `where ${whereConditions.join(' and ')}`;

    // 组合完整的SQL语句
    const sqlParts = [selectClause, fromClause, ...joinClauses, whereClause];
    const fullSql = sqlParts.join(' \n ');

    // console.log('生成的SQL语句:', fullSql);
    return fullSql;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    const onWindowResize = () => {
      if (!gridApiRef.current) return;
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        timers.delete(resizeTimerRef.current);
      }
      resizeTimerRef.current = scheduleTimeout(() => {
        resizeTimerRef.current = undefined;
        gridApiRef.current.sizeColumnsToFit();
      }, 100);
    };
    const request = $.ajax({
      url: '',
      type: 'POST',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        action: 'get_index_list',
        dbinfo: db_dictRef.current[varicodeRef.current]
      }),
      success: data => {
        // console.log('data');
        updateState({
          rowData: data
        });
      },
      error: (xhr, status, error) => {
        if (status === 'abort') return;
        notify.error(error);
      }
    });
    // 监听窗口大小变化
    window.addEventListener('resize', onWindowResize);
    return () => {
      mountedRef.current = false;
      request.abort();
      // 移除窗口大小变化监听器
      window.removeEventListener('resize', onWindowResize);
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
      resizeTimerRef.current = undefined;
      if (previewChartRef.current) {
        previewChartRef.current.dispose();
        previewChartRef.current = null;
      }
    };
  }, []);
  const {
    showModal,
    modalType,
    formData,
    showQuickCalcModal,
    quickCalcFormData,
    indicatorOptions
  } = stateRef.current;
  const modalTitle = {
    add: '新增指标',
    edit: '编辑指标',
    copy: '复制新增指标'
  }[modalType] || '';
  return <div className="main-container">
            <AlertsWrapper initMessages={propsRef.current.initMessages} />
            <div className="button-container">
              <button onClick={handleAdd} className="btn-addindex">
                新增指标
              </button>
              <button onClick={() => updateState({
        showQuickCalcModal: true
      })} className="btn-addindex">
                快捷新增计算指标
              </button>
              <input type="text" className='index-delete-input' placeholder="请输入指标名" value={stateRef.current.deleteIndexName} onChange={handleDeleteIndexNameChange} />
              <button onClick={handleDeleteIndexData} className="btn-delindexdata" disabled={stateRef.current.buttonDisabled.deleteIndexDataButton}>
                指标数据删除
              </button>
            </div>
          <div className="ag-theme-balham grid-container">
            <AgGridReact modules={AG_GRID_MODULES} theme="legacy" columnDefs={columnDefsRef.current} rowData={stateRef.current.rowData} defaultColDef={defaultColDefRef.current} pagination paginationPageSize={paginationPageSizeRef.current} paginationPageSizeSelector={false} rowHeight={60} suppressMenuHide={false} animateRows overlayLoadingTemplate={'<span class="ag-overlay-loading-center">加载中...</span>'} overlayNoRowsTemplate={'<span class="ag-overlay-no-rows-center">无数据</span>'} suppressHorizontalScroll={false} onGridReady={onGridReady} />
          </div>

          {/* 普通新增指标弹出层 */}
          {showModal && <div className="modal-overlay">
            <div className="modal-content-indexmanage">
              <span className="modal-title">{modalTitle}</span>

              <div className="form-grid">
                <div>
                  <label className="form-label">指标分类<span className="required-field">*</span></label>
                  <input type="text" value={formData.指标分类} onChange={function (e) {
              handleInputChange('指标分类', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">指标id<span className="required-field">*</span></label>
                  <input type="text" value={formData.指标id} onChange={function (e) {
              handleInputChange('指标id', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">指标名称<span className="required-field">*</span></label>
                  <input type="text" value={formData.指标名称} onChange={function (e) {
              handleInputChange('指标名称', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">增加方式<span className="required-field">*</span></label>
                  <select value={formData.增加方式} onChange={function (e) {
              handleInputChange('增加方式', e.target.value);
            }} className="form-select">
                    <option value=""></option>
                    <option value="增量">增量</option>
                    <option value="覆盖">覆盖</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">指标来源<span className="required-field">*</span></label>
                  <input type="text" value={formData.指标来源} onChange={function (e) {
              handleInputChange('指标来源', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">指标说明</label>
                  <input type="text" value={formData.指标说明} onChange={function (e) {
              handleInputChange('指标说明', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">顺序</label>
                  <input type="number" value={formData.更新次序} onChange={function (e) {
              handleInputChange('更新次序', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">更新时间</label>
                  <input type="date" value={formData.更新时间 ? formData.更新时间 : ''} onChange={function (e) {
              // const dateTimeValue = e.target.value ? e.target.value.replace('T', ' ') + ':00' : '';
              const dateValue = e.target.value ? e.target.value : '';
              handleInputChange('更新时间', dateValue);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">刷新语句</label>
                  <input type="text" value={formData.刷新语句} onChange={function (e) {
              handleInputChange('刷新语句', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">指标项</label>
                  <input type="text" value={formData.wind指标项} onChange={function (e) {
              handleInputChange('wind指标项', e.target.value);
            }} className="form-input" />
                </div>

                <div>
                  <label className="form-label">栏目类别</label>
                  <input type="text" value={formData.栏目类别} onChange={function (e) {
              handleInputChange('栏目类别', e.target.value);
            }} className="form-input" />
                </div>

                <div className="textarea-full-width">
                  <label className="form-label">指标语句</label>
                  <textarea value={formData.指标语句} onChange={function (e) {
              handleInputChange('指标语句', e.target.value);
            }} rows={3} className="form-textarea" />
                </div>
              </div>

              <div className="button-group">
                <button onClick={handleSubmit} className="btn-confirm" disabled={stateRef.current.buttonDisabled.submitButton}>
                  确认
                </button>
                <button onClick={handleCancel} className="btn-cancel">
                  取消
                </button>
              </div>
            </div>
          </div>}

        {/* 快捷新增计算指标弹出层 */}
          {showQuickCalcModal && <div className="modal-overlay">
            <div className="modal-content-indexmanage">
              <span className="modal-title">快捷新增计算指标</span>
              <div className="quick-calc-help-text">
                计算公式(仅支持 加减乘除 和 英文括号)：+-*/()，例如：(a*2/5+b)*c-3*d-10
              </div>

              <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '20px'
        }}>
                <div>
                  <label className="form-label">新指标名：<span className="required-field">*</span></label>
                  <input type="text" value={quickCalcFormData.newIndexName} onChange={e => handleQuickCalcInputChange('newIndexName', e.target.value)} className="form-input"
            // placeholder="计算指标1"
            />
                </div>
                <div>
                  <label className="form-label">计算公式：<span className="required-field">*</span></label>
                  <input type="text" value={quickCalcFormData.calculateFormula} onChange={e => handleQuickCalcInputChange('calculateFormula', e.target.value)} className="form-input" placeholder="例如：(a*2/5+b)*c-3*d-10" />
                </div>
              </div>

              {/* 四个指标的配置区域 */}
              <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px'
        }}>
                {['指标a', '指标b', '指标c', '指标d'].map(indicatorKey => <div key={indicatorKey} className="quick-calc-indicator-box">
                    <h4 className="quick-calc-indicator-title">
                      {indicatorKey}：
                    </h4>
                    <div style={{
              marginBottom: '10px',
              display: 'flex',
              alignItems: 'center'
            }}>
                      <label className="form-label" style={{
                marginRight: '5px',
                minWidth: '45px'
              }}>数据表：</label>
                      <div style={{
                flex: 1
              }}>
                        <OnPasteSelect placeholder="请选择数据表" options={dataTableOptionsRef.current} value={quickCalcFormData[indicatorKey]['数据表'] ? {
                  value: quickCalcFormData[indicatorKey]['数据表'],
                  label: quickCalcFormData[indicatorKey]['数据表']
                } : null} onChange={option => {
                  const value = option ? option.value : '';
                  handleDataTableChange(indicatorKey, value);
                }} isClearable components={{
                  MenuList: WindowedMenuList
                }} maxMenuHeight={150} />
                      </div>
                    </div>

                    <div style={{
              display: 'flex',
              alignItems: 'center'
            }}>
                      <label className="form-label" style={{
                marginRight: '5px',
                minWidth: '45px'
              }}>指标名：</label>
                      <div style={{
                flex: 1
              }}>
                        <OnPasteSelect placeholder="请选择指标名" options={indicatorOptions[indicatorKey] || []} value={quickCalcFormData[indicatorKey]['指标名'] ? {
                  value: quickCalcFormData[indicatorKey]['指标名'],
                  label: quickCalcFormData[indicatorKey]['指标名']
                } : null} onChange={option => {
                  const value = option ? option.value : '';
                  handleQuickCalcInputChange(indicatorKey, value, '指标名');
                }} isClearable components={{
                  MenuList: WindowedMenuList
                }} isDisabled={!quickCalcFormData[indicatorKey]['数据表']} maxMenuHeight={130} />
                      </div>
                    </div>
                  </div>)}
              </div>

              <div className="button-group1">
                <button onClick={handlePreviewData} className="btn-confirm" style={{
            marginRight: '10px'
          }} disabled={stateRef.current.buttonDisabled.previewDataButton}>
                  预览数据
                </button>
                <button onClick={() => handleQuickCalcAdd(true)} className="btn-confirm" style={{
            marginRight: '10px'
          }} disabled={stateRef.current.buttonDisabled.quickCalcCalculateButton}>
                  增加并计算
                </button>
                <button onClick={() => handleQuickCalcAdd(false)} className="btn-confirm" style={{
            marginRight: '10px'
          }} disabled={stateRef.current.buttonDisabled.quickCalcAddButton}>
                  增加
                </button>
                <button onClick={handleQuickCalcCancel} className="btn-cancel">
                  取消
                </button>
              </div>
            </div>
          </div>}

        {/* 预览数据弹出层 */}
        {stateRef.current.showPreviewModal && <div className="modal-overlay">
            <div className="modal-content-indexmanage preview-modal-content">
              <div className="preview-modal-header">
                <h3 className="modal-title">预览数据</h3>
                <button onClick={handleClosePreviewModal} className="preview-modal-close-btn">
                  ×
                </button>
              </div>

              <div className="preview-modal-body">
                {/* 左侧表格区域 */}
                <div className="preview-grid-container">
                  <div className="ag-theme-balham" style={{
              height: '100%',
              width: '220px'
            }}>
                    <AgGridReact modules={AG_GRID_MODULES} theme="legacy" columnDefs={[{
                headerName: '日期',
                field: '日期',
                width: 125
              }, {
                headerName: '价格',
                field: '价格',
                width: 90
              }]} rowData={stateRef.current.previewData} pagination={true} paginationPageSize={15} paginationPageSizeSelector={false} domLayout="normal" suppressMenuHide={true} defaultColDef={{
                sortable: true,
                filter: false,
                resizable: true,
                suppressHeaderMenuButton: true
              }} />
                  </div>
                </div>

                {/* 右侧图表区域 */}
                <div className="preview-chart-container">
                  <div id="preview-chart" style={{
              width: '100%',
              height: '98%'
            }} />
                </div>
              </div>
            </div>
          </div>}
        </div>;
}



export default IndexManageMain;
