import { Application, Filter, Graphics, Particle, ParticleContainer, Rectangle, Texture, Ticker } from 'pixi.js'
import { BloomSimulation } from './BloomSimulation'
import { BLOOM_STRIDE } from './protocol'

const COLORS = [0xff4a22, 0x1646d8, 0xf4cd24, 0xd84967, 0x58db8b, 0xf3f0e7]
const MAX_SATELLITES = 10
const FIXED_STEP = 1 / 30
const smoothstep = (start: number, end: number, value: number) => {
  const normalized = Math.max(0, Math.min(1, (value - start) / Math.max(.0001, end - start)))
  return normalized * normalized * (3 - 2 * normalized)
}

export interface BloomRendererControls {
  lifetime: number
  density: number
  intensity: number
  complexity: number
  motion: number
}

export class PixiBloomRenderer {
  private app = new Application()
  private simulation = new BloomSimulation()
  private cores = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, color: true } })
  private rings = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, rotation: true, color: true } })
  private satellites = new ParticleContainer({ dynamicProperties: { position: true, vertex: true, color: true } })
  private coreParticles: Particle[] = []
  private ringParticles: Particle[] = []
  private satelliteParticles: Particle[] = []
  private diskTexture: Texture | null = null
  private ringTexture: Texture | null = null
  private controls: BloomRendererControls = { lifetime: 16, density: 82, intensity: 82, complexity: 78, motion: 65 }
  private accumulator = 0
  private elapsed = 0
  private failures = 0
  private destroyed = false
  private initialized = false
  private sample = new Float32Array(4)
  private performanceElement: HTMLDivElement | null = null
  private statsStarted = performance.now()
  private statsFrames = 0
  private averageFrameCost = 0
  private visibleObjects = 0

  constructor(private host: HTMLElement, private onFailure: (error: Error) => void) {}

  async init() {
    try {
      await this.app.init({
        preference: 'webgl', powerPreference: 'high-performance', resizeTo: this.host,
        background: 0x11110f, antialias: true, autoDensity: true,
        resolution: Math.min(window.devicePixelRatio, 2), autoStart: false, sharedTicker: false,
      })
      if (this.destroyed) { this.app.destroy(true); return }
      this.host.replaceChildren(this.app.canvas)
      this.app.canvas.className = 'pixi-bloom-canvas'
      if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('perf')) {
        this.performanceElement = document.createElement('div')
        this.performanceElement.className = 'pixi-performance'
        this.host.appendChild(this.performanceElement)
      }
      const disk = new Graphics().circle(16, 16, 14).fill(0xffffff)
      const ring = new Graphics().circle(18, 18, 14).stroke({ color: 0xffffff, width: 2 })
      this.diskTexture = this.app.renderer.generateTexture({ target: disk, resolution: 4, antialias: true })
      this.ringTexture = this.app.renderer.generateTexture({ target: ring, resolution: 4, antialias: true })
      disk.destroy(); ring.destroy()
      this.app.stage.addChild(this.rings, this.cores, this.satellites)
      this.resizeBounds()
      this.app.renderer.on('resize', this.resizeBounds, this)
      this.app.canvas.addEventListener('webglcontextlost', this.contextLost)
      this.app.ticker.add(this.tick)
      this.initialized = true
      this.syncParticlePool()
      this.app.start()
    } catch (error) {
      this.fail(error)
    }
  }

  setFeatures(features: Float32Array) {
    if (features.some(value => !Number.isFinite(value))) {
      this.fail(new Error('Bloom feature buffer contained invalid numeric data.'), false)
      return
    }
    this.simulation.setFeatures(features)
    if (this.initialized) this.syncParticlePool()
  }

  setControls(controls: BloomRendererControls) {
    this.controls = {
      lifetime: Math.max(1, controls.lifetime), density: Math.max(0, Math.min(100, controls.density)),
      intensity: Math.max(0, Math.min(100, controls.intensity)), complexity: Math.max(0, Math.min(100, controls.complexity)),
      motion: Math.max(0, Math.min(100, controls.motion)),
    }
  }

  // Future GLSL/WGSL effects can be attached without changing simulation or React code.
  setPostProcessFilters(filters: Filter[]) {
    this.app.stage.filters = filters
  }

  private resizeBounds = () => {
    const width = Math.max(1, this.host.clientWidth), height = Math.max(1, this.host.clientHeight)
    this.simulation.setSize(width, height)
    const bounds = new Rectangle(0, 0, width, height)
    this.cores.boundsArea = bounds; this.rings.boundsArea = bounds; this.satellites.boundsArea = bounds
  }

  private syncParticlePool() {
    if (!this.diskTexture || !this.ringTexture) return
    while (this.coreParticles.length < this.simulation.count) {
      const core = new Particle({ texture: this.diskTexture, anchorX: .5, anchorY: .5, alpha: 0 })
      const ring = new Particle({ texture: this.ringTexture, anchorX: .5, anchorY: .5, alpha: 0 })
      this.coreParticles.push(core); this.ringParticles.push(ring)
      this.cores.addParticle(core); this.rings.addParticle(ring)
      for (let index = 0; index < MAX_SATELLITES; index++) {
        const satellite = new Particle({ texture: this.diskTexture, anchorX: .5, anchorY: .5, alpha: 0 })
        this.satelliteParticles.push(satellite); this.satellites.addParticle(satellite)
      }
    }
    for (let index = this.simulation.count; index < this.coreParticles.length; index++) {
      this.coreParticles[index].alpha = 0; this.ringParticles[index].alpha = 0
      for (let satellite = 0; satellite < MAX_SATELLITES; satellite++) this.satelliteParticles[index * MAX_SATELLITES + satellite].alpha = 0
    }
  }

  private tick = (ticker: Ticker) => {
    const started = performance.now()
    try {
      const frameSeconds = Math.min(.1, ticker.deltaMS / 1000)
      this.accumulator += frameSeconds
      while (this.accumulator >= FIXED_STEP) {
        this.elapsed += FIXED_STEP
        this.simulation.update(FIXED_STEP, this.elapsed, this.controls.motion / 50)
        this.accumulator -= FIXED_STEP
      }
      this.render(this.accumulator / FIXED_STEP, performance.now())
      this.failures = 0
    } catch (error) {
      // Contain individual bad frames. Pixi's ticker remains alive and retries next frame.
      this.failures++
      if (this.failures === 3) this.fail(error, false)
    } finally {
      const finished = performance.now()
      this.averageFrameCost = this.averageFrameCost * .92 + (finished - started) * .08
      this.statsFrames++
      if (this.performanceElement && finished - this.statsStarted >= 500) {
        const fps = this.statsFrames * 1000 / (finished - this.statsStarted)
        const resolution = this.app.renderer.resolution
        this.performanceElement.textContent = `${fps.toFixed(0)} FPS  ·  ${this.averageFrameCost.toFixed(2)} MS JS  ·  ${this.visibleObjects} OBJECTS  ·  ${resolution.toFixed(2)}× DPR  ·  ${this.app.canvas.width}×${this.app.canvas.height}`
        this.statsFrames = 0; this.statsStarted = finished
      }
    }
  }

  private render(interpolation: number, now: number) {
    const count = this.simulation.count, data = this.simulation.features
    const visibleCount = Math.min(count, Math.floor(30 + this.controls.density * 1.5)), firstVisible = count - visibleCount
    let visibleObjects = 0
    for (let index = 0; index < count; index++) {
      const feature = index * BLOOM_STRIDE, core = this.coreParticles[index], ring = this.ringParticles[index]
      if (index < firstVisible) {
        core.alpha = 0; ring.alpha = 0
        for (let satellite = 0; satellite < MAX_SATELLITES; satellite++) this.satelliteParticles[index * MAX_SATELLITES + satellite].alpha = 0
        continue
      }
      const age = Math.max(0, (now - data[feature + 6]) / (this.controls.lifetime * 1000))
      // Long, zero-velocity fade curves avoid visible pops at either endpoint.
      const life = age < 1 ? smoothstep(0, .12, age) * (1 - smoothstep(.68, 1, age)) : 0
      this.simulation.sampleInto(index, interpolation, this.sample)
      const x = this.sample[0], y = this.sample[1], phase = this.sample[2], normalized = this.sample[3], size = 18 + normalized * 105
      const alpha = life * (.18 + this.controls.intensity / 145), color = COLORS[Math.floor(data[feature + 5]) % COLORS.length]
      core.x = x; core.y = y; core.scaleX = core.scaleY = size / 14; core.alpha = alpha * .32; core.tint = color
      ring.x = x; ring.y = y; ring.scaleX = ring.scaleY = size * (1.05 + life * .45) / 14; ring.rotation = phase; ring.alpha = alpha; ring.tint = color
      const satellites = Math.min(MAX_SATELLITES, Math.floor(data[feature + 7] * (.4 + this.controls.complexity / 100)))
      if (life > 0) visibleObjects += 2 + satellites
      for (let satelliteIndex = 0; satelliteIndex < MAX_SATELLITES; satelliteIndex++) {
        const satellite = this.satelliteParticles[index * MAX_SATELLITES + satelliteIndex]
        if (satelliteIndex >= satellites || life === 0) { satellite.alpha = 0; continue }
        const angle = phase + satelliteIndex * Math.PI * 2 / satellites
        const orbit = size * (1.15 + data[feature + 3] * .65)
        satellite.x = x + Math.cos(angle) * orbit; satellite.y = y + Math.sin(angle) * orbit
        satellite.scaleX = satellite.scaleY = (.12 + data[feature + 3] * .25); satellite.alpha = alpha * .7; satellite.tint = COLORS[(Math.floor(data[feature + 5]) + satelliteIndex) % COLORS.length]
      }
    }
    this.visibleObjects = visibleObjects
  }

  private contextLost = (event: Event) => {
    event.preventDefault()
    this.fail(new Error('The WebGL context was lost. Falling back to Canvas 2D.'))
  }

  private fail(error: unknown, fatal = true) {
    const resolved = error instanceof Error ? error : new Error(String(error))
    console.error('[PixiBloomRenderer]', resolved)
    if (fatal) this.onFailure(resolved)
  }

  destroy() {
    this.destroyed = true
    if (!this.initialized) return
    this.app.canvas.removeEventListener('webglcontextlost', this.contextLost)
    this.app.renderer.off('resize', this.resizeBounds, this)
    this.app.ticker.remove(this.tick)
    this.performanceElement?.remove(); this.performanceElement = null
    this.app.destroy(true, { children: true, texture: true })
    this.initialized = false
  }
}
