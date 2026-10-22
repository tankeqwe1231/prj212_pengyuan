import React, { useLayoutEffect, useRef } from 'react';
import { renderReact } from '../../modules/reactRoot';
import SplitPane from '../../components/SplitPane';
import SideBarCustom from './SideBarCustom';
import PopoverMonitor from './PopoverMonitor';

const SIDEBAR_SCROLLBAR_WIDE_CLASS = 'sidebar-scrollbar-wide';
const SIDEBAR_SCROLLBAR_HOVER_ZONE_PX = 8;

function setSidebarScrollbarWide(sidebar, clientX) {
  if (!sidebar) {
    return;
  }
  const rect = sidebar.getBoundingClientRect();
  const nearScrollbar = clientX >= rect.right - SIDEBAR_SCROLLBAR_HOVER_ZONE_PX
    && clientX <= rect.right;
  sidebar.classList.toggle(SIDEBAR_SCROLLBAR_WIDE_CLASS, nearScrollbar);
}

function clearSidebarScrollbarWide(sidebar) {
  if (sidebar) {
    sidebar.classList.remove(SIDEBAR_SCROLLBAR_WIDE_CLASS);
  }
}

function NavBarCustom(incomingProps) {
  const props = {
    ...incomingProps
  };
  Object.keys(NavBarCustom.defaultProps || {}).forEach(key => {
    if (typeof props[key] === 'undefined') props[key] = NavBarCustom.defaultProps[key];
  });
  const propsRef = useRef(props);
  const { container, isMobile, agree_flag } = props;
  const nav_dataRef = useRef(JSON.parse(container.getAttribute('data-js')));
  const current_top_categoryRef = useRef(container.getAttribute('current_top_category'));
  const current_sub_categoryRef = useRef(container.getAttribute('current_sub_category'));
  const top_category_lstRef = useRef(container.getAttribute('top_category_lst').split('|'));
  const second_category_list_orderRef = useRef(JSON.parse(container.getAttribute('second_category_list_order')));
  const isMobileRef = useRef(isMobile);
  const agree_flagRef = useRef(agree_flag);
  function handleClick(ev) {
    ev.preventDefault();
    agree_flagRef.current = true;
    const category = ev.currentTarget.getAttribute('data-category');
    if (category != null) {
      const topCategory = category.split('|')[0];
      const subCategory = category.split('|')[1];
      if (topCategory !== current_top_categoryRef.current || subCategory !== current_sub_categoryRef.current) {
        localStorage.removeItem('scrollTop');
        document.getElementById('sidebar').scrollTop = 0;
        const sideBar = document.getElementById('sidebar');
        renderReact(<SideBarCustom third_category={nav_dataRef.current[topCategory][subCategory]} isMobile={isMobileRef.current} agree_flag={agree_flagRef.current} />, sideBar);
        if (topCategory !== current_top_categoryRef.current) {
          const element = document.getElementsByClassName('activate-top');
          if (element.length) {
            element[0].classList.remove('activate-top');
          }
          ev.currentTarget.parentElement.parentElement.previousElementSibling.classList.add('activate-top');
        }
        if (category !== current_top_categoryRef.current + '|' + current_sub_categoryRef.current) {
          const elementSecond = document.getElementsByClassName('activate-second');
          if (elementSecond.length) {
            elementSecond[0].classList.remove('activate-second');
          }
          ev.currentTarget.classList.add('activate-second');
        }
        current_top_categoryRef.current = topCategory;
        current_sub_categoryRef.current = subCategory;
      }
    }
  }
  function genSecondNavlist(topcategoryname) {
    const secondCategoryArr = Object.keys(nav_dataRef.current[topcategoryname]);
    const secondCategoryArrOrder = [];
    if (second_category_list_orderRef.current.hasOwnProperty(topcategoryname)) {
      second_category_list_orderRef.current[topcategoryname].forEach(function (value, i) {
        if (secondCategoryArr.indexOf(value) >= 0) {
          secondCategoryArrOrder.push(value);
          secondCategoryArr.splice(secondCategoryArr.indexOf(value), 1);
        }
      });
    }
    secondCategoryArrOrder.push(...secondCategoryArr);
    return secondCategoryArrOrder;
  }
  propsRef.current = props;
  useLayoutEffect(() => {
    const {
      MonitorsContainer,
      SplitPaneDom,
      bootstrapData
    } = propsRef.current;
    let leftWidth = Number(localStorage.getItem('FengYunSplitPos')) || '12vw';
    const navbarCollapse = document.querySelector('.navbar-collapse.collapse');
    const topHeight = navbarCollapse ? navbarCollapse.clientHeight : 0;
    const isDashboardLayout = window.location.href.indexOf('dashboard') > -1;
    const updateSidebarWidth = size => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.style.width = typeof size === 'number' ? size + 'px' : size;
      }
    };
    let teardownSidebarScrollbarHover = () => {};
    renderReact(<PopoverMonitor />, MonitorsContainer);
    if (isMobileRef.current) {
      leftWidth = 20 + 'vw';
      console.log('移动端，强制指定左侧宽度为 ' + leftWidth);
    }
    if (propsRef.current.isMac) {
      document.querySelector('.top').classList.add('top-mac');
      document.querySelector('.top').classList.remove('top');
    }
    console.log('左侧：', leftWidth);
    if (SplitPaneDom) {
      if (isDashboardLayout) {
        SplitPaneDom.style.paddingTop = (topHeight || 60) + 'px';
      }
      let appId = 'app';
      let className = 'dashboard container-fluid';
      if (window.location.href.indexOf('slicemodelview/add') > -1) {
        appId = 'js-add-slice-container';
        className = '';
      }
      renderReact(<SplitPane split="vertical" defaultSize={leftWidth} style={{
        height: null,
        minHeight: '50%'
      }} pane1Style={{
        marginTop: isDashboardLayout || topHeight > 60 ? null : -20
      }} pane2Style={{
        height: '100%',
        minWidth: 0
      }} onChange={updateSidebarWidth} onDragFinished={size => {
        updateSidebarWidth(size);
        localStorage.setItem('FengYunSplitPos', size.toString());
      }}>
          <div
            id="sidebar"
            className="sidebar-fixed"
            style={{
              height: '100%',
              width: leftWidth
            }}
            onScroll={propsRef.current.onscrollFunc}
            onMouseMove={(e) => setSidebarScrollbarWide(e.currentTarget, e.clientX)}
            onMouseLeave={(e) => clearSidebarScrollbarWide(e.currentTarget)}
          >
            <SideBarCustom third_category={nav_dataRef.current[current_top_categoryRef.current][current_sub_categoryRef.current]} isMobile={isMobileRef.current} agree_flag={agree_flagRef.current} />
          </div>
          <div className="row row-main-container">
            <div id={appId} className={className} data-bootstrap={bootstrapData} />
          </div>
        </SplitPane>, SplitPaneDom);
    } else {
      const sidebar = document.getElementById('sidebar');
      renderReact(<SideBarCustom third_category={nav_dataRef.current[current_top_categoryRef.current][current_sub_categoryRef.current]} isMobile={isMobileRef.current} agree_flag={agree_flagRef.current} />, sidebar);
      if (sidebar) {
        const onMove = (e) => setSidebarScrollbarWide(sidebar, e.clientX);
        const onLeave = () => clearSidebarScrollbarWide(sidebar);
        sidebar.addEventListener('mousemove', onMove);
        sidebar.addEventListener('mouseleave', onLeave);
        teardownSidebarScrollbarHover = () => {
          sidebar.removeEventListener('mousemove', onMove);
          sidebar.removeEventListener('mouseleave', onLeave);
          clearSidebarScrollbarWide(sidebar);
        };
      }
    }
    return teardownSidebarScrollbarHover;
  }, []);
  const {
    urlStr
  } = propsRef.current;
  return <ul className="navbar-nav">
        {top_category_lstRef.current.map((k, index) => <li className="nav-item dropdown" key={'li_' + index}>
            <a className={current_top_categoryRef.current === k && urlStr.indexOf('dashboard') > -1 ? 'nav-link dropdown-toggle activate-top' : 'nav-link dropdown-toggle'} data-bs-toggle="dropdown" href="#" role="button" aria-expanded="false">
              <i className="fa fa-fw fa-dashboard" />&nbsp; {k}
            </a>
            <ul className="dropdown-menu" key={'ul_' + index}>
              {genSecondNavlist(k).map((value, index1) => <li key={'li1_' + index1}><a href="#" data-category={k + '|' + value} className={current_top_categoryRef.current === k && current_sub_categoryRef.current === value ? 'dropdown-item activate-second' : 'dropdown-item'} onClick={handleClick}> {value} </a></li>)}
            </ul>
          </li>)}
      </ul>;
}



export default NavBarCustom;
