
import $ from 'jquery';
import { t } from '../javascripts/locales';

function ckEditorWidget(slice) {
  const fd = slice.formData;
  const EditorId = 'ckeditor_' + slice.containerId;
  // Rendering can run again while CKEditor is still loading its plugins.
  // Destroy the previous instance before removing the node it will replace.
  const previousEditor = CKEDITOR.instances[EditorId];
  if (previousEditor) {
    previousEditor.destroy(true);
  }
  const html = '<div id=' + EditorId + '></div>';
  slice.container.html(html);
  const editorElement = document.getElementById(EditorId);
  const token = $('input#csrf_token').val();
  const sliceCell = $('#cell-' + fd.slice_id);
  const isDashboard = sliceCell.length > 0;
  // console.log(APP_DIR);

    const ckInstance = CKEDITOR.replace(EditorId, { height: slice.height() });
    const isCurrentEditor = () => CKEDITOR.instances[EditorId] === ckInstance &&
      editorElement.isConnected;
    ckInstance.on('instanceReady', function (data) {
      if (!isCurrentEditor()) {
        return;
      }
      if (isDashboard && !fd.show_cke_menu) {
        $('#' + slice.containerId + ' .cke_top').hide();
      }
      const editor = data.editor;
      let editorChanged = false;
      editor.setData(fd.editor_content, function () {
        if (!isCurrentEditor()) {
          return;
        }
        const imgs = editor.document.$.querySelectorAll('img');

        // 为iframe内的图片添加点击事件，代理到主页面进行放大
         imgs.forEach((img) => {
           // 设置图片的放大图标样式
           img.style.cursor = 'zoom-in';
          img.addEventListener('click', function(e) {
            e.preventDefault();
              // 创建遮罩层
              const overlay = document.createElement('div');
              overlay.style.position = 'fixed';
              overlay.style.top = '0';
              overlay.style.left = '0';
              overlay.style.width = '100%';
              overlay.style.height = '100%';
              overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
              overlay.style.zIndex = '9998';
              overlay.style.cursor = 'zoom-out';
              overlay.style.overflow = 'auto';
              overlay.style.padding = '20px';
              overlay.style.boxSizing = 'border-box';
              overlay.style.textAlign = 'center';

              // 创建图片元素 - 使用简单直接的方式
              const tempImg = document.createElement('img');
              tempImg.src = this.src;
              tempImg.style.maxWidth = 'none'; // 显示原始大小
              tempImg.style.maxHeight = 'none'; // 显示原始大小
              tempImg.style.display = 'block';
              tempImg.style.margin = '0 auto'; // 只水平居中
              tempImg.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
              tempImg.style.cursor = 'zoom-out';
              tempImg.style.borderRadius = '4px';

              // 为小图片添加垂直居中效果
              tempImg.onload = function() {
                const windowHeight = window.innerHeight - 40; // 减去padding
                const imgHeight = this.naturalHeight;

                if (imgHeight < windowHeight) {
                  // 图片较小时，添加上边距实现垂直居中
                  const topMargin = Math.max(0, (windowHeight - imgHeight) / 2);
                  this.style.marginTop = topMargin + 'px';
                }
              };

              overlay.appendChild(tempImg);
              document.body.appendChild(overlay);

             // 点击关闭
             overlay.addEventListener('click', function () {
               document.body.removeChild(overlay);
             });
           });
         });
        editor.on('change', function () {
          editorChanged = true;
        });
      });
      editor.config.filebrowserUploadMethod = 'xhr';
      editor.config.fileTools_requestHeaders = {
           'X-Requested-With': 'XMLHttpRequest',
           'X-CSRFToken': token,
      };
      const button = document.querySelector('.ckeditor-switch');
      if (isDashboard && button && button.firstChild.data === t('Edit Dashboard')) {
          editor.setReadOnly(true);
          $('#' + slice.containerId + ' .cke_top').hide();
      }
      if (isDashboard && !button) {
          editor.setReadOnly(true);
          $('#' + slice.containerId + ' .cke_top').hide();
      }
      if (button) {
          const onToggleEdit = (obj) => {
          if (!isCurrentEditor()) {
            return;
          }
          if (obj.currentTarget.textContent.trim() === t('Edit Dashboard')) {
              editor.setReadOnly(false);
              if (fd.show_cke_menu) {
                $('#' + slice.containerId + ' .cke_top').show();
              }
          } else {
              editor.setReadOnly(true);
              $('#' + slice.containerId + ' .cke_top').hide();
              // editor.document.removeListener('change', function (){ console.log('移除监听') });
          }
          };
          button.addEventListener('click', onToggleEdit);
          editor.on('destroy', function () {
            button.removeEventListener('click', onToggleEdit);
          });
      }
      editor.on('blur', function () {
          if (isCurrentEditor() && editorChanged) {
            editorChanged = false;
            fd.editor_content = editor.getData();
            if (!isDashboard) {
                slice.props.setControlValue('editor_content', editor.getData(), []);
            }
            if (isDashboard) {
                slice.props.updateSliceFormData(fd.slice_id, fd);
            }
          }
        });
      slice.container.find('.cke_bottom').hide();
      if (isDashboard && fd.hide_chart_header) {
        sliceCell.find('span.editable-title').hide();
        // 设置sliceCell 下 chart-header border-bottom 为0
        sliceCell.find('.chart-header').css('border-bottom', '0');
        $('#cke_ckeditor_' + slice.containerId).css('border', '0');
      }
    });
}

export default ckEditorWidget;
