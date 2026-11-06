(function (AA) {
  AA.registerMode({
    id: 'dust',
    label: { en: 'Dust', zh: '星塵' },
    exposure: 1.48,
    glsl: `
vec3 renderDust(vec2 uv,float u_time){
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
`
  });
})(window.AA);
