(function (AA) {
  const { $, on, clamp } = AA.util;
  const { GLASS_FX_IDS } = AA.UI_CONFIG;

  AA.createUIFx = function createUIFx(ui) {
    let lAngle = Math.atan2(0.75, 0.65);
    let lMag = Math.hypot(0.65, 0.75);
    let ptrW = 0;
    let gyroX = 0;
    let gyroY = 0;
    let hasGyro = false;
    let gyroAsked = false;
    let gyroPending = false;
    let glassPress = 0;
    let glassRaf = null;
    let lastGlassTick = 0;
    let _lastGlassDom = 0;
    let _glassStaticSize = null;
    let _lastMat = null;
    let _lastKx = '';
    let _lastKy = '';
    let _lastKp = '';
    let _lastOpP = -1;
    let rp = null;
    const _kCache = {};

    function init() {
      ui.glassEls = {};
      for (const [k, id] of Object.entries(GLASS_FX_IDS)) ui.glassEls[k] = $(id);

      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission !== 'function') {
        on(window, 'deviceorientation', e => handleGyro(e), { passive: true });
      }
    }

    function applyVisualVars(full = false) {
      const {
        clockFont,
        isNightMode,
        clockColor,
        clockAmpmColor,
        dateColor,
        clockCustomTextColor,
        clockMaterial,
        clockOpacity: op,
        clockSize,
        bgColor
      } = ui.store.getState();
      const root = document.documentElement;
      const sp = (k, v) => root.style.setProperty(k, v);
      const rgba = (hex, a) => `rgba(${AA.UIManager.hexToRgb(hex).map(x => Math.round(x * 255)).join(', ')}, ${a})`;
      const nightCol = `rgba(110, 63, 32, ${op})`;
      sp('--clock-font', AA.UIManager.FONTS[clockFont]);
      sp('--ampm-color', isNightMode ? nightCol : rgba(clockAmpmColor, op));
      sp('--date-color', isNightMode ? nightCol : rgba(dateColor, op));
      sp('--custom-text-color', isNightMode ? nightCol : rgba(clockCustomTextColor, op));
      sp('--clock-shadow-color', isNightMode ? 'transparent' : `rgba(255, 255, 255, ${0.2 * op})`);
      const [r, g, b] = isNightMode
        ? [217, 119, 54]
        : AA.UIManager.hexToRgb(clockColor).map(x => Math.round(x * 255));
      const cColor = `rgba(${r}, ${g}, ${b}, ${op})`;
      let fill = cColor;
      let stroke = '0';
      let blend = 'normal';
      let digitFilter = 'none';
      let filter = 'drop-shadow(0 8px 16px rgba(0,0,0,.5)) drop-shadow(0 0 4px var(--clock-shadow-color))';
      if (clockMaterial === 1) {
        fill = `rgb(${r}, ${g}, ${b})`;
        stroke = '0';
        digitFilter = 'url(#hollow-fx)';
        const hb = ui.glassEls && ui.glassEls.hollowBlur;
        const hf = ui.glassEls && ui.glassEls.hollowFlood;
        if (hb) hb.setAttribute('stdDeviation', Math.max(1.0, clockSize * 0.095).toFixed(2));
        if (hf) {
          hf.setAttribute('flood-color', `rgb(${r}, ${g}, ${b})`);
          hf.setAttribute('flood-opacity', String(op));
        }
      } else if (clockMaterial === 2) {
        const [rc, gc, bc] = [r, g, b].map(c => Math.round(c + (255 - c) * 0.38));
        fill = `rgba(${rc}, ${gc}, ${bc}, ${op})`;
        stroke = `max(1px, 0.015em) rgba(${r}, ${g}, ${b}, ${(0.9 * op).toFixed(2)})`;
        blend = 'screen';
        filter = [
          `drop-shadow(0 0 2px rgba(255, 255, 255, ${(0.65 * op).toFixed(2)}))`,
          `drop-shadow(0 0 6px rgba(${r}, ${g}, ${b}, ${(0.95 * op).toFixed(2)}))`,
          `drop-shadow(0 0 16px rgba(${r}, ${g}, ${b}, ${(0.75 * op).toFixed(2)}))`,
          `drop-shadow(0 0 34px rgba(${r}, ${g}, ${b}, ${(0.45 * op).toFixed(2)}))`
        ].join(' ');
      } else if (clockMaterial === 3) {
        const maxC = Math.max(bgColor[0], bgColor[1], bgColor[2], 0.01);
        const [ar, ag, ab] = isNightMode
          ? [217, 119, 54]
          : bgColor.map(v => Math.round(clamp((v / maxC) * 195 + 60, 0, 255)));
        const [gr, gg, gb] = isNightMode
          ? [217, 119, 54]
          : [
            Math.round(r * 0.45 + ar * 0.55),
            Math.round(g * 0.45 + ag * 0.55),
            Math.round(b * 0.45 + ab * 0.55)
          ];
        const [sr, sg, sb] = isNightMode
          ? [242, 168, 110]
          : [gr, gg, gb].map(c => Math.round(c + (255 - c) * 0.65));
        const [cr, cg, cb] = isNightMode
          ? [255, 210, 165]
          : [r, g, b].map(c => Math.round(c + (255 - c) * 0.92));
        fill = `rgb(${gr}, ${gg}, ${gb})`;
        stroke = '0';
        digitFilter = 'none';
        filter = `url(#glass-fx) drop-shadow(0 5px 10px rgba(0, 0, 0, ${(0.24 * op).toFixed(2)}))`;
        const ge = ui.glassEls;
        if (ge && ge.bodyFlood) {
          const setFlood = (el, col, a) => {
            el.setAttribute('flood-color', col);
            el.setAttribute('flood-opacity', (a * op).toFixed(3));
          };
          const reduceTrans = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
          setFlood(ge.bodyFlood, `rgb(${ar}, ${ag}, ${ab})`, reduceTrans ? 0.28 : 0.04 + glassPress * 0.06);
          setFlood(ge.bevelFlood, `rgb(${gr}, ${gg}, ${gb})`, reduceTrans ? 0.36 : 0.17 + glassPress * 0.08);
          setFlood(ge.causticFlood, `rgb(${sr}, ${sg}, ${sb})`, 0.36 + glassPress * 0.16);
          setFlood(ge.whisperFlood, `rgb(${ar}, ${ag}, ${ab})`, 0.28);
          setFlood(ge.crestFlood, `rgb(${cr}, ${cg}, ${cb})`, 0.95);
          setFlood(ge.prismCFlood, '#38e8ff', isNightMode ? 0 : 0.38);
          setFlood(ge.prismWFlood, '#ff6ee0', isNightMode ? 0 : 0.34);
          if (_glassStaticSize !== clockSize) {
            _glassStaticSize = clockSize;
            ge.bevelBlur.setAttribute('stdDeviation', Math.min(2.0, Math.max(1.3, clockSize * 0.14)).toFixed(2));
            ge.crestBlur.setAttribute('stdDeviation', Math.min(0.4, Math.max(0.32, clockSize * 0.024)).toFixed(2));
            const mDist = String(Math.min(3, Math.max(1, Math.round(clockSize * 0.12))));
            ge.mwOff.setAttribute('dx', mDist);
            ge.meOff.setAttribute('dx', '-' + mDist);
            ge.mnOff.setAttribute('dy', mDist);
            ge.msOff.setAttribute('dy', '-' + mDist);
            const cDist = String(Math.min(2, Math.max(1, Math.round(clockSize * 0.045))));
            ge.cwOff.setAttribute('dx', cDist);
            ge.ceOff.setAttribute('dx', '-' + cDist);
            ge.cnOff.setAttribute('dy', cDist);
            ge.csOff.setAttribute('dy', '-' + cDist);
          }
        }
        if (_lastMat !== 3 || full) _lastGlassDom = 0;
        updateGlassVectors(true);
        startGlassLoop();
      }
      _lastMat = clockMaterial;
      if (clockMaterial !== 3) {
        stopGlassLoop();
        sp('--glass-press', '1');
      }
      sp('--clock-color', cColor);
      sp('--clock-fill', fill);
      sp('--clock-stroke', stroke);
      sp('--clock-blend', blend);
      sp('--digit-filter', digitFilter);
      sp('--clock-filter', filter);
      const clk = ui.clockEl;
      if (!full && clk) {
        clk.style.opacity = 0.99;
        clearTimeout(rp);
        rp = setTimeout(() => {
          clk.style.opacity = '';
        }, 50);
      }
    }

    function tryRequestGyro() {
      if (gyroAsked || gyroPending) return;
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        gyroPending = true;
        DeviceOrientationEvent.requestPermission().then(res => {
          gyroAsked = true;
          if (res === 'granted') on(window, 'deviceorientation', e => handleGyro(e), { passive: true });
        }).catch(() => {}).finally(() => {
          gyroPending = false;
        });
      } else {
        gyroAsked = true;
      }
    }

    function handleGyro(e) {
      if (e.gamma === null || e.beta === null || ui.store.getState().clockMaterial !== 3) return;
      hasGyro = true;
      gyroX = clamp(e.gamma / 35, -1, 1);
      gyroY = clamp((e.beta - 45) / 35, -1, 1);
    }

    function startGlassLoop() {
      if (glassRaf || document.hidden || ui.store.getState().clockMaterial !== 3) return;
      _lastGlassDom = 0;
      updateGlassVectors(true);
      lastGlassTick = performance.now();
      glassRaf = requestAnimationFrame(tickGlassBound);
    }

    function stopGlassLoop() {
      if (glassRaf) {
        cancelAnimationFrame(glassRaf);
        glassRaf = null;
      }
    }

    function updateGlassVectors(force = false) {
      const g = ui.glassEls;
      if (!g || !g.crestX) return;
      const { clockOpacity: op, isNightMode } = ui.store.getState();
      const p = glassPress;
      const comp = 1 - p * 0.35;
      const nx = Math.cos(lAngle);
      const ny = Math.sin(lAngle);
      const strength = clamp(lMag, 0.55, 1.15) * comp;
      const ux = nx * strength;
      const uy = ny * strength;
      const q = v => (Math.round(v * 50) / 50).toFixed(2);
      const kx = q(ux);
      const ky = q(uy);
      const kp = p.toFixed(2);
      if (!force && _lastKx === kx && _lastKy === ky && _lastKp === kp) return;
      _lastKx = kx;
      _lastKy = ky;
      _lastKp = kp;
      const kc = _kCache;
      const setK = (name, el, k2, k3) => {
        const a = Math.max(0, k2).toFixed(2);
        const b = Math.max(0, k3).toFixed(2);
        const s = a + '|' + b;
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
      const cx = nx * 0.82 - ny * 0.57;
      const cy = ny * 0.82 + nx * 0.57;
      const wx = nx * 0.82 + ny * 0.57;
      const wy = ny * 0.82 - nx * 0.57;
      setK('prismCX', g.prismCX, cx * strength, -cx * strength);
      setK('prismCY', g.prismCY, -cy * strength, cy * strength);
      setK('prismWX', g.prismWX, -wx * strength, wx * strength);
      setK('prismWY', g.prismWY, wy * strength, -wy * strength);
      if (force || Math.abs((_lastOpP ?? -1) - p) > 0.002) {
        _lastOpP = p;
        const reduceTrans = window.matchMedia?.('(prefers-reduced-transparency: reduce)').matches;
        if (!reduceTrans) {
          g.bodyFlood.setAttribute('flood-opacity', ((0.04 + p * 0.06) * op).toFixed(3));
          g.bevelFlood.setAttribute('flood-opacity', ((0.17 + p * 0.08) * op).toFixed(3));
          g.causticFlood.setAttribute('flood-opacity', ((0.36 + p * 0.16) * op).toFixed(3));
        }
        if (!isNightMode) {
          g.prismCFlood.setAttribute('flood-opacity', ((0.38 + p * 0.12) * op).toFixed(3));
          g.prismWFlood.setAttribute('flood-opacity', ((0.34 + p * 0.12) * op).toFixed(3));
        }
        document.documentElement.style.setProperty('--glass-press', (1 - p * 0.032).toFixed(4));
      }
    }

    function tickGlass(now) {
      glassRaf = null;
      const { clockMaterial, isHolding, isIdle, bgSpeed, isLowPower } = ui.store.getState();
      if (clockMaterial !== 3 || document.hidden) return;
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const fdt = clamp(now - lastGlassTick, 1, 64);
      lastGlassTick = now;
      const pTarget = isHolding ? 1 : 0;
      const kP = 1 - Math.pow(1 - (isHolding ? 0.08 : 0.26), fdt / 16.666);
      glassPress += (pTarget - glassPress) * kP;
      if (Math.abs(pTarget - glassPress) < 0.001) glassPress = pTarget;
      if (calm) {
        lAngle = Math.atan2(0.75, 0.65);
        lMag = Math.hypot(0.65, 0.75);
        updateGlassVectors(false);
        if (glassPress !== pTarget) glassRaf = requestAnimationFrame(tickGlassBound);
        return;
      }
      const ptrActive = now < ui.ptrActiveUntil ? 1 : 0;
      const active = ptrActive === 1 || ptrW > 0.01 || isHolding || glassPress > 0.002;
      const minStep = active ? 36 : (isIdle ? 240 : isLowPower ? 240 : 110);
      const flipping = ui.clockLayerObj && ui.clockLayerObj.classList.contains('is-flipping');
      if (flipping || now - (_lastGlassDom || 0) < minStep) {
        glassRaf = requestAnimationFrame(tickGlassBound);
        return;
      }
      const dt = clamp((now - (_lastGlassDom || now - minStep)) * 0.001, 0.016, 0.3);
      _lastGlassDom = now;
      const t = now * 0.00018 * clamp(bgSpeed, 0.2, 2.5);
      const driftX = Math.cos(t) * 0.64 + Math.sin(t * 0.43) * 0.22 + 0.16;
      const driftY = Math.sin(t * 0.71) * 0.64 + Math.cos(t * 0.37) * 0.22 + 0.18;
      const ambX = hasGyro ? clamp(driftX * 0.35 + (-gyroX) * 0.85, -1.15, 1.15) : driftX;
      const ambY = hasGyro ? clamp(driftY * 0.35 + (-gyroY) * 0.85, -1.15, 1.15) : driftY;
      const kW = 1 - Math.exp(-dt * (ptrActive ? 12 : 2.8));
      ptrW += (ptrActive - ptrW) * kW;
      if (ptrW < 0.001 && !ptrActive) ptrW = 0;
      const w = ptrW;
      const tx = ambX * (1 - w) + (-ui.ptrX * 1.05) * w;
      const ty = ambY * (1 - w) + (-ui.ptrY * 1.05) * w;
      const rawMag = Math.hypot(tx, ty);
      const tAngle = rawMag > 0.02 ? Math.atan2(ty, tx) : lAngle;
      const tMag = clamp(rawMag, 0.62, 1.15);
      const dAngle = Math.atan2(Math.sin(tAngle - lAngle), Math.cos(tAngle - lAngle));
      const kL = 1 - Math.exp(-dt * (active ? 10 : 3.2));
      const maxStep = (active ? 8.5 : 2.2) * dt;
      const stepA = clamp(dAngle * kL, -maxStep, maxStep);
      lAngle = Math.atan2(Math.sin(lAngle + stepA), Math.cos(lAngle + stepA));
      lMag += (tMag - lMag) * kL;
      updateGlassVectors(false);
      glassRaf = requestAnimationFrame(tickGlassBound);
    }

    const tickGlassBound = tickGlass;

    return {
      init,
      applyVisualVars,
      startGlassLoop,
      stopGlassLoop,
      tickGlass,
      updateGlassVectors,
      tryRequestGyro,
      handleGyro
    };
  };
})(window.AA);
