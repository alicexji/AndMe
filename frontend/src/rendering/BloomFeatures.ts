import { BLOOM_STRIDE, type BloomFeatures, type PreprocessRequest } from './protocol'

const clamp = (value: number) => Math.max(0, Math.min(1, value))
const hash = (text: string) => {
  let value = [...text].reduce((seed, char) => (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0, 7)
  // Avalanche similar IDs so adjacent source records do not form accidental columns.
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b)
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35)
  return (value ^ (value >>> 16)) >>> 0
}

// Normalize against the complete source snapshot, never the changing live window.
export function buildBloomFeatures(request: Pick<PreprocessRequest, 'events' | 'reference' | 'axis' | 'scale'>): BloomFeatures {
  const { axis, scale } = request
  const reference = request.reference.filter(event => Number.isFinite(event.value) && Number.isFinite(event.time))
  const events = request.events.filter(event => [event.value, event.secondary, event.time, event.born, event.rawFieldCount].every(Number.isFinite))
  const valueOf = (event: { value: number; time: number }, index: number) => axis === 'sequence' ? index : axis === 'time' ? event.time : scale === 'log' ? Math.log1p(Math.abs(event.value)) : Math.abs(event.value)
  const values = reference.map(valueOf)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const ranks = new Map<number, number>()
  if (axis === 'value' && scale === 'rank') {
    [...values].sort((a, b) => a - b).forEach((value, index) => {
      if (!ranks.has(value)) ranks.set(value, index / Math.max(1, values.length - 1))
    })
  }
  const indices = new Map(reference.map((event, index) => [event.id, index]))
  const output = new Float32Array(events.length * BLOOM_STRIDE)
  const keys: string[] = []
  events.forEach((event, index) => {
    const seed = hash(event.id), offset = index * BLOOM_STRIDE
    const value = valueOf(event, indices.get(event.id) ?? index)
    output[offset] = .08 + (seed % 1009) / 1009 * .84
    output[offset + 1] = .1 + ((seed >>> 9) % 1013) / 1013 * .8
    output[offset + 2] = axis === 'value' && scale === 'rank' ? ranks.get(value) ?? .5 : max === min ? .5 : clamp((value - min) / (max - min))
    output[offset + 3] = clamp(Math.atan(Math.abs(event.secondary) * .08) * 2 / Math.PI)
    output[offset + 4] = (hash(event.label) % 6283) / 1000
    output[offset + 5] = seed % 6
    output[offset + 6] = event.born
    output[offset + 7] = Math.max(2, Math.min(10, event.rawFieldCount + 2))
    output[offset + 8] = event.value < 0 ? -1 : 1
    output[offset + 9] = ((event.time % 86400000) + 86400000) % 86400000 / 86400000
    // Exact instance identity is kept outside Float32 storage, including replayed records.
    keys.push(`${event.id}:${event.born}`)
  })
  return { data: output, keys }
}
