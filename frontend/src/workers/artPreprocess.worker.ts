/// <reference lib="webworker" />
import { buildBloomFeatures } from '../rendering/BloomFeatures'
import type { PreprocessRequest, PreprocessResponse } from '../rendering/protocol'

self.onmessage = (message: MessageEvent<PreprocessRequest>) => {
  const request = message.data
  if (request.type !== 'preprocess-blooms') return
  try {
    const { data, keys } = buildBloomFeatures(request)
    const response: PreprocessResponse = { type: 'blooms-ready', requestId: request.requestId, count: keys.length, keys, data: data.buffer as ArrayBuffer }
    self.postMessage(response, { transfer: [response.data] })
  } catch (error) {
    const response: PreprocessResponse = { type: 'worker-error', requestId: request.requestId, message: error instanceof Error ? error.message : 'Unknown preprocessing failure' }
    self.postMessage(response)
  }
}
export {}
