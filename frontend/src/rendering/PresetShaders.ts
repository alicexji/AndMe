export type PresetMode = 'bloom' | 'matrix' | 'particles' | 'signals' | 'notation' | 'currents' | 'ledger'
export const isPaper = (mode: PresetMode) => ['notation', 'currents', 'ledger'].includes(mode)
export const isStrip = (mode: PresetMode) => mode === 'signals' || mode === 'currents'

// Long traces are narrow tessellated strips, not full-screen fragment shaders.
export function presetVertex(mode: PresetMode) {
  const strip = isStrip(mode)
  return `#version 300 es
  in vec2 aPosition;
  in vec4 aBloom;
  in vec4 aColor;
  in vec4 aShape;
  uniform mat3 uProjectionMatrix, uWorldTransformMatrix, uTransformMatrix;
  uniform float uTime;
  out vec2 vPoint;
  out vec4 vColor;
  out vec4 vShape;
  out vec2 vSize;
  void main() {
    vColor = aColor; vShape = aShape; vSize = aBloom.zw;
    vPoint = aPosition;
    vec2 position;
    ${strip ? `
      float u = (aPosition.x + 1.0) * .5;
      float phase = aShape.z;
      float amplitude = 15.0 + aBloom.w * 76.0;
      float curve = ${mode === 'currents' ? 'sin(u * 6.283 + aShape.x) * amplitude + sin(u * 3.14159 + phase * .35) * amplitude * .35' : 'sin(u * (8.0 + aShape.w * 12.0) + phase) * amplitude + cos(u * 5.0 - phase * .4) * amplitude * .25'};
      float halfWidth = ${mode === 'currents' ? '1.4 + aBloom.w * 4.0' : '.65 + aBloom.w * 1.6'};
      position = vec2(u * aBloom.z, aBloom.y + curve * sin(u * 3.14159) + aPosition.y * halfWidth);
      vPoint = vec2(u * aBloom.z, aPosition.y);
    ` : `
      float angle = ${mode === 'matrix' ? 'aShape.x + sin(aShape.z) * .12' : '0.0'};
      mat2 rotation = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
      position = aBloom.xy + rotation * aPosition * aBloom.z;
    `}
    gl_Position = vec4((uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(position,1.0)).xy,0.0,1.0);
  }`
}

const distanceFunctions = `
float edge(float d) { float aa = max(fwidth(d), .001); return 1.0 - smoothstep(-aa, aa, d); }
float box(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q,0.0)) + min(max(q.x,q.y),0.0); }
float line(vec2 p, vec2 a, vec2 b, float width) {
  vec2 d=b-a; return length(p-a-d*clamp(dot(p-a,d)/dot(d,d),0.0,1.0))-width;
}
`
export function presetFragment(mode: PresetMode) {
  const body: Record<Exclude<PresetMode, 'bloom'>, string> = {
    matrix: `
      float kind = mod(floor(vShape.x * 10.0),4.0);
      float extent = .28 + vSize.y * .48;
      float stroke = 1.1 / vSize.x;
      float d;
      if (kind < 1.0) d=box(vPoint,vec2(extent));
      else if(kind < 2.0) d=abs(length(vPoint)-extent)-stroke;
      else if(kind < 3.0) d=min(box(vPoint,vec2(extent,stroke)),box(vPoint,vec2(stroke,extent)));
      else d=line(vPoint,vec2(-extent,extent),vec2(extent,-extent),stroke);
      coverage=edge(d);
      coverage=max(coverage,edge(abs(box(vPoint,vec2(.9)))-.45/vSize.x)*.12*uComplexity);
    `,
    particles: `
      vec2 p=vPoint;
      float d=length(p*vec2(1.0,1.8));
      coverage=edge(d-.45)*.85 + exp(-d*d*7.0)*.15;
    `,
    signals: `
      coverage=(1.0-smoothstep(.65,1.0,abs(vPoint.y))) * smoothstep(0.0,25.0,vPoint.x) * (1.0-smoothstep(vSize.x-25.0,vSize.x,vPoint.x));
    `,
    currents: `
      float period=15.0+vShape.w*28.0;
      float phase=fract(vPoint.x/period-uTime*(.25+vShape.w*.4)+vShape.x);
      float aa=max(fwidth(phase),.002);
      coverage=(1.0-smoothstep(.65-aa,.65+aa,phase))*(1.0-smoothstep(.65,1.0,abs(vPoint.y)));
    `,
    notation: `
      vec2 p=vPoint;
      float kind=mod(floor(vShape.x*10.0),4.0);
      float stroke=1.1/vSize.x;
      float lengthScale=.3+vSize.y*.5;
      float d;
      if(kind<1.0) {
        d=min(length((p-vec2(-.3,0.0))*vec2(1.0,1.35))-.11,line(p,vec2(-.22,0.0),vec2(-.22,-.7),stroke));
        d=min(d,line(p,vec2(-.22,-.7),vec2(.3,-.48),stroke*1.3));
      } else if(kind<2.0) {
        d=line(p,vec2(-lengthScale,0.0),vec2(lengthScale,0.0),stroke);
        d=min(d,min(length(p-vec2(-lengthScale,0.0)),length(p-vec2(lengthScale,0.0)))-.08);
      } else if(kind<3.0) {
        d=min(line(p,vec2(-.7,.25),vec2(-.25,-.25),stroke),line(p,vec2(-.25,-.25),vec2(.25,.25),stroke));
        d=min(d,line(p,vec2(.25,.25),vec2(.7,-.2),stroke));
      } else d=box(p,vec2(lengthScale,.055+vSize.y*.06));
      coverage=edge(d);
      coverage=max(coverage,edge(abs(length(p-vec2(.6,-.45))-.07)-stroke)*uComplexity*.5);
    `,
    ledger: `
      coverage=edge(box(vPoint,vec2(.94)))*.75;
      float ring=edge(abs(length(vPoint)-(.2+vSize.y*.45+sin(vShape.z)*.015))-1.3/vSize.x);
      float cut=edge(box(vPoint-vec2(.27,0.0),vec2(.028,.78)));
      color=mix(color,vec3(.10,.12,.13),max(ring,cut*uComplexity)*.85);
    `,
  }
  return `#version 300 es
  precision highp float;
  in vec2 vPoint;
  in vec4 vColor;
  in vec4 vShape;
  in vec2 vSize;
  uniform float uTime;
  uniform float uComplexity;
  out vec4 finalColor;
  ${distanceFunctions}
  void main() {
    float coverage=0.0;
    vec3 color=vColor.rgb;
    ${body[mode as Exclude<PresetMode, 'bloom'>]}
    float alpha=clamp(coverage*vColor.a,0.0,1.0);
    finalColor=vec4(color*alpha,alpha);
  }`
}

export function presetGeometry(mode: PresetMode) {
  if (!isStrip(mode)) return { positions: new Float32Array([-1,-1,1,-1,1,1,-1,1]), indices: new Uint16Array([0,1,2,0,2,3]) }
  const segments=96, positions=new Float32Array((segments+1)*4), indices=new Uint16Array(segments*6)
  for(let i=0;i<=segments;i++) { positions.set([i/segments*2-1,-1,i/segments*2-1,1],i*4) }
  for(let i=0;i<segments;i++) { const j=i*2; indices.set([j,j+2,j+1,j+1,j+2,j+3],i*6) }
  return { positions, indices }
}
