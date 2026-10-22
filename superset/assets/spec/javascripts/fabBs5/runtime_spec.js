import $ from 'jquery';
import sinon from 'sinon';

import {
  AdminActions,
  AdminFilters,
  abAlert,
  initializeFabControls,
  loadSelectDataSlave,
} from '../../../javascripts/fabBs5/runtime';

describe('FAB Bootstrap 5 runtime', () => {
  let submitStub;
  let select2Original;

  beforeEach(() => {
    global.Event = window.Event;
    global.CustomEvent = window.CustomEvent;
    document.body.innerHTML = '<div class="modal" id="modal-confirm"><div class="modal-dialog"><div class="modal-content"><div class="modal-text"></div><button id="modal-confirm-ok" type="button">OK</button></div></div></div><div class="modal" id="modal-alert"><div class="modal-dialog"><div class="modal-content"><div class="modal-text"></div></div></div></div>';
    submitStub = sinon.stub(window.HTMLFormElement.prototype, 'submit');
    select2Original = $.fn.select2;
    $.fn.select2 = function select2(command) {
      if (command === 'destroy') this.removeClass('select2-hidden-accessible');
      else this.addClass('select2-hidden-accessible');
      return this;
    };
  });

  afterEach(() => {
    submitStub.restore();
    $.fn.select2 = select2Original;
    document.body.innerHTML = '';
  });

  it('submits selected action rows with the existing CSRF field', () => {
    document.body.insertAdjacentHTML('beforeend', '<form id="action_form"><input name="csrf_token" value="token"><input id="action" name="action"></form><input class="action_check" name="rowid" value="7" type="checkbox" checked>');
    const actions = new AdminActions();

    actions.execute_multiple('export', 'Confirm');
    document.getElementById('modal-confirm-ok').click();

    const form = document.getElementById('action_form');
    expect(form.querySelector('[name="csrf_token"]').value).to.equal('token');
    expect(form.querySelector('#action').value).to.equal('export');
    expect(form.querySelector('[name="rowid"]').value).to.equal('7');
    expect(submitStub.calledOnce).to.equal(true);
  });

  it('submits single deletes through the CSRF delete form', () => {
    document.body.insertAdjacentHTML('beforeend', '<form id="delete_form"><input name="csrf_token" value="token"></form>');
    const actions = new AdminActions();

    actions.execute_single_delete('/items/delete/3', 'Delete?');
    document.getElementById('modal-confirm-ok').click();

    expect(document.getElementById('delete_form').action).to.contain('/items/delete/3');
    expect(submitStub.calledOnce).to.equal(true);
  });

  it('uses the Bootstrap 5 alert modal API', () => {
    abAlert('Nothing selected');

    expect(document.querySelector('#modal-alert .modal-text').textContent).to.equal('Nothing selected');
    expect(document.getElementById('modal-alert').classList.contains('show')).to.equal(true);
  });

  it('creates filter fields with FAB-compatible query names', () => {
    document.body.insertAdjacentHTML('beforeend', '<form id="filter_form"><a class="filter" name="name" href="#">Name</a><table class="filters"><tbody></tbody></table></form>');
    new AdminFilters(
      '#filter_form',
      { name: 'Name' },
      { name: '<input class="form-control" type="text">' },
      { name: ['Contains', 'Equal to'] },
      [],
    );

    document.querySelector('a.filter').click();

    expect(document.querySelector('.filter_val').name).to.equal('_flt_0_name');
    expect(document.querySelector('.filter-op').classList.contains('select2-hidden-accessible')).to.equal(true);
  });

  it('shows the search form only while filters are selected', () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="list-filter-selector"><a class="filter" name="name" href="#">Name</a></div><form id="filter_form" class="d-none"><table class="filters"><tbody></tbody></table><button type="submit">Search</button></form>');
    new AdminFilters(
      '#filter_form',
      { name: 'Name' },
      { name: '<input class="form-control" type="text">' },
      { name: ['Contains', 'Equal to'] },
      [],
      '#list-filter-selector',
    );

    expect(document.getElementById('filter_form').classList.contains('d-none')).to.equal(true);

    document.querySelector('#list-filter-selector a.filter').click();

    expect(document.getElementById('filter_form').classList.contains('d-none')).to.equal(false);
    expect(document.querySelector('#filter_form button[type="submit"]').textContent).to.equal('Search');

    document.querySelector('.remove-filter').click();

    expect(document.getElementById('filter_form').classList.contains('d-none')).to.equal(true);
  });

  it('replaces dependent Select2 choices when the master field changes', () => {
    document.body.insertAdjacentHTML('beforeend', '<select id="master"><option value="7" selected>Seven</option></select><select id="slave" class="my_select2_ajax_slave" master_id="master" endpoint="/items/{{ID}}"><option value="old">Old</option></select>');
    const getStub = sinon.stub($, 'get').callsFake((url, callback) => {
      callback([{ id: 'new', text: 'New' }]);
    });

    loadSelectDataSlave(document);

    expect(getStub.calledWith('/items/7')).to.equal(true);
    expect(Array.from(document.getElementById('slave').options).map(option => option.value))
      .to.deep.equal(['new']);
    getStub.restore();
  });

  it('hides selected options and keeps multi-select removal closed', () => {
    let select2Options;
    let dropdownOpen = false;
    $.fn.select2 = function select2(commandOrOptions) {
      if (commandOrOptions === 'destroy') return this.removeClass('select2-hidden-accessible');
      select2Options = commandOrOptions;
      this.addClass('select2-hidden-accessible');
      this.after('<span class="select2"><span class="select2-selection"><ul><li class="select2-selection__choice"><span class="select2-selection__choice__remove">×</span></li></ul></span></span>');
      const $selection = this.next('.select2').find('.select2-selection');
      $selection.on('click', () => { dropdownOpen = !dropdownOpen; });
      $selection.on('click', '.select2-selection__choice__remove', () => {
        this.val([]);
      });
      return this;
    };
    document.body.insertAdjacentHTML('beforeend', '<select id="owners" class="my_select2" multiple><option value="1" selected>Admin</option><option value="2">User</option></select>');

    initializeFabControls(document);

    expect(select2Options.matcher({}, { selected: true, text: 'Admin' })).to.equal(null);
    expect(select2Options.matcher({}, { selected: false, text: 'User' }).text).to.equal('User');

    document.querySelector('#owners + .select2 .select2-selection__choice__remove').click();

    expect($('#owners').val()).to.deep.equal([]);
    expect(dropdownOpen).to.equal(false);
  });

  it('closes date-only pickers after a date selection', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="expire_date-picker" class="input-group appbuilder_date">'
      + '<input id="expire_date" type="text">'
      + '<button type="button" data-td-toggle="datetimepicker">Calendar</button>'
      + '</div>',
    );

    initializeFabControls(document);

    const picker = document.getElementById('expire_date-picker').fabDatePicker;
    const hideStub = sinon.stub(picker, 'hide');
    picker._subscribers['change.td'][0]();

    expect(hideStub.calledOnce).to.equal(true);
  });

  it('keeps time pickers open while the time value is completed', () => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="created_on-picker" class="input-group appbuilder_datetime">'
      + '<input id="created_on" type="text">'
      + '<button type="button" data-td-toggle="datetimepicker">Calendar</button>'
      + '</div>',
    );

    initializeFabControls(document);

    const picker = document.getElementById('created_on-picker').fabDatePicker;

    expect(picker._subscribers['change.td']).to.equal(undefined);
  });
});
