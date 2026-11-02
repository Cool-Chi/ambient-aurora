(function (AA) {
const vsSource = `attribute vec2 position;void main(){gl_Position=vec4(position,0.0,1.0);}`;
const fsSource = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_resolution;uniform float u_time;uniform vec3 u_color;uniform float u_weights[5];uniform float u_brightness;uniform float u_vignette;uniform float u_time2;uniform float u_timeMix;float hash(float p){p=fract(p*0.1031);p*=p+33.33;p*=p+p;return fract(p);}
float hash(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);
vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i+vec2(0.0,0.0)),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}float fbm(vec2 p){
float f=0.0;float amp=0.5;for(int i=0;i<4;i++){f +=amp*noise(p);p*=2.0;amp*=0.5;}return f;}vec3 renderSilk(vec2 uv,float u_time){vec2 p=uv*2.0-1.0;p.x*=u_resolution.x/u_resolution.y;
float t=u_time*0.25;vec2 q=p;q.x +=sin(p.y*1.5+t*0.8)*0.6;q.y +=cos(p.x*1.5+t*0.6)*0.6;vec2 r=p;r.x +=cos(q.y*2.0+sin(q.x*1.8+t))*0.5;
r.y +=sin(q.x*2.0+cos(q.y*1.8+t*0.9))*0.5;float folds=(sin(r.x*2.5+r.y*2.0+t)+cos(r.x*1.8-r.y*2.2-t*0.7))*0.5;float sheen=pow(clamp(folds*0.5+0.5,0.0,1.0),3.0);
vec3 col=mix(u_color*0.15,u_color*1.1,smoothstep(-1.0,0.5,folds));col +=mix(u_color*1.8,vec3(1.0),0.35)*sheen*0.65;return col;}
vec3 renderIntelligence(vec2 uv,float u_time){vec2 dc=abs(uv-0.5)*2.0;float edge=max(pow(dc.x,8.0),pow(dc.y,8.0));
return u_color*smoothstep(0.4,1.2,edge+fbm(uv*2.0-u_time*0.2)*0.4)*smoothstep(0.0,0.4,length(dc))*3.0;}vec3 renderStardust(vec2 uv,float u_time){vec2 p=(uv-0.5)*2.0;
p.x*=u_resolution.x/u_resolution.y;float nebula=pow((fbm(p*1.5-u_time*0.05)*0.6+fbm(p*3.0+u_time*0.08)*0.4),2.5)*1.5;vec2 grid=p*20.0;vec2 id=floor(grid);
vec2 fv=fract(grid)-0.5;float dist=length(fv-(vec2(hash(id+vec2(1.3,7.1)),hash(id+vec2(7.1,1.3)))-0.5));
float star=smoothstep(0.12,0.0,dist)*(sin(u_time*2.0+hash(dot(id,vec2(1.0,25.0)))*25.0)*0.5+0.5)*step(0.7,hash(dot(id,vec2(3.7,1.7))));
return u_color*nebula+vec3(star*0.8);}vec3 renderLiquid(vec2 uv,float u_time){vec2 p=uv*2.0-1.0;p.x*=u_resolution.x/u_resolution.y;float t=u_time*0.2;
vec2 c1=vec2(sin(t)*0.8,cos(t*0.6)*0.6);vec2 c2=vec2(cos(t*1.2)*0.7,sin(t*0.9)*0.7);vec2 c3=vec2(sin(t*0.7+2.0)*0.6,cos(t*1.1+1.0)*0.6);
float w1=smoothstep(2.0,0.0,length(p-c1));float w2=smoothstep(2.0,0.0,length(p-c2));float w3=smoothstep(2.0,0.0,length(p-c3));vec3 col1=u_color*1.2;
vec3 col2=mix(u_color,vec3(1.0),0.3);vec3 col3=u_color*0.7;vec3 bg=u_color*0.15;return bg+col1*w1+col2*w2+col3*w3;}vec3 renderHorizon(vec2 uv,float u_time){vec2 p=uv*2.0-1.0;
p.x*=u_resolution.x/u_resolution.y;float curve=-0.7+sin(p.x*0.6+u_time*0.1)*0.15+cos(p.x*0.3-u_time*0.05)*0.1;float dist=p.y-curve;float primaryGlow=exp(-dist*2.5);
float coreGlow=exp(-dist*8.0);float n=fbm(p*2.0+vec2(u_time*0.05,0.0));float atmosphere=primaryGlow*(0.7+n*0.5);float mask=smoothstep(-0.05,0.1,dist);vec2 grid=p*12.0;
vec2 id=floor(grid);vec2 fv=fract(grid)-0.5;float starDist=length(fv-(vec2(hash(id+2.0),hash(id+5.1))-0.5));
float star=smoothstep(0.08,0.0,starDist)*step(0.92,hash(id*7.3));float twinkle=sin(u_time*1.5+hash(id)*20.0)*0.5+0.5;float skyMask=smoothstep(0.0,1.0,p.y);
vec3 glowColor=u_color*atmosphere*mask+(u_color*1.5+0.2)*coreGlow*mask;vec3 starColor=vec3(star*twinkle*0.5*skyMask);return glowColor+starColor;}
vec3 evalScene(vec2 uv,float t){vec3 c=vec3(0.0);if(u_weights[0]>0.001)c+=renderSilk(uv,t)*u_weights[0];if(u_weights[1]>0.001)c+=renderIntelligence(uv,t)*u_weights[1];if(u_weights[2]>0.001)c+=renderStardust(uv,t)*u_weights[2];if(u_weights[3]>0.001)c+=renderLiquid(uv,t)*u_weights[3];if(u_weights[4]>0.001)c+=renderHorizon(uv,t)*u_weights[4];return c;}
void main(){
vec2 uv=gl_FragCoord.xy/u_resolution.xy;vec2 p=(uv-0.5)*2.0;p.x*=u_resolution.x/u_resolution.y;vec3 c=evalScene(uv,u_time);
if(u_timeMix>0.001)c=mix(c,evalScene(uv,u_time2),smoothstep(0.0,1.0,u_timeMix));
vec3 lit=c*clamp(1.0-length(p)*u_vignette,0.0,1.0)*u_brightness;
float dither=(hash(gl_FragCoord.xy)-0.5)*0.008;
float ditherMask=smoothstep(0.0,0.02,max(lit.r,max(lit.g,lit.b)));
gl_FragColor=vec4(max(lit+vec3(dither*ditherMask),0.0),1.0);}`;
AA.SHADERS = { vsSource, fsSource };
})(window.AA);
