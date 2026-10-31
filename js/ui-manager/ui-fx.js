(function (AA) {
const { $, qs, on, clamp } = AA.util;
const haptic = p => { try { navigator.vibrate?.(p) } catch(e){} };
function runPixelShift() {
  const state = this.store.getState();
  clearInterval(this.pixelShiftTimer);
  if (state.pixelShift) this.pixelShiftTimer = setInterval(() => this.appContainer.style.transform = `translate(${(Math.random()-0.5)*12}px, ${(Math.random()-0.5)*12}px)`, 60000);
  else this.appContainer.style.transform = 'translate(0px, 0px)';
}
function applyVisualVars(full = false) {
  const { fontStyle, nightMode, textColor, ampmColor, dateColor, customTextColor, material, clockOpacity: op, size, colorTarget } = this.store.getState();
  const root = document.documentElement, sp = (k, v) => root.style.setProperty(k, v);
  const rgba = (hex, a) => `rgba(${AA.UIManager.hexToRgb(hex).map(x => Math.round(x * 255)).join(', ')}, ${a})`;
  const nightCol = `rgba(110, 63, 32, ${op})`;
  sp('--clock-font', AA.UIManager.FONTS[fontStyle]);
  sp('--ampm-color', nightMode ? nightCol : rgba(ampmColor, op));
  sp('--date-color', nightMode ? nightCol : rgba(dateColor, op));
  sp('--custom-text-color', nightMode ? nightCol : rgba(customTextColor, op));
  sp('--clock-shadow-color', nightMode ? 'transparent' : `rgba(255, 255, 255, ${0.2 * op})`);
  const [r, g, b] = nightMode ? [217, 119, 54] : AA.UIManager.hexToRgb(textColor).map(x => Math.round(x * 255));
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
function tryRequestGyro() {
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
function handleGyro(e) {
  if (e.gamma === null || e.beta === null || this.store.getState().material !== 3) return;
  this.hasGyro = true;
  this.gyroX = clamp(e.gamma / 35, -1, 1);
  this.gyroY = clamp((e.beta - 45) / 35, -1, 1);
}
function startGlassLoop() {
  if (this.glassRaf || document.hidden || this.store.getState().material !== 3) return;
  this._lastGlassDom = 0;
  this.updateGlassVectors(true);
  this.lastGlassTick = performance.now();
  this.glassRaf = requestAnimationFrame(this.tickGlassBound);
}
function stopGlassLoop() {
  if (this.glassRaf) {
    cancelAnimationFrame(this.glassRaf);
    this.glassRaf = null;
  }
}
function updateGlassVectors(force = false) {
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
function tickGlass(now) {
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
function scheduleIdle() {
  const state = this.store.getState();
  clearTimeout(this.idleTimer);
  if (state.idleTimeout !== 2) {
    this.idleTimer = setTimeout(() => this.setIdle(), state.idleTimeout === 0 ? 3000 : 10000);
  }
}
function wakeUp() {
  const now = Date.now();
  if (now - this.lastWake < 150) return;
  this.lastWake = now;
  document.body.classList.remove('is-idle');
  this.store.setState('isIdle', false);
  this.scheduleIdle();
}
function setIdle() {
  if(!document.body.classList.contains('is-idle')) {
    document.body.classList.add('is-idle');
    this.store.setState('isIdle', true);
    this.panel.classList.remove('active');
    this.store.setState('isPanelOpen', false);
    if (document.activeElement) document.activeElement.blur();
  }
}
function clearExitSequence() {
  clearTimeout(this.holdTimeout); this.holdTimeout = null;
  clearTimeout(this.exitCloseTimer); this.exitCloseTimer = null;
  clearTimeout(this.exitRecoverTimer); this.exitRecoverTimer = null;
  document.body.classList.remove('disconnected');
}
function recoverFromExit() {
  this.clearExitSequence();
  this.bgLayer.classList.remove('exiting');
  this.clockLayerObj.classList.remove('exiting');
  this.store.setState('isHolding', false);
}
function exitApp(isStarting) {
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
async function requestWakeLock() {
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
function releaseWakeLock() {
  if (this.wakeLock) {
    this.wakeLock.release().catch(()=>{});
    this.wakeLock = null;
  }
}
AA.UI_FX = { applyVisualVars, startGlassLoop, stopGlassLoop, tickGlass, updateGlassVectors, tryRequestGyro, handleGyro, scheduleIdle, setIdle, wakeUp, exitApp, clearExitSequence, recoverFromExit, requestWakeLock, releaseWakeLock, runPixelShift };
})(window.AA);
