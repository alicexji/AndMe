import type { Observation } from '../types'
export interface PortraitObservation extends Observation {
  metadata: { word_count: number; media_count: number; media_bytes: number }
}
export interface PortraitMark { timestamp: number; minute: number; weight: number; texture: number }
export function minuteOfDay(timestamp: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(timestamp))
  return (Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value)) / 1440
}
export function humanMarks(items: PortraitObservation[], timezone: string): PortraitMark[] {
  return items.map(item => ({ timestamp: Date.parse(item.received_at), minute: minuteOfDay(item.received_at, timezone),
    weight: Math.min(1, Math.log1p(item.metadata.word_count + item.metadata.media_count * 40) / Math.log1p(400)),
    texture: Math.min(1, Math.log1p(item.metadata.media_bytes) / Math.log1p(25 * 1024 * 1024)) }))
}
// Every record contributes, with drawing work bounded to 288 temporal bins.
export function portraitBins(marks: PortraitMark[], start: number, end: number) {
  const bins = new Map<number, { x: number; y: number; weight: number; texture: number; count: number }>()
  for (const mark of marks) {
    const x = Math.min(23, Math.max(0, Math.floor((mark.timestamp - start) / Math.max(1, end - start) * 24)))
    const y = Math.min(11, Math.floor(mark.minute * 12))
    const key = x * 12 + y
    const bin = bins.get(key) ?? { x: (x + .5) / 24, y: (y + .5) / 12, weight: 0, texture: 0, count: 0 }
    bin.weight += mark.weight; bin.texture += mark.texture; bin.count++
    bins.set(key, bin)
  }
  return [...bins.values()].map(bin => ({ ...bin, weight: bin.weight / bin.count, texture: bin.texture / bin.count }))
}
