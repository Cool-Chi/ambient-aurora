(function (AA) {
  // Vertex shader: bufferless full-screen oversized triangle from gl_VertexID (WebGL2)
  const vsSource = `#version 300 es
void main(){
  vec2 pos=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  gl_Position=vec4(pos*2.0-1.0,0.0,1.0);
}`;

  // One-time consistency check: registration order must match UI_CONFIG.BG_MODES (u_weights[i] <-> BG_MODES[i])
  const cfgModes = AA.UI_CONFIG && AA.UI_CONFIG.BG_MODES;
  const modeIds = AA.MODE_IDS;
  if (!cfgModes || modeIds.length !== cfgModes.length || modeIds.some((id, i) => id !== cfgModes[i])) {
    console.warn('[AA.SHADERS] MODE_IDS does not match UI_CONFIG.BG_MODES:', modeIds, cfgModes);
  }

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

  // Fragment shader assembly: registered background modes, dual-color, dual-time crossfade (GLSL ES 3.00)
  function buildFragmentSource(opts = {}) {
    const activeEps = fmtFloat(opts.activeEps ?? 0.001);
    const modes = AA.MODES;
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

    const modeBlocks = modes.map(m => `// --- mode: ${m.id} ---\n${m.glsl}`).join('\n\n');

    const evalScene = `// --- Scene evaluation (weighted sum of active modes) ---
vec3 evalScene(vec2 uv,float t){
  vec3 c=vec3(0.0);
${modes.map((m, i) => `  if(u_weights[${i}]>${activeEps})c+=${m.fnName}(uv,t)*${m.expConst}*u_weights[${i}];`).join('\n')}
  return c;
}`;

    return [header, SHARED_GLSL, modeBlocks, evalScene, MAIN_GLSL].join('\n\n');
  }

  const fsSource = buildFragmentSource({ activeEps: 0.001 });

  AA.SHADERS = { vsSource, fsSource, buildFragmentSource };
})(window.AA);
