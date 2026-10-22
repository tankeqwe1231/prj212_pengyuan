import $ from 'jquery';
import Alert from 'bootstrap/js/dist/alert';
import Modal from 'bootstrap/js/dist/modal';
import Dropdown from 'bootstrap/js/dist/dropdown';
import Collapse from 'bootstrap/js/dist/collapse';
import Tab from 'bootstrap/js/dist/tab';
import Tooltip from 'bootstrap/js/dist/tooltip';
import Popover from 'bootstrap/js/dist/popover';
import { TempusDominus } from '@eonasdan/tempus-dominus';
import 'select2/dist/js/select2.full';

import '../../stylesheets/react-theme.scss';
import '../../stylesheets/react-select/select.less';
import '../../stylesheets/superset.less';
import '../../stylesheets/custom.css';
import 'select2/dist/css/select2.min.css';
import 'select2-bootstrap-5-theme/dist/select2-bootstrap-5-theme.min.css';
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.min.css';
import '../../stylesheets/fab-bs5.scss';
import mountStandardNavbarControls from '../modules/navbarControls';

import {
  AdminActions,
  AdminFilters,
  abAlert,
  initializeFabControls,
  initializeFabKeepState,
  loadSelectData,
  loadSelectDataSlave,
} from './runtime';

window.$ = $;
window.jQuery = $;
window.bootstrap = { Alert, Collapse, Dropdown, Modal, Popover, Tab, Tooltip };
window.TempusDominus = TempusDominus;
window.AdminActions = AdminActions;
window.AdminFilters = AdminFilters;
window.ab_alert = abAlert;
window.initializeFabControls = initializeFabControls;
window.initializeFabKeepState = initializeFabKeepState;
window.loadSelectData = loadSelectData;
window.loadSelectDataSlave = loadSelectDataSlave;

$(function () {
  initializeFabControls(document);
  initializeFabKeepState(document);
  mountStandardNavbarControls();
});
