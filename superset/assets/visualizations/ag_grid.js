import React from 'react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';
import { d3format } from '../javascripts/modules/utils';
import { renderReact } from '../javascripts/modules/reactRoot';
import { aggridlicense } from './constants';

const AG_GRID_MODULES = [AllEnterpriseModule];

function agGrid(slice, payload) {
    // 设置 AG Grid Enterprise 许可证
    LicenseManager.setLicenseKey(aggridlicense);

    const fd = slice.formData;
    const metricNameList = slice.datasource.metrics.map(m => m.metric_name.split('__')[1]);
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const chartHeight = slice.height();
    const date_col = payload.data.date_col;
    const float_col = payload.data.float_col;
    let isGroup = false;
    const allColumnsGroup = fd.all_columns_group ? fd.all_columns_group : [];
    const columnAggFunc = fd.column_aggfunc ? JSON.parse(fd.column_aggfunc) : {};
    if (allColumnsGroup.length > 0) {
        isGroup = true;
    }
    const thWidth = fd.th_width ? JSON.parse(fd.th_width) : {};
    const numberFormatColumn = fd.number_format_column ? JSON.parse(fd.number_format_column) : {};
    const columnDefs = payload.data.columns.map((column) => {
        const headerDict = { field: column, headerName: column };
        if (thWidth[column]) {
            headerDict.width = thWidth[column];
        }
        if (date_col.includes(column)) {
            headerDict.filter = 'agDateColumnFilter';
            headerDict.filterParams = {
                comparator: function (filterLocalDateAtMidnight, cellValue) {
                    const dateAsString = cellValue;
                    if (dateAsString == null) return -1;
                    const dateParts = dateAsString.split('/');
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
                },
                browserDatePicker: true,
            };
        }
        if (isGroup && allColumnsGroup.includes(column)) {
            headerDict.rowGroup = true;
            headerDict.hide = true;
            headerDict.rowGroupIndex = allColumnsGroup.indexOf(column);
        }
        if (isGroup && metricNameList.includes(column)) {
            headerDict.aggFunc = 'sum';
            if (columnAggFunc[column]) {
                headerDict.aggFunc = columnAggFunc[column];
            }
            headerDict.enableValue = true;
        }
        //  针对 float_col 中标识的列，设置 valueFormatter
        if (float_col && float_col.includes(column)) {
            headerDict.valueFormatter = (params) => {
                // 检查是否是数字并格式化
                if (params.value != null && !isNaN(params.value)) {
                    if (numberFormatColumn[column]) {
                        return d3format(numberFormatColumn[column], params.value);
                    }
                    return Number(params.value).toFixed(2); // 保留两位小数
                }
                return params.value; // 返回原始值或空值
            };
        }
        return headerDict;
    });

    // 网格配置选项
    const gridOptions = {
        modules: AG_GRID_MODULES,
        theme: 'legacy',
        columnDefs,
        rowData: payload.data.records,
        // rowData: rowData,
        // treeData: isTree,
        animateRows: true,
        groupDefaultExpanded: -1,
        columnMenu: 'legacy',
        suppressMenuHide: true,  // 禁用隐藏列菜单
        defaultColDef: {
            sortable: true,
            // minWidth: 100,
            resizable: true,
             // editable: true,
            filter: 'agTextColumnFilter',
            // menuTabs: ["filterMenuTab", 'generalMenuTab', "aggregationMenuTab"],
            menuTabs: ['generalMenuTab', 'filterMenuTab'],
            allowedAggFuncs: ['sum', 'avg', 'min', 'max'],
        },
        onFirstDataRendered: fd.column_width_adapt ? function (params) {
            params.api.sizeColumnsToFit();
        } : null,
        // groupMultiAutoColumn: true,
        autoGroupColumnDef: allColumnsGroup.length ? {
            headerName: allColumnsGroup.join('/'),
            width: thWidth['分组列'] ? thWidth['分组列'] : null,
            filter: 'agTextColumnFilter',
            // 设置filterValueGetter才会显示过滤器
            filterValueGetter: (params) => {
                const data = params.node.data;
                if (data) {
                    return allColumnsGroup.map(column => data[column]).join(' / ');
                }
                return '';
            },
        } : {},
    };
    const container = document.querySelector(slice.selector);
    renderReact(
        React.createElement(
            'div',
            {
                id: sliceId,
                className: 'ag-theme-balham',
                style: { width: slice.width(), height: chartHeight },
            },
            React.createElement(AgGridReact, gridOptions),
        ),
        container,
    );

}

export default agGrid;
