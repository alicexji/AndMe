import { Application, Buffer, BufferUsage, Geometry, GlProgram, Mesh, Shader, Ticker, UniformGroup } from 'pixi.js'
import { BloomSimulation, DEPARTURE_MS } from './BloomSimulation'
import { BLOOM_STRIDE, type BloomFeatures } from './protocol'
import { bloomFragment, bloomVertex } from './BloomShader'
import { GRID_SPACING, gridAnchor } from './BloomGrid'
import { composeScore, type ScoreNode, notationVertex, notationFragment } from './NotationScore'
import { isPaper, isStrip, presetVertex, presetFragment, presetGeometry, type PresetMode } from './PresetShaders'


const FIXED_STEP = 1 / 30
const INSTANCE_STRIDE = 12
// Up to 180 source records plus retiring records; particles expand each into at most 27 marks.
const MAX_INSTANCES = 360 * 30
const PALETTE = [0xff4a22,0x1646d8,0xf4cd24,0xd84967,0x58db8b,0x739bbc].map(c => [(c>>16)/255,((c>>8)&255)/255,(c&255)/255])
const smoothstep = (start: number, end: number, value: number) => {
  const x = Math.max(0, Math.min(1, (value - start) / (end - start)))
  return x * x * (3 - 2 * x)
}
export interface BloomRendererControls { lifetime: number; density: number; intensity: number; complexity: number; motion: number }

export class PixiBloomRenderer {
  private app = new Application()
  private simulation = new BloomSimulation()
  private controls: BloomRendererControls = { lifetime: 16, density: 82, intensity: 82, complexity: 78, motion: 65 }
  private features: BloomFeatures = { data: new Float32Array(), keys: [] }
  private instanceData: Float32Array
  private scoreNodes: ScoreNode[] = []
  private buffer: Buffer | null = null
  private geometry: Geometry | null = null
  private shader: Shader | null = null
  private mesh: Mesh<Geometry, Shader> | null = null
  private uniforms = new UniformGroup({ uTime: { value: 0, type: 'f32' }, uComplexity: { value: .78, type: 'f32' } })
  private accumulator = 0
  private flowTime = 0
  private sample = new Float32Array(4)
  private destroyed = false
  private initialized = false
  private failures = 0
  private visible = true
  private resizeObserver: ResizeObserver | null = null
  private intersectionObserver: IntersectionObserver | null = null
  private dotGrid: HTMLDivElement | null = null
  private performanceElement: HTMLDivElement | null = null
  private frameIntervals: number[] = []
  private frameWork = 0
  private lastFrame = 0
  private statsStarted = 0

  constructor(private host: HTMLElement, private onFailure: (error: Error) => void, private mode: PresetMode = 'bloom') {
    const capacity = mode === 'particles' || mode === 'notation' ? MAX_INSTANCES : isStrip(mode) ? 360 * 3 : 360
    this.instanceData = new Float32Array(capacity * INSTANCE_STRIDE)
  }

  async init() {
    try {
      await this.app.init({ preference: 'webgl', preferWebGLVersion: 2, powerPreference: 'high-performance', background: isPaper(this.mode) ? 0xeee9dc : this.mode === 'bloom' ? 0x000000 : 0x11110f,
        antialias: false, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoStart: false, sharedTicker: false })
      if (this.destroyed) { this.app.destroy(true, { children: true }); return }
      this.initialized = true
      this.host.replaceChildren(this.app.canvas)
      this.app.canvas.className = this.mode === 'bloom' ? 'pixi-bloom-canvas' : 'pixi-art-canvas'
      if (this.mode === 'bloom') {
        this.dotGrid = document.createElement('div')
        this.dotGrid.className = 'bloom-dot-grid'
        this.dotGrid.setAttribute('aria-hidden', 'true')
        this.dotGrid.style.backgroundSize = `${GRID_SPACING}px ${GRID_SPACING}px`
        this.host.appendChild(this.dotGrid)
      }
      this.buffer = new Buffer({ data: this.instanceData, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST, shrinkToFit: false })
      const shape = presetGeometry(this.mode)
      this.geometry = new Geometry({
        attributes: {
          aPosition: { buffer: shape.positions, format: 'float32x2' },
          aBloom: { buffer: this.buffer, format: 'float32x4', stride: 48, offset: 0, instance: true },
          aColor: { buffer: this.buffer, format: 'float32x4', stride: 48, offset: 16, instance: true },
          aShape: { buffer: this.buffer, format: 'float32x4', stride: 48, offset: 32, instance: true },
        },
        indexBuffer: shape.indices, instanceCount: 0,
      })
      this.shader = new Shader({ glProgram: new GlProgram({ vertex: this.mode === 'bloom' ? bloomVertex : this.mode === 'notation' ? notationVertex : presetVertex(this.mode), fragment: this.mode === 'bloom' ? bloomFragment : this.mode === 'notation' ? notationFragment : presetFragment(this.mode), name: `art-${this.mode}`, preferredFragmentPrecision: 'highp' }), resources: { bloomUniforms: this.uniforms } })
      this.mesh = new Mesh({ geometry: this.geometry, shader: this.shader })
      this.mesh.blendMode = this.mode === 'bloom' || this.mode === 'particles' ? 'screen' : 'normal'
      this.app.stage.addChild(this.mesh)
      if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf')) {
        this.performanceElement = document.createElement('div')
        this.performanceElement.className = 'pixi-performance'
        this.host.appendChild(this.performanceElement)
      }
      // Own the render call so the timing includes CPU-side WebGL submission.
      this.app.ticker.remove(this.app.render, this.app)
      this.app.ticker.add(this.tick)
      this.app.canvas.addEventListener('webglcontextlost', this.contextLost)
      this.resizeObserver = new ResizeObserver(this.resize)
      this.resizeObserver.observe(this.host)
      this.intersectionObserver = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.syncPlayback() })
      this.intersectionObserver.observe(this.host)
      document.addEventListener('visibilitychange', this.syncPlayback)
      this.resize()
      this.syncPlayback()
    } catch (error) { this.fail(error) }
  }

  setFeatures(features: BloomFeatures) {
    if (this.destroyed) return
    if (features.data.length !== features.keys.length * BLOOM_STRIDE || features.data.some(value => !Number.isFinite(value))) {
      this.fail(new Error('Invalid bloom feature buffer')); return
    }
    this.features = features
    this.reconcile()
  }

  setControls(controls: BloomRendererControls) {
    this.controls = { lifetime: Math.max(1, controls.lifetime), density: Math.max(0, Math.min(100, controls.density)), intensity: Math.max(0, Math.min(100, controls.intensity)), complexity: Math.max(0, Math.min(100, controls.complexity)), motion: Math.max(0, Math.min(100, controls.motion)) }
    this.reconcile()
  }

  private reconcile() {
    this.simulation.reconcile(this.features, Math.floor(30 + this.controls.density * 1.5), performance.now(), this.controls.lifetime)
  }

  private resize = () => {
    if (!this.initialized || this.destroyed) return
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight)
    this.app.renderer.resize(width, height)
    if (this.mode === 'ledger') this.host.style.setProperty('--ledger-cell', `${Math.max(34, Math.min(62, width / 14))}px`)
    this.simulation.setSize(width, height)
  }

  private syncPlayback = () => {
    if (!this.initialized || this.destroyed) return
    if (this.visible && !document.hidden) {
      this.lastFrame = 0; this.accumulator = 0; this.frameIntervals.length = 0; this.statsStarted = performance.now()
      this.simulation.prune(performance.now(), this.controls.lifetime)
      this.app.start()
    } else this.app.stop()
  }

  private tick = (ticker: Ticker) => {
    if (this.destroyed) return
    const started = performance.now()
    try {
      const dt = Math.min(.1, ticker.deltaMS / 1000)
      this.simulation.prune(started, this.controls.lifetime)
      this.flowTime += dt * this.controls.motion / 65
      this.accumulator += dt
      while (this.accumulator >= FIXED_STEP) {
        this.simulation.update(FIXED_STEP, this.controls.motion / 50)
        this.accumulator -= FIXED_STEP
      }
      this.render(this.accumulator / FIXED_STEP, started)
      this.app.render()
      this.failures = 0
      const work = performance.now() - started
      this.frameWork = this.frameWork * .9 + work * .1
      if (this.lastFrame) this.frameIntervals.push(started - this.lastFrame)
      this.lastFrame = started
      if (started - this.statsStarted >= 1000) {
        if (this.performanceElement && this.frameIntervals.length) {
          const sorted = [...this.frameIntervals].sort((a,b) => a-b)
          const mean = sorted.reduce((sum,value) => sum+value,0) / sorted.length
          const p95 = sorted[Math.min(sorted.length-1, Math.floor(sorted.length*.95))]
          this.performanceElement.textContent = `${(1000/mean).toFixed(0)} FPS / ${p95.toFixed(1)} MS P95 / ${this.frameWork.toFixed(2)} MS CPU+SUBMIT / ${this.geometry!.instanceCount} MARKS / ${this.app.renderer.resolution.toFixed(1)}x DPR`
        }
        this.frameIntervals.length = 0; this.statsStarted = started
      }
    } catch (error) {
      if (++this.failures >= 3) this.fail(error)
    }
  }

  private render(interpolation: number, now: number) {
    if (!this.mesh || !this.geometry || !this.buffer) return
    let visible = 0
    this.scoreNodes.length = 0
    for (const state of this.simulation.states.values()) {
      const data = state.features
      const age = Math.max(0, (now - data[6]) / (this.controls.lifetime * 1000))
      const life = smoothstep(0, .1, age) * (1 - smoothstep(.65, 1, age))
      const departure = state.departure === null ? 1 : 1 - smoothstep(0, DEPARTURE_MS, now - state.departure)
      const opacity = life * departure * (.25 + this.controls.intensity / 145)
      if (opacity < .001) continue
      this.simulation.sampleInto(state, interpolation, this.sample)
      const [, , phase, normalized] = this.sample
      if (this.mode === 'notation') {
        this.scoreNodes.push({key:state.key,x:28+data[0]*(this.simulation.width-56),value:normalized,secondary:data[3],opacity,color:PALETTE[Math.floor(data[5])%PALETTE.length]})
        continue
      }
      if (this.mode !== 'bloom') {
        visible = this.writePreset(data, this.sample, age, opacity, visible)
        continue
      }
      // Emit from fixed survey points; only the atmospheric field drifts.
      const x = gridAnchor(data[0], this.simulation.width), y = gridAnchor(data[1], this.simulation.height)
      const radius = 48 + normalized * 102
      const extent = radius * 1.65
      if (x + extent < 0 || y + extent < 0 || x - extent > this.simulation.width || y - extent > this.simulation.height) continue
      if (visible >= this.instanceData.length / INSTANCE_STRIDE) break
      const offset = visible * INSTANCE_STRIDE
      this.instanceData[offset] = x; this.instanceData[offset+1] = y; this.instanceData[offset+2] = radius; this.instanceData[offset+3] = 0
      this.instanceData[offset+4] = .12; this.instanceData[offset+5] = .42; this.instanceData[offset+6] = 1; this.instanceData[offset+7] = opacity
      this.instanceData[offset+8] = data[4]; this.instanceData[offset+9] = age; this.instanceData[offset+10] = phase; this.instanceData[offset+11] = data[3]
      visible++
    }
    if (this.mode === 'notation') visible = composeScore(this.scoreNodes,this.flowTime,this.controls.complexity,this.instanceData,this.simulation.width,this.simulation.height)
    // Broad overlapping fields are fill-rate limited. Keep the CSS dot lattice at
    // native resolution while limiting shader pixels for crowded scenes.
    const nativeResolution = Math.min(window.devicePixelRatio || 1, 2)
    const resolution = this.mode === 'bloom' ? Math.min(nativeResolution, visible > 90 ? 1.25 : visible > 55 ? 1.5 : 2) : nativeResolution
    if (this.app.renderer.resolution !== resolution) {
      this.app.renderer.resize(this.simulation.width, this.simulation.height, resolution)
    }
    // Only live, on-screen instances are uploaded and drawn. Capacity is just reusable bytes.
    this.geometry.instanceCount = visible
    this.mesh.visible = visible > 0
    if (visible) this.buffer.update(visible * INSTANCE_STRIDE * 4)
    this.uniforms.uniforms.uTime = this.flowTime
    this.uniforms.uniforms.uComplexity = this.controls.complexity / 100
    this.uniforms.update()
  }

  private writePreset(data: Float32Array, sample: Float32Array, age: number, opacity: number, count: number) {
    const [sx,sy,phase,value] = sample, width=this.simulation.width, height=this.simulation.height
    const color = PALETTE[Math.floor(data[5]) % PALETTE.length]
    const emit = (x:number,y:number,size:number,alpha:number,seed=data[4]) => {
      if(count>=this.instanceData.length / INSTANCE_STRIDE || (!isStrip(this.mode) && (x+size<0 || y+size<0 || x-size>width || y-size>height))) return
      const o=count++*INSTANCE_STRIDE
      const b=this.instanceData
      b[o]=x; b[o+1]=y; b[o+2]=size; b[o+3]=value
      b[o+4]=color[0]; b[o+5]=color[1]; b[o+6]=color[2]; b[o+7]=alpha
      b[o+8]=seed; b[o+9]=age; b[o+10]=phase; b[o+11]=data[3]
    }
    if(this.mode==='particles') {
      const total=5+Math.floor(value*12+this.controls.complexity*.10)
      for(let k=0;k<total;k++) {
        const angle=phase+k*2.399963, orbit=(12+k*3.5)*(0.5+Math.sin(age*Math.PI)*.5)
        emit(sx+Math.cos(angle)*orbit,sy+Math.sin(angle*1.17)*orbit,2.5+(k%4)*.9,opacity*(.45+(k%3)*.2))
      }
    } else if(isStrip(this.mode)) {
      const layers=1+Math.floor(this.controls.complexity/40)
      for(let k=0;k<layers;k++) emit(0,data[1]*height+k*(6+data[3]*8),width,opacity*(k===0?.72:.2),data[4]+k*.7)
    } else if(this.mode==='matrix'||this.mode==='ledger') {
      const cell=this.mode==='matrix'?70:Math.max(34,Math.min(62,width/14))
      const cols=Math.max(1,Math.floor(width/cell)),rows=Math.max(1,Math.floor(height/cell))
      const x=(Math.min(cols-1,Math.floor(data[0]*cols))+.5)*cell
      const y=(Math.min(rows-1,Math.floor(data[1]*rows))+.5)*cell
      emit(x,y,cell*.47,opacity)
    } else {
      const staff=Math.floor(data[1]*Math.max(1,(height-42)/42))
      emit(data[0]*width,28+staff*42+Math.floor(data[3]*4)*4,18+value*35,opacity)
    }
    return count
  }

  private contextLost = (event: Event) => { event.preventDefault(); this.fail(new Error('WebGL context lost; using Canvas fallback.')) }
  private fail(error: unknown) {
    if (this.destroyed) return
    this.app.stop?.()
    const resolved = error instanceof Error ? error : new Error(String(error))
    console.error('[PixiBloomRenderer]', resolved)
    this.onFailure(resolved)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.resizeObserver?.disconnect(); this.intersectionObserver?.disconnect()
    document.removeEventListener('visibilitychange', this.syncPlayback)
    this.simulation.states.clear()
    if (!this.initialized) return
    this.app.canvas.removeEventListener('webglcontextlost', this.contextLost)
    this.dotGrid?.remove(); this.dotGrid = null
    this.performanceElement?.remove()
    this.app.destroy(true, { children: true })
    this.geometry?.destroy(true)
    this.shader?.destroy(true)
    this.initialized = false
  }
}
