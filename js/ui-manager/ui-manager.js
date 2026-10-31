(function (AA) {
const { $, qs, on, clamp } = AA.util;
const { EASE_OUT } = AA.CONST;
const { Store, DICT } = AA;
const { FONTS, THEMES, SLIDERS, UI_BINDINGS, BINDING_BY_ID } = AA.UI_CONFIG;
const qsa = (el, sel) => el.querySelectorAll(sel);
const haptic = p => { try { navigator.vibrate?.(p) } catch(e){} };
const CP_PRESETS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#5ac8fa', '#007aff', '#af52de', '#ffffff'];
const CP_TARGETS = ['colorTarget', 'textColor', 'ampmColor', 'dateColor', 'customTextColor'];
const hsvToRgb = (h, s, v) => {
  const c = v * s, hp = (h % 360) / 60, x = c * (1 - Math.abs(hp % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  return [r + m, g + m, b + m];
};
const rgbToHsv = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max];
};
const parseHex = str => {
  const t = String(str).trim(), p = t[0] === '#' ? t : '#' + t;
  return /^#[0-9a-f]{6}$/i.test(p) ? p.toLowerCase() : null;
};
const createColorPicker = ui => {
  const el = document.createElement('div');
  el.className = 'aa-color-picker';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Color picker');
  el.setAttribute('aria-hidden', 'true');
  el.inert = true;
  el.innerHTML = `<div class="cp-head"><span class="cp-preview"></span><input type="text" class="cp-hex" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" aria-label="Hex"><button type="button" class="cp-close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="cp-sv-pad"><div class="cp-sv-thumb"></div></div><div class="cp-hue-track"><div class="cp-hue-thumb"></div></div><div class="cp-presets">${CP_PRESETS.map(c => `<button type="button" class="cp-preset" data-hex="${c}" aria-label="${c.toUpperCase()}" style="--c:${c}"></button>`).join('')}</div>`;
  ui.panel.parentElement.appendChild(el);
  const hexIn = qs(el, '.cp-hex'), pad = qs(el, '.cp-sv-pad'), svThumb = qs(el, '.cp-sv-thumb'), track = qs(el, '.cp-hue-track'), hueThumb = qs(el, '.cp-hue-thumb');
  const presetBtns = Array.from(qsa(el, '.cp-preset'));
  let isOpen = false, prop = null, anchorEl = null, h = 0, s = 0, v = 1, hex = '#000000', lastEmit = '', raf = null, dirty = false;
  const readHex = p => {
    const st = ui.store.getState();
    if (p === 'colorTarget') { const c = st.colorTarget; return UIManager.rgbToHex(c[0], c[1], c[2]); }
    const val = st[p];
    return (typeof val === 'string' && /^#[0-9a-f]{6}$/i.test(val)) ? val.toLowerCase() : '#ffffff';
  };
  const paint = () => {
    hex = UIManager.rgbToHex(...hsvToRgb(h, s, v));
    el.style.setProperty('--cp-h', h.toFixed(1));
    el.style.setProperty('--cp-cur', hex);
    svThumb.style.left = `${s * 100}%`;
    svThumb.style.top = `${(1 - v) * 100}%`;
    hueThumb.style.left = `${h / 360 * 100}%`;
    if (document.activeElement !== hexIn) hexIn.value = hex.toUpperCase();
    presetBtns.forEach(b => b.classList.toggle('is-active', b.dataset.hex === hex));
  };
  const setFromHex = p => {
    const [nh, ns, nv] = rgbToHsv(...UIManager.hexToRgb(p));
    if (ns > 0 && nv > 0) h = nh;
    s = ns; v = nv;
    paint();
  };
  const emit = () => {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    dirty = false;
    if (!isOpen || !prop || hex === lastEmit) return;
    lastEmit = hex;
    if (prop === 'colorTarget') ui.store.setState('colorTarget', UIManager.hexToRgb(hex));
    else ui.store.setState(prop, hex);
    ui.scheduleIdle();
  };
  const queue = () => {
    dirty = true;
    if (!raf) raf = requestAnimationFrame(() => { raf = null; if (dirty) emit(); });
  };
  const place = () => {
    const panel = ui.panel, hr = panel.parentElement.getBoundingClientRect(), pr = panel.getBoundingClientRect(), W = el.offsetWidth, H = el.offsetHeight, m = 8;
    const pl = pr.left - hr.left, pt = pr.top - hr.top, pw = pr.width, ph = pr.height;
    let x, y;
    if (window.matchMedia('(max-width: 600px)').matches || !anchorEl) {
      x = pl + (pw - W) / 2;
      y = pt + ph - H - 12;
    } else {
      const tr = anchorEl.getBoundingClientRect();
      x = tr.left - hr.left + tr.width / 2 - W / 2;
      y = tr.bottom - hr.top + 8;
      if (y + H > pt + ph - m) y = tr.top - hr.top - H - 8;
    }
    el.style.left = `${Math.round(clamp(x, pl + m, Math.max(pl + m, pl + pw - W - m)))}px`;
    el.style.top = `${Math.round(clamp(y, pt + m, Math.max(pt + m, pt + ph - H - m)))}px`;
  };
  const bindDrag = (node, update) => {
    let pid = null, rect = null;
    on(node, 'pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId;
      rect = node.getBoundingClientRect();
      try { node.setPointerCapture(pid); } catch (err) {}
      e.preventDefault();
      if (document.activeElement === hexIn) hexIn.blur();
      update(e, rect);
      queue();
    });
    on(node, 'pointermove', e => {
      if (e.pointerId !== pid) return;
      update(e, rect);
      queue();
    });
    const end = e => {
      if (e.pointerId !== pid) return;
      pid = null;
      try { node.releasePointerCapture(e.pointerId); } catch (err) {}
      if (dirty) emit();
    };
    ['pointerup', 'pointercancel'].forEach(t => on(node, t, end));
  };
  bindDrag(pad, (e, r) => {
    s = clamp((e.clientX - r.left) / (r.width || 1), 0, 1);
    v = 1 - clamp((e.clientY - r.top) / (r.height || 1), 0, 1);
    paint();
  });
  bindDrag(track, (e, r) => {
    h = clamp((e.clientX - r.left) / (r.width || 1), 0, 1) * 360;
    paint();
  });
  on(hexIn, 'input', () => {
    const p = parseHex(hexIn.value);
    if (p) { setFromHex(p); emit(); }
  });
  on(hexIn, 'blur', () => { hexIn.value = hex.toUpperCase(); });
  on(hexIn, 'keydown', e => { if (e.key === 'Enter') hexIn.blur(); });
  on(el, 'pointerdown', e => e.stopPropagation());
  on(el, 'click', e => {
    e.stopPropagation();
    const b = e.target.closest('.cp-preset');
    if (b) { haptic(10); setFromHex(b.dataset.hex); emit(); return; }
    if (e.target.closest('.cp-close')) { haptic(10); api.close(); }
  });
  const api = {
    el,
    isOpen: () => isOpen,
    open(p, trigger) {
      if (!CP_TARGETS.includes(p)) return;
      if (isOpen && dirty) emit();
      prop = p;
      anchorEl = trigger ? (trigger.closest('.tc-chip, .swatch-wrapper') || trigger) : null;
      const cur = readHex(p);
      lastEmit = cur;
      setFromHex(cur);
      place();
      if (!isOpen) {
        isOpen = true;
        haptic(10);
        el.inert = false;
        el.setAttribute('aria-hidden', 'false');
        el.classList.add('is-open');
      }
    },
    toggle(p, trigger) {
      if (isOpen && prop === p) api.close();
      else api.open(p, trigger);
    },
    close() {
      if (dirty) emit();
      if (!isOpen) return;
      isOpen = false;
      prop = null;
      anchorEl = null;
      if (document.activeElement === hexIn) hexIn.blur();
      el.classList.remove('is-open');
      el.inert = true;
      el.setAttribute('aria-hidden', 'true');
    },
    reposition() {
      if (isOpen) place();
    },
    refresh(key) {
      if (!isOpen || key !== prop) return;
      const cur = readHex(prop);
      if (cur === lastEmit) return;
      lastEmit = cur;
      setFromHex(cur);
    }
  };
  return api;
};
class UIManager {
  static get DICT() {
    return DICT;
  }
  static get FONTS() {
    return FONTS;
  }
  static get THEMES() {
    return THEMES;
  }
  static get SLIDERS() {
    return SLIDERS;
  }
  static get UI_BINDINGS() {
    return UI_BINDINGS;
  }
  static BINDING_BY_ID = BINDING_BY_ID;
  static hexToRgb(h) {
    return [parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255];
  }
  static rgbToHex(r, g, b) {
    return `#${[r,g,b].map(x => clamp(Math.round(x * 255), 0, 255).toString(16).padStart(2, '0')).join('')}`;
  }
  constructor(store) {
    this.store = store;
    this.panel = $('settings-panel');
    this.activeTab = 0;
    this.appContainer = $('app-container');
    this.hudToast = $('hud-toast');
    this.bgLayer = $('bg-layer');
    this.clockLayerObj = $('clock-layer');
    this.pixelShiftTimer = null;
    this.hudTimer = null;
    this.idleTimer = null;
    this.lastWake = 0;
    this.wakeLock = null;
    this.wakeLockPending = false;
    this.holdTimeout = null;
    this.exitCloseTimer = null;
    this.exitRecoverTimer = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.tgStart = null;
    this.tgTarget = null;
    this.tgDragged = false;
    this.typoAnim = null;
    this.lAngle = Math.atan2(0.75, 0.65);
    this.lMag = Math.hypot(0.65, 0.75);
    this.clockEl = $('clock');
    this.clockWrapperEl = $('clock-wrapper');
    this.btnLowpower = $('btn-lowpower');
    this.ptrX = -0.65;
    this.ptrY = -0.75;
    this.ptrActiveUntil = 0;
    this.ptrW = 0;
    this.gyroX = 0;
    this.gyroY = 0;
    this.hasGyro = false;
    this.gyroAsked = false;
    this.gyroPending = false;
    this.glassPress = 0;
    this.glassRaf = null;
    this.lastGlassTick = 0;
    this.glassEls = null;
    this._kCache = {};
    this.tickGlassBound = this.tickGlass.bind(this);
    this.store.subscribe((prop, val) => {
      if (Store.TRANSIENT_KEYS.has(prop)) return;
      let skipAnim = false;
      if (prop === 'lang') {
        this.renderPanel();
        skipAnim = true;
      }
      this.syncUI(skipAnim, prop === 'lang' ? null : prop);
    });
  }
  init() {
    [['btn-lowpower', 24, '', `<rect x="2" y="7" width="16" height="10" rx="3" ry="3"/> <line x1="22" y1="11" x2="22" y2="13"/> <rect class="battery-level" x="4" y="9" width="12" height="6" rx="1" fill="currentColor" stroke="none"/>`],
    ['btn-settings', 20, '', `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>`],
    ['btn-fullscreen', 20, 'fs-icon', `<path class="fs-top-left" d="M8 3H5a2 2 0 0 0-2 2v3"/><path class="fs-top-right" d="M16 3h3a2 2 0 0 1 2 2v3"/><path class="fs-bottom-left" d="M8 21H5a2 2 0 0 1-2-2v-3"/><path class="fs-bottom-right" d="M16 21h3a2 2 0 0 0 2-2v-3"/>`]].forEach(([id, size, cls, paths]) => $(id).innerHTML = UIManager.renderIcon(paths, cls, size));
    this.glassEls = {
      bevelBlur: $('glass-bevel-blur'),
      crestBlur: $('glass-crest-blur'),
      mwOff: $('glass-mw-off'), meOff: $('glass-me-off'), mnOff: $('glass-mn-off'), msOff: $('glass-ms-off'),
      cwOff: $('glass-cw-off'), ceOff: $('glass-ce-off'), cnOff: $('glass-cn-off'), csOff: $('glass-cs-off'),
      causticX: $('glass-caustic-x'), causticY: $('glass-caustic-y'),
      crestX: $('glass-crest-x'), crestY: $('glass-crest-y'),
      whisperX: $('glass-whisper-x'), whisperY: $('glass-whisper-y'),
      prismCX: $('glass-prism-c-x'), prismCY: $('glass-prism-c-y'),
      prismWX: $('glass-prism-w-x'), prismWY: $('glass-prism-w-y'),
      prismCFlood: $('glass-prism-c-flood'), prismWFlood: $('glass-prism-w-flood'),
      bodyFlood: $('glass-body-flood'), bevelFlood: $('glass-bevel-flood'),
      causticFlood: $('glass-caustic-flood'), whisperFlood: $('glass-whisper-flood'),
      crestFlood: $('glass-crest-flood'),
      hollowBlur: $('hollow-blur'), hollowFlood: $('hollow-flood')
    };
    this.renderPanel();
    this.syncUI(true);
    this.bindEvents();
    this.runPixelShift();
    this.wakeUp();
    this.requestWakeLock();
    window.dispatchEvent(new Event('resize'));
  }
  renderPanel() {
    const { lang } = this.store.getState(), d = UIManager.DICT[lang], I = this.activeTab;
    const row = (label, ctrl) => `<div class="settings-row"><span class="row-label">${label}</span>${ctrl}</div>`;
    const tg = (id, label) => row(label, `<input type="checkbox" id="${id}" class="toggle-switch">`);
    const seg = (label, prop, options, offset = 0) => { const isCol = options.length > 3; return `<div class="settings-row${isCol ? ' col-layout' : ''}"><span class="row-label">${label}</span><div class="segmented-control${isCol ? '' : ' inline-seg'}" data-prop="${prop}" role="radiogroup"><div class="segmented-highlight"></div>${options.map((t, i) => `<button class="segment-btn" data-value="${i + offset}">${t}</button>`).join('')}</div></div>`; };
    const mtg = (label, opts) => `<div class="settings-row"><span class="row-label">${label}</span><div class="mtg-control">${opts.map(o => `<button class="mtg-btn" data-prop="${o.p}">${o.l}</button>`).join('')}</div></div>`;
    const slider = (key, id) => { const s = UIManager.SLIDERS.find(s => s.key === key && (!id || s.id === id)); return `<div class="slider-row" aria-label="${d[key]}">${UIManager.renderIcon(s.svgMin, 'slider-icon min-icon')}<div class="range-container"><input type="range" id="${s.id}" min="${s.min}" max="${s.max}" step="${s.step}"></div>${UIManager.renderIcon(s.svgMax, 'slider-icon max-icon')}</div>`; };
    const langRow = row(d.lang, `<div class="segmented-control inline-seg" data-prop="lang" role="radiogroup" style="max-width:120px"><div class="segmented-highlight"></div><button class="segment-btn ${lang === 'en' ? 'active' : ''}" data-value="en">EN</button><button class="segment-btn ${lang === 'zh' ? 'active' : ''}" data-value="zh">中</button></div>`);
    const theme = row(d.theme, `<div class="swatches-container">${UIManager.THEMES.map(t => `<button class="swatch-wrapper" data-rgb="${t.rgb}" aria-label="${t.label}"><div class="swatch-color" style="background: linear-gradient(135deg, ${t.grad});"></div></button>`).join('')}<div class="swatch-wrapper" id="custom-swatch-wrapper" aria-label="Custom Color"><div class="swatch-color custom-swatch-color" id="custom-swatch-color"></div><input type="color" id="custom-color-input" value="#ffffff"></div></div>`);
    const tcKeys = ['textColor', 'ampmColor', 'dateColor', 'customTextColor'];
    const tcState = this.store.getState();
    const tcRow = row(d.tc, `<div class="tc-group">${tcKeys.map((k, idx) => `<label class="tc-chip"><span class="tc-dot" id="swatch-${k}" style="background:${tcState[k]}"></span><span class="tc-lbl">${d.tcItems[idx]}</span><input type="color" class="tc-input" id="ctrl-${k}" data-prop="${k}" value="${tcState[k]}" aria-label="${d.tc} ${d.tcItems[idx]}"></label>`).join('')}</div>`);
    const anchorRow = `<div class="settings-row anchor-row"><span class="row-label">${d.anchor}</span><div class="anchor-grid" data-prop="anchor" role="radiogroup">${[...Array(9)].map((_, i) => `<button class="anchor-btn" data-value="${i}" role="radio"></button>`).join('')}</div></div>`;
    const ctRow = `<div class="settings-row"><input type="text" id="ctrl-customtext" class="ct-input" maxlength="30" placeholder="${d.ctph}"></div>`;
    const tabs = [
      [[seg(d.font, 'fontStyle', ['SF Pro', 'New York', 'Mono']), tcRow, seg(d.mat, 'material', d.mats)], [slider('size'), slider('weight'), slider('opacity')], [tg('ctrl-24hr', d.time), tg('ctrl-leadingzero', d.lz), tg('ctrl-seconds', d.sec), seg(d.tick, 'clockAnimMode', d.ticks)], [tg('ctrl-date', d.date), mtg(d.df, [{l:d.dY,p:'showY'}, {l:d.dM,p:'showM'}, {l:d.dD,p:'showD'}, {l:d.dW,p:'showW'}]), seg(d.layout, 'clockLayout', d.layouts), seg(d.datePos, 'datePosition', d.datePositions)], [tg('ctrl-showcustom', d.sct), ctRow], [anchorRow, slider('offset', 'ctrl-offx'), slider('offset', 'ctrl-offy')]],
      [[seg(d.mode, 'mode', d.modes, 1), theme], [slider('speed')]],
      [[langRow, seg(d.idle, 'idleTimeout', d.idles)], [tg('ctrl-pixelshift', d.burn), tg('ctrl-nightmode', d.night)]]
    ];
    if (this._cp) this._cp.close();
    this.panel.innerHTML = `<div class="tab-header" role="tablist">${d.tabs.map((t, i) => `<button class="tab-nav-btn${i === I ? ' active' : ''}" data-tab="${i}" role="tab">${t}</button>`).join('')}</div><div class="tab-panes">${tabs.map((blocks, i) => `<div class="tab-pane${i === I ? ' active' : ''}">${blocks.map(b => `<div class="settings-block">${b.join('')}</div>`).join('')}</div>`).join('')}</div>`;
  }
  setTab(i) {
    if (this._cp) this._cp.close();
    const tp = qs(this.panel, '.tab-panes'); if (tp) tp.scrollTop = 0;
    this.activeTab = i;
    const state = this.store.getState();
    qsa(this.panel, '.tab-nav-btn').forEach((b, j) => b.classList.toggle('active', j === i));
    qsa(this.panel, '.tab-pane').forEach((p, j) => { p.classList.toggle('active', j === i); if (j === i) qsa(p, '.segmented-control').forEach(c => this.updateSegmentHighlight(c, state[c.dataset.prop], true)); });
  }
  runPixelShift() {
    const state = this.store.getState();
    clearInterval(this.pixelShiftTimer);
    if (state.pixelShift) this.pixelShiftTimer = setInterval(() => this.appContainer.style.transform = `translate(${(Math.random()-0.5)*12}px, ${(Math.random()-0.5)*12}px)`, 60000);
    else this.appContainer.style.transform = 'translate(0px, 0px)';
  }
  updateSliderFill(el) {
    el.style.setProperty('--val', `${((el.value - (el.min || 0)) / ((el.max || 100) - (el.min || 0))) * 100}%`);
  }
  showHUD(text) {
    this.hudToast.textContent = text;
    this.hudToast.classList.add('is-visible');
    clearTimeout(this.hudTimer);
    this.hudTimer = setTimeout(() => this.hudToast.classList.remove('is-visible'), 2000);
  }
  updateSegmentHighlight(container, val, skipAnim = false) {
    const btn = Array.from(qsa(container, '.segment-btn')).find(b => isNaN(b.dataset.value) ? b.dataset.value === val : Number(b.dataset.value) === Number(val));
    if (btn) {
      qsa(container, '.segment-btn').forEach(b => b.classList.toggle('active', b === btn));
      const highlight = qs(container, '.segmented-highlight');
      if (skipAnim) highlight.style.transition = 'none';
      highlight.style.width = `${btn.offsetWidth}px`; highlight.style.transform = `translateX(${btn.offsetLeft}px)`;
      if (skipAnim) requestAnimationFrame(() => requestAnimationFrame(() => highlight.style.transition = ''));
    }
  }
  applyVisualVars(full = false) {
    const { fontStyle, nightMode, textColor, ampmColor, dateColor, customTextColor, material, clockOpacity: op, size, colorTarget } = this.store.getState();
    const root = document.documentElement, sp = (k, v) => root.style.setProperty(k, v);
    const rgba = (hex, a) => `rgba(${UIManager.hexToRgb(hex).map(x => Math.round(x * 255)).join(', ')}, ${a})`;
    const nightCol = `rgba(110, 63, 32, ${op})`;
    sp('--clock-font', UIManager.FONTS[fontStyle]);
    sp('--ampm-color', nightMode ? nightCol : rgba(ampmColor, op));
    sp('--date-color', nightMode ? nightCol : rgba(dateColor, op));
    sp('--custom-text-color', nightMode ? nightCol : rgba(customTextColor, op));
    sp('--clock-shadow-color', nightMode ? 'transparent' : `rgba(255, 255, 255, ${0.2 * op})`);
    const [r, g, b] = nightMode ? [217, 119, 54] : UIManager.hexToRgb(textColor).map(x => Math.round(x * 255));
    const cColor = `rgba(${r}, ${g}, ${b}, ${op})`;
    let fill = cColor, stroke = '0', blend = 'normal', digitFilter = 'none', filter = 'drop-shadow(0 8px 16px rgba(0,0,0,.5)) drop-shadow(0 0 4px var(--clock-shadow-color))';
    if (material === 1) {
      fill = `rgb(${r}, ${g}, ${b})`;
      stroke = '0';
      digitFilter = 'url(#hollow-fx)';
      const hb = this.glassEls && this.glassEls.hollowBlur, hf = this.glassEls && this.glassEls.hollowFlood;
      if (hb) hb.setAttribute('stdDeviation', Math.max(1.0, size * 0.095).toFixed(2));
      if (hf) {
        hf.setAttribute('flood-color', `rgb(${r}, ${g}, ${b})`);
        hf.setAttribute('flood-opacity', String(op));
      }
    } else if (material === 2) {
      const [rc, gc, bc] = [r, g, b].map(c => Math.round(c + (255 - c) * 0.38));
      fill = `rgba(${rc}, ${gc}, ${bc}, ${op})`;
      stroke = `max(1px, 0.015em) rgba(${r}, ${g}, ${b}, ${(0.9 * op).toFixed(2)})`;
      blend = 'screen';
      filter = `drop-shadow(0 0 2px rgba(255, 255, 255, ${(0.65 * op).toFixed(2)})) drop-shadow(0 0 6px rgba(${r}, ${g}, ${b}, ${(0.95 * op).toFixed(2)})) drop-shadow(0 0 16px rgba(${r}, ${g}, ${b}, ${(0.75 * op).toFixed(2)})) drop-shadow(0 0 34px rgba(${r}, ${g}, ${b}, ${(0.45 * op).toFixed(2)}))`;
    } else if (material === 3) {
      const maxC = Math.max(colorTarget[0], colorTarget[1], colorTarget[2], 0.01);
      const [ar, ag, ab] = nightMode ? [217, 119, 54] : colorTarget.map(v => Math.round(clamp((v / maxC) * 195 + 60, 0, 255)));
      const [gr, gg, gb] = nightMode ? [217, 119, 54] : [Math.round(r * 0.45 + ar * 0.55), Math.round(g * 0.45 + ag * 0.55), Math.round(b * 0.45 + ab * 0.55)];
      const [sr, sg, sb] = nightMode ? [242, 168, 110] : [gr, gg, gb].map(c => Math.round(c + (255 - c) * 0.65));
      const [cr, cg, cb] = nightMode ? [255, 210, 165] : [r, g, b].map(c => Math.round(c + (255 - c) * 0.92));
      fill = `rgb(${gr}, ${gg}, ${gb})`;
      stroke = '0';
      digitFilter = 'none';
      filter = `url(#glass-fx) drop-shadow(0 5px 10px rgba(0, 0, 0, ${(0.24 * op).toFixed(2)}))`;
      const ge = this.glassEls;
      if (ge && ge.bodyFlood) {
        const setFlood = (el, col, a) => { el.setAttribute('flood-color', col); el.setAttribute('flood-opacity', (a * op).toFixed(3)); };
        const reduceTrans = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
        setFlood(ge.bodyFlood, `rgb(${ar}, ${ag}, ${ab})`, reduceTrans ? 0.28 : 0.04 + this.glassPress * 0.06);
        setFlood(ge.bevelFlood, `rgb(${gr}, ${gg}, ${gb})`, reduceTrans ? 0.36 : 0.17 + this.glassPress * 0.08);
        setFlood(ge.causticFlood, `rgb(${sr}, ${sg}, ${sb})`, 0.36 + this.glassPress * 0.16);
        setFlood(ge.whisperFlood, `rgb(${ar}, ${ag}, ${ab})`, 0.28);
        setFlood(ge.crestFlood, `rgb(${cr}, ${cg}, ${cb})`, 0.95);
        setFlood(ge.prismCFlood, '#38e8ff', nightMode ? 0 : 0.38);
        setFlood(ge.prismWFlood, '#ff6ee0', nightMode ? 0 : 0.34);
        if (this._glassStaticSize !== size) {
          this._glassStaticSize = size;
          ge.bevelBlur.setAttribute('stdDeviation', Math.min(2.0, Math.max(1.3, size * 0.14)).toFixed(2));
          ge.crestBlur.setAttribute('stdDeviation', Math.min(0.4, Math.max(0.32, size * 0.024)).toFixed(2));
          const mDist = String(Math.min(3, Math.max(1, Math.round(size * 0.12))));
          ge.mwOff.setAttribute('dx', mDist); ge.meOff.setAttribute('dx', '-' + mDist);
          ge.mnOff.setAttribute('dy', mDist); ge.msOff.setAttribute('dy', '-' + mDist);
          const cDist = String(Math.min(2, Math.max(1, Math.round(size * 0.045))));
          ge.cwOff.setAttribute('dx', cDist); ge.ceOff.setAttribute('dx', '-' + cDist);
          ge.cnOff.setAttribute('dy', cDist); ge.csOff.setAttribute('dy', '-' + cDist);
        }
      }
      if (this._lastMat !== 3 || full) this._lastGlassDom = 0;
      this.updateGlassVectors(true);
      this.startGlassLoop();
    }
    this._lastMat = material;
    if (material !== 3) {
      this.stopGlassLoop();
      sp('--glass-press', '1');
    }
    sp('--clock-color', cColor);
    sp('--clock-fill', fill);
    sp('--clock-stroke', stroke);
    sp('--clock-blend', blend);
    sp('--digit-filter', digitFilter);
    sp('--clock-filter', filter);
    const clk = this.clockEl;
    if (!full && clk) {
      clk.style.opacity = 0.99;
      clearTimeout(this.rp);
      this.rp = setTimeout(() => clk.style.opacity = '', 50);
    }
  }
  tryRequestGyro() {
    if (this.gyroAsked || this.gyroPending) return;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      this.gyroPending = true;
      DeviceOrientationEvent.requestPermission().then(res => {
        this.gyroAsked = true;
        if (res === 'granted') on(window, 'deviceorientation', e => this.handleGyro(e), { passive: true });
      }).catch(() => {}).finally(() => { this.gyroPending = false; });
    } else {
      this.gyroAsked = true;
    }
  }
  handleGyro(e) {
    if (e.gamma === null || e.beta === null || this.store.getState().material !== 3) return;
    this.hasGyro = true;
    this.gyroX = clamp(e.gamma / 35, -1, 1);
    this.gyroY = clamp((e.beta - 45) / 35, -1, 1);
  }
  startGlassLoop() {
    if (this.glassRaf || document.hidden || this.store.getState().material !== 3) return;
    this._lastGlassDom = 0;
    this.updateGlassVectors(true);
    this.lastGlassTick = performance.now();
    this.glassRaf = requestAnimationFrame(this.tickGlassBound);
  }
  stopGlassLoop() {
    if (this.glassRaf) {
      cancelAnimationFrame(this.glassRaf);
      this.glassRaf = null;
    }
  }
  updateGlassVectors(force = false) {
    const g = this.glassEls;
    if (!g || !g.crestX) return;
    const { clockOpacity: op, nightMode } = this.store.getState();
    const p = this.glassPress;
    const comp = 1 - p * 0.35;
    const nx = Math.cos(this.lAngle), ny = Math.sin(this.lAngle);
    const strength = clamp(this.lMag, 0.55, 1.15) * comp;
    const ux = nx * strength, uy = ny * strength;
    const q = v => (Math.round(v * 50) / 50).toFixed(2);
    const kx = q(ux), ky = q(uy), kp = p.toFixed(2);
    if (!force && this._lastKx === kx && this._lastKy === ky && this._lastKp === kp) return;
    this._lastKx = kx; this._lastKy = ky; this._lastKp = kp;
    const kc = this._kCache;
    const setK = (name, el, k2, k3) => {
      const a = Math.max(0, k2).toFixed(2), b = Math.max(0, k3).toFixed(2), s = a + '|' + b;
      if (!force && kc[name] === s) return;
      kc[name] = s;
      el.setAttribute('k2', a);
      el.setAttribute('k3', b);
    };
    setK('crestX', g.crestX, ux + 0.08, -ux + 0.08);
    setK('crestY', g.crestY, uy + 0.08, -uy + 0.08);
    setK('whisperX', g.whisperX, -ux * 0.62, ux * 0.62);
    setK('whisperY', g.whisperY, -uy * 0.62, uy * 0.62);
    const cStr = 0.95 * (1 - p * 0.18);
    setK('causticX', g.causticX, -ux * cStr, ux * cStr);
    setK('causticY', g.causticY, -uy * cStr, uy * cStr);
    const cx = nx * 0.82 - ny * 0.57, cy = ny * 0.82 + nx * 0.57;
    const wx = nx * 0.82 + ny * 0.57, wy = ny * 0.82 - nx * 0.57;
    setK('prismCX', g.prismCX, cx * strength, -cx * strength);
    setK('prismCY', g.prismCY, -cy * strength, cy * strength);
    setK('prismWX', g.prismWX, -wx * strength, wx * strength);
    setK('prismWY', g.prismWY, wy * strength, -wy * strength);
    if (force || Math.abs((this._lastOpP ?? -1) - p) > 0.002) {
      this._lastOpP = p;
      const reduceTrans = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
      if (!reduceTrans) {
        g.bodyFlood.setAttribute('flood-opacity', ((0.04 + p * 0.06) * op).toFixed(3));
        g.bevelFlood.setAttribute('flood-opacity', ((0.17 + p * 0.08) * op).toFixed(3));
        g.causticFlood.setAttribute('flood-opacity', ((0.36 + p * 0.16) * op).toFixed(3));
      }
      if (!nightMode) {
        g.prismCFlood.setAttribute('flood-opacity', ((0.38 + p * 0.12) * op).toFixed(3));
        g.prismWFlood.setAttribute('flood-opacity', ((0.34 + p * 0.12) * op).toFixed(3));
      }
      document.documentElement.style.setProperty('--glass-press', (1 - p * 0.032).toFixed(4));
    }
  }
  tickGlass(now) {
    this.glassRaf = null;
    const { material, isHolding, isIdle, speed, lowPower } = this.store.getState();
    if (material !== 3 || document.hidden) return;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fdt = clamp(now - this.lastGlassTick, 1, 64);
    this.lastGlassTick = now;
    const pTarget = isHolding ? 1 : 0;
    const kP = 1 - Math.pow(1 - (isHolding ? 0.08 : 0.26), fdt / 16.666);
    this.glassPress += (pTarget - this.glassPress) * kP;
    if (Math.abs(pTarget - this.glassPress) < 0.001) this.glassPress = pTarget;
    if (calm) {
      this.lAngle = Math.atan2(0.75, 0.65); this.lMag = Math.hypot(0.65, 0.75);
      this.updateGlassVectors(false);
      if (this.glassPress !== pTarget) this.glassRaf = requestAnimationFrame(this.tickGlassBound);
      return;
    }
    const ptrActive = now < this.ptrActiveUntil ? 1 : 0;
    const active = ptrActive === 1 || this.ptrW > 0.01 || isHolding || this.glassPress > 0.002;
    const minStep = active ? 36 : (isIdle ? 240 : lowPower ? 240 : 110);
    const flipping = this.clockLayerObj && this.clockLayerObj.classList.contains('is-flipping');
    if (flipping || now - (this._lastGlassDom || 0) < minStep) {
      this.glassRaf = requestAnimationFrame(this.tickGlassBound);
      return;
    }
    const dt = clamp((now - (this._lastGlassDom || now - minStep)) * 0.001, 0.016, 0.3);
    this._lastGlassDom = now;
    const t = now * 0.00018 * clamp(speed, 0.2, 2.5);
    const driftX = Math.cos(t) * 0.64 + Math.sin(t * 0.43) * 0.22 + 0.16;
    const driftY = Math.sin(t * 0.71) * 0.64 + Math.cos(t * 0.37) * 0.22 + 0.18;
    const ambX = this.hasGyro ? clamp(driftX * 0.35 + (-this.gyroX) * 0.85, -1.15, 1.15) : driftX;
    const ambY = this.hasGyro ? clamp(driftY * 0.35 + (-this.gyroY) * 0.85, -1.15, 1.15) : driftY;
    const kW = 1 - Math.exp(-dt * (ptrActive ? 12 : 2.8));
    this.ptrW += (ptrActive - this.ptrW) * kW;
    if (this.ptrW < 0.001 && !ptrActive) this.ptrW = 0;
    const w = this.ptrW;
    const tx = ambX * (1 - w) + (-this.ptrX * 1.05) * w;
    const ty = ambY * (1 - w) + (-this.ptrY * 1.05) * w;
    const rawMag = Math.hypot(tx, ty);
    const tAngle = rawMag > 0.02 ? Math.atan2(ty, tx) : this.lAngle;
    const tMag = clamp(rawMag, 0.62, 1.15);
    const dAngle = Math.atan2(Math.sin(tAngle - this.lAngle), Math.cos(tAngle - this.lAngle));
    const kL = 1 - Math.exp(-dt * (active ? 10 : 3.2));
    const maxStep = (active ? 8.5 : 2.2) * dt;
    const stepA = clamp(dAngle * kL, -maxStep, maxStep);
    this.lAngle = Math.atan2(Math.sin(this.lAngle + stepA), Math.cos(this.lAngle + stepA));
    this.lMag += (tMag - this.lMag) * kL;
    this.updateGlassVectors(false);
    this.glassRaf = requestAnimationFrame(this.tickGlassBound);
  }
  syncUI(skipAnim = false, changedKey = null) {
    const state = this.store.getState(), { lowPower, colorTarget, anchor, offsetX, offsetY } = state;
    const root = document.documentElement, sp = (k, v) => root.style.setProperty(k, v);
    const full = changedKey === null;
    if (!full && !skipAnim && (changedKey === 'material' || changedKey === 'fontStyle')) {
      const targetEl = changedKey === 'fontStyle' ? this.clockWrapperEl : this.clockEl;
      if (this.typoAnim) { this.typoAnim.cancel(); this.typoAnim = null; }
      if (targetEl) {
        const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, ease = EASE_OUT;
        const outAnim = this.typoAnim = targetEl.animate(
          calm ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.96)' }],
          { duration: 120, easing: ease, fill: 'forwards' }
        );
        outAnim.onfinish = () => {
          if (this.typoAnim !== outAnim) return;
          this.applyVisualVars(false);
          window.dispatchEvent(new Event('resize'));
          const inAnim = this.typoAnim = targetEl.animate(
            calm ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'scale(1.03)' }, { opacity: 1, transform: 'scale(1)' }],
            { duration: 240, easing: ease }
          );
          outAnim.cancel();
          inAnim.onfinish = inAnim.oncancel = () => { if (this.typoAnim === inAnim) this.typoAnim = null; };
        };
      } else this.applyVisualVars(false);
    } else if (full || skipAnim || ['nightMode', 'textColor', 'ampmColor', 'dateColor', 'customTextColor', 'clockOpacity', 'size', 'colorTarget'].includes(changedKey)) {
      this.applyVisualVars(full);
    }
    if (full || changedKey === 'anchor') { const ax = anchor % 3, ay = Math.floor(anchor / 3), F = ['flex-start', 'center', 'flex-end'], O = ['4vmin', '50%', 'calc(100% - 4vmin)']; sp('--pos-x', F[ax]); sp('--pos-y', F[ay]); sp('--ox', O[ax]); sp('--oy', O[ay]); qsa(document, '.anchor-btn').forEach((b, i) => b.classList.toggle('active', i === anchor)); }
    if (full || ['showY', 'showM', 'showD', 'showW'].includes(changedKey)) qsa(document, '.mtg-btn').forEach(b => b.classList.toggle('active', state[b.dataset.prop]));
    if (full || changedKey === 'offsetX') sp('--off-x', `${offsetX}vw`);
    if (full || changedKey === 'offsetY') sp('--off-y', `${offsetY}vh`);
    ['textColor', 'ampmColor', 'dateColor', 'customTextColor'].forEach(k => {
      if (full || changedKey === k) {
        const inp = $(`ctrl-${k}`), dot = $(`swatch-${k}`);
        if (inp) inp.value = state[k];
        if (dot) dot.style.background = state[k];
      }
    });
    if (full || changedKey === 'pixelShift') this.runPixelShift();
    if (full || changedKey === 'lowPower') {
      const btnLowpower = this.btnLowpower;
      if (btnLowpower) btnLowpower.classList.toggle('is-active', lowPower);
    }
    const bindings = UIManager.UI_BINDINGS;
    const bindKeys = full ? Object.keys(bindings) : (bindings[changedKey] ? [changedKey] : []);
    bindKeys.forEach(k => {
      const b = bindings[k];
      const el = $(b.id);
      if (el) {
        if (String(el[b.prop]) !== String(state[k])) el[b.prop] = state[k];
        if (b.cssVar) sp(b.cssVar, b.format ? b.format(state[k]) : state[k]);
        if (el.type === 'range') this.updateSliderFill(el);
      }
    });
    if (full) {
      qsa(document, '.segmented-control').forEach(c => { const val = state[c.dataset.prop]; if (val !== undefined) requestAnimationFrame(() => this.updateSegmentHighlight(c, val, skipAnim)); });
    } else {
      const c = qs(document, `.segmented-control[data-prop="${changedKey}"]`);
      const val = state[changedKey];
      if (c && val !== undefined) requestAnimationFrame(() => this.updateSegmentHighlight(c, val, skipAnim));
    }
    if (full || changedKey === 'colorTarget') {
      qsa(document, '.swatches-container .swatch-wrapper').forEach(s => s.classList.remove('active'));
      const activeSwatch = qs(document, `.swatch-wrapper[data-rgb="${colorTarget.join(',')}"]`), customEl = $('custom-swatch-color');
      if (activeSwatch) { activeSwatch.classList.add('active'); customEl.style.background = ''; customEl.classList.remove('has-color'); }
      else { $('custom-swatch-wrapper').classList.add('active');$('custom-color-input').value = UIManager.rgbToHex(...colorTarget); customEl.style.background = UIManager.rgbToHex(...colorTarget); customEl.classList.add('has-color'); }
    }
    if (this._cp) this._cp.refresh(changedKey);
  }
  scheduleIdle() {
    const state = this.store.getState();
    clearTimeout(this.idleTimer);
    if (state.idleTimeout !== 2) {
      this.idleTimer = setTimeout(() => this.setIdle(), state.idleTimeout === 0 ? 3000 : 10000);
    }
  }
  wakeUp() {
    const now = Date.now();
    if (now - this.lastWake < 150) return;
    this.lastWake = now;
    document.body.classList.remove('is-idle');
    this.store.setState('isIdle', false);
    this.scheduleIdle();
  }
  setIdle() {
    if(!document.body.classList.contains('is-idle')) {
      document.body.classList.add('is-idle');
      this.store.setState('isIdle', true);
      this.panel.classList.remove('active');
      this.store.setState('isPanelOpen', false);
      if (document.activeElement) document.activeElement.blur();
    }
  }
  static renderIcon(paths, cls = '', size = 0) {
    return `<svg${cls ? ` class="${cls}"` : ''}${size ? ` width="${size}" height="${size}"` : ''} viewBox="0 0 24 24"${size ? ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : ''}>${paths}</svg>`;
  }
  clearExitSequence() {
    clearTimeout(this.holdTimeout); this.holdTimeout = null;
    clearTimeout(this.exitCloseTimer); this.exitCloseTimer = null;
    clearTimeout(this.exitRecoverTimer); this.exitRecoverTimer = null;
    document.body.classList.remove('disconnected');
  }
  recoverFromExit() {
    this.clearExitSequence();
    this.bgLayer.classList.remove('exiting');
    this.clockLayerObj.classList.remove('exiting');
    this.store.setState('isHolding', false);
  }
  exitApp(isStarting) {
    const state = this.store.getState();
    if (state.isHolding === isStarting) return;
    if (isStarting) this.clearExitSequence();
    this.store.setState('isHolding', isStarting);
    this.bgLayer.classList.toggle('exiting', isStarting);
    this.clockLayerObj.classList.toggle('exiting', isStarting);
    if (isStarting) {
      haptic(15);
      this.holdTimeout = setTimeout(() => {
        this.holdTimeout = null;
        this.store.setState('isHolding', false);
        haptic([30, 50, 30]);
        document.body.classList.add('disconnected');
        this.exitCloseTimer = setTimeout(() => {
          this.exitCloseTimer = null;
          try { window.close(); } catch (err) {}
          this.exitRecoverTimer = setTimeout(() => this.recoverFromExit(), 300);
        }, 800);
      }, 2000);
    } else {
      haptic(10);
      clearTimeout(this.holdTimeout);
      this.holdTimeout = null;
    }
    if (this.store.getState().material === 3) this.startGlassLoop();
  }
  async requestWakeLock() {
    if (this.wakeLock || this.wakeLockPending) return;
    if (!('wakeLock' in navigator) || document.hidden) return;
    this.wakeLockPending = true;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (document.hidden) { sentinel.release().catch(() => {}); return; }
      this.wakeLock = sentinel;
      on(sentinel, 'release', () => { if (this.wakeLock === sentinel) this.wakeLock = null; });
    } catch(e){} finally {
      this.wakeLockPending = false;
    }
  }
  releaseWakeLock() {
    if (this.wakeLock) {
      this.wakeLock.release().catch(()=>{});
      this.wakeLock = null;
    }
  }
  bindEvents() {
    let lastHap = 0, anchorHold = null, holdFired = false, anchorX = 0, anchorY = 0;
    const cp = this._cp = createColorPicker(this);
    const clearAnchorHold = () => { if (anchorHold) { clearTimeout(anchorHold); anchorHold = null; } };
    const trackGlassPtr = e => {
      this.ptrX = clamp((e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2, -1, 1);
      this.ptrY = clamp((e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2, -1, 1);
      this.ptrActiveUntil = performance.now() + 900;
    };
    on(document, 'pointerdown', e => {
      if (this.store.getState().material === 3) { trackGlassPtr(e); this.tryRequestGyro(); }
      if (e.target.type === 'range') document.body.classList.add('is-dragging');
      const tg = e.target.closest('.toggle-switch');
      if (tg) { this.tgStart = e.clientX; this.tgTarget = tg; this.tgDragged = false; }
      const btn = e.target.closest('.anchor-btn');
      if (btn) {
        clearAnchorHold(); holdFired = false;
        anchorX = e.clientX; anchorY = e.clientY;
        anchorHold = setTimeout(() => {
          holdFired = true; anchorHold = null; haptic([30, 50]);
          this.store.setState('offsetX', 0); this.store.setState('offsetY', 0);
          if (this.store.getState().anchor !== +btn.dataset.value) this.store.setState('anchor', +btn.dataset.value);
        }, 500);
      } else if (e.button === 0 && !e.target.closest('button, .settings-panel, .swatch-wrapper, input, .anchor-grid, .tc-group')) { this.touchStartX = e.clientX; this.touchStartY = e.clientY; this.exitApp(true); }
    }, { passive: true });
    on(document, 'pointermove', e => {
      if (anchorHold && (Math.abs(e.clientX - anchorX) > 12 || Math.abs(e.clientY - anchorY) > 12)) clearAnchorHold();
      const state = this.store.getState();
      if (state.isHolding && this.touchStartX !== null && (Math.abs(e.clientX - this.touchStartX) > 15 || Math.abs(e.clientY - this.touchStartY) > 15)) this.exitApp(false);
      if (state.material === 3) trackGlassPtr(e);
      if (this.tgTarget && this.tgStart !== null) {
        const dx = e.clientX - this.tgStart;
        if (Math.abs(dx) > 8) {
          this.tgDragged = true;
          const checkedState = dx > 0;
          if (this.tgTarget.checked !== checkedState) { this.tgTarget.checked = checkedState; this.tgTarget.dispatchEvent(new Event('change', { bubbles: true })); }
        }
      }
    }, { passive: true });
    const endPointer = () => {
      clearAnchorHold();
      this.exitApp(false);
      document.body.classList.remove('is-dragging');
      this.tgStart = null;
      setTimeout(() => this.tgTarget = null, 0);
    };
    ['pointerup', 'pointercancel'].forEach(t => on(document, t, endPointer, { passive: true }));
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      on(window, 'deviceorientation', e => this.handleGyro(e), { passive: true });
    }
    on(document, 'contextmenu', e => {
      if (e.target.closest('.anchor-grid, .icon-btn') || this.store.getState().isHolding) e.preventDefault();
    });
    on(document, 'input', e => {
      if (e.target.type === 'range') { document.body.classList.add('is-dragging'); const t = e.target, v = t.value, isEdge = v === t.min || v === t.max, now = Date.now(); if (isEdge || now - lastHap > 40) { haptic(isEdge ? 20 : 5); lastHap = now; } }
      const entry = UIManager.BINDING_BY_ID[e.target.id];
      if (entry && e.target.type !== 'checkbox') { this.store.setState(entry[0], e.target.type === 'text' ? e.target.value : parseFloat(e.target.value)); }
      else if (e.target.classList.contains('tc-input')) this.store.setState(e.target.dataset.prop, e.target.value);
      else if (e.target.id === 'custom-color-input') { this.store.setState('colorTarget', UIManager.hexToRgb(e.target.value)); }
    });
    on(document, 'change', e => {
      if (e.target.classList.contains('tc-input')) haptic(10);
      if (e.target.type === 'checkbox') { haptic(10); const entry = UIManager.BINDING_BY_ID[e.target.id]; if (entry) this.store.setState(entry[0], e.target.checked); }
    });
    on(document, 'click', e => { if (e.target.closest('.toggle-switch') && this.tgDragged) { e.preventDefault(); e.stopPropagation(); } }, { capture: true });
    on(document, 'click', e => {
      const t = e.target;
      const isBg = t.id === 'custom-color-input', isTc = !!(t.classList && t.classList.contains('tc-input'));
      if (!isBg && !isTc) return;
      e.preventDefault();
      cp.toggle(isBg ? 'colorTarget' : t.dataset.prop, t);
    }, { capture: true });
    on(document, 'pointerdown', e => {
      if (!cp.isOpen()) return;
      const t = e.target;
      if (cp.el.contains(t) || (t.classList && (t.classList.contains('tc-input') || t.id === 'custom-color-input'))) return;
      cp.close();
    }, { passive: true });
    on(document, 'keydown', e => { if (e.key === 'Escape' && cp.isOpen()) cp.close(); });
    this.store.subscribe((key, val) => { if (key === 'isPanelOpen' && !val) cp.close(); });
    on(window, 'resize', () => cp.reposition());
    on(document, 'click', e => {
      const state = this.store.getState();
      const segBtn = e.target.closest('.segment-btn'), swatch = e.target.closest('.swatch-wrapper[data-rgb]'), tabBtn = e.target.closest('.tab-nav-btn'), anchorBtn = e.target.closest('.anchor-btn'), mtgBtn = e.target.closest('.mtg-btn');
      if (e.target.closest('.icon-btn')) haptic(15);
      if (tabBtn) { const i = +tabBtn.dataset.tab; if (i !== this.activeTab) { haptic(10); this.setTab(i); } }
      else if (mtgBtn) { haptic(10); const p = mtgBtn.dataset.prop; this.store.setState(p, !this.store.getState()[p]); }
      else if (anchorBtn) { if (!holdFired && !anchorBtn.classList.contains('active')) { haptic(10); this.store.setState('anchor', +anchorBtn.dataset.value); } holdFired = false; }
      else if (segBtn && !segBtn.classList.contains('active')) {
        if (segBtn.closest('.segmented-control').dataset.prop === 'material' && +segBtn.dataset.value === 3) this.tryRequestGyro();
        haptic(10); this.store.setState(segBtn.closest('.segmented-control').dataset.prop, isNaN(segBtn.dataset.value) ? segBtn.dataset.value : parseInt(segBtn.dataset.value));
      } else if (swatch) { haptic(10); this.store.setState('colorTarget', swatch.dataset.rgb.split(',').map(Number)); }
      else if (e.target.closest('#btn-lowpower')) {
        const newState = !state.lowPower; this.store.setState('lowPower', newState); this.showHUD(newState ? UIManager.DICT[state.lang].lpOn : UIManager.DICT[state.lang].lpOff);
      } else if (e.target.closest('#btn-settings')) {
        this.panel.classList.toggle('active');
        this.store.setState('isPanelOpen', this.panel.classList.contains('active'));
      }
      else if (e.target.closest('#btn-fullscreen')) { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); else if (document.exitFullscreen) document.exitFullscreen(); }
      else if (!e.target.closest('.settings-panel') && !e.target.closest('#custom-color-input') && this.panel.classList.contains('active')) {
        this.panel.classList.remove('active');
        this.store.setState('isPanelOpen', false);
      }
      this.wakeUp();
      this.requestWakeLock();
    });
    on(window, 'resize', () => {
      document.body.classList.toggle('is-fullscreen', (window.innerHeight >= window.screen.height - 1) || !!document.fullscreenElement);
      this.wakeUp();
    });
    on(document, 'fullscreenchange', () => window.dispatchEvent(new Event('resize')));
    ['mousemove', 'pointermove', 'touchstart', 'keydown'].forEach(evt => on(window, evt, () => this.wakeUp(), { passive: true }));
    on(document, 'keydown', e => { if (e.target.tagName !== 'INPUT' && (e.code === 'Space' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) { this.touchStartX = null; this.exitApp(true); } } });
    on(document, 'keyup', e => { if (e.code === 'Space' || e.key === ' ') this.exitApp(false); }); on(window, 'blur', () => this.exitApp(false));
  }
}
AA.UIManager = UIManager;
})(window.AA);
