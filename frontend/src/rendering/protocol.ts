export const BLOOM_STRIDE = 10

export interface BloomReference { id: string; value: number; time: number }
export interface BloomFeatures { data: Float32Array; keys: string[] }

export interface WorkerEvent {
  id: string
  label: string
  value: number
  secondary: number
  time: number
  born: number
  rawFieldCount: number
}

export interface PreprocessRequest {
  type: 'preprocess-blooms'
  requestId: number
  events: WorkerEvent[]
  reference: BloomReference[]
  axis: 'value' | 'time' | 'sequence'
  scale: 'linear' | 'log' | 'rank'
}

export interface PreprocessResult {
  type: 'blooms-ready'
  requestId: number
  count: number
  data: ArrayBuffer
  keys: string[]
}

export interface WorkerFailure {
  type: 'worker-error'
  requestId: number
  message: string
}

export type PreprocessResponse = PreprocessResult | WorkerFailure
