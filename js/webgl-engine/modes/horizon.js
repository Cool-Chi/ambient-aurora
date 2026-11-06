(function (AA) {
  AA.registerMode({
    id: 'horizon',
    label: { en: 'Horizon', zh: '天沿' },
    exposure: 1.18,
    glsl: `
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
`
  });
})(window.AA);
