import $ from 'jquery';
import Modal from 'bootstrap/js/dist/modal';
import Collapse from 'bootstrap/js/dist/collapse';
import Tab from 'bootstrap/js/dist/tab';
import Tooltip from 'bootstrap/js/dist/tooltip';
import Popover from 'bootstrap/js/dist/popover';
import { TempusDominus } from '@eonasdan/tempus-dominus';

const select2Options = {
  allowClear: true,
  placeholder: 'Select a State',
  theme: 'bootstrap-5',
  width: 'resolve',
};

function select2MatcherWithoutSelected(params, data, matcher) {
  if (data.selected || (data.element && data.element.selected)) return null;
  if (matcher) return matcher(params, data);

  const term = String((params && params.term) || '').trim().toLowerCase();
  return !term || String(data.text || '').toLowerCase().includes(term) ? data : null;
}

function preventMultiSelectOpenOnRemove($element) {
  if (!$element.prop('multiple')) return;

  const $selection = $element.next('.select2').find('.select2-selection');
  if (!$selection.length) return;

  const removeSelector = '.select2-selection__choice__remove';
  let scrollPositions = [];

  // A mousedown on a choice otherwise focuses the selection, which redirects
  // focus to the search input at the end of a potentially very long list.
  $selection.on('mousedown.fabBs5Remove', removeSelector, event => {
    event.preventDefault();
  });

  // Capture before Select2's delegated click handler updates the choices and
  // focuses its search input again (including when the dropdown is closed).
  $selection[0].addEventListener('click', event => {
    if (!event.target.closest(removeSelector)) return;
    scrollPositions = [];
    for (let node = $selection[0]; node; node = node.parentElement) {
      if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) {
        scrollPositions.push({ node, top: node.scrollTop, left: node.scrollLeft });
      }
    }
  }, true);

  $selection.off('click.fabBs5Remove').on(
    'click.fabBs5Remove',
    removeSelector,
    event => {
      event.stopPropagation();
      scrollPositions.forEach(({ node, top, left }) => {
        // Also cancel Bootstrap's smooth focus scrolling, which may not have
        // moved scrollTop yet when the click handler finishes.
        node.scrollTo({ top, left, behavior: 'instant' });
      });
      scrollPositions = [];
    },
  );
}

function initializeSelect2(element, options = {}) {
  const $element = $(element);
  if ($element.hasClass('select2-hidden-accessible')) $element.select2('destroy');
  const settings = {
    ...select2Options,
    ...options,
  };
  if ($element.prop('multiple')) {
    const select2Defaults = $.fn.select2.defaults;
    const matcher = options.matcher
      || (select2Defaults && select2Defaults.defaults && select2Defaults.defaults.matcher);
    settings.matcher = (params, data) => select2MatcherWithoutSelected(params, data, matcher);
  }
  $element.select2(settings);
  preventMultiSelectOpenOnRemove($element);
  if ($element.hasClass('readonly')) $element.prop('disabled', true);
  return $element;
}

function initializeRemoteSelect2(element) {
  const $element = $(element);
  if ($element.hasClass('select2-hidden-accessible')) $element.select2('destroy');
  $element.select2({
    ...select2Options,
    ajax: {
      url: $element.data('endpoint'),
      dataType: 'json',
      delay: 250,
      data: params => ({
        page: params.page || 1,
        q: params.term || '',
      }),
      processResults: data => data,
      cache: true,
    },
    minimumInputLength: 0,
  });
  preventMultiSelectOpenOnRemove($element);
}

function initializeDatePicker(element) {
  const pickerElement = element.matches('.appbuilder_date, .appbuilder_datetime')
    ? element
    : element.closest('.appbuilder_date, .appbuilder_datetime');
  if (!pickerElement || pickerElement.dataset.tdInitialized === 'true') return null;
  const dateTime = pickerElement.classList.contains('appbuilder_datetime');
  const picker = new TempusDominus(pickerElement, {
    allowInputToggle: true,
    display: {
      buttons: { clear: true, close: true, today: true },
      components: {
        calendar: true,
        clock: dateTime,
        date: true,
        decades: true,
        hours: dateTime,
        minutes: dateTime,
        month: true,
        seconds: dateTime,
        useTwentyfourHour: true,
        year: true,
      },
    },
    localization: {
      format: dateTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd',
      hourCycle: 'h23',
      locale: 'zh-CN',
    },
  });
  if (!dateTime) {
    // Selecting a date (including the "Go to today" action) is a complete
    // value for date-only fields, so close the picker immediately.
    picker.subscribe('change.td', () => picker.hide());
  }
  pickerElement.dataset.tdInitialized = 'true';
  pickerElement.fabDatePicker = picker;
  return picker;
}

function normalizeSelectData(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function replaceSelectOptions(element, data) {
  const previousValue = $(element).val();
  const options = normalizeSelectData(data);
  element.replaceChildren();
  options.forEach(option => {
    const id = option && typeof option === 'object' ? option.id : option;
    const label = option && typeof option === 'object'
      ? (option.text == null ? id : option.text)
      : option;
    element.add(new Option(label == null ? '' : label, id == null ? '' : id));
  });
  $(element).val(previousValue);
}

export function loadSelectData(root = document) {
  $('.my_select2_ajax', root).each(function () {
    const element = this;
    $.get($(element).attr('endpoint'), data => {
      replaceSelectOptions(element, data);
      initializeSelect2(element, { placeholder: 'Select' });
    });
  });
}

export function loadSelectDataSlave(root = document) {
  $('.my_select2_ajax_slave', root).each(function () {
    const element = this;
    const $element = $(element);
    const masterId = $element.attr('master_id');
    const load = () => {
      const masterValue = $(`#${masterId}`).val();
      if (!masterValue) {
        replaceSelectOptions(element, []);
        initializeSelect2(element, { placeholder: 'Select' });
        return;
      }
      const endpoint = $element.attr('endpoint').replace('{{ID}}', masterValue);
      $.get(endpoint, data => {
        replaceSelectOptions(element, data);
        initializeSelect2(element, { placeholder: 'Select' });
      });
    };
    load();
    $(`#${masterId}`).off('change.fabSlave').on('change.fabSlave', load);
  });
}

export function initializeFabControls(root = document) {
  $('.my_select2', root).each(function () { initializeSelect2(this); });
  $('.my_select2_remote', root).each(function () { initializeRemoteSelect2(this); });
  $('.appbuilder_date, .appbuilder_datetime', root).each(function () {
    initializeDatePicker(this);
  });
  loadSelectData(root);
  loadSelectDataSlave(root);
  root.querySelectorAll('[data-bs-toggle="tooltip"], [rel="tooltip"]').forEach(element => {
    Tooltip.getOrCreateInstance(element, { container: 'body', placement: 'bottom' });
  });
  root.querySelectorAll('[data-bs-toggle="popover"]').forEach(element => {
    Popover.getOrCreateInstance(element, { container: 'body' });
  });
}

export function abAlert(text) {
  const element = document.getElementById('modal-alert');
  if (!element) return;
  const message = element.querySelector('.modal-text');
  if (message) message.textContent = text;
  Modal.getOrCreateInstance(element).show();
}

export function AdminActions() {
  let mode = null;
  let actionName = '';
  let actionUrl = '';
  const modalElement = document.getElementById('modal-confirm');
  const okButton = document.getElementById('modal-confirm-ok');
  let modalInstance = null;

  const showConfirmation = confirmation => {
    const message = modalElement && modalElement.querySelector('.modal-text');
    if (message) message.textContent = confirmation || '';
    if (modalElement) {
      modalInstance = Modal.getOrCreateInstance(modalElement);
      modalInstance.show();
    }
  };
  const submitForm = $form => {
    if (!$form.length) return false;
    $form[0].submit();
    return true;
  };
  const submitMultiple = () => {
    const $form = $('#action_form');
    $('#action', $form).val(actionName);
    $form.find('input.action_check').remove();
    $('input.action_check:checked').each(function () {
      $form.append($(this).clone().prop('checked', true));
    });
    submitForm($form);
  };
  const submitSingle = () => {
    const $form = mode === 'delete' && !$('#action_form').length
      ? $('#delete_form') : $('#action_form');
    $form.attr('action', actionUrl);
    submitForm($form);
  };

  if (okButton) {
    $(okButton).off('click.fabActions').on('click.fabActions', event => {
      event.preventDefault();
      if (modalInstance) modalInstance.hide();
      if (mode === 'multiple') submitMultiple();
      if (mode === 'single' || mode === 'delete') submitSingle();
    });
  }
  $('.action_check_all').off('change.fabActions').on('change.fabActions', function () {
    $('.action_check').prop('checked', this.checked).trigger('change');
  });
  $('.action_check').off('change.fabActions').on('change.fabActions', function () {
    $(this).closest('tr').toggleClass('table-success', this.checked);
  });

  this.execute_multiple = (name, confirmation) => {
    if ($('input.action_check:checked').length === 0) {
      abAlert('No row selected');
      return false;
    }
    mode = 'multiple';
    actionName = name;
    if (confirmation) showConfirmation(confirmation);
    else submitMultiple();
    return false;
  };
  this.execute_single = (url, confirmation) => {
    mode = 'single';
    actionUrl = url;
    if (confirmation) showConfirmation(confirmation);
    else submitSingle();
    return false;
  };
  this.execute_single_delete = (url, confirmation) => {
    mode = 'delete';
    actionUrl = url;
    showConfirmation(confirmation);
    return false;
  };
}

export function AdminFilters(element, labels, form, filters, activeFilters, selectorElement = element) {
  const $root = $(element);
  const $selector = $(selectorElement);
  const $container = $('.filters tbody', $root).length
    ? $('.filters tbody', $root) : $('.filters', $root);

  const syncFormVisibility = () => {
    $root.toggleClass('d-none', $container.children().length === 0);
  };

  const addOperation = ($row, name, selectedValue, activate = true) => {
    const $select = $('<select class="filter-op my_select2 form-select form-select-sm"/>');
    let selectedIndex = -1;
    $(filters[name]).each(function (index) {
      const selected = selectedValue === this || selectedValue === String(this);
      if (selected) selectedIndex = index;
      $('<option/>', { selected, text: this, value: index }).appendTo($select);
    });
    $('<td class="filter"/>').append($select).appendTo($row);
    $select.on('select2:select change', event => {
      const value = event.params ? event.params.data.id : $select.val();
      $row.find('.filter_val').attr('name', `_flt_${value}_${name}`);
    });
    if (activate) initializeSelect2($select[0], { allowClear: false, placeholder: 'Select' });
    return selectedIndex;
  };

  const appendField = ($row, name, operation, value) => {
    const $field = $(form[name]);
    const $input = $field.is(':input') ? $field : $field.find('input').first();
    const target = $input.length ? $input : $field;
    target.attr('name', `_flt_${operation}_${name}`).addClass('filter_val');
    if (target.attr('type') === 'checkbox') {
      target.prop('checked', value === true || value === 'y' || value === 'True' || value === '1');
    } else {
      target.val(value == null ? '' : value);
    }
    $('<td class="filter"/>').append($field).appendTo($row);
    const select = $field.hasClass('my_select2') ? $field : target.filter('.my_select2');
    if (select.length) initializeSelect2(select[0]);
    const picker = $field.filter('.appbuilder_date, .appbuilder_datetime')[0]
      || target.closest('.appbuilder_date, .appbuilder_datetime')[0];
    if (picker) initializeDatePicker(picker);
  };

  const addFilter = (name, operationName = null, value = '') => {
    const $row = $('<tr/>').appendTo($container);
    const $remove = $('<a href="#" class="btn btn-sm btn-outline-secondary remove-filter"/>')
      .append('<span aria-hidden="true">&times;</span>&nbsp;')
      .append(document.createTextNode(labels[name]))
      .on('click', event => {
        event.preventDefault();
        $row.find('.my_select2').each(function () {
          if ($(this).hasClass('select2-hidden-accessible')) $(this).select2('destroy');
        });
        const picker = $row.find('.appbuilder_date, .appbuilder_datetime')[0];
        if (picker && picker.fabDatePicker) picker.fabDatePicker.dispose();
        $row.remove();
        syncFormVisibility();
      });
    $('<td/>').append($remove).appendTo($row);
    const operation = addOperation($row, name, operationName, operationName === null);
    appendField($row, name, operation < 0 ? 0 : operation, value);
    syncFormVisibility();
  };

  $('a.filter', $selector).off('click.fabFilters').on('click.fabFilters', function (event) {
    event.preventDefault();
    addFilter($(this).attr('name'));
  });
  $(activeFilters).each(function () {
    const values = Array.isArray(this[2]) ? this[2] : [this[2]];
    values.forEach(value => addFilter(this[0], this[1], value));
  });
  syncFormVisibility();
}

export function initializeFabKeepState(root = document) {
  root.querySelectorAll('[data-bs-toggle="tab"]').forEach(element => {
    if (element.dataset.fabKeepTabBound === 'true') return;
    element.dataset.fabKeepTabBound = 'true';
    element.addEventListener('shown.bs.tab', () => {
      localStorage.setItem('lastTab', element.getAttribute('href') || element.dataset.bsTarget);
    });
  });
  const lastTab = localStorage.getItem('lastTab');
  const tab = lastTab && root.querySelector(`[href="${lastTab}"], [data-bs-target="${lastTab}"]`);
  const firstTab = root.querySelector('[data-bs-toggle="tab"]');
  if (tab || firstTab) Tab.getOrCreateInstance(tab || firstTab).show();
  root.querySelectorAll('.accordion-collapse').forEach(element => {
    if (element.dataset.fabKeepAccordionBound === 'true') return;
    element.dataset.fabKeepAccordionBound = 'true';
    element.addEventListener('shown.bs.collapse', () => localStorage.setItem('lastAccordion', element.id));
    element.addEventListener('hidden.bs.collapse', () => localStorage.removeItem('lastAccordion'));
  });
  const lastAccordion = localStorage.getItem('lastAccordion');
  const accordion = lastAccordion && document.getElementById(lastAccordion);
  if (accordion && !accordion.classList.contains('show')) {
    Collapse.getOrCreateInstance(accordion, { toggle: false }).show();
  }
}
