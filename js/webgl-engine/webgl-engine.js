(function (AA) {
  const { on, clamp } = AA.util;
  const { vsSource, buildFragmentSource } = AA.SHADERS;
  const { NIGHT_COLOR, applyHueDrift, deriveSecondaryColor } = AA.COLOR_UTILS;

  // Central tunables for the engine (no other magic numbers for these behaviors)
  const ENGINE_CFG = {
    PIXEL_BUDGET: 2500000,          // Max rendered pixels
    LOW_POWER_DPR: 0.75,            // DPR in low-power mode
    MAX_DPR: 2,                     // Max DPR in standard mode
    OCTAVES_STD: 4,                 // fbm octave count in standard mode
    OCTAVES_LOW: 2,                 // fbm octave count in low-power mode
    PANEL_SCALE_CAP: 0.75,          // Max Auto render scale while settings panel is open
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
    AUTO_COOLDOWN_UP_MS: 8000,      // Cooldown after stepping scale up
    AUTO_FLAP_WINDOW_MS: 30000,     // Downgrade within this window after an upgrade doubles the next upgrade threshold
    AUTO_UP_MAX_MS: 80000,          // Cap for the doubled upgrade threshold (80s); must stay below AUTO_UP_RESET_MS
    AUTO_UP_RESET_MS: 120000,       // Time since the last upgrade (without a downgrade) before the upgrade threshold resets to AUTO_UP_MS (2 min)
    FRAME_JITTER_MS: 2,             // Frame-clock tolerance margin in scheduleFrame
    MAX_DT_MS: 100,                 // Clamped frame delta ceiling in scheduleFrame
    REF_FRAME_MS: 16.666,           // 60fps reference frame duration for smoothing and time step
    SMOOTH_BASE: 0.033,             // Per-reference-frame exponential smoothing factor
    TIME_STEP_BASE: 0.01,           // Base shader time advance per reference frame
    ACTIVE_MODE_EPS: 0.001,         // Minimum mode weight counted as active (shader evalScene and stepWeights)
    AUTO_OVERLOAD_DECAY: 0.5,       // Overload timer decay rate during stable frames in stepAutoScale
    DRIFT_STEP_EPS: 0.0005          // Minimum driftPhase delta (~0.18°) before recomputing drifted RGB
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

  class WebGLEngine {
    constructor(canvas, store) {
      this.canvas = canvas;
      this.store = store;
      AA._glFrames = 0;
      this.glReady = false;
      this.uniforms = {};
      this.uVignetteLoc = null;
      this.program = null;
      this.vao = null;
      this.running = false;
      this.rafId = null;

      const state = this.store.getState();
      this.params = {
        bgMode: state.bgMode,
        isIdle: state.isIdle,
        isLowPower: state.isLowPower,
        bgSpeed: state.bgSpeed,
        isNightMode: state.isNightMode,
        bgColor: state.bgColor,
        isHolding: state.isHolding,
        bgBrightness: state.bgBrightness,
        isDimOnIdle: state.isDimOnIdle,
        bgVignette: state.bgVignette,
        bgRenderScale: state.bgRenderScale,
        isPanelOpen: state.isPanelOpen,
        isBgColorMix: state.isBgColorMix,
        bgHueShift: state.bgHueShift,
        isBgHueDrift: state.isBgHueDrift,
        isBgModeCycle: state.isBgModeCycle,
        bgCycleInterval: state.bgCycleInterval
      };
      AA._activeScale = state.bgRenderScale === 'auto' ? 1 : state.bgRenderScale;
      this.colorLive = [...state.bgColor];
      this.cachedColor2 = null;
      this.driftedPrimary = [0, 0, 0];
      this.driftedColor2 = [0, 0, 0];
      this.lastDriftCalcPhase = -1;
      this.updateCachedColor2();
      this.color2Live = [...this.cachedColor2];
      this.driftPhase = 0;
      this.displayMode = state.bgMode;
      this.cycleElapsed = 0;
      const modeCount = AA.MODES.length;
      this.currentWeights = new Array(modeCount).fill(0);
      this.targetWeights = new Array(modeCount).fill(0);
      this.activeModeCount = modeCount > 0 ? 1 : 0;
      this.invalidateUniformCache();
      if (modeCount > 0) {
        let initIdx = AA.MODE_INDEX_BY_ID[state.bgMode];
        if (initIdx === undefined) {
          console.warn('[AA.WebGLEngine] Unknown mode id "' + state.bgMode + '", falling back to "' + AA.MODE_IDS[0] + '".');
          initIdx = 0;
        }
        this.displayMode = AA.MODE_IDS[initIdx];
        this.currentWeights[initIdx] = 1.0;
        this.targetWeights[initIdx] = 1.0;
      }
      this.currentBrightness = 1.0;
      this.currentVignette = ENGINE_CFG.VIGNETTE_MAP[state.bgVignette];
      this.globalTime = 0;
      this.lastTime = performance.now();
      this.renderBound = this.render.bind(this);
      this.frameClock = performance.now();
      this.isWrapping = false;
      this.wrapTime = 0;
      this.wrapProgress = 0;
      this.highSpeedFps = (state.bgSpeed > 1.0);
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
      this.autoUpRequiredMs = ENGINE_CFG.AUTO_UP_MS;
      this.lastAutoUpTime = 0;
      this.autoIgnoreUntil = performance.now() + ENGINE_CFG.AUTO_IGNORE_INIT_MS;
      this.fallbackEl = canvas.parentElement;
      this.fallbackActive = false;
      this.vsSource = vsSource;
      if (modeCount > 0) {
        // Built once; reused by initGL() on every (re)creation of the GL context
        this.fsSource = buildFragmentSource({ activeEps: ENGINE_CFG.ACTIVE_MODE_EPS });
      } else {
        console.error('[AA.WebGLEngine] No background modes registered; activating CSS fallback.');
        this.fsSource = '';
      }

      on(this.canvas, 'webglcontextlost', (e) => {
        e.preventDefault();
        this.glReady = false;
        this.program = null;
        this.vao = null;
        this.invalidateUniformCache();
        this.pause();
        this.showFallback();
      }, false);

      on(this.canvas, 'webglcontextrestored', () => {
        this.initGL();
        if (!document.hidden) this.resume();
      }, false);

      this.initGL();

      const onColor = () => this.updateCachedColor2();
      const onColorFallback = () => {
        this.updateCachedColor2();
        this.updateFallback();
      };
      this.stateHandlers = {
        bgColor: onColorFallback,
        isNightMode: onColorFallback,
        isBgColorMix: onColor,
        bgHueShift: onColor,
        isIdle: val => {
          this.idleStartTime = val ? performance.now() : 0;
          this.isDeepIdle = false;
        },
        bgMode: val => {
          this.cycleElapsed = 0;
          this.setDisplayMode(val);
        },
        isBgModeCycle: val => {
          this.cycleElapsed = 0;
          const userMode = this.params.bgMode;
          if (!val && this.displayMode !== userMode) this.setDisplayMode(userMode);
        },
        bgCycleInterval: () => {
          this.cycleElapsed = 0;
        },
        bgRenderScale: val => {
          this.overloadTime = 0;
          this.stableTime = 0;
          this.autoCooldownUntil = 0;
          this.autoUpRequiredMs = ENGINE_CFG.AUTO_UP_MS;
          this.lastAutoUpTime = 0;
          if (val === 'auto') this.autoScale = 1.0;
          this.resize();
        },
        isPanelOpen: () => {
          this.overloadTime = 0;
          this.stableTime = 0;
          this.autoIgnoreUntil = performance.now() + ENGINE_CFG.AUTO_IGNORE_PANEL_MS;
          this.resize();
        },
        isLowPower: () => this.resize()
      };
      this.store.subscribe(Object.keys(this.params), (key, val) => this.handleStateChange(key, val));
      on(window, 'resize', () => this.resize());
    }

    // Forget the last uploaded u_weights / u_octaves so the next draw() uploads them again
    invalidateUniformCache() {
      this.lastUploadedOctaves = -1;
      if (!this.lastUploadedWeights || this.lastUploadedWeights.length !== this.currentWeights.length) {
        this.lastUploadedWeights = new Array(this.currentWeights.length).fill(-1);
      } else {
        this.lastUploadedWeights.fill(-1);
      }
    }

    compileShader(gl, source, type) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const rawLog = gl.getShaderInfoLog(shader);
        console.error(type === gl.FRAGMENT_SHADER && AA.SHADERS.formatShaderError ? AA.SHADERS.formatShaderError(rawLog) : rawLog);
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    initGL() {
      if (!AA.MODES.length) {
        this.glReady = false;
        this.program = null;
        this.vao = null;
        this.showFallback();
        return;
      }
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
      const bootT0 = performance.now();
      const vs = this.compileShader(gl, this.vsSource, gl.VERTEX_SHADER);
      const fs = this.compileShader(gl, this.fsSource, gl.FRAGMENT_SHADER);
      if (!(vs && fs)) AA._bootCompileMs = Math.round((performance.now() - bootT0) * 100) / 100;
      if (vs && fs) {
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
        AA._bootCompileMs = Math.round((performance.now() - bootT0) * 100) / 100;
        if (linked) {
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
          this.invalidateUniformCache();
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
      const { isNightMode, bgColor } = this.params;
      const c = isNightMode ? NIGHT_COLOR : bgColor;
      const rgb = (m) => `rgb(${c.map(x => Math.round(clamp(x * m, 0, 1) * 255)).join(',')})`;
      this.fallbackEl.style.background = `radial-gradient(ellipse at 30% 25%, ${rgb(1.6)} 0%, ${rgb(0.8)} 45%, #050505 100%)`;
    }

    updateCachedColor2() {
      const { bgColor, isNightMode, isBgColorMix, bgHueShift } = this.params;
      this.cachedColor2 = deriveSecondaryColor(bgColor, isNightMode, isBgColorMix, bgHueShift);
      // Force the drifted colors to be recomputed on the next frame
      this.lastDriftCalcPhase = -1;
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
      if (!AA.MODES.length) return;
      let idx = AA.MODE_INDEX_BY_ID[m];
      if (idx === undefined) {
        console.warn('[AA.WebGLEngine] Unknown mode id "' + m + '", falling back to "' + AA.MODE_IDS[0] + '".');
        idx = 0;
        m = AA.MODE_IDS[0];
      }
      this.displayMode = m;
      this.targetWeights.fill(0);
      this.targetWeights[idx] = 1.0;
      this.autoIgnoreUntil = performance.now() + ENGINE_CFG.AUTO_IGNORE_MODE_MS;
      this.overloadTime = 0;
      this.stableTime = 0;
    }

    handleStateChange(key, val) {
      if (key in this.params) this.params[key] = val;
      const handler = this.stateHandlers[key];
      if (handler) handler(val);
    }

    resize() {
      // Every resize re-uploads u_weights / u_octaves on the next draw
      this.invalidateUniformCache();
      if (!this.glReady || !this.gl || this.gl.isContextLost()) return;
      const { isLowPower, bgRenderScale, isPanelOpen } = this.params;
      // Panel cap applies to Auto only; manual scales are used as-is
      const activeScale = bgRenderScale === 'auto'
        ? (isPanelOpen ? Math.min(this.autoScale, ENGINE_CFG.PANEL_SCALE_CAP) : this.autoScale)
        : bgRenderScale;
      AA._activeScale = activeScale;
      const cssW = Math.max(1, window.innerWidth);
      const cssH = Math.max(1, window.innerHeight);
      const dpr = isLowPower ? ENGINE_CFG.LOW_POWER_DPR : Math.min(window.devicePixelRatio || 1, ENGINE_CFG.MAX_DPR);
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

      // u_weights: upload only when a weight changed since the last upload
      const cw = this.currentWeights;
      const lw = this.lastUploadedWeights;
      let weightsChanged = false;
      for (let i = 0; i < cw.length; i++) {
        if (cw[i] !== lw[i]) {
          weightsChanged = true;
          lw[i] = cw[i];
        }
      }
      if (weightsChanged) this.gl.uniform1fv(this.uniforms.u_weights, cw);

      this.gl.uniform1f(this.uniforms.u_brightness, this.currentBrightness);
      this.gl.uniform1f(this.uVignetteLoc, this.currentVignette);

      // u_octaves: upload only when the octave count changed
      const octaves = this.params.isLowPower ? ENGINE_CFG.OCTAVES_LOW : ENGINE_CFG.OCTAVES_STD;
      if (octaves !== this.lastUploadedOctaves) {
        this.gl.uniform1i(this.uniforms.u_octaves, octaves);
        this.lastUploadedOctaves = octaves;
      }

      this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
      AA._glFrames = (AA._glFrames || 0) + 1;
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
      const { isIdle, isLowPower, bgSpeed, isPanelOpen } = this.params;

      if (!isIdle) {
        this.idleStartTime = 0;
        this.isDeepIdle = false;
      } else {
        if (this.idleStartTime === 0) this.idleStartTime = timestamp;
        this.isDeepIdle = (timestamp - this.idleStartTime) >= ENGINE_CFG.DEEP_IDLE_MS;
      }

      const effectiveSpeed = bgSpeed * (this.reducedMotion ? ENGINE_CFG.REDUCED_MOTION_MUL : 1);
      if (effectiveSpeed > ENGINE_CFG.SPEED_UP_THRESH) this.highSpeedFps = true;
      else if (effectiveSpeed < ENGINE_CFG.SPEED_DOWN_THRESH) this.highSpeedFps = false;

      const speedInterval = this.highSpeedFps ? ENGINE_CFG.FPS_HIGH_MS : ENGINE_CFG.FPS_BASE_MS;
      const idleInterval = !isIdle ? 0 : (this.isDeepIdle ? ENGINE_CFG.FPS_DEEP_IDLE_MS : ENGINE_CFG.FPS_IDLE_MS);
      const minInterval = Math.max(
        idleInterval,
        isLowPower ? ENGINE_CFG.FPS_LOW_POWER_MS : 0,
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

      if (timestamp < this.frameClock + minInterval - ENGINE_CFG.FRAME_JITTER_MS) return null;
      this.frameClock += minInterval;
      if (timestamp - this.frameClock > minInterval) this.frameClock = timestamp;

      const rawDt = timestamp - this.lastTime;
      const dt = clamp(rawDt, 0, ENGINE_CFG.MAX_DT_MS);
      const k = 1 - Math.pow(1 - ENGINE_CFG.SMOOTH_BASE, dt / ENGINE_CFG.REF_FRAME_MS);
      this.lastTime = timestamp;

      return { rawDt, dt, k, minInterval, effectiveSpeed };
    }

    // Advance shader time and run the seamless dual-time wrap
    stepTimeAndWrap(dt, effectiveSpeed) {
      const step = ENGINE_CFG.TIME_STEP_BASE * effectiveSpeed * (dt / ENGINE_CFG.REF_FRAME_MS);
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
      const { isBgModeCycle, bgCycleInterval } = this.params;
      if (!isBgModeCycle || AA.MODE_IDS.length === 0) return;
      this.cycleElapsed += dt;
      const limit = ENGINE_CFG.CYCLE_INTERVALS_MS[bgCycleInterval];
      if (this.cycleElapsed >= limit) {
        this.cycleElapsed = 0;
        this.setDisplayMode(AA.nextMode(this.displayMode));
      }
    }

    // Hue drift, live colors, brightness and vignette interpolation
    stepColorsAndScene(dt, k) {
      const {
        isIdle,
        isNightMode,
        bgColor,
        isHolding,
        bgBrightness,
        isDimOnIdle,
        bgVignette,
        isBgHueDrift
      } = this.params;

      if (!isBgHueDrift) {
        this.driftPhase = 0;
      } else if (!isNightMode) {
        this.driftPhase = (this.driftPhase + dt / ENGINE_CFG.DRIFT_PERIOD_MS) % 1;
      }

      // Recompute drifted RGB (into reused arrays) only when the phase moved enough
      const drifting = isBgHueDrift && !isNightMode;
      if (drifting && Math.abs(this.driftPhase - this.lastDriftCalcPhase) >= ENGINE_CFG.DRIFT_STEP_EPS) {
        applyHueDrift(bgColor, this.driftPhase, this.driftedPrimary);
        applyHueDrift(this.cachedColor2, this.driftPhase, this.driftedColor2);
        this.lastDriftCalcPhase = this.driftPhase;
      }

      const target = isNightMode
        ? NIGHT_COLOR
        : (isBgHueDrift ? this.driftedPrimary : bgColor);
      for (let i = 0; i < 3; i++) this.colorLive[i] += (target[i] - this.colorLive[i]) * k;

      const target2 = drifting ? this.driftedColor2 : this.cachedColor2;
      for (let i = 0; i < 3; i++) this.color2Live[i] += (target2[i] - this.color2Live[i]) * k;

      this.currentBrightness += (
        (isHolding
          ? ENGINE_CFG.BRIGHT_HOLD
          : (isIdle && isDimOnIdle)
            ? bgBrightness * (this.isDeepIdle ? ENGINE_CFG.BRIGHT_DEEP_IDLE_MUL : ENGINE_CFG.BRIGHT_IDLE_MUL)
            : bgBrightness) - this.currentBrightness
      ) * k;

      const targetVignette = ENGINE_CFG.VIGNETTE_MAP[bgVignette];
      this.currentVignette += (targetVignette - this.currentVignette) * k;
    }

    // Mode weight crossfade with early snap-to-zero and normalization (also counts active modes in the same pass)
    stepWeights(k) {
      const len = this.currentWeights.length;
      let wSum = 0;
      for (let i = 0; i < len; i++) {
        let w = this.currentWeights[i] + (this.targetWeights[i] - this.currentWeights[i]) * k;
        if (this.targetWeights[i] === 0 && w < ENGINE_CFG.WEIGHT_SNAP_EPS) w = 0;
        this.currentWeights[i] = w;
        wSum += w;
      }
      if (wSum > 0) {
        let active = 0;
        for (let i = 0; i < len; i++) {
          const nw = this.currentWeights[i] / wSum;
          this.currentWeights[i] = nw;
          if (nw > ENGINE_CFG.ACTIVE_MODE_EPS) active++;
        }
        this.activeModeCount = active;
      } else {
        this.activeModeCount = 0;
      }
    }

    // Auto render-scale controller. Returns true when the scale changed (resize already drew).
    stepAutoScale(timestamp, rawDt, minInterval) {
      const { bgRenderScale, isIdle, isPanelOpen } = this.params;

      const autoActive = bgRenderScale === 'auto' && !isIdle && !isPanelOpen;
      if (
        rawDt > ENGINE_CFG.AUTO_MAX_RAW_DT ||
        timestamp < this.autoIgnoreUntil ||
        this.activeModeCount > 1 ||
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
        this.overloadTime = Math.max(0, this.overloadTime - rawDt * ENGINE_CFG.AUTO_OVERLOAD_DECAY);
      }

      // Two full minutes since the last upgrade without a downgrade: forget the doubled upgrade threshold
      if (this.lastAutoUpTime > 0 && (timestamp - this.lastAutoUpTime) >= ENGINE_CFG.AUTO_UP_RESET_MS) {
        this.autoUpRequiredMs = ENGINE_CFG.AUTO_UP_MS;
        this.lastAutoUpTime = 0;
      }

      if (timestamp >= this.autoCooldownUntil) {
        const ti = SCALE_TIERS.indexOf(this.autoScale);
        if (this.overloadTime >= ENGINE_CFG.AUTO_DOWN_MS && this.autoScale > 0.25) {
          if (this.lastAutoUpTime > 0 && (timestamp - this.lastAutoUpTime) <= ENGINE_CFG.AUTO_FLAP_WINDOW_MS) {
            this.autoUpRequiredMs = Math.min(this.autoUpRequiredMs * 2, ENGINE_CFG.AUTO_UP_MAX_MS);
          }
          this.lastAutoUpTime = 0;
          this.autoScale = SCALE_TIERS[Math.max(0, ti - 1)];
          this.autoCooldownUntil = timestamp + ENGINE_CFG.AUTO_COOLDOWN_DOWN_MS;
          this.overloadTime = 0;
          this.stableTime = 0;
          this.emaFrameDt = minInterval;
          this.resize();
          return true;
        }
        if (this.stableTime >= this.autoUpRequiredMs && this.autoScale < 1.0) {
          this.autoScale = SCALE_TIERS[Math.min(SCALE_TIERS.length - 1, ti + 1)];
          this.lastAutoUpTime = timestamp;
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
        AA._glFrames = (AA._glFrames || 0) + 1;
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
