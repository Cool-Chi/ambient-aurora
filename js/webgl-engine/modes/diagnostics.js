/*
 * modes/diagnostics.js - developer-only diagnostics for registered background modes
 *
 * NOT used at runtime by the app. Call AA.diagnoseModes() from the browser console.
 *
 * Exports: AA.diagnoseModes() -> { bootCompileMs, fullCompileMs, modes: [{ id, passed, avgLuminance, frameMs, compileMs }], error? }
 *
 * What it does
 *   For every mode in AA.MODES it builds a standalone single-mode fragment shader
 *   (AA.SHADERS.buildFragmentSource({ modes: [mode], outLineMap })), compiles and links it in a private
 *   offscreen WebGL2 context (the app's context and AA.SHADERS.lastLineMap are never touched), renders it
 *   with fixed deterministic uniforms and reports:
 *     passed        compile + link succeeded (compile errors are logged with mode id and mode-local line)
 *     avgLuminance  average relative luminance of the frame (0..1, 4 decimals)
 *     frameMs       estimated single draw time over a timed batch (3 decimals)
 *     compileMs     compile + link time of the single-mode shader (2 decimals)
 *   bootCompileMs is AA._bootCompileMs written by WebGLEngine.initGL (null if the engine has not booted
 *   GL yet); fullCompileMs is a fresh compile + link of the full all-modes shader in the offscreen context.
 *
 * Depends on: AA.MODES, AA.SHADERS (vsSource, buildFragmentSource, formatShaderError), AA.COLOR_UTILS
 *
 * Co-change guide
 *   New shared uniform -> shaders.js header + webgl-engine.js UNIFORM_NAMES + the fixed uniforms below
 */
(function (AA) {
  const W = 64;
  const H = 36;
  const TIMED_DRAWS = 20;
  const BASE_COLOR = [0.06, 0.36, 0.27];
  const round = (v, digits) => {
    const k = Math.pow(10, digits);
    return Math.round(v * k) / k;
  };

  // Compiles and links vs + fs; returns { ok, program, shaders, compileMs, error }
  function buildProgram(gl, fsSource, lineMap) {
    const t0 = performance.now();
    const shaders = [];
    const compile = (type, source, isFragment) => {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
      const raw = gl.getShaderInfoLog(shader);
      return { error: isFragment ? AA.SHADERS.formatShaderError(raw, lineMap) : raw };
    };

    const vs = compile(gl.VERTEX_SHADER, AA.SHADERS.vsSource, false);
    const fs = compile(gl.FRAGMENT_SHADER, fsSource, true);
    const failed = vs.error || fs.error;
    if (failed) {
      return { ok: false, program: null, shaders, compileMs: performance.now() - t0, error: failed };
    }
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    const compileMs = performance.now() - t0;
    if (!linked) {
      return { ok: false, program, shaders, compileMs, error: gl.getProgramInfoLog(program) };
    }
    return { ok: true, program, shaders, compileMs, error: '' };
  }

  function release(gl, built) {
    if (!built) return;
    if (built.program) gl.deleteProgram(built.program);
    built.shaders.forEach(s => gl.deleteShader(s));
  }

  AA.diagnoseModes = function diagnoseModes() {
    const modes = AA.MODES || [];
    const bootCompileMs = typeof AA._bootCompileMs === 'number' ? AA._bootCompileMs : null;
    const result = { bootCompileMs, fullCompileMs: null, modes: [] };

    if (modes.length === 0) {
      console.warn('[AA.diagnoseModes] No background modes registered.');
      result.error = 'no modes registered';
      return result;
    }

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true
    });
    if (!gl) {
      console.warn('[AA.diagnoseModes] WebGL2 is not available.');
      result.error = 'webgl2 unavailable';
      return result;
    }

    const color2 = AA.COLOR_UTILS.deriveSecondaryColor(BASE_COLOR, false, true, 67);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.viewport(0, 0, W, H);

    const setUniforms = program => {
      const loc = n => gl.getUniformLocation(program, n);
      gl.useProgram(program);
      gl.uniform2f(loc('u_resolution'), W, H);
      gl.uniform1f(loc('u_time'), 12.34);
      gl.uniform1f(loc('u_time2'), 0.0);
      gl.uniform1f(loc('u_timeMix'), 0.0);
      gl.uniform3fv(loc('u_color'), BASE_COLOR);
      gl.uniform3fv(loc('u_color2'), color2);
      gl.uniform1fv(loc('u_weights'), [1.0]);
      gl.uniform1f(loc('u_brightness'), 1.0);
      gl.uniform1f(loc('u_vignette'), 1.0);
      gl.uniform1i(loc('u_octaves'), 4);
    };

    const sync = () => {
      gl.finish();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    };

    // Fresh compile of the full all-modes shader (does not touch AA.SHADERS.lastLineMap)
    const fullMap = [];
    const fullSource = AA.SHADERS.buildFragmentSource({ modes: modes.slice(), outLineMap: fullMap });
    const full = buildProgram(gl, fullSource, fullMap);
    result.fullCompileMs = round(full.compileMs, 2);
    if (!full.ok) console.error('[AA.diagnoseModes] Full shader failed to build:\n' + full.error);
    release(gl, full);
    if (result.bootCompileMs === null) result.bootCompileMs = result.fullCompileMs;

    const rows = modes.map(mode => {
      const lineMap = [];
      const source = AA.SHADERS.buildFragmentSource({ modes: [mode], outLineMap: lineMap });
      const built = buildProgram(gl, source, lineMap);
      const row = {
        id: mode.id,
        passed: built.ok,
        avgLuminance: null,
        frameMs: null,
        compileMs: round(built.compileMs, 2)
      };
      if (!built.ok) {
        console.error('[AA.diagnoseModes] Mode "' + mode.id + '" failed to build:\n' + built.error);
        release(gl, built);
        return row;
      }

      setUniforms(built.program);

      // Warm-up draw, then a timed batch
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      sync();
      const t0 = performance.now();
      for (let i = 0; i < TIMED_DRAWS; i++) gl.drawArrays(gl.TRIANGLES, 0, 3);
      sync();
      row.frameMs = round((performance.now() - t0) / TIMED_DRAWS, 3);

      const pixels = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let sum = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        sum += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
      }
      row.avgLuminance = round(sum / (W * H * 255), 4);

      release(gl, built);
      return row;
    });

    gl.bindVertexArray(null);
    gl.deleteVertexArray(vao);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();

    result.modes = rows;
    if (typeof console.table === 'function') console.table(rows);
    else console.log(rows);
    console.log('[AA.diagnoseModes] bootCompileMs=' + result.bootCompileMs + ' fullCompileMs=' + result.fullCompileMs + ' modes=' + rows.length + ' passed=' + rows.filter(r => r.passed).length);
    return result;
  };
})(window.AA);
