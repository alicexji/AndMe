import type { Artwork } from './types'

export const PALETTES = [
  { name: 'Signal', colors: ['#ff4a22', '#11110f', '#f3f0e7', '#1646d8', '#f4cd24'] },
  { name: 'Machine', colors: ['#11110f', '#f3f0e7', '#1646d8', '#6f716e'] },
  { name: 'Memory', colors: ['#d84967', '#f3f0e7', '#e2ad2e', '#1646d8'] },
]

export const SELECTED_ARTIFACTS: Artwork[] = [
  {
    id: '01', title: 'The Day According to the Machine',
    description: 'A future continuous portrait assembled from passive device events.',
    tags: ['machine', 'continuous'], style: 'flow-field', dataSummary: 'Engine reserved',
  },
  {
    id: '02', title: 'The Day According to Me',
    description: 'A sparse portrait composed only from moments deliberately preserved.',
    tags: ['human', 'intentional'], style: 'structural-dots', dataSummary: 'Live archive',
  },
  {
    id: '03', title: 'Distance Between Records',
    description: 'The intervals, absences, and contradictions between two witnesses.',
    tags: ['comparison', 'future'], style: 'radial-pathway', dataSummary: 'Interpretation study',
  },
]

