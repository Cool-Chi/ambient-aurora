(function (AA) {
const { on, clamp } = AA.util;
const { vsSource, fsSource } = AA.SHADERS;
class WebGLEngine {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.store = store;
    this.glReady = false;
    this.uniforms = {};
    this.uVignetteLoc = null;
    this.running = false;
    this.rafId = null;
    const state = this.store.getState();
    this.colorLive = [...state.colorTarget];
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
    this.fallbackEl = canvas.parentElement;
    this.fallbackActive = false;
    this.vsSource = vsSource;
    this.fsSource = fsSource;
    on(this.canvas, 'webglcontextlost', (e) => { e.preventDefault(); this.glReady = false; this.pause(); this.showFallback(); }, false);
    on(this.canvas, 'webglcontextrestored', () => { this.initGL(); if (!document.hidden) this.resume(); }, false);
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
    this.gl = this.canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' }) ||
              this.canvas.getContext('experimental-webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
    this.glReady = false;
    if (!this.gl) { this.showFallback(); return; }
    const vs = this.compileShader(this.gl, this.vsSource, this.gl.VERTEX_SHADER);
    const fs = this.compileShader(this.gl, this.fsSource, this.gl.FRAGMENT_SHADER);
    if (vs && fs) {
      const program = this.gl.createProgram();
      this.gl.attachShader(program, vs);
      this.gl.attachShader(program, fs);
      this.gl.linkProgram(program);
      if (this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
        this.gl.useProgram(program);
        const pb = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pb);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), this.gl.STATIC_DRAW);
        const pos = this.gl.getAttribLocation(program, 'position');
        this.gl.enableVertexAttribArray(pos);
        this.gl.vertexAttribPointer(pos, 2, this.gl.FLOAT, false, 0, 0);
        ['u_resolution', 'u_time', 'u_color', 'u_weights', 'u_brightness', 'u_time2', 'u_timeMix'].forEach(n => this.uniforms[n] = this.gl.getUniformLocation(program, n));
        this.uVignetteLoc = this.gl.getUniformLocation(program, 'u_vignette');
        this.glReady = true;
        this.hideFallback();
        this.resize();
      } else {
        console.error(this.gl.getProgramInfoLog(program));
      }
    }
    if (!this.glReady) this.showFallback();
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
  handleStateChange(key, val) {
    if (key === 'mode') {
      this.targetWeights.fill(0);
      this.targetWeights[val - 1] = 1.0;
    } else if (key === 'lowPower' || key === 'renderScale') {
      this.resize();
    } else if (key === 'colorTarget' || key === 'nightMode') {
      this.updateFallback();
    }
  }
  resize() {
    if (!this.glReady || !this.gl || this.gl.isContextLost()) return;
    const { lowPower, renderScale } = this.store.getState();
    const PIXEL_BUDGET = 2500000;
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const dpr = lowPower ? 0.75 : Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(dpr, Math.sqrt(PIXEL_BUDGET / (cssW * cssH))) * clamp(Number(renderScale) || 1, 0.25, 1);
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
    this.gl.uniform1fv(this.uniforms.u_weights, this.currentWeights);
    this.gl.uniform1f(this.uniforms.u_brightness, this.currentBrightness);
    this.gl.uniform1f(this.uVignetteLoc, this.currentVignette);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
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
    this.rafId = requestAnimationFrame(this.renderBound);
  }
  render(timestamp) {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.renderBound);
    const { isIdle, lowPower, speed, nightMode, colorTarget, isHolding, bgBrightness = 1, dimOnIdle = true, vignette = 1 } = this.store.getState();
    const minInterval = isIdle ? 50 : lowPower ? 41.6 : 16.6;
    if (timestamp < this.frameClock + minInterval - 2) return;
    this.frameClock += minInterval;
    if (timestamp - this.frameClock > minInterval) this.frameClock = timestamp;
    const dt = clamp(timestamp - this.lastTime, 0, 100), k = 1 - Math.pow(1 - 0.033, dt / 16.666);
    this.lastTime = timestamp;
    if (!this.glReady) return;
    const step = 0.01 * speed * (dt / 16.666);
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
    const target = nightMode ? [0.16, 0.08, 0.0] : colorTarget;
    for (let i = 0; i < 3; i++) this.colorLive[i] += (target[i] - this.colorLive[i]) * k;
    for (let i = 0; i < 5; i++) this.currentWeights[i] += (this.targetWeights[i] - this.currentWeights[i]) * k;
    this.currentBrightness += ((isHolding ? 1.5 : (isIdle && dimOnIdle) ? bgBrightness * 0.65 : bgBrightness) - this.currentBrightness) * k;
    const targetVignette = vignette === 2 ? 0.75 : vignette === 1 ? 0.4 : 0.0;
    this.currentVignette += (targetVignette - this.currentVignette) * k;
    this.draw();
  }
  start() {
    this.resize();
    this.resume();
  }
}
AA.WebGLEngine = WebGLEngine;
})(window.AA);
