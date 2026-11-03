(function (AA) {
  // Vertex shader: bufferless full-screen oversized triangle from gl_VertexID (WebGL2)
  const vsSource = `#version 300 es
void main(){
  vec2 pos=vec2((gl_VertexID<<1)&2,gl_VertexID&2);
  gl_Position=vec4(pos*2.0-1.0,0.0,1.0);
}`;

  // Fragment shader: five background modes, dual-color, dual-time crossfade (GLSL ES 3.00)
  const fsSource = `#version 300 es
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision mediump float;
precision mediump int;
#endif
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;
uniform vec3 u_color2;
uniform float u_weights[5];
uniform float u_brightness;
uniform float u_vignette;
uniform float u_time2;
uniform float u_timeMix;
uniform int u_octaves;
const float EXP_SILK=1.05;
const float EXP_GLOW=0.72;
const float EXP_DUST=1.48;
const float EXP_LIQUID=0.92;
const float EXP_HORIZON=1.18;

// --- PCG integer hashes ---
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
}

// --- Mode 1: Silk ---
vec3 renderSilk(vec2 uv,float u_time){
  vec2 p=uv*2.0-1.0;
  p.x*=u_resolution.x/u_resolution.y;
  float t=u_time*0.25;
  vec2 q=p;
  q.x +=sin(p.y*1.5+t*0.8)*0.6;
  q.y +=cos(p.x*1.5+t*0.6)*0.6;
  vec2 r=p;
  r.x +=cos(q.y*2.0+sin(q.x*1.8+t))*0.5;
  r.y +=sin(q.x*2.0+cos(q.y*1.8+t*0.9))*0.5;
  float folds=(sin(r.x*2.5+r.y*2.0+t)+cos(r.x*1.8-r.y*2.2-t*0.7))*0.5;
  float sheen=pow(clamp(folds*0.5+0.5,0.0,1.0),3.0);
  vec3 col=mix(u_color*0.18,mix(u_color,u_color2,0.35)*1.05,smoothstep(-1.0,0.5,folds));
  col +=mix(u_color2*1.7,vec3(1.0),0.28)*sheen*0.7;
  return col;
}

// --- Mode 2: Glow (renderIntelligence) ---
vec3 renderIntelligence(vec2 uv,float u_time){
  vec2 dc=abs(uv-0.5)*2.0;
  float edge=max(pow(dc.x,8.0),pow(dc.y,8.0));
  float grad=clamp(uv.x*0.55+uv.y*0.45+0.2*sin(u_time*0.15),0.0,1.0);
  vec3 edgeCol=mix(u_color,u_color2,smoothstep(0.15,0.85,grad));
  return edgeCol*smoothstep(0.35,1.15,edge+fbm(uv*2.0-u_time*0.2)*0.4)*smoothstep(0.0,0.4,length(dc))*2.6;
}

// --- Mode 3: Dust (renderStardust) ---
vec3 renderStardust(vec2 uv,float u_time){
  vec2 p=(uv-0.5)*2.0;
  p.x*=u_resolution.x/u_resolution.y;
  float n1=fbm(p*1.5-u_time*0.05);
  float nebula=pow(u_octaves>2?(n1*0.6+fbm(p*3.0+u_time*0.08)*0.4):n1,2.1)*1.65;
  float patchNoise=smoothstep(0.28,0.72,noise(p*0.85+vec2(u_time*0.03,-u_time*0.02)));
  vec3 nebCol=mix(u_color,u_color2,patchNoise*0.75);
  vec3 starTint=mix(vec3(1.0),u_color2+0.3,0.35);
  vec2 grid=p*20.0;
  vec2 id=floor(grid);
  vec2 fv=fract(grid)-0.5;
  float dist=length(fv-(vec2(hash(id+vec2(1.3,7.1)),hash(id+vec2(7.1,1.3)))-0.5));
  float star=smoothstep(0.12,0.0,dist)*(sin(u_time*2.0+hash(dot(id,vec2(1.0,25.0)))*25.0)*0.5+0.5)*step(0.7,hash(dot(id,vec2(3.7,1.7))));
  return nebCol*nebula+starTint*(star*0.8);
}

// --- Mode 4: Liquid ---
vec3 renderLiquid(vec2 uv,float u_time){
  vec2 p=uv*2.0-1.0;
  p.x*=u_resolution.x/u_resolution.y;
  float t=u_time*0.2;
  vec2 c1=vec2(sin(t)*0.8,cos(t*0.6)*0.6);
  vec2 c2=vec2(cos(t*1.2)*0.7,sin(t*0.9)*0.7);
  vec2 c3=vec2(sin(t*0.7+2.0)*0.6,cos(t*1.1+1.0)*0.6);
  float w1=smoothstep(2.0,0.0,length(p-c1));
  float w2=smoothstep(2.0,0.0,length(p-c2));
  float w3=smoothstep(2.0,0.0,length(p-c3));
  vec3 col1=u_color*1.15;
  vec3 col2=u_color2*1.15;
  vec3 col3=mix(u_color,u_color2,0.5)*1.05;
  vec3 bg=mix(u_color,u_color2,0.3)*0.14;
  return bg+col1*w1+col2*w2+col3*w3;
}

// --- Mode 5: Horizon ---
vec3 renderHorizon(vec2 uv,float u_time){
  vec2 p=uv*2.0-1.0;
  p.x*=u_resolution.x/u_resolution.y;
  float curve=-0.7+sin(p.x*0.6+u_time*0.1)*0.15+cos(p.x*0.3-u_time*0.05)*0.1;
  float dist=p.y-curve;
  float primaryGlow=exp(-dist*2.5);
  float coreGlow=exp(-dist*8.0);
  float n=fbm(p*2.0+vec2(u_time*0.05,0.0));
  float atmosphere=primaryGlow*(0.7+n*0.5);
  float mask=smoothstep(-0.05,0.1,dist);
  vec2 grid=p*12.0;
  vec2 id=floor(grid);
  vec2 fv=fract(grid)-0.5;
  float starDist=length(fv-(vec2(hash(id+2.0),hash(id+5.1))-0.5));
  float star=smoothstep(0.08,0.0,starDist)*step(0.92,hash(id*7.3));
  float twinkle=sin(u_time*1.5+hash(id)*20.0)*0.5+0.5;
  float skyMask=smoothstep(0.0,1.0,p.y);
  float altMix=clamp(dist*1.4,0.0,1.0);
  vec3 atmoCol=mix(u_color,u_color2,smoothstep(0.0,0.85,altMix));
  vec3 glowColor=atmoCol*atmosphere*mask+(u_color*1.35+u_color2*0.25+0.12)*coreGlow*mask;
  vec3 starColor=vec3(star*twinkle*0.5*skyMask);
  return glowColor+starColor;
}

// --- Scene evaluation (weighted sum of active modes) ---
vec3 evalScene(vec2 uv,float t){
  vec3 c=vec3(0.0);
  if(u_weights[0]>0.001)c+=renderSilk(uv,t)*EXP_SILK*u_weights[0];
  if(u_weights[1]>0.001)c+=renderIntelligence(uv,t)*EXP_GLOW*u_weights[1];
  if(u_weights[2]>0.001)c+=renderStardust(uv,t)*EXP_DUST*u_weights[2];
  if(u_weights[3]>0.001)c+=renderLiquid(uv,t)*EXP_LIQUID*u_weights[3];
  if(u_weights[4]>0.001)c+=renderHorizon(uv,t)*EXP_HORIZON*u_weights[4];
  return c;
}

// --- Entry point ---
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

  AA.SHADERS = { vsSource, fsSource };
})(window.AA);
