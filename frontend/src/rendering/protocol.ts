export const BLOOM_STRIDE = 10

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
  axis: 'value' | 'time' | 'sequence'
  scale: 'linear' | 'log' | 'rank'
}

export interface PreprocessResult {
  type: 'blooms-ready'
  requestId: number
  count: number
  data: ArrayBuffer
}

export interface WorkerFailure {
  type: 'worker-error'
  requestId: number
  message: string
}

export type PreprocessResponse = PreprocessResult | WorkerFailure

