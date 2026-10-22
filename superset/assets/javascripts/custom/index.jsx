/* eslint no-unused-vars: 0 */
import React, { Fragment } from 'react';
import { createAppStore } from '../reduxUtils';
import { renderReact } from '../modules/reactRoot';
import SearchSlicesSelect from './components/SearchSlicesSelect';
import SearchGlobal from './components/SearchGlobal';
import DifyChatWrapper from './components/DifyChatWrapper';
import NavBarCustom from './components/NavBarCustom';

// 初始化CSRF保护
// initJQueryAjax();

global.notify = {
  info: () => {},
  error: () => {},
};
const urlStr = window.location.href.split('?')[0];
const container = document.getElementById('navbar');
const FavoritesContainer = document.getElementById('myFavorites');
const MonitorsContainer = document.getElementById('myMonitors');
const searchSlicesContainer = document.getElementById('search-slices');
const userId = container ? container.getAttribute('userId') : null;


const SplitPaneDom = document.getElementById('SplitPaneDom');
const isMobile = navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i);

let bootstrapData = null;
if (SplitPaneDom) {
        bootstrapData = SplitPaneDom.getAttribute('data-bootstrap');
        SplitPaneDom.removeAttribute('data-bootstrap');
}
let bootstrapDataParse = {};
if (bootstrapData) {
    bootstrapDataParse = JSON.parse(bootstrapData);
}

if (bootstrapDataParse.expire_date) {
    const expire_date = bootstrapDataParse.expire_date;
    if (expire_date) {
        const today = new Date();
        const expire_date_time = new Date(expire_date).getTime();
        const current_date_time = today.getTime();
        const days = parseInt((expire_date_time - current_date_time) / (1000 * 60 * 60 * 24));
        const expire_date_confirm = localStorage.getItem('expire_date_confirm');
        const currentDate = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        if (days <= 5 && expire_date_confirm !== currentDate) {
            alert('您的账号将在' + days + '天后到期！');
            localStorage.setItem('expire_date_confirm', currentDate);
            console.log('已点击确定');
        }
    }
}

let agree_flag = false;
if (urlStr.indexOf("superset/dashboard") === -1 || bootstrapDataParse.agree_time) {
    agree_flag = true;
}

let timer;
const onscrollFunc = (e) => {
    clearTimeout(timer);
    e.persist();
    timer = setTimeout(() => {
               console.log('scrollTop:', e.target.scrollTop);
               localStorage.setItem('scrollTop', e.target.scrollTop);
            }, 150);
};

const isMac = navigator.userAgent.indexOf('Mac') !== -1;


renderReact(
  <NavBarCustom
    container={container}
    MonitorsContainer={MonitorsContainer}
    SplitPaneDom={SplitPaneDom}
    bootstrapData={bootstrapData}
    isMobile={isMobile}
    isMac={isMac}
    agree_flag={agree_flag}
    onscrollFunc={onscrollFunc}
    urlStr={urlStr}
  />,
  container,
  { sync: true },
);

const renderFavorites = (favorites) => {
  if (FavoritesContainer) {
    renderReact(
      <Fragment>
        {favorites.map((o, index1) => (
          <li key={'favorites_' + index1}>
            <a className="dropdown-item" href={o.url}>{o.second_menu + '-' + o.title}</a>
          </li>
        ))}
      </Fragment>,
      FavoritesContainer,
    );
  }
};

const fetchFavorites = () => {
  fetch(`/superset/fave_dashboards/${userId}/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  .then((resp) => {
    return resp.json();
  })
  .then(favorites => {
    renderFavorites(favorites);
  })
  .catch(error => {
    notify.error('获取收藏列表失败');
    renderFavorites([]);
  });
};

if (userId) {
  fetchFavorites();
}

if (searchSlicesContainer) {
  renderReact(
      <SearchGlobal />,
      searchSlicesContainer,
    );
}

const DifyChatContainer = document.createElement('div');
DifyChatContainer.id = 'dify-chat-global-container';
document.body.appendChild(DifyChatContainer);


const difyReducer = (state = {}, action) => {
  return state; // 简单的reducer，不做任何状态修改
};

const difyStore = createAppStore({ reducer: difyReducer });
// renderReact(
//   <DifyChatWrapper store={difyStore} />,
//   DifyChatContainer,
// );
