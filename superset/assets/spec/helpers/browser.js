/* eslint no-undef: 0, no-native-reassign: 0 */
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import chai from 'chai';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});

global.jsdom = dom;
global.document = dom.window.document;
global.window = dom.window;

Object.getOwnPropertyNames(dom.window).forEach((property) => {
  if (typeof global[property] === 'undefined') {
    Object.defineProperty(
      global,
      property,
      Object.getOwnPropertyDescriptor(dom.window, property),
    );
  }
});

Object.defineProperty(global, 'navigator', {
  configurable: true,
  value: dom.window.navigator,
});

const canvas2dContext = {
  clearRect() {},
  createLinearGradient() {
    return { addColorStop() {} };
  },
  fillRect() {},
  fillText() {},
  measureText(text) {
    return { width: String(text).length * 8 };
  },
  restore() {},
  save() {},
  setTransform() {},
  translate() {},
};
Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'toDataURL', {
  configurable: true,
  value() { return 'data:image/png;base64,'; },
});

Object.defineProperty(dom.window.HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value(contextType) {
    return contextType === '2d' ? canvas2dContext : null;
  },
});

// Configuration copied from https://github.com/sinonjs/sinon/issues/657
// allowing for sinon.fakeServer to work

global.window = global.document.defaultView;
global.XMLHttpRequest = global.window.XMLHttpRequest;

if (!global.window.ResizeObserver) {
  global.window.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}
global.ResizeObserver = global.window.ResizeObserver;
global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = id => clearTimeout(id);

global.sinon = require('sinon');

global.expect = chai.expect;
global.assert = chai.assert;

global.sinon.useFakeXMLHttpRequest();

global.window.XMLHttpRequest = global.XMLHttpRequest;
global.$ = require('jquery');
global.jQuery = global.$;
