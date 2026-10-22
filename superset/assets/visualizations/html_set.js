import 'datatables.net-bs5';
import 'datatables.net-bs5/css/dataTables.bootstrap5.css';

// import './excel_view.css';

export default function htmlSet(slice, payload) {
  const container = slice.container;
  // const fd = slice.formData;
  // const height = container.height();
  // payload data is a string of html with a single table element
  container.html(payload.data.html);
  // container.css('overflow', 'auto');
}
