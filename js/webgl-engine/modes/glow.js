(function (AA) {
  AA.registerMode({
    id: 'glow',
    label: { en: 'Glow', zh: '光暈' },
    exposure: 0.72,
    glsl: `
vec3 renderGlow(vec2 uv,float u_time){
  vec2 dc=abs(uv-0.5)*2.0;
  float edge=max(pow(dc.x,8.0),pow(dc.y,8.0));
  float grad=clamp(uv.x*0.55+uv.y*0.45+0.2*sin(u_time*0.15),0.0,1.0);
  vec3 edgeCol=mix(u_color,u_color2,smoothstep(0.15,0.85,grad));
  return edgeCol*smoothstep(0.35,1.15,edge+fbm(uv*2.0-u_time*0.2)*0.4)*smoothstep(0.0,0.4,length(dc))*2.6;
}
`
  });
})(window.AA);
