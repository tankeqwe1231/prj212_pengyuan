import React, { useLayoutEffect, useRef, useState } from 'react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import { AgGridReact } from 'ag-grid-react';
import { AllEnterpriseModule, LicenseManager } from 'ag-grid-enterprise';
import { Button } from 'react-bootstrap';
import Dropzone from 'react-dropzone';
import axios from 'axios';
import OnPasteSelect from '../../components/OnPasteSelect';
import WindowedMenuList from '../../components/WindowedMenuList';
import AlertsWrapper from '../../components/AlertsWrapper';
import './reports_data_manage.css';
import { aggridlicense } from '../../../visualizations/constants';


// 设置ag-grid企业版许可证
LicenseManager.setLicenseKey(aggridlicense);
const AG_GRID_MODULES = [AllEnterpriseModule];
const initDataDict = JSON.parse(document.getElementById('row-main-container').getAttribute('init-data-dict'));
const varietySections = Object.keys(initDataDict.variety_sections);
const reportTypes = initDataDict.report_types;
const baseUrl = '/reportsdatamanage';

function ReportsDataManage(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(ReportsDataManage.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = ReportsDataManage.defaultProps[key];
  });
  const propsRef = useRef(props);
  const mountedRef = useRef(true);
  const [state, setState] = useState(() => ({
    // 表格数据
    reportsData: [],
    // 新增/编辑弹窗
    showModal: false,
    modalMode: 'add',
    // 'add' or 'edit'
    currentEditId: null,
    // 表单数据
    formData: {
      report_title: '',
      report_subtitle: '',
      variety_section: null,
      variety: null,
      description: '',
      report_type: null,
      report_public_date: '',
      author: ''
    },
    // 文件相关
    coverImgFile: null,
    reportFile: null,
    uploadProgress: 0,
    isUploading: false,
    // 删除确认
    showDeleteConfirm: false,
    deleteId: null
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
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
  const columnDefsRef = useRef([{
    headerName: '报告标题',
    field: 'report_title',
    width: 250,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '所属品种',
    field: 'variety',
    width: 120,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '报告类别',
    field: 'report_type',
    width: 100,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '发布日期',
    field: 'report_public_date',
    width: 150,
    valueFormatter: params => {
      return params.value ? new Date(params.value).toLocaleDateString().replace(/\//g, '/') : '';
    },
    sort: 'desc'
  }, {
    headerName: '作者',
    field: 'author',
    width: 120,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '文件类型',
    field: 'report_file_suffix',
    width: 120,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      maxNumConditions: 1
    }
  }, {
    headerName: '操作',
    field: 'actions',
    width: 120,
    cellRenderer: actionsCellRenderer.bind(undefined),
    sortable: false
  }]);
  const defaultColDefRef = useRef({
    sortable: true,
    floatingFilter: true,
    suppressHeaderMenuButton: true,
    resizable: true,
    cellStyle: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center'
    }
  });
  const paginationPageSizeRef = useRef(15);
  const gridApiRef = useRef(undefined);
  function fetchReportsData() {
    axios.post(`${baseUrl}/list`, {
      action: 'get_reports'
    }).then(response => {
      if (response.data && response.data.reports_data) {
        updateState({
          reportsData: response.data.reports_data
        });
      }
    }).catch(error => {
      console.error('获取报告数据失败:', error);
      notify.error('获取报告数据失败');
    });
  }
  function actionsCellRenderer(params) {
    return <div>
        <i className="fa fa-edit rdm-action-icon" onClick={() => handleEdit(params.data)} title="编辑" />
        <i className="fa fa-trash rdm-action-icon rdm-delete-icon" onClick={() => handleDelete(params.data.id)} title="删除" style={{
        marginLeft: '10px'
      }} />
      </div>;
  }
  function handleAdd() {
    updateState({
      showModal: true,
      modalMode: 'add',
      currentEditId: null,
      formData: {
        report_title: '',
        report_subtitle: '',
        variety_section: null,
        variety: null,
        description: '',
        report_type: null,
        report_public_date: '',
        author: ''
      },
      coverImgFile: null,
      reportFile: null,
      uploadProgress: 0
    });
  }
  function handleEdit(rowData) {
    updateState({
      showModal: true,
      modalMode: 'edit',
      currentEditId: rowData.id,
      formData: {
        report_title: rowData.report_title || '',
        report_subtitle: rowData.report_subtitle || '',
        variety_section: rowData.variety_section || null,
        variety: rowData.variety || null,
        description: rowData.description || '',
        report_type: rowData.report_type || null,
        report_public_date: rowData.report_public_date || '',
        author: rowData.author || ''
      },
      coverImgFile: null,
      reportFile: null,
      uploadProgress: 0
    });
  }
  function handleDelete(id) {
    updateState({
      showDeleteConfirm: true,
      deleteId: id
    });
  }
  function confirmDelete() {
    const {
      deleteId
    } = stateRef.current;
    axios.post(`${baseUrl}/list`, {
      action: 'delete_report',
      id: deleteId
    }).then(response => {
      if (response.data && response.data.success) {
        notify.success('删除成功');
        fetchReportsData();
      } else {
        notify.error(response.data.error || '删除失败');
      }
    }).catch(error => {
      console.error('删除失败:', error);
      notify.error('删除失败');
    }).finally(() => {
      updateState({
        showDeleteConfirm: false,
        deleteId: null
      });
    });
  }
  function cancelDelete() {
    updateState({
      showDeleteConfirm: false,
      deleteId: null
    });
  }
  function closeModal() {
    updateState({
      showModal: false,
      modalMode: 'add',
      currentEditId: null,
      formData: {
        report_title: '',
        report_subtitle: '',
        variety_section: null,
        variety: null,
        description: '',
        report_type: null,
        report_public_date: '',
        author: ''
      },
      coverImgFile: null,
      reportFile: null,
      uploadProgress: 0
    });
  }
  function handleFormChange(field, value) {
    const {
      formData
    } = stateRef.current;
    const newFormData = Object.assign({}, formData);
    newFormData[field] = value;

    // 如果修改了所属板块，清空所属品种
    if (field === 'variety_section') {
      newFormData.variety = null;
    }
    updateState({
      formData: newFormData
    });
  }
  function handleCoverImgDrop(acceptedFiles) {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const fileType = file.type;
      const fileSize = file.size;

      // 验证文件类型
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(fileType)) {
        notify.error('封面图只支持 jpg/png 格式');
        return;
      }

      // 验证文件大小（2MB）
      if (fileSize > 2 * 1024 * 1024) {
        notify.error('封面图大小不能超过 2MB');
        return;
      }
      updateState({
        coverImgFile: file
      });
    }
  }
  function handleReportFileDrop(acceptedFiles, rejectedFiles = []) {
    if (rejectedFiles.length > 0) {
      notify.error('报告文件只支持 PDF 格式');
      return;
    }
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const fileName = file.name;
      const fileExt = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      const fileSize = file.size;

      // 验证文件类型
      if (fileExt !== '.pdf') {
        notify.error('报告文件只支持 PDF 格式');
        return;
      }

      // 验证PDF文件大小（20MB）
      if (fileSize > 20 * 1024 * 1024) {
        notify.error('PDF文件大小不能超过 20MB');
        return;
      }
      updateState({
        reportFile: file
      });
    }
  }
  function handleSubmit() {
    const {
      formData,
      modalMode,
      reportFile
    } = stateRef.current;

    // 验证必填字段
    if (modalMode === 'add') {
      if (!formData.report_title || !formData.variety_section || !formData.variety || !formData.report_type || !formData.report_public_date || !formData.author || !reportFile) {
        notify.error('请填写所有必填字段并选择报告文件');
        return;
      }
    } else {
      // 编辑模式，除了文件其他字段必填
      if (!formData.report_title || !formData.variety_section || !formData.variety || !formData.report_type || !formData.report_public_date || !formData.author) {
        notify.error('请填写所有必填字段');
        return;
      }
    }

    // 禁用提交按钮
    updateState({
      isUploading: true,
      uploadProgress: 0
    });

    // 开始上传流程
    uploadFilesAndSubmit();
  }
  function uploadFilesAndSubmit() {
    const {
      formData,
      modalMode,
      currentEditId,
      coverImgFile,
      reportFile
    } = stateRef.current;
    let coverImgUrl = null;
    let reportFileUrl = null;
    let reportFileOriginName = null;
    let reportFileSuffix = null;

    // 创建Promise链：先上传封面图，再上传报告文件，最后提交表单
    let uploadPromise = Promise.resolve();

    // 上传封面图（如果有选择）
    if (coverImgFile) {
      uploadPromise = uploadPromise.then(() => {
        updateState({
          uploadProgress: 10
        });
        const coverFormData = new FormData();
        coverFormData.append('action', 'upload_cover');
        coverFormData.append('file', coverImgFile);
        coverFormData.append('author', formData.author);
        return axios.post(`${baseUrl}/list`, coverFormData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: progressEvent => {
            const percentCompleted = Math.round(progressEvent.loaded * 20 / progressEvent.total) + 10;
            updateState({
              uploadProgress: percentCompleted
            });
          }
        }).then(coverResponse => {
          if (coverResponse.data && coverResponse.data.file_url) {
            coverImgUrl = coverResponse.data.file_url;
          } else {
            throw new Error('封面图上传失败');
          }
        });
      });
    }

    // 直接上传 PDF 到后端，返回用于预览和下载的文件信息。
    if (reportFile) {
      uploadPromise = uploadPromise.then(() => {
        updateState({
          uploadProgress: 30
        });
        const reportFormData = new FormData();
        reportFormData.append('action', 'upload_report_file');
        reportFormData.append('file', reportFile);
        return axios.post(`${baseUrl}/list`, reportFormData, {
          onUploadProgress: progressEvent => {
            if (progressEvent.total) {
              updateState({
                uploadProgress: 30 + Math.min(55, Math.round(progressEvent.loaded * 55 / progressEvent.total))
              });
            }
          }
        }).then(uploadResponse => {
          const result = uploadResponse.data;
          if (!result || !result.success || !result.file_uuid) {
            throw new Error((result && result.error) || '报告文件上传失败');
          }
          reportFileUrl = result.file_uuid;
          reportFileOriginName = result.file_origin_name;
          reportFileSuffix = result.file_suffix;
        });
      });
    }

    // 提交表单
    uploadPromise.then(() => {
      updateState({
        uploadProgress: 90
      });
      const submitData = {
        action: modalMode === 'add' ? 'add_report' : 'update_report',
        report_title: formData.report_title,
        report_subtitle: formData.report_subtitle,
        variety_section: formData.variety_section,
        variety: formData.variety,
        description: formData.description,
        report_type: formData.report_type,
        report_public_date: formData.report_public_date,
        author: formData.author
      };
      if (modalMode === 'edit') {
        submitData.id = currentEditId;
      }

      // 如果有上传新文件，添加文件URL
      if (coverImgUrl) {
        submitData.cover_img_url = coverImgUrl;
      }
      if (reportFileUrl) {
        submitData.report_file_url = reportFileUrl;
        submitData.report_file_origin_name = reportFileOriginName;
        submitData.report_file_suffix = reportFileSuffix;
      }
      return axios.post(`${baseUrl}/list`, submitData);
    }).then(submitResponse => {
      if (submitResponse.data && submitResponse.data.success) {
        updateState({
          uploadProgress: 100
        });
        notify.success(modalMode === 'add' ? '新增成功' : '修改成功');
        closeModal();
        fetchReportsData();
      } else {
        throw new Error(submitResponse.data.error || '提交失败');
      }
      updateState({
        isUploading: false,
        uploadProgress: 0
      });
    }).catch(error => {
      console.error('操作失败:', error);
      const responseData = error.response && error.response.data;
      notify.error((responseData && responseData.error) || error.message || '操作失败');
      updateState({
        isUploading: false,
        uploadProgress: 0
      });
    });
  }
  function renderModal() {
    const {
      showModal,
      modalMode,
      formData,
      coverImgFile,
      reportFile,
      isUploading,
      uploadProgress
    } = stateRef.current;
    if (!showModal) {
      return null;
    }

    // 获取所属品种选项
    const varietyOptions = formData.variety_section ? (initDataDict.variety_sections[formData.variety_section] || []).map(v => ({
      value: v,
      label: v
    })) : [];
    return <div className="rdm-modal-overlay">
        <div className="rdm-modal-content">
          <div className="rdm-modal-title">{modalMode === 'add' ? '新增报告' : '修改报告'}</div>

          <div className="rdm-modal-body">
            <div className="rdm-form-row">
              <div className="rdm-form-group">
                <label className="rdm-form-label">报告标题：<span className="required-field">*</span></label>
                <input type="text" className="rdm-form-input" value={formData.report_title} onChange={e => handleFormChange('report_title', e.target.value)} placeholder="" />
              </div>
              <div className="rdm-form-group">
                <label className="rdm-form-label">副标题：</label>
                <input type="text" className="rdm-form-input" value={formData.report_subtitle} onChange={e => handleFormChange('report_subtitle', e.target.value)} placeholder="" />
              </div>
            </div>

            <div className="rdm-form-row">
              <div className="rdm-form-group rdm-form-group-full">
                <label className="rdm-form-label">摘要：</label>
                <textarea className="rdm-form-textarea" value={formData.description} onChange={e => handleFormChange('description', e.target.value)} placeholder="" rows={4} />
              </div>
            </div>

            <div className="rdm-form-row">
              <div className="rdm-form-group-inline">
                <label className="rdm-form-label">所属板块<span className="required-field">*</span>：</label>
                <OnPasteSelect placeholder="" options={varietySections.map(v => ({
                value: v,
                label: v
              }))} value={formData.variety_section ? {
                value: formData.variety_section,
                label: formData.variety_section
              } : null} onChange={option => handleFormChange('variety_section', option ? option.value : null)} isClearable className="rdm-form-select" components={{
                MenuList: WindowedMenuList
              }} maxMenuHeight={150} />
              </div>
              <div className="rdm-form-group-inline">
                <label className="rdm-form-label">所属品种<span className="required-field">*</span>：</label>
                <OnPasteSelect placeholder="" options={varietyOptions} value={formData.variety ? {
                value: formData.variety,
                label: formData.variety
                } : null} onChange={option => handleFormChange('variety', option ? option.value : null)} isClearable className="rdm-form-select" components={{
                MenuList: WindowedMenuList
              }} maxMenuHeight={150} isDisabled={!formData.variety_section} />
              </div>
            </div>

            <div className="rdm-form-row">
              <div className="rdm-form-group-inline">
                <label className="rdm-form-label">报告类别<span className="required-field">*</span>：</label>
                <OnPasteSelect placeholder="" options={reportTypes.map(t => ({
                value: t,
                label: t
              }))} value={formData.report_type ? {
                value: formData.report_type,
                label: formData.report_type
              } : null} onChange={option => handleFormChange('report_type', option ? option.value : null)} isClearable className="rdm-form-select" components={{
                MenuList: WindowedMenuList
              }} maxMenuHeight={150} />
              </div>
              <div className="rdm-form-group-inline">
                <label className="rdm-form-label">发布日期<span className="required-field">*</span>：</label>
                <input type="date" className="rdm-form-input" value={formData.report_public_date.split(' ')[0]} onChange={e => handleFormChange('report_public_date', e.target.value)} />
              </div>
            </div>

            <div className="rdm-form-row">
              <div className="rdm-form-group-inline">
                <label className="rdm-form-label">作者<span className="required-field">*</span>：</label>
                <input type="text" className="rdm-form-input" value={formData.author} onChange={e => handleFormChange('author', e.target.value)} placeholder="" style={{
                flex: 0.4
              }} />
              </div>
            </div>

            <div className="rdm-form-row">
              <div className="rdm-form-group">
                <label className="rdm-form-label">封面图：</label>
                <Dropzone onDrop={handleCoverImgDrop} multiple={false} accept="image/jpeg,image/jpg,image/png">
                  {({
                  getRootProps,
                  getInputProps
                }) => <div {...getRootProps()} className="rdm-dropzone">
                      <input {...getInputProps()} />
                      {coverImgFile ? <div className="rdm-file-name">{coverImgFile.name}</div> : <div className="rdm-dropzone-placeholder">点击或拖拽上传封面图（jpg/png，≤2MB）</div>}
                    </div>}
                </Dropzone>
              </div>
              <div className="rdm-form-group">
                <label className="rdm-form-label">报告文件：{modalMode === 'add' ? <span className="required-field">*</span> : ''}</label>
                <Dropzone onDrop={handleReportFileDrop} multiple={false} accept=".pdf">
                  {({
                  getRootProps,
                  getInputProps
                }) => <div {...getRootProps()} className="rdm-dropzone">
                      <input {...getInputProps()} />
                      {reportFile ? <div className="rdm-file-name">{reportFile.name}</div> : <div className="rdm-dropzone-placeholder">点击或拖拽上传报告文件（PDF，≤20MB）</div>}
                    </div>}
                </Dropzone>
              </div>
            </div>

            {isUploading && <div className="rdm-progress-container">
                <div className="rdm-progress-bar" style={{
              width: `${uploadProgress}%`
            }}>
                  {uploadProgress}%
                </div>
                {uploadProgress >= 85 && uploadProgress < 90 && <div>文件已上传，正在处理，请稍候…</div>}
              </div>}
          </div>

          <div className="rdm-modal-footer">
            <Button variant="primary" onClick={handleSubmit} disabled={isUploading}>
              确定
            </Button>
            <Button onClick={closeModal} style={{
            marginLeft: '10px'
          }} disabled={isUploading}>
              取消
            </Button>
          </div>
        </div>
      </div>;
  }
  function renderDeleteConfirm() {
    const {
      showDeleteConfirm
    } = stateRef.current;
    if (!showDeleteConfirm) {
      return null;
    }
    return <div className="rdm-modal-overlay">
        <div className="rdm-modal-content rdm-confirm-modal">
          <div className="rdm-modal-title">确认删除</div>
          <div className="rdm-modal-body">
            <p>确定要删除该报告吗？此操作不可恢复。</p>
          </div>
          <div className="rdm-modal-footer">
            <Button variant="danger" onClick={confirmDelete}>
              确定
            </Button>
            <Button onClick={cancelDelete} style={{
            marginLeft: '10px'
          }}>
              取消
            </Button>
          </div>
        </div>
      </div>;
  }
  function onGridReady(params) {
    gridApiRef.current = params.api;
    params.api.sizeColumnsToFit();
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    fetchReportsData();
    return () => {
      mountedRef.current = false;
    };
    // Preserve the legacy mount-only initial request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const {
    reportsData
  } = stateRef.current;
  return <div className="rdm-container">
        <AlertsWrapper />

        <div className="rdm-header">
          <Button variant="primary" onClick={handleAdd}>
            新增报告
          </Button>
        </div>

        <div className="rdm-grid-container ag-theme-balham">
          <AgGridReact modules={AG_GRID_MODULES} theme="legacy" columnDefs={columnDefsRef.current} defaultColDef={defaultColDefRef.current} rowData={reportsData} onGridReady={onGridReady} pagination paginationPageSize={paginationPageSizeRef.current} paginationPageSizeSelector={false} />
        </div>

        {renderModal()}
        {renderDeleteConfirm()}
      </div>;
}



export default ReportsDataManage;
