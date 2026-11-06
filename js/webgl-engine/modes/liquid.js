(function (AA) {
  AA.registerMode({
    id: 'liquid',
    label: { en: 'Liquid', zh: '液態' },
    exposure: 0.92,
    heavy: false,
    glsl: `
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
`
  });
})(window.AA);
