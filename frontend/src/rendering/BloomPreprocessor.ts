import type { BloomFeatures, BloomReference, PreprocessRequest, PreprocessResponse, WorkerEvent } from './protocol'

export interface BloomPreprocessOptions {
  axis: PreprocessRequest['axis']
  scale: PreprocessRequest['scale']
  reference: BloomReference[]
}

export class BloomPreprocessor {
  private worker = new Worker(new URL('../workers/artPreprocess.worker.ts', import.meta.url), { type: 'module' })
  private requestId = 0
  private pending = new Map<number, { resolve: (data: BloomFeatures) => void; reject: (error: Error) => void }>()

  constructor() {
    this.worker.onmessage = (message: MessageEvent<PreprocessResponse>) => {
      const pending = this.pending.get(message.data.requestId)
      if (!pending) return
      this.pending.delete(message.data.requestId)
      if (message.data.type === 'worker-error') pending.reject(new Error(message.data.message))
      else pending.resolve({ data: new Float32Array(message.data.data), keys: message.data.keys })
    }
    this.worker.onerror = event => {
      const error = new Error(event.message || 'The art preprocessing worker stopped.')
      this.pending.forEach(item => item.reject(error))
      this.pending.clear()
    }
  }

  preprocess(events: WorkerEvent[], options: BloomPreprocessOptions): Promise<BloomFeatures> {
    const requestId = ++this.requestId
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.worker.postMessage({ type: 'preprocess-blooms', requestId, events, ...options } satisfies PreprocessRequest)
    })
  }

  destroy() {
    this.worker.terminate()
    this.pending.forEach(item => item.reject(new Error('Preprocessor destroyed.')))
    this.pending.clear()
  }
}
