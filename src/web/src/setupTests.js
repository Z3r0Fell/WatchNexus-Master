import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for Node.js/Jest environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// NOTE: CRA's jest preset runs with `resetMocks: true`, which wipes every
// jest.fn() implementation before EACH test. The global mocks below get their
// default behaviour (re)applied in a top-level beforeEach, which runs after
// that reset and before any per-file beforeEach/test overrides.

// Mock matchMedia globally before any imports
const matchMediaImpl = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
});
const mockMatchMedia = jest.fn().mockImplementation(matchMediaImpl);
global.matchMedia = mockMatchMedia;
window.matchMedia = mockMatchMedia;
document.matchMedia = mockMatchMedia;

// In-memory Storage mock: methods are jest.fn()s (tests stub them with
// mockReturnValue / mockImplementation) but behave like real storage by default.
const createStorageMock = () => {
  let store = {};
  const mock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    key: jest.fn(),
  };
  Object.defineProperty(mock, 'length', { get: () => Object.keys(store).length });
  Object.defineProperty(mock, '__reset', {
    enumerable: false,
    value: () => {
      store = {};
      mock.getItem.mockImplementation((k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null));
      mock.setItem.mockImplementation((k, v) => { store[k] = String(v); });
      mock.removeItem.mockImplementation((k) => { delete store[k]; });
      mock.clear.mockImplementation(() => { store = {}; });
      mock.key.mockImplementation((i) => Object.keys(store)[i] ?? null);
    },
  });
  mock.__reset();
  return mock;
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();
Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true, writable: true });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, configurable: true, writable: true });

// Mock navigator.clipboard
const clipboardMock = {
  readText: jest.fn().mockResolvedValue(''),
  writeText: jest.fn().mockResolvedValue(undefined),
};
Object.defineProperty(navigator, 'clipboard', {
  value: clipboardMock,
  writable: true,
  configurable: true,
});

// jsdom gaps used by Radix UI / layout code
if (typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  global.ResizeObserver = window.ResizeObserver;
}
if (typeof window.IntersectionObserver === 'undefined') {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
  };
  global.IntersectionObserver = window.IntersectionObserver;
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function scrollIntoView() {};
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = function hasPointerCapture() { return false; };
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = function releasePointerCapture() {};

const createAxiosInstanceMock = () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  defaults: { headers: { common: {} } },
  interceptors: {
    request: { use: jest.fn(), eject: jest.fn(), handlers: [] },
    response: { use: jest.fn(), eject: jest.fn(), handlers: [] },
  },
});

beforeEach(() => {
  mockMatchMedia.mockImplementation(matchMediaImpl);
  localStorageMock.__reset();
  sessionStorageMock.__reset();
  clipboardMock.readText.mockResolvedValue('');
  clipboardMock.writeText.mockResolvedValue(undefined);

  // Restore the default axios.create() behaviour of src/__mocks__/axios.js
  // (wiped by resetMocks) so modules imported inside tests still get an
  // instance with interceptors.
  try {
    // eslint-disable-next-line global-require
    const axiosMod = require('axios');
    const axios = axiosMod && (axiosMod.default || axiosMod);
    if (axios && axios.create && axios.create._isMockFunction && !axios.create.getMockImplementation()) {
      axios.create.mockImplementation(createAxiosInstanceMock);
    }
  } catch { /* axios not resolvable in this test */ }
});
