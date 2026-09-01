export interface DataPoint {
  value: number
  secondary: number
  timestamp: number
}

export type ArtStyle = 'flow-field' | 'structural-dots' | 'radial-pathway'

export interface ArtSettings {
  palette: string[]
  density: number
  speed: number
  randomness: number
}

export interface Artwork {
  id: string
  title: string
  description: string
  tags: string[]
  style: ArtStyle
  dataSummary: string
}

export interface MediaAsset {
  id: string
  media_type: string
  url: string
  byte_count: number
}

export interface Observation {
  id: string
  received_at: string
  local_time: string
  observation_type: string
  raw_text: string
  media: MediaAsset[]
}

export interface ArchiveDay {
  date: string
  timezone: string
  observations: Observation[]
}

