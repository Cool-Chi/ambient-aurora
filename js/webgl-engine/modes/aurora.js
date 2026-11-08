(function (AA) {
  AA.registerMode({
    id: 'aurora',
    label: { en: 'Aurora', zh: '極光' },
    exposure: 1.15,
    glsl: `
vec3 renderAurora(vec2 uv,float u_time){
  vec2 p=uv*2.0-1.0;
  p.x*=u_resolution.x/u_resolution.y;

  float t1=u_time*0.2;
  float w1=sin(p.x*0.65+t1)*0.25+cos(p.x*1.2-t1*0.7)*0.15-0.55;
  float warp1=noise(vec2(p.x*0.5+t1*0.25,p.y*0.35))*0.32;
  float h1=p.y-(w1+warp1);
  float rayNoise1=fbm(vec2(p.x*2.8+sin(p.y*1.8+t1)*0.35+t1*0.45,p.y*0.45-t1*0.15));
  float curtain1=smoothstep(-0.06,0.1,h1)*exp(-max(h1,0.0)*1.6)*(0.6+rayNoise1*0.85);
  float hem1=exp(-abs(h1)*7.5)*0.45;
  float int1=curtain1+hem1;
  float colFactor1=clamp(h1*1.1+(rayNoise1-0.5)*0.25,0.0,1.0);
  vec3 col1=mix(u_color*1.35,u_color2*1.25,smoothstep(0.05,0.8,colFactor1));

  float t2=u_time*0.15;
  float w2=sin(p.x*0.55-t2*0.8+2.0)*0.28+cos(p.x*1.0+t2*0.6)*0.14-0.05;
  float warp2=noise(vec2(p.x*0.45-t2*0.3+2.5,p.y*0.35))*0.3;
  float h2=p.y-(w2+warp2);
  float rayNoise2=fbm(vec2(p.x*2.5-cos(p.y*1.6+t2)*0.35-t2*0.35,p.y*0.4-t2*0.12));
  float curtain2=smoothstep(-0.06,0.1,h2)*exp(-max(h2,0.0)*1.5)*(0.55+rayNoise2*0.8);
  float hem2=exp(-abs(h2)*7.0)*0.4;
  float int2=curtain2+hem2;
  float colFactor2=clamp(h2*1.0+(rayNoise2-0.5)*0.25,0.0,1.0);
  vec3 col2=mix(mix(u_color,u_color2,0.25)*1.25,u_color2*1.4,smoothstep(0.0,0.75,colFactor2));

  vec3 bg=mix(u_color,u_color2,0.35)*0.1;
  vec3 sheen=mix(u_color2,vec3(1.0),0.35)*(pow(rayNoise1,3.0)*curtain1*0.25+pow(rayNoise2,3.0)*curtain2*0.22);

  return bg+col1*int1+col2*int2+sheen;
}
`
  });
})(window.AA);
