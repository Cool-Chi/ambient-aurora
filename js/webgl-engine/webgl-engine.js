(function (AA) {
  const { on, clamp } = AA.util;
  const { vsSource, fsSource } = AA.SHADERS;

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
    'u_vignette'
  ];
  const DEEP_IDLE_MS = 300000;
  const DRIFT_PERIOD_MS = 2400000;
  const CYCLE_INTERVALS_MS = [300000, 900000, 3600000];
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
      AA._glFrames = 0;
      AA._glEngine = this;
      this.glReady = false;
      this.uniforms = {};
      this.uVignetteLoc = null;
      this.programs = [];
      this.programUniforms = [];
      this.program = null;
      this.activeProgIdx = -1;
      this.running = false;
      this.rafId = null;

      const state = this.store.getState();
      AA._activeScale = state.renderScale === 0 ? 1 : state.renderScale;
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
      this.currentVignette = state.vignette === 2 ? 0.75 : state.vignette === 1 ? 0.4 : 0.0;
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
      this.emaFrameDt = 33.3;
      this.overloadTime = 0;
      this.stableTime = 0;
      this.autoCooldownUntil = 0;
      this.autoIgnoreUntil = performance.now() + 1500;
      this.fallbackEl = canvas.parentElement;
      this.fallbackActive = false;
      this.vsSource = vsSource;
      this.fsSource = fsSource;

      on(this.canvas, 'webglcontextlost', (e) => {
        e.preventDefault();
        this.glReady = false;
        this.activeProgIdx = -1;
        this.programs = [];
        this.programUniforms = [];
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

    buildProgram(vs, fsSrc) {
      const gl = this.gl;
      const fs = this.compileShader(gl, fsSrc, gl.FRAGMENT_SHADER);
      if (!fs) return null;
      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, 'position');
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return null;
      }
      const uniforms = {};
      UNIFORM_NAMES.forEach(n => {
        uniforms[n] = gl.getUniformLocation(program, n);
      });
      return { program, uniforms };
    }

    initGL() {
      this.gl = this.canvas.getContext('webgl', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
      }) || this.canvas.getContext('experimental-webgl', {
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power'
      });
      this.glReady = false;
      this.programs = [];
      this.programUniforms = [];
      this.activeProgIdx = -1;
      if (!this.gl) {
        this.showFallback();
        return;
      }
      const gl = this.gl;
      const vs = this.compileShader(gl, this.vsSource, gl.VERTEX_SHADER);
      if (vs) {
        const hdr = this.fsSource.indexOf('#endif\n');
        const lowSrc = hdr >= 0
          ? this.fsSource.slice(0, hdr + 7) + '#define FBM_OCTAVES 2\n#define LOW_POWER\n' + this.fsSource.slice(hdr + 7)
          : '#define FBM_OCTAVES 2\n#define LOW_POWER\n' + this.fsSource;
        const std = this.buildProgram(vs, this.fsSource);
        const low = std ? this.buildProgram(vs, lowSrc) : null;
        if (std) {
          const pb = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, pb);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
          this.programs = [std.program, low ? low.program : null];
          this.programUniforms = [std.uniforms, low ? low.uniforms : null];
          this.glReady = true;
          this.hideFallback();
          this.resize();
        }
      }
      if (!this.glReady) this.showFallback();
    }

    selectProgram() {
      if (!this.gl || !this.programs.length) return;
      let idx = this.store.getState().lowPower ? 1 : 0;
      if (!this.programs[idx]) idx = 0;
      if (this.activeProgIdx === idx) return;
      this.activeProgIdx = idx;
      this.program = this.programs[idx];
      this.uniforms = this.programUniforms[idx];
      this.uVignetteLoc = this.uniforms.u_vignette;
      this.gl.useProgram(this.program);
      this.gl.uniform2f(
        this.uniforms.u_resolution,
        this.gl.drawingBufferWidth || this.canvas.width,
        this.gl.drawingBufferHeight || this.canvas.height
      );
    }

    updateFallback() {
      if (!this.fallbackActive || !this.fallbackEl) return;
      const state = this.store.getState();
      const c = state.nightMode ? [0.16, 0.08, 0.0] : state.colorTarget;
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
      this.autoIgnoreUntil = performance.now() + 2000;
      this.overloadTime = 0;
      this.stableTime = 0;
    }

    handleStateChange(key, val) {
      if (key === 'isIdle') {
        this.idleStartTime = val ? performance.now() : 0;
        this.isDeepIdle = false;
      } else if (key === 'mode') {
        this.cycleElapsed = 0;
        this.setDisplayMode(val);
      } else if (key === 'modeCycle') {
        this.cycleElapsed = 0;
        const userMode = this.store.getState().mode;
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
        this.autoIgnoreUntil = performance.now() + 1000;
        this.resize();
      } else if (key === 'lowPower') {
        this.resize();
      } else if (key === 'colorTarget' || key === 'nightMode') {
        this.updateFallback();
      }
    }

    resize() {
      if (!this.glReady || !this.gl || this.gl.isContextLost()) return;
      this.selectProgram();
      const { lowPower, renderScale, isPanelOpen } = this.store.getState();
      const PIXEL_BUDGET = 2500000;
      const baseScale = renderScale === 0 ? this.autoScale : renderScale;
      const activeScale = isPanelOpen ? Math.min(baseScale, 0.75) : baseScale;
      AA._activeScale = activeScale;
      const cssW = Math.max(1, window.innerWidth);
      const cssH = Math.max(1, window.innerHeight);
      const dpr = lowPower ? 0.75 : Math.min(window.devicePixelRatio || 1, 2);
      const scale = Math.min(dpr, Math.sqrt(PIXEL_BUDGET / (cssW * cssH))) * clamp(Number(activeScale) || 1, 0.25, 1);
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
      this.selectProgram();
      this.gl.uniform1f(this.uniforms.u_time, this.globalTime);
      this.gl.uniform1f(this.uniforms.u_time2, this.wrapTime);
      this.gl.uniform1f(this.uniforms.u_timeMix, this.isWrapping ? this.wrapProgress : 0.0);
      this.gl.uniform3f(this.uniforms.u_color, this.colorLive[0], this.colorLive[1], this.colorLive[2]);
      this.gl.uniform3f(this.uniforms.u_color2, this.color2Live[0], this.color2Live[1], this.color2Live[2]);
      this.gl.uniform1fv(this.uniforms.u_weights, this.currentWeights);
      this.gl.uniform1f(this.uniforms.u_brightness, this.currentBrightness);
      this.gl.uniform1f(this.uVignetteLoc, this.currentVignette);
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
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
      this.emaFrameDt = this.lastMinInterval || 33.3;
      this.autoIgnoreUntil = this.lastTime + 1500;
      this.rafId = requestAnimationFrame(this.renderBound);
    }

    render(timestamp) {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(this.renderBound);

      const {
        isIdle,
        lowPower,
        speed,
        nightMode,
        colorTarget,
        isHolding,
        bgBrightness = 1,
        dimOnIdle = true,
        vignette = 1,
        renderScale,
        isPanelOpen,
        colorMix = true,
        hueShift = 42,
        hueDrift = false,
        modeCycle = false,
        cycleInterval = 0
      } = this.store.getState();

      if (!isIdle) {
        this.idleStartTime = 0;
        this.isDeepIdle = false;
      } else {
        if (this.idleStartTime === 0) this.idleStartTime = timestamp;
        this.isDeepIdle = (timestamp - this.idleStartTime) >= (AA._deepIdleMs || DEEP_IDLE_MS);
      }

      const effectiveSpeed = speed * (this.reducedMotion ? 0.3 : 1);
      if (effectiveSpeed > 1.05) this.highSpeedFps = true;
      else if (effectiveSpeed < 0.95) this.highSpeedFps = false;

      const speedInterval = this.highSpeedFps ? 16.6 : 33.3;
      const idleInterval = !isIdle ? 0 : (this.isDeepIdle ? 75 : 50);
      const minInterval = Math.max(idleInterval, lowPower ? 41.6 : 0, isPanelOpen ? 33.3 : 0, speedInterval);

      if (this.lastMinInterval !== minInterval) {
        this.lastMinInterval = minInterval;
        this.frameClock = timestamp - minInterval;
        this.emaFrameDt = minInterval;
        this.overloadTime = 0;
        this.stableTime = 0;
      }

      if (timestamp < this.frameClock + minInterval - 2) return;
      this.frameClock += minInterval;
      if (timestamp - this.frameClock > minInterval) this.frameClock = timestamp;

      const rawDt = timestamp - this.lastTime;
      const dt = clamp(rawDt, 0, 100),
        k = 1 - Math.pow(1 - 0.033, dt / 16.666);
      this.lastTime = timestamp;

      if (!this.glReady) {
        AA._glFrames = (AA._glFrames || 0) + 1;
        return;
      }

      const step = 0.01 * effectiveSpeed * (dt / 16.666);
      this.globalTime += step;

      if (!this.isWrapping && this.globalTime >= 3600) {
        this.isWrapping = true;
        this.wrapTime = 0;
        this.wrapProgress = 0;
      }
      if (this.isWrapping) {
        this.wrapTime += step;
        this.wrapProgress += dt / 6000;
        if (this.wrapProgress >= 1.0) {
          this.globalTime = this.wrapTime;
          this.isWrapping = false;
          this.wrapProgress = 0;
        }
      }

      if (modeCycle) {
        this.cycleElapsed += dt;
        const limit = AA._cycleIntervalMs || CYCLE_INTERVALS_MS[cycleInterval] || 300000;
        if (this.cycleElapsed >= limit) {
          this.cycleElapsed = 0;
          this.setDisplayMode((this.displayMode % 5) + 1);
        }
      }

      if (!hueDrift) {
        this.driftPhase = 0;
      } else if (!nightMode) {
        this.driftPhase = (this.driftPhase + dt / (AA._driftPeriodMs || DRIFT_PERIOD_MS)) % 1;
      }

      const driftedPrimary = (hueDrift && !nightMode) ? applyHueDrift(colorTarget, this.driftPhase) : colorTarget;
      const target = nightMode ? NIGHT_COLOR : driftedPrimary;
      for (let i = 0; i < 3; i++) this.colorLive[i] += (target[i] - this.colorLive[i]) * k;

      const target2 = deriveSecondaryColor(driftedPrimary, nightMode, colorMix, hueShift);
      for (let i = 0; i < 3; i++) this.color2Live[i] += (target2[i] - this.color2Live[i]) * k;

      let wSum = 0;
      for (let i = 0; i < 5; i++) {
        let w = this.currentWeights[i] + (this.targetWeights[i] - this.currentWeights[i]) * k;
        if (this.targetWeights[i] === 0 && w < 0.02) w = 0;
        this.currentWeights[i] = w;
        wSum += w;
      }
      if (wSum > 0) {
        for (let i = 0; i < 5; i++) this.currentWeights[i] /= wSum;
      }

      this.currentBrightness += (
        (isHolding
          ? 1.5
          : (isIdle && dimOnIdle)
            ? bgBrightness * (this.isDeepIdle ? 0.45 : 0.65)
            : bgBrightness) - this.currentBrightness
      ) * k;

      const targetVignette = vignette === 2 ? 0.75 : vignette === 1 ? 0.4 : 0.0;
      this.currentVignette += (targetVignette - this.currentVignette) * k;

      let activeModes = 0;
      for (let i = 0; i < 5; i++) if (this.currentWeights[i] > 0.001) activeModes++;

      const autoActive = renderScale === 0 && !isIdle && !isPanelOpen;
      if (rawDt > 150 || timestamp < this.autoIgnoreUntil || activeModes > 1 || this.isWrapping || !autoActive) {
        this.emaFrameDt = minInterval;
        this.overloadTime = 0;
        this.stableTime = 0;
      } else {
        this.emaFrameDt += (rawDt - this.emaFrameDt) * 0.15;
        if (this.emaFrameDt > minInterval * 1.35) {
          this.overloadTime += rawDt;
          this.stableTime = 0;
        } else if (this.emaFrameDt <= minInterval * 1.12) {
          this.stableTime += rawDt;
          this.overloadTime = Math.max(0, this.overloadTime - rawDt * 0.5);
        }
        if (timestamp >= this.autoCooldownUntil) {
          const ti = SCALE_TIERS.indexOf(this.autoScale);
          if (this.overloadTime >= 2000 && this.autoScale > 0.25) {
            this.autoScale = SCALE_TIERS[Math.max(0, ti - 1)];
            this.autoCooldownUntil = timestamp + 5000;
            this.overloadTime = 0;
            this.stableTime = 0;
            this.emaFrameDt = minInterval;
            this.resize();
            return;
          }
          if (this.stableTime >= 10000 && this.autoScale < 1.0) {
            this.autoScale = SCALE_TIERS[Math.min(SCALE_TIERS.length - 1, ti + 1)];
            this.autoCooldownUntil = timestamp + 8000;
            this.overloadTime = 0;
            this.stableTime = 0;
            this.emaFrameDt = minInterval;
            this.resize();
            return;
          }
        }
      }

      this.draw();
    }

    start() {
      this.resize();
      this.resume();
    }
  }

  AA.WebGLEngine = WebGLEngine;
})(window.AA);
