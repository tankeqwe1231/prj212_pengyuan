const $ = require('jquery');

function appendIframeToken(url, iframeToken) {
  if (!iframeToken) {
    return url;
  }
  const separator = url.indexOf('?') >= 0 ? '&' : '?';
  return url + separator + 'iframe_token=' + encodeURIComponent(iframeToken);
}

function iframeWidget(slice, payload) {
  const fd = slice.formData;
  const sliceCell = $('#cell-' + fd.slice_id);
  const isDashboard = sliceCell.length > 0;
  if (isDashboard && fd.hide_chart_header) {
        sliceCell.find('.chart-header').css('border-bottom', '0');
        sliceCell.find('.chart-header').hide();
      }
  const container = document.getElementById('app');
  const bootstrap = JSON.parse(container.getAttribute('data-bootstrap'));
  const username = bootstrap.username;
  $('#code').attr('rows', '15');
  let url = slice.render_template(fd.url);
  if (url.indexOf('?') >= 0) {
    url = url + '&username_fengyun=' + username;
  } else {
    url = url + '?username_fengyun=' + username;
  }
  const iframeToken = payload && payload.data && payload.data.iframe_token;
  url = appendIframeToken(url, iframeToken);
  slice.container.html('<iframe style="width:100%;" allowfullscreen allow="fullscreen" allowtransparency="true"></iframe>');
  const iframe = slice.container.find('iframe');
  iframe.css('height', slice.height());
  iframe.attr('src', url);
}

module.exports = iframeWidget;
module.exports.appendIframeToken = appendIframeToken;
