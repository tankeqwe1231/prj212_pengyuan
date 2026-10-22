import 'datatables.net-bs5';
import 'datatables.net-bs5/css/dataTables.bootstrap5.css';
import $ from 'jquery';

import './excel_view.css';

export default function excelView(slice, payload) {
  const container = slice.container;
  // const fd = slice.formData;
  const height = container.height();
  // let cols = payload.data.columns;
  // if (Array.isArray(cols[0])) {
  //   cols = cols.map(col => col[0]);
  // }

  // payload data is a string of html with a single table element
  container.html(payload.data.html);

  // jQuery hack to set verbose names in headers
  const replaceCell = function () {
    const s = $(this)[0].textContent;
    $(this)[0].textContent = slice.datasource.verbose_map[s] || s;
  };
  slice.container.find('thead tr:first th').each(replaceCell);
  slice.container.find('thead tr th:first-child').each(replaceCell);

  container.css('overflow', 'auto');
  container.css('height', `${height + 10}px`);
}
