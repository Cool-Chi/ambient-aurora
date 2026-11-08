(function (AA) {
  // Vertex shader: bufferless full-screen oversized triangle from gl_VertexID (WebGL2)
  const vsSource = `#version 300 es
void main(){
  vec2 pos=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  gl_Position=vec4(pos*2.0-1.0,0.0,1.0);
}`;

  // Always yields a valid GLSL float literal (contains a decimal point)
  const fmtFloat = n => (Number.isInteger(n) ? n.toFixed(1) : String(n));

  // Shared GLSL helpers available to every registered mode
  const SHARED_GLSL = `// --- PCG integer hashes ---
uint pcg(uint v){
  uint state=v*747796405u+2891336453u;
  uint word=((state>>((state>>28u)+4u))^state)*277803737u;
  return (word>>22u)^word;
}

uvec2 pcg2d(uvec2 v){
  v=v*1664525u+1013904223u;
  v.x+=v.y*1664525u;
  v.y+=v.x*1664525u;
  v^=v>>16u;
  v.x+=v.y*1664525u;
  v.y+=v.x*1664525u;
  v^=v>>16u;
  return v;
}

// p+0.0 canonicalizes -0.0 to +0.0 so grid corners match across zero crossings
float hash(float p){
  return float(pcg(floatBitsToUint(p+0.0)))*(1.0/4294967296.0);
}

float hash(vec2 p){
  uvec2 h=pcg2d(floatBitsToUint(p+vec2(0.0)));
  return float(h.x)*(1.0/4294967296.0);
}

// --- Value noise ---
float noise(vec2 p){
  vec2 i=floor(p);
  vec2 f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i+vec2(0.0,0.0)),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);
}

// --- Fractal Brownian motion (octave count from u_octaves) ---
float fbm(vec2 p){
  float f=0.0;
  float amp=0.5;
  for(int i=0;i<u_octaves;i++){
    f+=amp*noise(p);
    p*=2.0;
    amp*=0.5;
  }
  return f;
}`;

  // Entry point (independent of the registered modes)
  const MAIN_GLSL = `// --- Entry point ---
void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution.xy;
  vec2 p=(uv-0.5)*2.0;
  p.x*=u_resolution.x/u_resolution.y;
  vec3 c=evalScene(uv,u_time);
  if(u_timeMix>0.001)c=mix(c,evalScene(uv,u_time2),smoothstep(0.0,1.0,u_timeMix));
  vec3 lit=c*clamp(1.0-length(p)*u_vignette,0.0,1.0)*u_brightness;
  float dither=(hash(gl_FragCoord.xy)-0.5)*0.008;
  float ditherMask=smoothstep(0.0,0.02,max(lit.r,max(lit.g,lit.b)));
  fragColor=vec4(max(lit+vec3(dither*ditherMask),0.0),1.0);
}`;

  // Number of lines in a chunk of the assembled source
  const lineCount = s => s.split('\n').length;

  // 1-based inclusive line ranges of every section of the assembled fragment source (chunks are joined by one blank line)
  function computeLineMap(header, count, modes, modeChunks, evalScene) {
    const map = [];
    let cursor = 1;

    const headerLines = lineCount(header);
    const headerOnly = count > 0 ? headerLines - count : headerLines;
    map.push({ kind: 'section', name: 'header', startLine: 1, endLine: headerOnly, bodyStart: 1 });
    if (count > 0) {
      map.push({ kind: 'section', name: 'mode_consts', startLine: headerOnly + 1, endLine: headerLines, bodyStart: headerOnly + 1 });
    }
    cursor += headerLines + 1;

    const sharedLines = lineCount(SHARED_GLSL);
    map.push({ kind: 'section', name: 'shared', startLine: cursor, endLine: cursor + sharedLines - 1, bodyStart: cursor });
    cursor += sharedLines + 1;

    if (count === 0) {
      cursor += 2;
    } else {
      modeChunks.forEach((chunk, i) => {
        const n = lineCount(chunk);
        // The first line of a mode chunk is the "// --- mode: id ---" marker; glsl line 1 is the next line
        map.push({ kind: 'mode', id: modes[i].id, startLine: cursor, endLine: cursor + n - 1, bodyStart: cursor + 1 });
        cursor += n + 1;
      });
    }

    const evalLines = lineCount(evalScene);
    map.push({ kind: 'section', name: 'evalScene', startLine: cursor, endLine: cursor + evalLines - 1, bodyStart: cursor });
    cursor += evalLines + 1;

    const mainLines = lineCount(MAIN_GLSL);
    map.push({ kind: 'section', name: 'main', startLine: cursor, endLine: cursor + mainLines - 1, bodyStart: cursor });
    return map;
  }

  // Fragment shader assembly: registered background modes, dual-color, dual-time crossfade (GLSL ES 3.00)
  //   opts.activeEps   minimum weight counted as active (default 0.001)
  //   opts.modes       optional custom mode list (default AA.MODES); does not touch AA.MODES or lastLineMap
  //   opts.outLineMap  optional array that receives the section line map of this build
  function buildFragmentSource(opts = {}) {
    const activeEps = fmtFloat(opts.activeEps ?? 0.001);
    const customModes = Array.isArray(opts.modes);
    const modes = customModes ? opts.modes : AA.MODES;
    const count = modes.length;
    if (count === 0) console.error('[AA.SHADERS] No background modes registered; fragment shader cannot be built.');

    const header = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision mediump float;
precision mediump int;
#endif
out vec4 fragColor;
#define MODE_COUNT ${count}
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_color2;
uniform float u_weights[MODE_COUNT];
uniform float u_brightness;
uniform float u_vignette;
uniform float u_time2;
uniform float u_timeMix;
uniform int u_octaves;
${modes.map(m => `const float ${m.expConst}=${fmtFloat(m.exposure)};`).join('\n')}`;

    const modeChunks = modes.map(m => `// --- mode: ${m.id} ---\n${m.glsl}`);
    const modeBlocks = modeChunks.join('\n\n');

    const evalScene = `// --- Scene evaluation (weighted sum of active modes) ---
vec3 evalScene(vec2 uv,float t){
  vec3 c=vec3(0.0);
${modes.map((m, i) => `  if(u_weights[${i}]>${activeEps})c+=${m.fnName}(uv,t)*${m.expConst}*u_weights[${i}];`).join('\n')}
  return c;
}`;

    const lineMap = computeLineMap(header, count, modes, modeChunks, evalScene);
    if (Array.isArray(opts.outLineMap)) {
      opts.outLineMap.length = 0;
      lineMap.forEach(e => opts.outLineMap.push(e));
    }
    if (!customModes) SHADERS.lastLineMap = lineMap;

    return [header, SHARED_GLSL, modeBlocks, evalScene, MAIN_GLSL].join('\n\n');
  }

  // Describes where a line of the assembled source belongs: "[mode:<id> line N]" or "[section:<name> line N]"
  function locateLine(lineMap, line) {
    const e = lineMap.find(x => line >= x.startLine && line <= x.endLine);
    if (!e) return '';
    const local = line - e.bodyStart + 1;
    if (e.kind === 'mode') return local < 1 ? `[mode:${e.id} marker]` : `[mode:${e.id} line ${local}]`;
    return `[section:${e.name} line ${local}]`;
  }

  // Appends the offending mode id / section and its local line number to each line-numbered entry of a
  // WebGL shader info log (ANGLE "ERROR: 0:N:", Mesa "0:N(", NVIDIA "0(N)"); other lines are left unchanged
  function formatShaderError(log, lineMap = SHADERS.lastLineMap) {
    if (typeof log !== 'string' || !log || !Array.isArray(lineMap) || lineMap.length === 0) return log;
    const patterns = [
      /^(\s*(?:ERROR|WARNING):\s*\d+:)(\d+)(:)/,
      /^(\s*\d+:)(\d+)(\()/,
      /^(\s*\d+\()(\d+)(\))/
    ];
    return log.split('\n').map(text => {
      for (const re of patterns) {
        const m = re.exec(text);
        if (m) {
          const where = locateLine(lineMap, Number(m[2]));
          return where ? text + ' ' + where : text;
        }
      }
      return text;
    }).join('\n');
  }

  const SHADERS = { vsSource, fsSource: '', buildFragmentSource, lastLineMap: [], formatShaderError };
  SHADERS.fsSource = buildFragmentSource({ activeEps: 0.001 });

  AA.SHADERS = SHADERS;
})(window.AA);
