export const STAFF_TOP = 88
export const STAFF_COUNT = 3
export interface ScoreNode { key: string; x: number; staff: number; value: number; secondary: number; opacity: number; color: number[] }
export const NOTATION_PALETTE = ['a90046','B23917','FF2e02','e5b673','ff9102','ff7202','ff026b','02d9ff','3a86b2'].map(hex => [0,2,4].map(i => parseInt(hex.slice(i,i+2),16)/255))
type FallingNode = { born: number; points: {x:number;y:number}[]; color:number[] }
const flights = new WeakMap<Float32Array, { next:number; serial:number; nodes:FallingNode[] }>()
function nodeColor(node:ScoreNode) {
  let hash=0
  for(const character of node.key) hash=(Math.imul(hash,31)+character.charCodeAt(0))|0
  return NOTATION_PALETTE[(hash>>>0)%NOTATION_PALETTE.length]
}
export function scoreY(staff: number, metric: number, height = 800) {
  const gap = Math.max(1, height - STAFF_TOP - 72) / STAFF_COUNT
  return STAFF_TOP + staff * gap + (8 - Math.round(Math.max(0, Math.min(1, metric)) * 8)) * gap * .05
}

// All translucent fields, graph edges, and dots share one antialiased GPU batch.
export function composeScore(nodes: ScoreNode[], time: number, complexity: number, buffer: Float32Array, width = 1000, height = 800) {
  let count = 0
  nodes = nodes.map(n => ({...n,color:nodeColor(n)}))
  const y = (n: ScoreNode) => scoreY(n.staff, n.value, height)
  const mark = (x:number,y:number,w:number,h:number,type:number,color:number[],opacity:number,angle=0) => {
    if(count >= buffer.length / 12) return
    const i = count++ * 12
    buffer.set([x,y,w,h,...color,opacity,type,0,angle,0],i)
  }
  // Multiple narrow, tall bands per record build an overlapping field across the page.
  const bands = 5 + Math.floor(complexity / 25)
  const span = Math.max(1, width - 40)
  const gap = Math.max(1, height - STAFF_TOP - 72) / STAFF_COUNT
  for(const n of nodes) for(let k=0;k<bands;k++) {
    const variation = (n.secondary + k * .381966) % 1
    const x = 20 + ((n.x - 20 + k * span / bands) % span + span) % span
    const center = scoreY(n.staff, n.secondary, height) + gap * .18
    mark(x,center,18,36,1,n.color,n.opacity * (.075 + variation * .09))
  }
  const arc = (a:ScoreNode,b:ScoreNode) => {
    const ay=y(a),by=y(b),cx=(a.x+b.x)/2
    const cy=Math.min(ay,by)-Math.min(gap*.8,28+Math.abs(b.x-a.x)*.22)
    const color=a.color
    let lx=a.x,ly=ay
    for(let step=1;step<=40;step++) {
      const t=step/40,q=1-t
      const nx=q*q*a.x+2*q*t*cx+t*t*b.x,ny=q*q*ay+2*q*t*cy+t*t*by
      const dx=nx-lx,dy=ny-ly
      mark((lx+nx)/2,(ly+ny)/2,Math.hypot(dx,dy)/2+.3,1.4,2,color,Math.min(a.opacity,b.opacity)*.85,Math.atan2(dy,dx))
      lx=nx;ly=ny
    }
  }
  // Persistent graph edges include several links between neighboring systems.
  const groups=Array.from({length:STAFF_COUNT},(_,staff)=>nodes.filter(n=>n.staff===staff).sort((a,b)=>a.x-b.x||a.key.localeCompare(b.key)))
  for(const group of groups) {
    if(!group.length) continue
    const limit=4+Math.floor(complexity/12)
    const stride=Math.max(1,Math.ceil((group.length-1)/limit))
    for(let i=0;i<group.length-1;i+=stride) {
      const target=Math.min(group.length-1,i+Math.max(1,Math.floor(group.length/5)))
      arc(group[i],group[target])
    }
  }
  for(let i=1;i<groups.length;i++) {
    const previous=groups[i-1],current=groups[i]
    if(!previous.length || !current.length) continue
    for(let k=0;k<Math.min(5,previous.length,current.length);k++) {
      arc(previous[Math.floor(k*previous.length/5)],current[Math.min(current.length-1,Math.floor((k+.5)*current.length/5))])
    }
  }
  for(const n of nodes) mark(n.x,y(n),13,13,0,n.color,n.opacity)

  // Snapshot each flight at birth: feed expiry/reordering cannot teleport or hide it.
  let state=flights.get(buffer)
  if(!state || time<state.next-1) {
    state={next:time,serial:0,nodes:[]}
    flights.set(buffer,state)
  }
  if(nodes.length && time>=state.next) {
    const serial=state.serial++
    const route=groups.filter(group=>group.length).map((group,i)=>group[(serial*7+i*3)%group.length])
    const first=route[0],last=route[route.length-1]
    const points=[{x:first.x/width,y:-30/height},...route.map(n=>({x:n.x/width,y:y(n)/height})),{x:Math.max(.03,Math.min(.97,last.x/width+(serial%2?.16:-.16))),y:1+50/height}]
    state.nodes.push({born:time,points,color:NOTATION_PALETTE[serial%NOTATION_PALETTE.length]})
    state.next=time+.48
  }
  state.nodes=state.nodes.filter(f=>time-f.born<(f.points.length-1)*1.05)
  for(const f of state.nodes) {
    const phase=(time-f.born)/1.05,index=Math.floor(phase),t=phase-index
    const a=f.points[index],b=f.points[index+1]
    if(!a || !b) continue
    const x=(a.x+(b.x-a.x)*t)*width
    const y=(a.y+(b.y-a.y)*t)*height-(index?Math.sin(Math.PI*t)*65:0)
    mark(x,y,13,13,0,f.color,1)
  }
  return count
}

export const notationVertex=`#version 300 es
in vec2 aPosition;
in vec4 aBloom;
in vec4 aColor;
in vec4 aShape;
uniform mat3 uProjectionMatrix,uWorldTransformMatrix,uTransformMatrix;
out vec2 vPoint;
out vec2 vSize;
out vec4 vColor;
out float vType;
void main() {
  vPoint=aPosition;vSize=aBloom.zw;vColor=aColor;vType=aShape.x;
  float angle=aShape.z;
  mat2 rotation=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
  vec2 position=aBloom.xy+rotation*(aPosition*aBloom.zw);
  gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(position,1.0)).xy,0,1);
}`
export const notationFragment=`#version 300 es
precision highp float;
in vec2 vPoint;
in vec2 vSize;
in vec4 vColor;
in float vType;
out vec4 finalColor;
void main() {
  float coverage;
  float r=length(vPoint);
  if(vType<.5 || vType>2.5) {
    float d=vType>3.5 ? abs(r-.72)-.07 : r-.76;
    float aa=max(fwidth(d),.001);
    coverage=1.0-smoothstep(-aa,aa,d);
  } else {
    vec2 aa=max(fwidth(vPoint),vec2(.001));
    coverage=(1.0-smoothstep(1.0-aa.x,1.0,abs(vPoint.x)))*(1.0-smoothstep(1.0-aa.y,1.0,abs(vPoint.y)));
  }
  float alpha=coverage*vColor.a;
  finalColor=vec4(vColor.rgb*alpha,alpha);
}`
