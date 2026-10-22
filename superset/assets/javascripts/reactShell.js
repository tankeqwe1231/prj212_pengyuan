import 'bootstrap/js/dist/alert';
import 'bootstrap/js/dist/collapse';
import 'bootstrap/js/dist/dropdown';
import 'bootstrap/js/dist/modal';

import mountStandardNavbarControls from './modules/navbarControls';

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    mountStandardNavbarControls,
    { once: true },
  );
} else {
  mountStandardNavbarControls();
}
