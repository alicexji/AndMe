import { BLOOM_STRIDE } from './protocol'

const STATE_STRIDE = 4

export class BloomSimulation {
  features: Float32Array<ArrayBufferLike> = new Float32Array()
  previous: Float32Array<ArrayBufferLike> = new Float32Array()
  current: Float32Array<ArrayBufferLike> = new Float32Array()
  count = 0
  width = 1
  height = 1

  setSize(width: number, height: number) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
  }

  setFeatures(features: Float32Array) {
    const oldFeatures = this.features, oldCurrent = this.current, oldPrevious = this.previous, oldCount = this.count
    this.features = features
    this.count = Math.floor(features.length / BLOOM_STRIDE)
    const next = new Float32Array(this.count * STATE_STRIDE)
    const nextPrevious = new Float32Array(this.count * STATE_STRIDE)
    const oldIndices = new Map<string, number>()
    for (let index = 0; index < oldCount; index++) oldIndices.set(this.identity(oldFeatures, index), index)
    for (let index = 0; index < this.count; index++) {
      const feature = index * BLOOM_STRIDE, state = index * STATE_STRIDE
      const oldIndex = oldIndices.get(this.identity(features, index))
      if (oldIndex !== undefined) {
        const oldState = oldIndex * STATE_STRIDE
        next.set(oldCurrent.subarray(oldState, oldState + STATE_STRIDE), state)
        nextPrevious.set(oldPrevious.subarray(oldState, oldState + STATE_STRIDE), state)
      } else {
        next[state] = nextPrevious[state] = features[feature] * this.width
        next[state + 1] = nextPrevious[state + 1] = features[feature + 1] * this.height
        next[state + 2] = nextPrevious[state + 2] = features[feature + 4]
        next[state + 3] = nextPrevious[state + 3] = features[feature + 2]
      }
    }
    this.current = next
    this.previous = nextPrevious
  }

  private identity(data: Float32Array<ArrayBufferLike>, index: number) {
    const offset = index * BLOOM_STRIDE
    return `${data[offset].toFixed(6)}:${data[offset + 1].toFixed(6)}:${data[offset + 4].toFixed(4)}:${data[offset + 6].toFixed(1)}`
  }

  update(seconds: number, elapsed: number, motion: number) {
    this.previous.set(this.current)
    for (let index = 0; index < this.count; index++) {
      const feature = index * BLOOM_STRIDE, state = index * STATE_STRIDE
      const baseX = this.features[feature] * this.width, baseY = this.features[feature + 1] * this.height
      const secondary = this.features[feature + 3], phase = this.features[feature + 4], polarity = this.features[feature + 8]
      const speed = (.12 + secondary * .34) * motion * polarity
      const targetX = baseX + Math.cos(elapsed * speed + phase) * (8 + secondary * 34)
      const targetY = baseY + Math.sin(elapsed * speed * 1.17 + phase) * (7 + secondary * 28)
      const blend = 1 - Math.exp(-seconds * 7)
      this.current[state] += (targetX - this.current[state]) * blend
      this.current[state + 1] += (targetY - this.current[state + 1]) * blend
      this.current[state + 2] = elapsed * speed + phase
      this.current[state + 3] = this.features[feature + 2]
    }
  }

  sampleInto(index: number, alpha: number, output: Float32Array) {
    const offset = index * STATE_STRIDE
    output[0] = this.previous[offset] + (this.current[offset] - this.previous[offset]) * alpha
    output[1] = this.previous[offset + 1] + (this.current[offset + 1] - this.previous[offset + 1]) * alpha
    output[2] = this.previous[offset + 2] + (this.current[offset + 2] - this.previous[offset + 2]) * alpha
    output[3] = this.current[offset + 3]
  }
}
