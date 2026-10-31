(function (AA) {
const { qs, on, clamp } = AA.util;
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
  el.innerHTML = `<div class="cp-head"><span class="cp-preview"></span><input type="text" class="cp-hex" maxlength="7" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" enterkeyhint="done" aria-label="Hex color"><button type="button" class="cp-close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="cp-sv-pad" role="slider" tabindex="0" aria-label="Saturation and brightness" aria-valuemin="0" aria-valuemax="100"><div class="cp-sv-thumb"></div></div><div class="cp-hue-track" role="slider" tabindex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax="360"><div class="cp-hue-thumb"></div></div><div class="cp-presets">${CP_PRESETS.map(c => `<button type="button" class="cp-preset" data-hex="${c}" aria-label="${c.toUpperCase()}" aria-pressed="false" style="--c:${c}"></button>`).join('')}</div>`;
  ui.panel.parentElement.appendChild(el);
  const hexIn = qs(el, '.cp-hex'), pad = qs(el, '.cp-sv-pad'), svThumb = qs(el, '.cp-sv-thumb'), track = qs(el, '.cp-hue-track'), hueThumb = qs(el, '.cp-hue-thumb');
  const presetBtns = Array.from(qsa(el, '.cp-preset'));
  let isOpen = false, prop = null, anchorEl = null, lastTrigger = null, h = 0, s = 0, v = 1, hex = '#000000', lastEmit = '', raf = null, dirty = false;
  const readHex = p => {
    const st = ui.store.getState();
    if (p === 'colorTarget') { const c = st.colorTarget; return AA.UIManager.rgbToHex(c[0], c[1], c[2]); }
    const val = st[p];
    return (typeof val === 'string' && /^#[0-9a-f]{6}$/i.test(val)) ? val.toLowerCase() : '#ffffff';
  };
  const paint = () => {
    hex = AA.UIManager.rgbToHex(...hsvToRgb(h, s, v));
    el.style.setProperty('--cp-h', h.toFixed(1));
    el.style.setProperty('--cp-cur', hex);
    svThumb.style.left = `${s * 100}%`;
    svThumb.style.top = `${(1 - v) * 100}%`;
    hueThumb.style.left = `${h / 360 * 100}%`;
    pad.setAttribute('aria-valuenow', String(Math.round(s * 100)));
    pad.setAttribute('aria-valuetext', `Saturation ${Math.round(s * 100)}%, Brightness ${Math.round(v * 100)}%`);
    track.setAttribute('aria-valuenow', String(Math.round(h)));
    if (document.activeElement !== hexIn) hexIn.value = hex.toUpperCase();
    presetBtns.forEach(b => {
      const act = b.dataset.hex === hex;
      b.classList.toggle('is-active', act);
      b.setAttribute('aria-pressed', act ? 'true' : 'false');
    });
  };
  const setFromHex = p => {
    const [nh, ns, nv] = rgbToHsv(...AA.UIManager.hexToRgb(p));
    if (ns > 0 && nv > 0) h = nh;
    s = ns; v = nv;
    paint();
  };
  const emit = () => {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    dirty = false;
    if (!isOpen || !prop || hex === lastEmit) return;
    lastEmit = hex;
    if (prop === 'colorTarget') ui.store.setState('colorTarget', AA.UIManager.hexToRgb(hex));
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
    const narrow = window.matchMedia('(max-width: 600px)').matches || !anchorEl;
    const tr = narrow ? null : anchorEl.getBoundingClientRect();
    let x, y;
    if (narrow) {
      x = pl + (pw - W) / 2;
      y = pt + ph - H - 12;
    } else {
      x = tr.left - hr.left + tr.width / 2 - W / 2;
      y = tr.bottom - hr.top + 8;
      if (y + H > pt + ph - m) y = tr.top - hr.top - H - 8;
    }
    const fx = Math.round(clamp(x, pl + m, Math.max(pl + m, pl + pw - W - m)));
    const fy = Math.round(clamp(y, pt + m, Math.max(pt + m, pt + ph - H - m)));
    el.style.left = `${fx}px`;
    el.style.top = `${fy}px`;
    if (narrow) el.style.transformOrigin = '';
    else el.style.transformOrigin = `${clamp(tr.left + tr.width / 2 - hr.left - fx, 0, W)}px ${clamp(tr.top + tr.height / 2 - hr.top - fy, 0, H)}px`;
  };
  const bindDrag = (node, update) => {
    let pid = null, rect = null;
    on(node, 'pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (pid !== null) return;
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
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => on(node, t, end));
    on(node, 'contextmenu', e => e.preventDefault());
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
  on(pad, 'keydown', e => {
    const st = e.shiftKey ? 0.1 : 0.01;
    if (e.key === 'ArrowLeft') s = clamp(s - st, 0, 1);
    else if (e.key === 'ArrowRight') s = clamp(s + st, 0, 1);
    else if (e.key === 'ArrowUp') v = clamp(v + st, 0, 1);
    else if (e.key === 'ArrowDown') v = clamp(v - st, 0, 1);
    else return;
    e.preventDefault();
    paint();
    emit();
  });
  on(track, 'keydown', e => {
    const st = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') h = clamp(h - st, 0, 360);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') h = clamp(h + st, 0, 360);
    else if (e.key === 'PageDown') h = clamp(h - 30, 0, 360);
    else if (e.key === 'PageUp') h = clamp(h + 30, 0, 360);
    else if (e.key === 'Home') h = 0;
    else if (e.key === 'End') h = 360;
    else return;
    e.preventDefault();
    paint();
    emit();
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
  const setExpanded = (node, flag) => {
    if (!node || !node.setAttribute) return;
    node.setAttribute('aria-haspopup', 'dialog');
    node.setAttribute('aria-expanded', flag ? 'true' : 'false');
  };
  const api = {
    el,
    isOpen: () => isOpen,
    open(p, trigger, viaKeyboard) {
      if (!CP_TARGETS.includes(p)) return;
      if (isOpen && dirty) emit();
      if (lastTrigger && lastTrigger !== trigger) setExpanded(lastTrigger, false);
      prop = p;
      lastTrigger = trigger || null;
      setExpanded(lastTrigger, true);
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
      if (viaKeyboard) { hexIn.focus({ preventScroll: true }); hexIn.select(); }
    },
    toggle(p, trigger, viaKeyboard) {
      if (isOpen && prop === p) api.close();
      else api.open(p, trigger, viaKeyboard);
    },
    close() {
      if (dirty) emit();
      if (!isOpen) return;
      isOpen = false;
      prop = null;
      anchorEl = null;
      const hadFocus = el.contains(document.activeElement);
      if (document.activeElement === hexIn) hexIn.blur();
      el.classList.remove('is-open');
      el.inert = true;
      el.setAttribute('aria-hidden', 'true');
      setExpanded(lastTrigger, false);
      if (hadFocus && lastTrigger && lastTrigger.isConnected) lastTrigger.focus({ preventScroll: true });
      lastTrigger = null;
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
AA.createColorPicker = createColorPicker;
})(window.AA);
