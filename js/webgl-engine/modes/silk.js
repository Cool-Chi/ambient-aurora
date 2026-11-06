(function (AA) {
  AA.registerMode({
    id: 'silk',
    label: { en: 'Silk', zh: '絲綢' },
    exposure: 1.05,
    heavy: false,
    glsl: `
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
`
  });
})(window.AA);
