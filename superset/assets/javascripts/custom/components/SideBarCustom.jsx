/* eslint no-unused-vars: 0 */
import React, { useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import $ from 'jquery';
import ModalTriggerCustom from '../../components/ModalTriggerCustom';
import '../../../stylesheets/custom.css';


// 定义组件属性类型
const propTypes = {
    third_category: PropTypes.object.isRequired,
    isMobile: PropTypes.bool,
    agree_flag: PropTypes.bool,
};

// 常量定义
const agreeList = ['fengyun', 'localhost'];
const isMac = navigator.userAgent.indexOf('Mac') !== -1;

// 隐私提示模态框内容组件
const PrivacyModalContent = ({ onClose }) => (
  <div>
    <div style={{ padding: '10px' }}>
      <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>温馨提示</h3>
      <p style={{ margin: '0', lineHeight: '1.6' }}>
        尊敬的用户您好：
      </p>
      <p style={{ margin: '10px 0', lineHeight: '1.6' }}>
        感谢您对紫金天风风云平台的信任与支持！本平台近日更新了
        <a href="/static/assets/html/privacy.html" target="_blank" style={{ color: '#FF8032', textDecoration: 'none' }}>《隐私保护指引》</a>和
        <a href="/static/assets/html/exceptions.html" target="_blank" style={{ color: '#FF8032', textDecoration: 'none' }}>《法律声明》</a>，特向您做如下说明，谢谢！
      </p>
      <p style={{ margin: '10px 0', lineHeight: '1.6' }}>
        此次更新主要调整行为信息收集和使用说明。
      </p>
    </div>
    <div style={{ marginTop: '20px', textAlign: 'center' }}>
      <button
        style={{
            marginRight: '10px',
            padding: '8px 16px',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        onClick={() => onClose('no')}
      >
        不同意
      </button>
      <button
        style={{
            padding: '8px 16px',
            backgroundColor: '#FF8032',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        onClick={() => onClose('yes')}
      >
        同意
      </button>
    </div>
  </div>
);

function SideBarCustom(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(SideBarCustom.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = SideBarCustom.defaultProps[key];
  });
  const propsRef = useRef(props);
  const currentUrl = window.location.href.split('?')[0];
  const [state, setState] = useState(() => ({
    showModal: true
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
  const headerResizeObserverRef = useRef(undefined);
  function handleClose(clickType) {
    console.log('clickType:', clickType);
    if (clickType === 'no') {
      window.location.href = '/logout';
      return;
    }
    updateState({
      showModal: false
    });
    // 更新同意状态
    $.ajax({
      url: '/superset/update_agree',
      type: 'GET',
      data: {},
      dataType: 'json',
      success: data => {
        console.log('update_agree success', data);
      },
      error: err => {
        console.log(err);
      }
    });
  }
  function chevronToggle(obj) {
    // 找到 <a> 标签（不管点击的是 a 还是 i）
    const $link = $(obj.target).closest('a');
    // 找到 <i> 标签并切换箭头图标方向
    $link.find('i').toggleClass('fa-chevron-right');
    $link.find('i').toggleClass('fa-chevron-down');
    // 展开/收缩功能由 Bootstrap 5 collapse 数据 API 处理。
  }
  function updateLayoutPadding() {
    const topHeader = document.querySelector('header.top, header.top-mac');
    const navbarCollapse = document.querySelector('.navbar-collapse.collapse');
    const topHeight = topHeader ? topHeader.clientHeight : navbarCollapse ? navbarCollapse.clientHeight : 0;
    const clientNavbar = topHeader ? topHeader.querySelector('.client-navbar') : null;
    if (clientNavbar) {
      const customNavbar = document.getElementById('navbar');
      const rightNavbar = clientNavbar.querySelector('.navbar-nav.ms-auto');
      const rightNavbarWrapped = customNavbar && rightNavbar ? rightNavbar.getBoundingClientRect().top > customNavbar.getBoundingClientRect().top : false;
      clientNavbar.classList.toggle('navbar-actions-wrapped', rightNavbarWrapped);
    }
    if (propsRef.current.isMobile) {
      console.log('移动端');
      if (document.getElementsByClassName('row-custom').length) {
        document.getElementsByClassName('row-custom')[0].style['margin-top'] = 123 + 'px';
      }
    } else {
      if (document.getElementsByClassName('row-custom').length) {
        const rowCustom = document.getElementsByClassName('row-custom')[0];
        rowCustom.style['padding-top'] = topHeight > 60 ? topHeight + 'px' : '';
      }
      if (document.getElementById('SplitPaneDom')) {
        const splitPaneDom = document.getElementById('SplitPaneDom');
        if (window.location.href.indexOf('dashboard') > -1) {
          splitPaneDom.style['padding-top'] = (topHeight || 60) + 'px';
        } else {
          splitPaneDom.style['padding-top'] = topHeight > 60 ? topHeight + 'px' : '';
          const firstPane = splitPaneDom.querySelector('.Pane1');
          if (firstPane) {
            firstPane.style['margin-top'] = topHeight > 60 ? '' : '-20px';
          }
        }
      }
    }
  }
  function renderSidebarMenuItems() {
    return propsRef.current.third_category.third_category_list_order.map((k, index) => {
      const dashboards = propsRef.current.third_category[k].values;
      // dashboards 是一个二维数组，按dashboards元素数组里下标2的数字正序将dashboards重排序
      dashboards.sort((a, b) => a[2] - b[2]);
      const hasActiveDashboard = dashboards.some(o => currentUrl.indexOf(o[1].split('?')[0]) > -1);
      const faType = 'fa-chevron-down';
      const collapseType = 'collapse show';
      return <div className={isMac ? 'sidebar-menu-mac' : 'sidebar-menu'} key={'sliceBarDiv_' + index}>
          <a className={hasActiveDashboard ? 'nav-header menu-first activate-third' : 'nav-header menu-first'} onClick={chevronToggle} data-bs-toggle="collapse" href={'#leftMenu' + index} role="button" aria-controls={'leftMenu' + index} aria-expanded="true">
            <i className={'fa ' + faType + ' icon-user-md icon-large'} /> {k}
          </a>
          <ul id={'leftMenu' + index} className={'sidebar-nav menu-second ' + collapseType}>
            {dashboards.map((o, index1) => {
            const activateDash = currentUrl.indexOf(o[1].split('?')[0]) > -1;
            return <li key={'sliceBarLi_' + index1}>
                  <a href={o[1]} className={activateDash ? 'activate-dash' : ''}>{o[0]}</a>
                </li>;
          })}
          </ul>
        </div>;
    });
  }
  function renderPrivacyModal() {
    const shouldShowModal = agreeList.some(target => currentUrl.indexOf(target) > -1) && !propsRef.current.agree_flag;
    if (!shouldShowModal) {
      return null;
    }
    return <ModalTriggerCustom showModal={stateRef.current.showModal} onHide={handleClose} modalBody={<PrivacyModalContent onClose={handleClose} />} modalFooter={null} />;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    // 恢复滚动位置
    if (localStorage.getItem('scrollTop')) {
      document.getElementById('sidebar').scrollTop = Number(localStorage.getItem('scrollTop'));
    }
    updateLayoutPadding();
    const topHeader = document.querySelector('header.top, header.top-mac');
    if (topHeader && typeof ResizeObserver !== 'undefined') {
      headerResizeObserverRef.current = new ResizeObserver(updateLayoutPadding);
      headerResizeObserverRef.current.observe(topHeader);
    } else {
      window.addEventListener('resize', updateLayoutPadding);
    }
    // 获取class:row-custom,子元素class：row-main-container得对象，设置css margin-left: 240px;
    // 不影响dashboard页面，因为dashboard页面有SplitPaneDom;
    // row-custom 可能是null,所以需要判断
    if (document.querySelector('.row-custom')) {
      const rowMainContainer = document.querySelector('.row-custom').querySelector('.row-main-container');
      if (rowMainContainer) {
        const sidebar = document.getElementById('sidebar');
        const sidebarWidth = sidebar.offsetWidth;
        console.log('sidebarWidth:', sidebarWidth);
        rowMainContainer.style.marginLeft = sidebarWidth + 10 + 'px';
      }
    }
    return () => {
      if (headerResizeObserverRef.current) {
        headerResizeObserverRef.current.disconnect();
      } else {
        window.removeEventListener('resize', updateLayoutPadding);
      }
    };
  }, []);
  // 计算并更新布局
  // this.updateLayoutPadding();
  return <div>
        {renderSidebarMenuItems()}
        {renderPrivacyModal()}
      </div>;
}


export default SideBarCustom;

SideBarCustom.propTypes = propTypes;

