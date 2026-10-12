import test from 'node:test'
import assert from 'node:assert/strict'
import { humanMarks, minuteOfDay, portraitBins } from '../src/rendering/PortraitFeatures.ts'

test('local time uses archive timezone and DST', () => {
  assert.equal(minuteOfDay('2026-08-31T16:00:00Z', 'America/New_York'), .5)
  assert.equal(minuteOfDay('2026-01-01T17:00:00Z', 'America/New_York'), .5)
})
test('every historical and new record contributes with bounded bins', () => {
  const marks = Array.from({ length: 1000 }, (_, timestamp) => ({ timestamp, minute: .5, weight: .4, texture: .2 }))
  const bins = portraitBins(marks, 0, 999)
  assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), 1000)
  assert.ok(bins.length <= 288)
  assert.deepEqual(portraitBins(marks, 0, 999), bins)
  assert.deepEqual(portraitBins([], 0, 999), [])
})
test('photo-only and text logs both produce marks', () => {
  const rows = [
    { received_at: '2026-01-01T12:00:00Z', metadata: { word_count: 0, media_count: 1, media_bytes: 10000 } },
    { received_at: '2026-01-02T12:00:00Z', metadata: { word_count: 5, media_count: 0, media_bytes: 0 } },
  ]
  const marks = humanMarks(rows, 'UTC')
  assert.equal(marks.length, 2)
  assert.ok(marks.every(mark => mark.weight > 0 && mark.weight <= 1))
  assert.ok(marks[0].texture > 0)
  assert.equal(marks[1].texture, 0)
})
