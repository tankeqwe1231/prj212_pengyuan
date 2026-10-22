/* global notify */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, FormGroup, FormControl, FormLabel } from 'react-bootstrap';
import { t } from '../../locales';
import OnPasteSelect from '../../components/OnPasteSelect';
import WindowedMenuList from '../../components/WindowedMenuList';
import AlertsWrapper from '../../components/AlertsWrapper';
import AppTable from '../../components/AppTable/AppTable';

const propTypes = {
  user: PropTypes.object.isRequired,
};

function PPTTaskManage(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(PPTTaskManage.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = PPTTaskManage.defaultProps[key];
  });
  const propsRef = useRef(props);
  const [state, setState] = useState(() => ({
    isLoading: true,
    tasks: [],
    showModal: false,
    modalTitle: '',
    taskName: '',
    taskPptHomeTitle: '',
    taskNodeList: '',
    taskEmail: '',
    currentTaskId: null,
    operationType: 'create',
    // create, edit, delete
    dashboards: [],
    // 存储仪表板列表
    selectedDashboards: [],
    // 存储选中的仪表板
    selectedTemplate: null,
    // 存储选中的PPT模版
    // PPT模版相关状态
    pptTemplates: [],
    showTemplateModal: false,
    templateModalTitle: '',
    templateName: '',
    templateFile: null,
    currentTemplateId: null,
    templateOperationType: 'upload' // upload, edit
  }));
  const stateRef = useRef(state);
  stateRef.current = state;
  const updateState = (update, callback) => {
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
  const runTasksTimerRef = useRef(null);
  function fetchTasks() {
    updateState({
      isLoading: true
    });
    $.ajax({
      url: '/superset/ppt/tasks/',
      type: 'GET',
      data: {
        type: 'all'
      },
      success: data => {
        updateState({
          tasks: data.tasks || [],
          pptTemplates: data.ppt_templates || [],
          isLoading: false
        });
      },
      error: xhr => {
        updateState({
          isLoading: false
        });
        const errorMsg = xhr.responseJSON.error || t('获取任务列表失败');
        notify.error(errorMsg);
      }
    });
  }
  function fetchRunTasks() {
    $.ajax({
      url: '/superset/ppt/tasks/',
      type: 'GET',
      data: {
        type: 'running'
      },
      success: data => {
        if (data.tasks && data.tasks.length > 0) {
          // 获取当前的tasks
          const currentTasks = [...(stateRef.current.tasks || [])];
          const taskMap = {};
          currentTasks.forEach(task => {
            taskMap[task.taskid] = task;
          });
          // 更新或添加运行中的任务
          data.tasks.forEach(runningTask => {
            // 更新已存在的任务
            taskMap[runningTask.taskid] = {
              ...taskMap[runningTask.taskid],
              ...runningTask
            };
          });
          const updatedTasks = Object.values(taskMap);
          // 按taskid倒序排序
          updatedTasks.sort((a, b) => b.taskid - a.taskid);
          updateState({
            tasks: updatedTasks
          });
        }
      },
      error: xhr => {
        console.error('获取运行中任务失败:', xhr.responseJSON ? xhr.responseJSON.error : '未知错误');
      }
    });
  }
  function fetchDashboards() {
    $.ajax({
      url: '/superset/api/dashboard/list/',
      type: 'GET',
      success: response => {
        const data = response;
        const dashboards = data.map(dashboard => ({
          id: dashboard[0],
          value: dashboard[0],
          // dashboard id
          label: dashboard[1] // dashboard title
        }));
        updateState({
          dashboards
        });
      },
      error: xhr => {
        const errorMsg = xhr.responseJSON.error || t('获取栏目列表失败');
        notify.error(errorMsg);
      }
    });
  }
  function handleCreateTask() {
    updateState({
      showModal: true,
      modalTitle: t('新建任务'),
      taskName: '',
      taskPptHomeTitle: '',
      taskEmail: '',
      selectedDashboards: [],
      selectedTemplate: null,
      operationType: 'create',
      currentTaskId: null
    });
  }
  function handleEditTask(task) {
    updateState({
      showModal: true,
      modalTitle: t('修改任务'),
      taskName: task.task_name,
      taskEmail: task.task_email || '',
      taskPptHomeTitle: task.task_ppt_home_title || '',
      operationType: 'edit',
      currentTaskId: task.taskid
    }, () => {
      // 处理已选择的栏目列表
      if (task.task_node_list) {
        const nodeIds = task.task_node_list.split(',').map(id => id.trim());
        if (stateRef.current.dashboards.length > 0) {
          // dashboards已加载，直接设置选中项
          const selectedDashboards = stateRef.current.dashboards.filter(dashboard => nodeIds.includes(dashboard.value.toString()));
          updateState({
            selectedDashboards
          });
        } else {
          // 使用一次性的effect处理选中项
          const checkDashboardsLoaded = setInterval(() => {
            if (stateRef.current.dashboards.length > 0) {
              const selectedDashboards = stateRef.current.dashboards.filter(dashboard => nodeIds.includes(dashboard.value.toString()));
              updateState({
                selectedDashboards
              });
              clearInterval(checkDashboardsLoaded);
            }
          }, 100);
          // 设置超时避免无限循环
          setTimeout(() => clearInterval(checkDashboardsLoaded), 5000);
        }
      }

      // 处理已选择的PPT模版
      if (task.task_ppt_template_id && stateRef.current.pptTemplates.length > 0) {
        const selectedTemplate = stateRef.current.pptTemplates.find(template => template.template_id === task.task_ppt_template_id);
        if (selectedTemplate) {
          updateState({
            selectedTemplate: {
              value: selectedTemplate.template_id,
              label: selectedTemplate.template_name,
              id: selectedTemplate.template_id
            }
          });
        }
      }
    });
  }
  function handleDeleteTask(task) {
    if (confirm(t('确定要删除该任务吗？'))) {
      $.ajax({
        url: '/superset/ppt/task/',
        type: 'POST',
        data: {
          taskid: task.taskid,
          operation: 'delete'
        },
        success: () => {
          const updatedTasks = stateRef.current.tasks.filter(t => t.taskid !== task.taskid);
          updateState({
            tasks: updatedTasks
          });
        },
        error: xhr => {
          const errorMsg = xhr.responseJSON.error || t('删除任务失败');
          notify.error(errorMsg);
        }
      });
    }
  }
  function handleRunTask(task) {
    $.ajax({
      url: '/superset/ppt/task/',
      type: 'POST',
      data: {
        taskid: task.taskid,
        operation: 'run'
      },
      success: () => {
        notify.success(t('任务已开始运行'));
        // 更新特定任务的状态而不是重新获取所有任务
        const updatedTasks = stateRef.current.tasks.map(t => {
          if (t.taskid === task.taskid) {
            return {
              ...t,
              task_status: 'running'
            };
          }
          return t;
        });
        updateState({
          tasks: updatedTasks
        });
      },
      error: xhr => {
        const errorMsg = xhr.responseJSON.error || t('运行任务失败');
        notify.error(errorMsg);
      }
    });
  }
  function handleModalClose() {
    updateState({
      showModal: false
    });
  }
  function handleModalSubmit() {
    if (!stateRef.current.taskName.trim()) {
      notify.error('任务名称不能为空');
      return;
    }
    if (!stateRef.current.taskPptHomeTitle.trim()) {
      notify.error('首页标题不能为空');
      return;
    }
    if (!stateRef.current.selectedDashboards || stateRef.current.selectedDashboards.length === 0) {
      notify.error('栏目列表不能为空');
      return;
    }
    if (!stateRef.current.selectedTemplate) {
      notify.error('PPT模版不能为空');
      return;
    }

    // 将选中的dashboard转换为id列表字符串
    const taskNodeList = stateRef.current.selectedDashboards.map(d => d.value).join(',');
    const data = {
      task_name: stateRef.current.taskName,
      task_node_list: taskNodeList,
      task_email: stateRef.current.taskEmail,
      task_ppt_home_title: stateRef.current.taskPptHomeTitle,
      task_ppt_template_id: stateRef.current.selectedTemplate.id,
      operation: stateRef.current.operationType
    };
    if (stateRef.current.operationType === 'edit' && stateRef.current.currentTaskId) {
      data.taskid = stateRef.current.currentTaskId;
    }
    $.ajax({
      url: '/superset/ppt/task/',
      type: 'POST',
      data,
      success: response => {
        updateState({
          showModal: false
        });
        if (stateRef.current.operationType === 'create') {
          const newTasks = {
            "taskid": response.taskid,
            task_name: stateRef.current.taskName,
            task_node_list: taskNodeList,
            task_email: stateRef.current.taskEmail,
            task_ppt_home_title: stateRef.current.taskPptHomeTitle,
            task_status: 'created',
            task_file_name: '',
            task_creat_time: response.task_creat_time,
            task_file_type: 'ppt',
            task_create_userid: response.task_create_userid,
            task_ppt_template_id: stateRef.current.selectedTemplate.id,
            task_count: 0
          };
          const updatedTasks = [newTasks, ...stateRef.current.tasks];
          updateState({
            tasks: updatedTasks
          });
        } else if (stateRef.current.operationType === 'edit') {
          // 更新任务列表中的特定任务
          const updatedTasks = stateRef.current.tasks.map(t => {
            if (t.taskid === stateRef.current.currentTaskId) {
              return {
                ...t,
                task_name: stateRef.current.taskName,
                task_node_list: taskNodeList,
                task_email: stateRef.current.taskEmail,
                task_ppt_home_title: stateRef.current.taskPptHomeTitle,
                task_ppt_template_id: stateRef.current.selectedTemplate.id
              };
            }
            return t;
          });
          updateState({
            tasks: updatedTasks
          });
          notify.success(t('任务更新成功'));
        }
      },
      error: xhr => {
        const errorMsg = xhr.responseJSON.error || t('操作失败');
        notify.error(errorMsg);
      }
    });
  }
  function handleTaskNameChange(e) {
    updateState({
      taskName: e.target.value
    });
  }
  function handleTaskPptHomeTitleChange(e) {
    updateState({
      taskPptHomeTitle: e.target.value
    });
  }
  function handleTaskEmailChange(e) {
    updateState({
      taskEmail: e.target.value
    });
  }
  function handleTaskNodeListChange(selectedOptions) {
    updateState({
      selectedDashboards: selectedOptions
    });
  }
  function handleSelectedTemplateChange(template) {
    updateState({
      selectedTemplate: template
    });
  }
  function handleUploadTemplate() {
    updateState({
      showTemplateModal: true,
      templateModalTitle: t('上传模版'),
      templateName: '',
      templateFile: null,
      templateOperationType: 'upload',
      currentTemplateId: null
    });
  }
  function handleEditTemplate(template) {
    updateState({
      showTemplateModal: true,
      templateModalTitle: t('修改模版'),
      templateName: template.template_name,
      templateFile: null,
      templateOperationType: 'edit',
      currentTemplateId: template.template_id
    });
  }
  function handleTemplateModalClose() {
    updateState({
      showTemplateModal: false
    });
  }
  function handleTemplateModalSubmit() {
    if (!stateRef.current.templateName.trim()) {
      notify.error('模版名称不能为空');
      return;
    }
    if (stateRef.current.templateOperationType === 'upload' && !stateRef.current.templateFile) {
      notify.error('请选择要上传的PPT模版文件');
      return;
    }
    if (stateRef.current.templateOperationType === 'edit' && !stateRef.current.templateName.trim() && !stateRef.current.templateFile) {
      notify.error('模版名称和PPT模版文件不能同时为空');
      return;
    }
    const formData = new FormData();
    formData.append('operation', stateRef.current.templateOperationType);
    formData.append('template_name', stateRef.current.templateName);
    if (stateRef.current.templateFile) {
      formData.append('template_file', stateRef.current.templateFile);
    }
    if (stateRef.current.templateOperationType === 'edit' && stateRef.current.currentTemplateId) {
      formData.append('template_id', stateRef.current.currentTemplateId);
    }
    $.ajax({
      url: '/superset/ppt/template_action/',
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: response => {
        updateState({
          showTemplateModal: false
        });
        if (stateRef.current.templateOperationType === 'upload') {
          const newTemplate = {
            template_id: response.template_id,
            template_name: stateRef.current.templateName,
            template_type: 'private',
            created_time: response.created_time
          };
          const updatedTemplates = [newTemplate, ...stateRef.current.pptTemplates];
          updateState({
            pptTemplates: updatedTemplates
          });
          notify.success(t('模版上传成功'));
        } else if (stateRef.current.templateOperationType === 'edit') {
          const updatedTemplates = stateRef.current.pptTemplates.map(t => {
            if (t.template_id === stateRef.current.currentTemplateId) {
              return {
                ...t,
                template_name: stateRef.current.templateName
              };
            }
            return t;
          });
          updateState({
            pptTemplates: updatedTemplates
          });
          notify.success(t('模版修改成功'));
        }
      },
      error: xhr => {
        const errorMsg = xhr.responseJSON.error || t('操作失败');
        notify.error(errorMsg);
      }
    });
  }
  function handleTemplateNameChange(e) {
    updateState({
      templateName: e.target.value
    });
  }
  function handleTemplateFileChange(e) {
    updateState({
      templateFile: e.target.files[0]
    });
  }
  function renderTaskTable() {
    if (stateRef.current.isLoading) {
      return <div className="loading">{t('加载中...')}</div>;
    }
    const tasks = stateRef.current.tasks || [];
    if (!tasks.length) {
      return <div className="no-data">{t('暂无任务数据')}</div>;
    }

    // 定义不同任务状态的样式
    const getTaskStatusStyle = status => {
      switch (status) {
        case 'created':
          return {
            color: '#7B7B7B'
          };
        // 灰色
        case 'running':
          return {
            color: '#2196F3',
            fontWeight: 'bold'
          };
        // 蓝色，加粗
        case 'finished':
          return {
            color: '#4CAF50',
            fontWeight: 'bold'
          };
        // 绿色，加粗
        case 'failed':
          return {
            color: '#F44336',
            fontWeight: 'bold'
          };
        // 红色，加粗
        default:
          return {};
        // 默认样式
      }
    };
    const tableData = tasks.map(task => {
        // 获取栏目列表对应的显示名称
        let columnLabels = '';
        if (task.task_node_list && stateRef.current.dashboards.length > 0) {
          const nodeIds = task.task_node_list.split(',').map(id => id.trim());
          const matchedDashboards = stateRef.current.dashboards.filter(dashboard => nodeIds.includes(dashboard.value.toString()));
          columnLabels = matchedDashboards.map(d => d.label).join('|');
        }
        return {
          ...task,
          actions: <div className="btn-group">
            <Button size="sm" variant="primary" onClick={() => handleRunTask(task)} disabled={task.task_status === 'running'}>
              {t('运行')}
            </Button>
            <Button size="sm" variant="primary" onClick={() => handleEditTask(task)} disabled={task.task_status === 'running'}>
              {t('修改')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => handleDeleteTask(task)} disabled={task.task_status === 'running'}>
              {t('删除')}
            </Button>
          </div>,
          columnLabels: columnLabels || task.task_node_list,
          fileLink: task.task_file_name
            ? <a href={`/static/assets/docs/${propsRef.current.user.username}/${task.task_file_name}`} download={task.task_file_name}>{task.task_file_name}</a>
            : '-'
        };
      });
    const columns = [{ accessorKey: 'task_name', header: t('任务名称') }, {
      accessorKey: 'columnLabels', header: t('栏目列表'), meta: { style: { fontSize: '12px' } }
    }, {
      accessorFn: task => task.task_email || '-', header: t('邮箱'), id: 'task_email'
    }, {
      accessorKey: 'task_status', header: t('任务状态')
    }, {
      accessorKey: 'fileLink',
      header: t('文件名称')
    }, {
      accessorKey: 'actions',
      header: t('操作'),
      id: 'actions',
      meta: { style: { width: '170px' } }
    }];
    return <AppTable
      className="table table-striped table-hover table-ppttask"
      columns={columns}
      data={tableData}
      getCellProps={cell => (cell.column.id === 'task_status'
        ? { style: getTaskStatusStyle(cell.row.original.task_status) }
        : (cell.column.columnDef.meta || {}))}
      getRowId={row => String(row.taskid)}
      pageSize={10}
    />;
  }
  function renderTemplateTable() {
    if (stateRef.current.isLoading) {
      return <div className="loading">{t('加载中...')}</div>;
    }
    const templates = (stateRef.current.pptTemplates || []).filter(template => template.template_type !== 'public');
    if (!templates.length) {
      return <div className="no-data">{t('暂无模版数据')}</div>;
    }
    const tableData = templates.map(template => ({
      ...template,
      actions: <div className="btn-group">
        <Button size="sm" variant="primary" onClick={() => handleEditTemplate(template)}>
          {t('修改')}
        </Button>
      </div>
    }));
    const columns = [{ accessorKey: 'template_name', header: t('模版名称') }, {
      accessorKey: 'created_time', header: t('上传时间')
    }, {
      accessorKey: 'actions',
      header: t('操作'),
      id: 'actions'
    }];
    return <AppTable
      className="table table-striped table-hover"
      columns={columns}
      data={tableData}
      getRowId={row => String(row.template_id)}
      pageSize={10}
    />;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    fetchTasks();
    fetchDashboards();
    // 启动定时获取运行中任务的定时器
    runTasksTimerRef.current = setInterval(fetchRunTasks, 15000); // 15秒间隔
    return () => {
      // 组件销毁时清除定时器
      if (runTasksTimerRef.current) {
        clearInterval(runTasksTimerRef.current);
        runTasksTimerRef.current = null;
      }
    };
    // Preserve the legacy mount-only requests and polling interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div className="ppt-task-container">
        <AlertsWrapper initMessages={[]} />
        <div className="task-header">
          <Button variant="primary" size="sm" onClick={handleCreateTask} className="create-task-btn">
            {t('新建任务')}
          </Button>
        </div>
        <div className="task-body">
          {renderTaskTable()}
        </div>

        <div className="ppt-templates-container" style={{
      marginTop: '30px'
    }}>
          <div className="template-header">
            <Button variant="primary" size="sm" onClick={handleUploadTemplate} className="upload-template-btn">
              {t('上传模版')}
            </Button>
          </div>
          <div className="template-body">
            {renderTemplateTable()}
          </div>
        </div>

        <Modal show={stateRef.current.showModal} onHide={handleModalClose}>
          <Modal.Header closeButton>
            <Modal.Title>{stateRef.current.modalTitle}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormGroup>
              <FormLabel>{t('任务名称')}<span style={{
              color: 'red'
            }}>*</span></FormLabel>
              <FormControl type="text" value={stateRef.current.taskName} onChange={handleTaskNameChange} placeholder={t('请输入任务名称')} />
            </FormGroup>
            <FormGroup>
              <FormLabel>{t('首页标题')}<span style={{
              color: 'red'
            }}>*</span></FormLabel>
              <FormControl type="text" value={stateRef.current.taskPptHomeTitle} onChange={handleTaskPptHomeTitleChange} placeholder={t('请输入首页标题')} />
            </FormGroup>
            <FormGroup>
              <FormLabel>{t('邮箱')}</FormLabel>
              <FormControl type="email" value={stateRef.current.taskEmail} onChange={handleTaskEmailChange} placeholder={t('请输入接收PPT的邮箱')} />
            </FormGroup>
            <FormGroup>
              <FormLabel>{t('栏目列表')}<span style={{
              color: 'red'
            }}>*</span></FormLabel>
              <OnPasteSelect isMulti value={stateRef.current.selectedDashboards} onChange={handleTaskNodeListChange} options={stateRef.current.dashboards} placeholder={t('请选择栏目，可多选')} valueKey="value" labelKey="label" components={{
            MenuList: WindowedMenuList
          }} />
            </FormGroup>
            <FormGroup>
              <FormLabel>{t('PPT模版')}<span style={{
              color: 'red'
            }}>*</span></FormLabel>
              <OnPasteSelect value={stateRef.current.selectedTemplate} onChange={handleSelectedTemplateChange} options={stateRef.current.pptTemplates.map(template => ({
            value: template.template_id,
            label: template.template_name,
            id: template.template_id
          }))} placeholder={t('请选择PPT模版')} valueKey="value" labelKey="label" components={{
            MenuList: WindowedMenuList
          }} />
            </FormGroup>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={handleModalClose}>{t('取消')}</Button>
            <Button variant="primary" onClick={handleModalSubmit}>{t('确定')}</Button>
          </Modal.Footer>
        </Modal>

        <Modal show={stateRef.current.showTemplateModal} onHide={handleTemplateModalClose}>
          <Modal.Header closeButton>
            <Modal.Title>{stateRef.current.templateModalTitle}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <FormGroup>
              <FormLabel>{t('模版名称')}<span style={{
              color: 'red'
            }}>*</span></FormLabel>
              <FormControl type="text" value={stateRef.current.templateName} onChange={handleTemplateNameChange} placeholder={t('请输入模版名称')} />
            </FormGroup>
            <FormGroup>
              <FormLabel>{t('PPT模版文件')}{stateRef.current.templateOperationType === 'upload' && <span style={{
              color: 'red'
            }}>*</span>}</FormLabel>
              <FormControl type="file" onChange={handleTemplateFileChange} accept=".pptx" />
              {stateRef.current.templateOperationType === 'upload' && <div style={{
            marginTop: '5px',
            fontSize: '12px',
            color: '#666'
          }}>
                  <span>模版ppt文件必须提供一个幻灯片母版,母版提供3张基础版式：首页、内容、尾页按序排列，如有额外免责声明等版式，请按序放置在内容和尾页之间，首页提供：标题、日期 文本占位符，对应占位符文本必须是：title、date，内容页提供：标题 文本占位符，占位符文本必须是：title</span>
                  <br /><a href="/static/assets/docs/ppt_template.pptx" download="ppt_template.pptx">ppt模版参考文件</a>
                </div>}
              {stateRef.current.templateOperationType === 'edit' && <div style={{
            marginTop: '5px',
            fontSize: '12px',
            color: '#666'
          }}>
                  {t('如不选择文件，则只修改模版名称')}
                </div>}
            </FormGroup>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={handleTemplateModalClose}>{t('取消')}</Button>
            <Button variant="primary" onClick={handleTemplateModalSubmit}>{t('确定')}</Button>
          </Modal.Footer>
        </Modal>
      </div>;
}


export default PPTTaskManage;

PPTTaskManage.propTypes = propTypes;
