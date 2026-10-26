const srcdoc = require('srcdoc-polyfill');

require('./markup.css');

function markupWidget(slice, payload) {
  $('#code').attr('rows', '15');
  const jqdiv = slice.container;
  jqdiv.css({
    overflow: 'auto',
  });

  // markup height is slice height - (marginTop + marginBottom)
  let iframeHeight = slice.height() - 20;
  if (slice.props.vizType === 'separator') {
    // separator height is the entire chart container: slice height + header
    iframeHeight = slice.height() + slice.headerHeight();
  }
  const fd = slice.formData;
  const iframeId = `if__${slice.containerId}`;
  if (slice.formData.markup_type === 'markdown') {
      const html = `
    <html>
      <head>
        <link rel="stylesheet" type="text/css" href="${payload.data.theme_css}" />
        <style type="text/css">
          p { font-size:` + fd.font_size + `px; }
          pre code { font-size:` + fd.font_size_2 + `px; }
        </style>
      </head>
      <body style="background-color: transparent;">
        ${payload.data.html}
      </body>
    </html>`;
      jqdiv.html(`
    <iframe id="${iframeId}"
      frameborder="0"
      height="${iframeHeight}"
      sandbox="allow-same-origin allow-scripts allow-top-navigation allow-popups">
    </iframe>
  `);

      const iframe = document.getElementById(iframeId);
      srcdoc.set(iframe, html);
  } else {
    const html = `<div class="editdiv" ><textarea rows="15"  
            id="ta_${slice.containerId}" 
            style="font-size: 17;width: 100%;overflow: auto;">
${payload.data.html}</textarea></div>`;
jqdiv.html(`<div class="showdiv">${payload.data.html}</div>`);
    // jqdiv.html(`<div class="showdiv">${payload.data.html}</div>${html}`);
    // $('#ta_' + slice.containerId).on('blur', function () {
    //     const sliceName = $('#' + fd.slice_id + '-cell .editable-title input').val();
    //     fd.code = $('#ta_' + slice.containerId).val();
    //     slice.props.actions.saveHtmlContent({ slice_id: fd.slice_id, form_data: fd }, sliceName);
    // });
  }
}

module.exports = markupWidget;
