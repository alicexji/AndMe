import { BLOOM_STRIDE, type BloomFeatures } from './protocol'

export const DEPARTURE_MS = 400
export interface BloomState {
  key: string
  features: Float32Array
  previous: Float32Array
  current: Float32Array
  departure: number | null
}

export class BloomSimulation {
  readonly states = new Map<string, BloomState>()
  width = 1
  height = 1

  setSize(width: number, height: number) {
    const w = Math.max(1, width), h = Math.max(1, height)
    for (const state of this.states.values()) {
      state.current[0] *= w / this.width; state.previous[0] *= w / this.width
      state.current[1] *= h / this.height; state.previous[1] *= h / this.height
    }
    this.width = w; this.height = h
  }

  reconcile({ data, keys }: BloomFeatures, budget: number, now: number, lifetime: number) {
    const selected = new Set<string>()
    for (let index = keys.length - 1; index >= 0 && selected.size < budget; index--) {
      const offset = index * BLOOM_STRIDE
      if (now - data[offset + 6] >= lifetime * 1000) continue
      const key = keys[index]
      selected.add(key)
      let state = this.states.get(key)
      if (!state) {
        const initial = new Float32Array([data[offset] * this.width, data[offset + 1] * this.height, data[offset + 4], data[offset + 2]])
        state = { key, features: new Float32Array(BLOOM_STRIDE), current: initial, previous: initial.slice(), departure: null }
        this.states.set(key, state)
      }
      for (let field = 0; field < BLOOM_STRIDE; field++) state.features[field] = data[offset + field]
      // Finish retirement once started; re-entry must not reset a fade mid-flight.
    }
    for (const state of this.states.values()) {
      if (!selected.has(state.key) && state.departure === null) state.departure = now
    }
    this.prune(now, lifetime)
  }

  prune(now: number, lifetime: number) {
    for (const [key, state] of this.states) {
      if (now - state.features[6] >= lifetime * 1000 || (state.departure !== null && now - state.departure >= DEPARTURE_MS)) this.states.delete(key)
    }
  }

  update(seconds: number, motion: number) {
    const blend = 1 - Math.exp(-seconds * 5)
    for (const { features: f, current: c, previous: p } of this.states.values()) {
      p.set(c)
      // Integrate phase so changing motion never changes the orbit discontinuously.
      c[2] += seconds * (.12 + f[3] * .34) * motion * f[8]
      c[0] += (f[0] * this.width + Math.cos(c[2]) * (8 + f[3] * 24) - c[0]) * blend
      c[1] += (f[1] * this.height + Math.sin(c[2] * 1.17) * (7 + f[3] * 20) - c[1]) * blend
      c[3] += (f[2] - c[3]) * blend
    }
  }

  sampleInto(state: BloomState, alpha: number, output: Float32Array) {
    for (let field = 0; field < 4; field++) output[field] = state.previous[field] + (state.current[field] - state.previous[field]) * alpha
  }
}
