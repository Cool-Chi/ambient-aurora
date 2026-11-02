window.AA = window.AA || {};
// Ambient Aurora v3.8.1-flat | Store / WebGLEngine / ClockController / UIManager
(function (AA) {
const $ = id => document.getElementById(id);
const qs = (el, sel) => el.querySelector(sel);
const on = (el, evt, cb, opt) => el.addEventListener(evt, cb, opt);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
class Store {
  static TRANSIENT_KEYS = new Set(['isIdle', 'isHolding', 'isPanelOpen']);
  constructor(defaultState, storageKey = 'aurora_settings') {
    this.storageKey = storageKey;
    this.state = Object.freeze({ ...defaultState });
    this.subscribers = [];
    this.saveTimeout = null;
    AA._store = this;
    this.load();
  }
  getState() {
    return this.state;
  }
  setState(key, value) {
    if (this.state[key] === value) return;
    this.state = Object.freeze({ ...this.state, [key]: value });
    this.scheduleSave(key);
    this.notify(key, value);
  }
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }
  notify(key, value) {
    this.subscribers.forEach(cb => cb(key, value));
  }
  scheduleSave(key) {
    if (Store.TRANSIENT_KEYS.has(key)) return;
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.flush(), 300);
  }
  flush() {
    clearTimeout(this.saveTimeout);
    try {
      const toSave = {};
      for (const [k, v] of Object.entries(this.state)) {
        if (!Store.TRANSIENT_KEYS.has(k)) toSave[k] = v;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(toSave));
    } catch(e){}
  }
  static validate(key, v, def) {
    const isInt = (n, lo, hi) => typeof n === 'number' && Number.isInteger(n) && n >= lo && n <= hi;
    const isNum = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
    switch (key) {
      case 'lang': return (v === 'en' || v === 'zh') ? v : undefined;
      case 'mode': return isInt(v, 1, 5) ? v : undefined;
      case 'fontStyle': return isInt(v, 0, 2) ? v : undefined;
      case 'clockAnimMode': return isInt(v, 0, 3) ? v : undefined;
      case 'clockLayout': return isInt(v, 0, 1) ? v : undefined;
      case 'textColor': case 'ampmColor': case 'dateColor': case 'customTextColor': return (typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(v)) ? v : undefined;
      case 'material': return isInt(v, 0, 3) ? v : undefined;
      case 'showCustomText': case 'showY': case 'showM': case 'showD': case 'showW': case 'showFps': return typeof v === 'boolean' ? v : undefined;
      case 'customText': return typeof v === 'string' ? v.substring(0, 30) : undefined;
      case 'anchor': return isInt(v, 0, 8) ? v : undefined;
      case 'offsetX': case 'offsetY': return isNum(v, -50, 50) ? v : undefined;
      case 'clockOpacity': return isNum(v, 0.1, 1) ? v : undefined;
      case 'bgBrightness': return isNum(v, 0.1, 1.5) ? v : undefined;
      case 'vignette': return isInt(v, 0, 2) ? v : undefined;
      case 'renderScale': return v === 'auto' ? 0 : (v === 0 || v === 0.25 || v === 0.5 || v === 0.75 || v === 1) ? v : undefined;
      case 'datePosition': return isInt(v, 0, 1) ? v : undefined;
      case 'idleTimeout': return isInt(v, 0, 2) ? v : undefined;
      case 'size': return isNum(v, 5, 20) ? v : undefined;
      case 'weight': return isNum(v, 100, 900) ? v : undefined;
      case 'speed': return isNum(v, 0.1, 4) ? v : undefined;
      case 'colorTarget':
        return (Array.isArray(v) && v.length === 3 && v.every(x => isNum(x, 0, 1))) ? [v[0], v[1], v[2]] : undefined;
      default:
        return (typeof v === typeof def && v !== null) ? v : undefined;
    }
  }
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        const merged = { ...this.state };
        for (const k of Object.keys(this.state)) {
          if (Store.TRANSIENT_KEYS.has(k)) continue;
          if (!Object.prototype.hasOwnProperty.call(saved, k)) continue;
          const clean = Store.validate(k, saved[k], this.state[k]);
          if (clean !== undefined) merged[k] = clean;
        }
        this.state = Object.freeze(merged);
      }
    } catch (e) {}
  }
}
AA.util = { $, qs, on, clamp };
AA.CONST = { EASE_OUT };
AA.VERSION = 'v3.8.1-flat';
AA.Store = Store;
})(window.AA);
