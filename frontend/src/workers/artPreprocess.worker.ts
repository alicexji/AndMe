/// <reference lib="webworker" />
import { BLOOM_STRIDE, type PreprocessRequest, type PreprocessResponse, type WorkerEvent } from '../rendering/protocol'

const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
const hash = (text: string) => [...text].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7)

function normalizedValues(events: WorkerEvent[], axis: PreprocessRequest['axis'], scale: PreprocessRequest['scale']) {
  if (!events.length) return []
  const source = axis === 'time' ? events.map(event => event.time) : axis === 'sequence' ? events.map((_, index) => index) : events.map(event => Math.abs(event.value))
  if (scale === 'rank' && axis === 'value') {
    const ordered = source.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
    const ranks = new Array(source.length)
    ordered.forEach((item, rank) => { ranks[item.index] = rank / Math.max(1, source.length - 1) })
    return ranks
  }
  const adjusted = scale === 'log' && axis === 'value' ? source.map(value => Math.log1p(value)) : source
  const min = Math.min(...adjusted), max = Math.max(...adjusted), range = max - min || 1
  return adjusted.map(value => clamp((value - min) / range))
}

self.onmessage = (message: MessageEvent<PreprocessRequest>) => {
  const request = message.data
  if (request.type !== 'preprocess-blooms') return
  try {
    const events = request.events.filter(event => Number.isFinite(event.value) && Number.isFinite(event.secondary) && Number.isFinite(event.time) && Number.isFinite(event.born))
    const normalized = normalizedValues(events, request.axis, request.scale)
    const output = new Float32Array(events.length * BLOOM_STRIDE)
    events.forEach((event, index) => {
      const seed = hash(event.id), labelSeed = hash(event.label), offset = index * BLOOM_STRIDE
      output[offset] = (seed % 1009) / 1009
      output[offset + 1] = ((seed >>> 9) % 1013) / 1013
      output[offset + 2] = normalized[index]
      output[offset + 3] = clamp(Math.atan(Math.abs(event.secondary) * .08) * 2 / Math.PI)
      output[offset + 4] = (labelSeed % 6283) / 1000
      output[offset + 5] = seed % 6
      output[offset + 6] = event.born
      output[offset + 7] = Math.max(2, Math.min(10, event.rawFieldCount + 2))
      output[offset + 8] = event.value < 0 ? -1 : 1
      output[offset + 9] = ((event.time % 86400000) + 86400000) % 86400000 / 86400000
    })
    const response: PreprocessResponse = { type: 'blooms-ready', requestId: request.requestId, count: events.length, data: output.buffer }
    self.postMessage(response, { transfer: [output.buffer] })
  } catch (error) {
    const response: PreprocessResponse = { type: 'worker-error', requestId: request.requestId, message: error instanceof Error ? error.message : 'Unknown preprocessing failure' }
    self.postMessage(response)
  }
}

export {}

