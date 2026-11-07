window.AA = window.AA || {};
// Ambient Aurora v3.18.0-flat | Store / WebGLEngine / ClockController / UIManager
(function (AA) {
const $ = id => document.getElementById(id);
const qs = (el, sel) => el.querySelector(sel);
const on = (el, evt, cb, opt) => el.addEventListener(evt, cb, opt);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
class Store {
  static STORAGE_VERSION = 2;
  static TRANSIENT_KEYS = new Set(['isIdle', 'isHolding', 'isPanelOpen']);
  constructor(defaultState, storageKey = 'aurora_settings') {
    this.storageKey = storageKey;
    this.defaultState = Object.freeze({ ...defaultState });
    this.state = this.defaultState;
    this.subscribers = new Map();
    this.saveTimeout = null;
    this.load();
  }
  getState() {
    return this.state;
  }
  setState(key, value) {
    const cfg = AA.UI_CONFIG;
    const entry = cfg && cfg.SCHEMA_BY_KEY && cfg.SCHEMA_BY_KEY[key];
    if (
      entry &&
      typeof entry.normalize === 'function' &&
      typeof entry.validate === 'function' &&
      entry.validate(value) === true
    ) {
      value = entry.normalize(value);
    }
    if (this.state[key] === value) return;
    this.state = Object.freeze({ ...this.state, [key]: value });
    this.scheduleSave(key);
    this.notify(key, value);
  }
  subscribe(keys, cb) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      let set = this.subscribers.get(k);
      if (!set) {
        set = new Set();
        this.subscribers.set(k, set);
      }
      set.add(cb);
    }
  }
  notify(key, val) {
    const set = this.subscribers.get(key);
    if (!set) return;
    for (const cb of set) cb(key, val, this.state);
  }
  scheduleSave(key) {
    if (Store.TRANSIENT_KEYS.has(key)) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.flush(), 300);
  }
  flush() {
    clearTimeout(this.saveTimeout);
    try {
      const persistedState = {};
      for (const [k, v] of Object.entries(this.state)) {
        if (!Store.TRANSIENT_KEYS.has(k)) persistedState[k] = v;
      }
      localStorage.setItem(this.storageKey, JSON.stringify({ version: Store.STORAGE_VERSION, state: persistedState }));
    } catch(e){}
  }
  // Schema-driven validation: returns an object holding only the keys whose value passes SETTINGS_SCHEMA[k].validate
  // (values are passed through SETTINGS_SCHEMA[k].normalize when defined, e.g. clockCustomText truncation)
  static validate(raw, def) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    const cfg = AA.UI_CONFIG;
    const schema = cfg && cfg.SETTINGS_SCHEMA;
    if (!schema) return out;
    const byKey = cfg.SCHEMA_BY_KEY || Object.fromEntries(schema.map(e => [e.key, e]));
    for (const k of Object.keys(def)) {
      if (Store.TRANSIENT_KEYS.has(k)) continue;
      if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
      const entry = byKey[k];
      if (!entry || typeof entry.validate !== 'function') continue;
      const v = raw[k];
      if (entry.validate(v) === true) {
        const n = typeof entry.normalize === 'function' ? entry.normalize(v) : v;
        out[k] = Array.isArray(n) ? n.slice() : n;
      }
    }
    return out;
  }
  load() {
    this.state = this.defaultState;
    let raw = null;
    try {
      raw = localStorage.getItem(this.storageKey);
    } catch (e) {
      return;
    }
    if (raw === null) return;
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      parsed = null;
    }
    const valid = !!parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      parsed.version === Store.STORAGE_VERSION &&
      !!parsed.state &&
      typeof parsed.state === 'object' &&
      !Array.isArray(parsed.state);
    if (!valid) {
      try {
        localStorage.removeItem(this.storageKey);
      } catch (e) {}
      return;
    }
    this.state = Object.freeze({ ...this.defaultState, ...Store.validate(parsed.state, this.defaultState) });
  }
}
AA.util = { $, qs, on, clamp };
AA.CONST = { EASE_OUT };
AA.VERSION = 'v3.18.0-flat';
AA.Store = Store;
})(window.AA);
