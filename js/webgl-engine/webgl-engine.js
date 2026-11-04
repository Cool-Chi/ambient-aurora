(function (AA) {
  const { on, clamp } = AA.util;
  const { vsSource, fsSource } = AA.SHADERS;

  // Central tunables for the engine (no other magic numbers for these behaviors)
  const ENGINE_CFG = {
    PIXEL_BUDGET: 2500000,          // Max rendered pixels (SD-7)
    LOW_POWER_DPR: 0.75,            // DPR in low-power mode
    MAX_DPR: 2,                     // Max DPR in standard mode
    PANEL_SCALE_CAP: 0.75,          // Max render scale while settings panel is open
    FPS_HIGH_MS: 16.6,              // ~60fps frame interval (speed > 1.05)
    FPS_BASE_MS: 33.3,              // ~30fps frame interval (speed <= 1.0 or panel open)
    FPS_LOW_POWER_MS: 41.6,         // ~24fps frame interval (low power)
    FPS_IDLE_MS: 50,                // 20fps frame interval (stage-1 idle)
    FPS_DEEP_IDLE_MS: 75,           // ~13.3fps frame interval (stage-2 deep idle)
    SPEED_UP_THRESH: 1.05,          // Speed threshold to step up to 60fps
    SPEED_DOWN_THRESH: 0.95,        // Speed threshold to step down to 30fps
    REDUCED_MOTION_MUL: 0.3,        // Speed multiplier when prefers-reduced-motion is active
    DEEP_IDLE_MS: 300000,           // Time in idle before entering deep idle (5 min)
    BRIGHT_HOLD: 1.5,               // Target brightness during hold-to-exit
    BRIGHT_IDLE_MUL: 0.65,          // Brightness multiplier in stage-1 idle
    BRIGHT_DEEP_IDLE_MUL: 0.45,     // Brightness multiplier in stage-2 deep idle
    VIGNETTE_MAP: [0.0, 0.4, 0.75], // Vignette strength by level (0=Off, 1=Subtle, 2=Strong)
    WRAP_THRESHOLD: 3600,           // globalTime threshold to start seamless time wrap
    WRAP_DURATION_MS: 6000,         // Crossfade duration for seamless time wrap (6s)
    DRIFT_PERIOD_MS: 2400000,       // Full 360° hue drift period (40 min)
    CYCLE_INTERVALS_MS: [300000, 900000, 3600000], // Mode cycle intervals (5m, 15m, 1h)
    WEIGHT_SNAP_EPS: 0.02,          // Snap decaying mode weights below this to 0
    AUTO_IGNORE_INIT_MS: 1500,      // Ignore auto-scale stats after init/resume
    AUTO_IGNORE_MODE_MS: 2000,      // Ignore auto-scale stats after mode switch
    AUTO_IGNORE_PANEL_MS: 1000,     // Ignore auto-scale stats after panel toggle
    AUTO_MAX_RAW_DT: 150,           // Reset auto-scale stats if frame gap exceeds this
    AUTO_EMA_ALPHA: 0.15,           // Frame time EMA smoothing factor
    AUTO_OVERLOAD_RATIO: 1.35,      // EMA / minInterval ratio considered overloaded
    AUTO_STABLE_RATIO: 1.12,        // EMA / minInterval ratio considered stable
    AUTO_DOWN_MS: 2000,             // Sustained overload duration before stepping down
    AUTO_UP_MS: 10000,              // Sustained stable duration before stepping up
    AUTO_COOLDOWN_DOWN_MS: 5000,    // Cooldown after stepping scale down
    AUTO_COOLDOWN_UP_MS: 8000       // Cooldown after stepping scale up
  };

  const SCALE_TIERS = [0.25, 0.5, 0.75, 1.0];
  const UNIFORM_NAMES = [
    'u_resolution',
    'u_time',
    'u_color',
    'u_color2',
    'u_weights',
    'u_brightness',
    'u_time2',
    'u_timeMix',
    'u_vignette',
    'u_octaves'
  ];
  const NIGHT_COLOR = [0.16, 0.08, 0.0];
  const NIGHT_COLOR2 = [0.24, 0.05, 0.0];

  function rgbToHsv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
      if (h < 0) h += 1;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  function hsvToRgb(h, s, v) {
    const hh = ((h % 1) + 1) % 1 * 6;
    const i = Math.floor(hh);
    const f = hh - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));
    switch (i % 6) {
      case 0: return [v, t, p];
      case 1: return [q, v, p];
      case 2: return [p, v, t];
      case 3: return [p, q, v];
      case 4: return [t, p, v];
      default: return [v, p, q];
    }
  }

  function applyHueDrift(rgb, driftOffset) {
    const r = clamp(Number(rgb[0]) || 0, 0, 1);
    const g = clamp(Number(rgb[1]) || 0, 0, 1);
    const b = clamp(Number(rgb[2]) || 0, 0, 1);
    if (!driftOffset) return [r, g, b];
    let [h, s, v] = rgbToHsv(r, g, b);
    if (s < 0.02) s = 0.18;
    return hsvToRgb((h + driftOffset) % 1, s, v);
  }

  function deriveSecondaryColor(rgb, nightMode, colorMix = true, hueShift = 42) {
    if (nightMode) return colorMix ? NIGHT_COLOR2.slice() : NIGHT_COLOR.slice();
    const r = clamp(Number(rgb[0]) || 0, 0, 1);
    const g = clamp(Number(rgb[1]) || 0, 0, 1);
    const b = clamp(Number(rgb[2]) || 0, 0, 1);
    if (!colorMix) return [r, g, b];
    const [h, s, v] = rgbToHsv(r, g, b);
    const shift = (((Number(hueShift) || 0) / 360 % 1) + 1) % 1;
    let h2 = (h + shift) % 1;
    let s2;
    let v2;
    if (s < 0.12 && v > 0.85) {
      if (s < 0.02) h2 = 0.08;
      s2 = 0.22;
      v2 = 0.95;
    } else if (v < 0.08) {
      s2 = clamp(s * 0.9 + 0.15, 0.2, 0.85);
      v2 = Math.max(v * 2.2, 0.06);
    } else {
      s2 = clamp(s * 0.92 + 0.12, 0.18, 0.92);
      v2 = clamp(v * 1.15 + 0.08, 0.16, 1.0);
    }
    return hsvToRgb(h2, s2, v2);
  }

  class WebGLEngine {
    constructor(canvas, store) {
      this.canvas = canvas;
      this.store = store;
      this.frameCount = 0;
      this.glReady = false;
      this.uniforms = {};
      this.uVignetteLoc = null;
      this.program = null;
      this.vao = null;
      this.running = false;
      this.rafId = null;

      const state = this.store.getState();
      this.params = {
        mode: state.mode,
        isIdle: state.isIdle,
        lowPower: state.lowPower,
        speed: state.speed,
        nightMode: state.nightMode,
        colorTarget: state.colorTarget,
        isHolding: state.isHolding,
        bgBrightness: state.bgBrightness ?? 1,
        dimOnIdle: state.dimOnIdle ?? true,
        vignette: state.vignette ?? 1,
        renderScale: state.renderScale,
        isPanelOpen: state.isPanelOpen,
        colorMix: state.colorMix ?? true,
        hueShift: state.hueShift ?? 42,
        hueDrift: state.hueDrift ?? false,
        modeCycle: state.modeCycle ?? false,
        cycleInterval: state.cycleInterval ?? 0
      };
      this.activeScale = state.renderScale === 0 ? 1 : state.renderScale;
      this.colorLive = [...state.colorTarget];
      this.color2Live = deriveSecondaryColor(state.colorTarget, state.nightMode, state.colorMix, state.hueShift);
      this.driftPhase = 0;
      this.displayMode = state.mode;
      this.cycleElapsed = 0;
      this.currentWeights = [0, 0, 0, 0, 0];
      this.targetWeights = [0, 0, 0, 0, 0];
      this.currentWeights[state.mode - 1] = 1.0;
      this.targetWeights[state.mode - 1] = 1.0;
      this.currentBrightness = 1.0;
      this.currentVignette = ENGINE_CFG.VIGNETTE_MAP[state.vignette] ?? 0;
      this.globalTime = 0;
      this.lastTime = performance.now();
      this.renderBound = this.render.bind(this);
      this.frameClock = performance.now();
      this.isWrapping = false;
      this.wrapTime = 0;
      this.wrapProgress = 0;
      this.highSpeedFps = (state.speed > 1.0);
      this.lastMinInterval = 0;
      this.idleStartTime = state.isIdle ? performance.now() : 0;
      this.isDeepIdle = false;
      this.prmMedia = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
      this.reducedMotion = !!(this.prmMedia && this.prmMedia.matches);
      if (this.prmMedia) {
        on(this.prmMedia, 'change', e => {
          this.reducedMotion = !!e.matches;
        });
      }
      this.autoScale = 1.0;
      this.emaFrameDt = ENGINE_CFG.FPS_BASE_MS;
      this.overloadTime = 0;
      this.stableTime = 0;
      this.autoCooldownUntil = 0;
      this.autoIgnoreUntil = performance.now() + ENGINE_CFG.AUTO_IGNORE_INIT_MS;
      this.fallbackEl = canvas.parentElement;
      this.fallbackActive = false;
      this.vsSource = vsSource;
      this.fsSource = fsSource;

      on(this.canvas, 'webglcontextlost', (e) => {
        e.preventDefault();
        this.glReady = false;
        this.program = null;
        this.vao = null;
        this.pause();
        this.showFallback();
      }, false);

      on(this.canvas, 'webglcontextrestored', () => {
        this.initGL();
        if (!document.hidden) this.resume();
      }, false);

      this.initGL();
      this.store.subscribe((key, val) => this.handleStateChange(key, val));
      on(window, 'resize', () => this.resize());
    }

    compileShader(gl, source, type) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    initGL() {
      this.gl = this.canvas.getContext('webgl2', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
      });
      this.glReady = false;
      this.program = null;
      this.vao = null;
      if (!this.gl) {
        this.showFallback();
        return;
      }
      const gl = this.gl;
      const vs = this.compileShader(gl, this.vsSource, gl.VERTEX_SHADER);
      const fs = this.compileShader(gl, this.fsSource, gl.FRAGMENT_SHADER);
      if (vs && fs) {
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
          this.program = program;
          gl.useProgram(program);
          this.uniforms = {};
          UNIFORM_NAMES.forEach(n => {
            this.uniforms[n] = gl.getUniformLocation(program, n);
          });
          this.uVignetteLoc = this.uniforms.u_vignette;
          this.vao = gl.createVertexArray();
          gl.bindVertexArray(this.vao);
          this.glReady = true;
          this.hideFallback();
          this.resize();
        } else {
          console.error(gl.getProgramInfoLog(program));
        }
      }
      if (!this.glReady) this.showFallback();
    }

    updateFallback() {
      if (!this.fallbackActive || !this.fallbackEl) return;
      const { nightMode, colorTarget } = this.params;
      const c = nightMode ? NIGHT_COLOR : colorTarget;
      const rgb = (m) => `rgb(${c.map(x => Math.round(clamp(x * m, 0, 1) * 255)).join(',')})`;
      this.fallbackEl.style.background = `radial-gradient(ellipse at 30% 25%, ${rgb(1.6)} 0%, ${rgb(0.8)} 45%, #050505 100%)`;
    }

    showFallback() {
      if (!this.fallbackEl) return;
      this.fallbackActive = true;
      this.canvas.style.display = 'none';
      this.updateFallback();
    }

    hideFallback() {
      if (!this.fallbackActive) return;
      this.fallbackActive = false;
      this.canvas.style.display = '';
      if (this.fallbackEl) this.fallbackEl.style.background = '';
    }

    setDisplayMode(m) {
      this.displayMode = m;
      this.targetWeights.fill(0);
      this.targetWeights[m - 1] = 1.0;
      this.autoIgnoreUntil = performance.now() + ENGINE_CFG.AUTO_IGNORE_MODE_MS;
      this.overloadTime = 0;
      this.stableTime = 0;
    }

    handleStateChange(key, val) {
      if (key in this.params) this.params[key] = val;

      if (key === 'isIdle') {
        this.idleStartTime = val ? performance.now() : 0;
        this.isDeepIdle = false;
      } else if (key === 'mode') {
        this.cycleElapsed = 0;
        this.setDisplayMode(val);
      } else if (key === 'modeCycle') {
        this.cycleElapsed = 0;
        const userMode = this.params.mode;
        if (!val && this.displayMode !== userMode) this.setDisplayMode(userMode);
      } else if (key === 'cycleInterval') {
        this.cycleElapsed = 0;
      } else if (key === 'renderScale') {
        this.overloadTime = 0;
        this.stableTime = 0;
        this.autoCooldownUntil = 0;
        if (val === 0) this.autoScale = 1.0;
        this.resize();
      } else if (key === 'isPanelOpen') {
        this.overloadTime = 0;
        this.stableTime = 0;
        this.autoIgnoreUntil = performance.now() + ENGINE_CFG.AUTO_IGNORE_PANEL_MS;
        this.resize();
      } else if (key === 'lowPower') {
        this.resize();
      } else if (key === 'colorTarget' || key === 'nightMode') {
        this.updateFallback();
      }
    }

    resize() {
      if (!this.glReady || !this.gl || this.gl.isContextLost()) return;
      const { lowPower, renderScale, isPanelOpen } = this.params;
      const baseScale = renderScale === 0 ? this.autoScale : renderScale;
      const activeScale = isPanelOpen ? Math.min(baseScale, ENGINE_CFG.PANEL_SCALE_CAP) : baseScale;
      this.activeScale = activeScale;
      const cssW = Math.max(1, window.innerWidth);
      const cssH = Math.max(1, window.innerHeight);
      const dpr = lowPower ? ENGINE_CFG.LOW_POWER_DPR : Math.min(window.devicePixelRatio || 1, ENGINE_CFG.MAX_DPR);
      const scale = Math.min(dpr, Math.sqrt(ENGINE_CFG.PIXEL_BUDGET / (cssW * cssH))) * clamp(Number(activeScale) || 1, 0.25, 1);
      const w = Math.max(1, Math.round(cssW * scale));
      const h = Math.max(1, Math.round(cssH * scale));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      const bw = this.gl.drawingBufferWidth || w;
      const bh = this.gl.drawingBufferHeight || h;
      this.gl.viewport(0, 0, bw, bh);
      this.gl.uniform2f(this.uniforms.u_resolution, bw, bh);
      this.draw();
    }

    draw() {
      if (!this.glReady || !this.gl || this.gl.isContextLost()) return;
      this.gl.uniform1f(this.uniforms.u_time, this.globalTime);
      this.gl.uniform1f(this.uniforms.u_time2, this.wrapTime);
      this.gl.uniform1f(this.uniforms.u_timeMix, this.isWrapping ? this.wrapProgress : 0.0);
      this.gl.uniform3f(this.uniforms.u_color, this.colorLive[0], this.colorLive[1], this.colorLive[2]);
      this.gl.uniform3f(this.uniforms.u_color2, this.color2Live[0], this.color2Live[1], this.color2Live[2]);
      this.gl.uniform1fv(this.uniforms.u_weights, this.currentWeights);
      this.gl.uniform1f(this.uniforms.u_brightness, this.currentBrightness);
      this.gl.uniform1f(this.uVignetteLoc, this.currentVignette);
      this.gl.uniform1i(this.uniforms.u_octaves, this.params.lowPower ? 2 : 4);
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
      this.frameCount++;
    }

    pause() {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    }

    resume() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.frameClock = this.lastTime;
      this.overloadTime = 0;
      this.stableTime = 0;
      this.emaFrameDt = this.lastMinInterval || ENGINE_CFG.FPS_BASE_MS;
      this.autoIgnoreUntil = this.lastTime + ENGINE_CFG.AUTO_IGNORE_INIT_MS;
      this.rafId = requestAnimationFrame(this.renderBound);
    }

    // Idle state, FPS interval, frame gating. Returns null when this frame is skipped.
    scheduleFrame(timestamp) {
      const { isIdle, lowPower, speed, isPanelOpen } = this.params;

      if (!isIdle) {
        this.idleStartTime = 0;
        this.isDeepIdle = false;
      } else {
        if (this.idleStartTime === 0) this.idleStartTime = timestamp;
        this.isDeepIdle = (timestamp - this.idleStartTime) >= ENGINE_CFG.DEEP_IDLE_MS;
      }

      const effectiveSpeed = speed * (this.reducedMotion ? ENGINE_CFG.REDUCED_MOTION_MUL : 1);
      if (effectiveSpeed > ENGINE_CFG.SPEED_UP_THRESH) this.highSpeedFps = true;
      else if (effectiveSpeed < ENGINE_CFG.SPEED_DOWN_THRESH) this.highSpeedFps = false;

      const speedInterval = this.highSpeedFps ? ENGINE_CFG.FPS_HIGH_MS : ENGINE_CFG.FPS_BASE_MS;
      const idleInterval = !isIdle ? 0 : (this.isDeepIdle ? ENGINE_CFG.FPS_DEEP_IDLE_MS : ENGINE_CFG.FPS_IDLE_MS);
      const minInterval = Math.max(
        idleInterval,
        lowPower ? ENGINE_CFG.FPS_LOW_POWER_MS : 0,
        isPanelOpen ? ENGINE_CFG.FPS_BASE_MS : 0,
        speedInterval
      );

      if (this.lastMinInterval !== minInterval) {
        this.lastMinInterval = minInterval;
        this.frameClock = timestamp - minInterval;
        this.emaFrameDt = minInterval;
        this.overloadTime = 0;
        this.stableTime = 0;
      }

      if (timestamp < this.frameClock + minInterval - 2) return null;
      this.frameClock += minInterval;
      if (timestamp - this.frameClock > minInterval) this.frameClock = timestamp;

      const rawDt = timestamp - this.lastTime;
      const dt = clamp(rawDt, 0, 100);
      const k = 1 - Math.pow(1 - 0.033, dt / 16.666);
      this.lastTime = timestamp;

      return { rawDt, dt, k, minInterval, effectiveSpeed };
    }

    // Advance shader time and run the seamless dual-time wrap
    stepTimeAndWrap(dt, effectiveSpeed) {
      const step = 0.01 * effectiveSpeed * (dt / 16.666);
      this.globalTime += step;

      if (!this.isWrapping && this.globalTime >= ENGINE_CFG.WRAP_THRESHOLD) {
        this.isWrapping = true;
        this.wrapTime = 0;
        this.wrapProgress = 0;
      }
      if (this.isWrapping) {
        this.wrapTime += step;
        this.wrapProgress += dt / ENGINE_CFG.WRAP_DURATION_MS;
        if (this.wrapProgress >= 1.0) {
          this.globalTime = this.wrapTime;
          this.isWrapping = false;
          this.wrapProgress = 0;
        }
      }
    }

    // Automatic mode cycling via engine-internal displayMode
    stepModeCycle(dt) {
      const { modeCycle, cycleInterval } = this.params;
      if (!modeCycle) return;
      this.cycleElapsed += dt;
      const limit = ENGINE_CFG.CYCLE_INTERVALS_MS[cycleInterval] || ENGINE_CFG.CYCLE_INTERVALS_MS[0];
      if (this.cycleElapsed >= limit) {
        this.cycleElapsed = 0;
        this.setDisplayMode((this.displayMode % 5) + 1);
      }
    }

    // Hue drift, live colors, brightness and vignette interpolation
    stepColorsAndScene(dt, k) {
      const {
        isIdle,
        nightMode,
        colorTarget,
        isHolding,
        bgBrightness,
        dimOnIdle,
        vignette,
        colorMix,
        hueShift,
        hueDrift
      } = this.params;

      if (!hueDrift) {
        this.driftPhase = 0;
      } else if (!nightMode) {
        this.driftPhase = (this.driftPhase + dt / ENGINE_CFG.DRIFT_PERIOD_MS) % 1;
      }

      const driftedPrimary = (hueDrift && !nightMode) ? applyHueDrift(colorTarget, this.driftPhase) : colorTarget;
      const target = nightMode ? NIGHT_COLOR : driftedPrimary;
      for (let i = 0; i < 3; i++) this.colorLive[i] += (target[i] - this.colorLive[i]) * k;

      const target2 = deriveSecondaryColor(driftedPrimary, nightMode, colorMix, hueShift);
      for (let i = 0; i < 3; i++) this.color2Live[i] += (target2[i] - this.color2Live[i]) * k;

      this.currentBrightness += (
        (isHolding
          ? ENGINE_CFG.BRIGHT_HOLD
          : (isIdle && dimOnIdle)
            ? bgBrightness * (this.isDeepIdle ? ENGINE_CFG.BRIGHT_DEEP_IDLE_MUL : ENGINE_CFG.BRIGHT_IDLE_MUL)
            : bgBrightness) - this.currentBrightness
      ) * k;

      const targetVignette = ENGINE_CFG.VIGNETTE_MAP[vignette] ?? 0;
      this.currentVignette += (targetVignette - this.currentVignette) * k;
    }

    // Mode weight crossfade with early snap-to-zero and normalization
    stepWeights(k) {
      let wSum = 0;
      for (let i = 0; i < 5; i++) {
        let w = this.currentWeights[i] + (this.targetWeights[i] - this.currentWeights[i]) * k;
        if (this.targetWeights[i] === 0 && w < ENGINE_CFG.WEIGHT_SNAP_EPS) w = 0;
        this.currentWeights[i] = w;
        wSum += w;
      }
      if (wSum > 0) {
        for (let i = 0; i < 5; i++) this.currentWeights[i] /= wSum;
      }
    }

    // Auto render-scale controller. Returns true when the scale changed (resize already drew).
    stepAutoScale(timestamp, rawDt, minInterval) {
      const { renderScale, isIdle, isPanelOpen } = this.params;

      let activeModes = 0;
      for (let i = 0; i < 5; i++) if (this.currentWeights[i] > 0.001) activeModes++;

      const autoActive = renderScale === 0 && !isIdle && !isPanelOpen;
      if (
        rawDt > ENGINE_CFG.AUTO_MAX_RAW_DT ||
        timestamp < this.autoIgnoreUntil ||
        activeModes > 1 ||
        this.isWrapping ||
        !autoActive
      ) {
        this.emaFrameDt = minInterval;
        this.overloadTime = 0;
        this.stableTime = 0;
        return false;
      }

      this.emaFrameDt += (rawDt - this.emaFrameDt) * ENGINE_CFG.AUTO_EMA_ALPHA;
      if (this.emaFrameDt > minInterval * ENGINE_CFG.AUTO_OVERLOAD_RATIO) {
        this.overloadTime += rawDt;
        this.stableTime = 0;
      } else if (this.emaFrameDt <= minInterval * ENGINE_CFG.AUTO_STABLE_RATIO) {
        this.stableTime += rawDt;
        this.overloadTime = Math.max(0, this.overloadTime - rawDt * 0.5);
      }

      if (timestamp >= this.autoCooldownUntil) {
        const ti = SCALE_TIERS.indexOf(this.autoScale);
        if (this.overloadTime >= ENGINE_CFG.AUTO_DOWN_MS && this.autoScale > 0.25) {
          this.autoScale = SCALE_TIERS[Math.max(0, ti - 1)];
          this.autoCooldownUntil = timestamp + ENGINE_CFG.AUTO_COOLDOWN_DOWN_MS;
          this.overloadTime = 0;
          this.stableTime = 0;
          this.emaFrameDt = minInterval;
          this.resize();
          return true;
        }
        if (this.stableTime >= ENGINE_CFG.AUTO_UP_MS && this.autoScale < 1.0) {
          this.autoScale = SCALE_TIERS[Math.min(SCALE_TIERS.length - 1, ti + 1)];
          this.autoCooldownUntil = timestamp + ENGINE_CFG.AUTO_COOLDOWN_UP_MS;
          this.overloadTime = 0;
          this.stableTime = 0;
          this.emaFrameDt = minInterval;
          this.resize();
          return true;
        }
      }
      return false;
    }

    render(timestamp) {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(this.renderBound);

      const timing = this.scheduleFrame(timestamp);
      if (!timing) return;

      if (!this.glReady) {
        this.frameCount++;
        return;
      }

      const { rawDt, dt, k, minInterval, effectiveSpeed } = timing;
      this.stepTimeAndWrap(dt, effectiveSpeed);
      this.stepModeCycle(dt);
      this.stepColorsAndScene(dt, k);
      this.stepWeights(k);
      if (this.stepAutoScale(timestamp, rawDt, minInterval)) return;
      this.draw();
    }

    start() {
      this.resize();
      this.resume();
    }
  }

  AA.WebGLEngine = WebGLEngine;
})(window.AA);
