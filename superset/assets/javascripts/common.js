/* eslint-disable global-require */
import $ from 'jquery';

function toggleCheckbox(apiUrlPrefix, selector) {
  const checkbox = $(selector)[0];
  if (checkbox) {
    $.get(apiUrlPrefix + checkbox.checked);
  }
}

$(document).ready(function () {
  $(':checkbox[data-checkbox-api-prefix]').change(function () {
    const $this = $(this);
    const prefix = $this.data('checkbox-api-prefix');
    const id = $this.attr('id');
    toggleCheckbox(prefix, '#' + id);
  });

  // for language picker dropdown
  $('#language-picker a').click(function (ev) {
    ev.preventDefault();

    const targetUrl = ev.currentTarget.href;
    $.ajax(targetUrl)
      .then(() => {
        location.reload();
      });
  });

  const zoom = window.devicePixelRatio || window.screen.deviceXDPI / window.screen.logicalXDPI;
  // console.log(zoom);
  // console.log('2222');
  // console.log(screen.availWidth);
  // console.log(screen.availHeight);
  const currentUrl = window.location.href;
              if (currentUrl.indexOf('/login/') !== -1 && zoom === 1.25) {
                // alert('系统检测到您的设备默认对显示进行了放大，建议使用【Ctrl】+【鼠标滚轮】缩放至80%，可获得更优质的浏览体验。');
            }
     const deviceType = navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i);
      if (!deviceType && currentUrl.indexOf('/login/') !== -1 && screen.availWidth <= 1280 && screen.availHeight <= 800) {
        // alert('系统检测到您的设备显示分辨率为1280*800或以下，建议使用【Ctrl】+【鼠标滚轮】缩放至80%，可获得更优质的浏览体验。');
    }
        // if (!!window.ActiveXObject || 'ActiveXObject' in window) {
        //     if (zoom === 1.25) {
        //         // 如果在笔记本中用IE浏览器打开 则弹出提示
        //         alert('您的设备对显示进行放大导致页面显示不完全,请调整后打开/或用其他浏览器');
        //     }
        // } else {
        //     if (zoom === 1.25) {
        //         const c = document.querySelector('body');
        //         c.style.zoom = -0.62 * zoom + 1.55;   // 就去修改页面的缩放比例，这个公式我自己算的，不准确，勉强。
        //     }
        // }


});

export function appSetup() {
  // Keep jQuery globals required by legacy visualization code. Bootstrap 5's
  // server-rendered navbar behavior is initialized by the reactShell entry.
  window.$ = $;
  window.jQuery = $;
}
