import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { stripTypeScriptTypes } from 'node:module'

// Load these DOM-free TypeScript modules without adding a test framework dependency.
function moduleURL(url) {
  const source = stripTypeScriptTypes(readFileSync(url, 'utf8')).replace(/from ['"](.\/[^'"]+)['"]/g, (_, path) => `from '${moduleURL(new URL(`${path}.ts`, url))}'`)
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}
const { buildBloomFeatures } = await import(moduleURL(new URL('../src/rendering/BloomFeatures.ts', import.meta.url)))
const { BloomSimulation, DEPARTURE_MS } = await import(moduleURL(new URL('../src/rendering/BloomSimulation.ts', import.meta.url)))
const event = (id, value, born = 1000) => ({ id, value, born, label: id, secondary: 10, time: value * 1000, rawFieldCount: 4 })
const reference = [event('small', 1), event('medium', 4), event('large', 10)]
const features = (events, axis = 'value', scale = 'linear') => buildBloomFeatures({ events, reference, axis, scale })

test('normalization remains stable as events arrive and expire in every mapping', () => {
  for (const axis of ['value', 'time', 'sequence']) for (const scale of ['linear', 'log', 'rank']) {
    const alone = features([reference[1]], axis, scale)
    const full = features(reference, axis, scale)
    assert.equal(alone.data[2], full.data[12], `${axis}/${scale}`)
  }
})
test('invalid inputs are removed and identical-value snapshots remain finite', () => {
  const result = features([event('bad', NaN), reference[0]])
  assert.equal(result.keys.length, 1)
  const equal = buildBloomFeatures({ events: [reference[0]], reference: [reference[0]], axis: 'value', scale: 'linear' })
  assert.equal(equal.data[2], .5)
  assert.ok(equal.data.every(Number.isFinite))
})
test('replayed source records keep distinct instance identities', () => {
  const result = features([event('small', 1, 1000.001), event('small', 1, 1000.002)])
  assert.notEqual(result.keys[0], result.keys[1])
})
test('existing states and buffers survive feed updates; radius eases rather than jumps', () => {
  const simulation = new BloomSimulation()
  simulation.reconcile(features([reference[1]]), 10, 1000, 16)
  const state = [...simulation.states.values()][0]
  const current = state.current, before = current[3]
  const changed = features(reference)
  changed.data[12] = 1
  simulation.reconcile(changed, 10, 1100, 16)
  assert.equal(simulation.states.get(state.key), state)
  assert.equal(state.current, current)
  assert.equal(current[3], before)
  simulation.update(1 / 30, 1)
  assert.ok(current[3] > before && current[3] < 1)
  const sample = new Float32Array(4)
  simulation.sampleInto(state, .5, sample)
  assert.ok(sample[3] > before && sample[3] < current[3])
})
test('density retirement fades before removal and expires without new feed input', () => {
  const simulation = new BloomSimulation()
  simulation.reconcile(features(reference), 3, 1000, 16)
  simulation.reconcile(features(reference), 1, 2000, 16)
  assert.equal(simulation.states.size, 3)
  assert.equal([...simulation.states.values()].filter(state => state.departure !== null).length, 2)
  simulation.prune(2000 + DEPARTURE_MS, 16)
  assert.equal(simulation.states.size, 1)
  simulation.prune(17000, 16)
  assert.equal(simulation.states.size, 0)
  simulation.reconcile(features(reference), 3, 17000, 16)
  assert.equal(simulation.states.size, 0, 'expired snapshots must not resurrect blooms')
})
test('motion changes integrate phase without teleporting the orbit', () => {
  const simulation = new BloomSimulation()
  simulation.reconcile(features([reference[1]]), 10, 1000, 16)
  for (let i = 0; i < 300; i++) simulation.update(1 / 30, 1)
  const state = [...simulation.states.values()][0]
  const phase = state.current[2]
  simulation.update(1 / 30, 0)
  assert.equal(state.current[2], phase)
  simulation.update(1 / 30, 2)
  assert.ok(Math.abs(state.current[2] - phase) < .04)
})
test('resize preserves normalized positions in both interpolation states', () => {
  const simulation = new BloomSimulation()
  simulation.setSize(400, 400)
  simulation.reconcile(features([reference[1]]), 10, 1000, 16)
  const state = [...simulation.states.values()][0]
  const x = state.current[0]
  simulation.setSize(800, 400)
  assert.equal(state.current[0], x * 2)
  assert.equal(state.previous[0], x * 2)
})

const { gridAnchor, GRID_SPACING } = await import(moduleURL(new URL('../src/rendering/BloomGrid.ts', import.meta.url)))
test('wave origins stay on the dot lattice across responsive sizes', () => {
  for (const extent of [375, 800, 1440]) for (const value of [0, .08, .33, .95, 1]) {
    const position = gridAnchor(value, extent)
    assert.equal((position - GRID_SPACING / 2) % GRID_SPACING, 0)
    assert.ok(position >= 0 && position <= extent)
  }
})

const { scoreY, composeScore } = await import(moduleURL(new URL('../src/rendering/NotationScore.ts', import.meta.url)))
test('notation metrics anchor to a continuous grid across the full height', () => {
  for (const height of [400, 600, 800]) {
    assert.equal(scoreY(1, height), 64)
    assert.ok(scoreY(0, height) <= height - 72)
    assert.ok(scoreY(0, height) > height - 96)
    for (let i=0;i<=100;i++) assert.equal((scoreY(i/100,height)-64)%24,0)
    assert.equal(scoreY(-1,height),scoreY(0,height))
  }
})
test('notation composition handles no data and respects finite batch capacity', () => {
  const buffer = new Float32Array(12 * 20)
  assert.equal(composeScore([], 0, 78, buffer), 0)
  const nodes = Array.from({length:15},(_,i)=>({key:String(i),x:30+i*50,staff:i%3,value:i/15,secondary:.6,opacity:.7,color:[.2,.4,.8]}))
  const count = composeScore(nodes, 3.5, 78, buffer)
  assert.ok(count > 0 && count <= 20)
  assert.ok(buffer.every(Number.isFinite))
})

test('falling notation nodes survive source removal and exit below the canvas', () => {
  const buffer = new Float32Array(12000)
  const node = {key:'fixed',x:200,staff:0,value:.5,secondary:.5,opacity:1,color:[0,0,0]}
  composeScore([node], 0, 50, buffer, 800, 800)
  assert.equal(composeScore([], .8, 50, buffer, 800, 800), 1)
  assert.equal(buffer[7], 1)
  const before = buffer[1]
  composeScore([], .801, 50, buffer, 800, 800)
  assert.ok(Math.abs(buffer[1] - before) < 2)
  assert.equal(composeScore([], 2.09, 50, buffer, 800, 800), 1)
  assert.ok(buffer[1] > 800)
  assert.equal(composeScore([], 2.11, 50, buffer, 800, 800), 0)
})

const { currencyRecords, biodiversityRecords } = await import(moduleURL(new URL('../src/rendering/OpenDatasets.ts', import.meta.url)))
test('currency changes compare each currency to its own previous date',()=>{
  const rows=currencyRecords({rates:{'2025-01-03':{EUR:1.1,JPY:180},'2025-01-02':{EUR:1,JPY:200}}})
  assert.equal(rows.length,2)
  assert.ok(Math.abs(rows[0].changePercent-10)<1e-9)
  assert.ok(Math.abs(rows[1].changePercent+10)<1e-9)
  assert.equal(rows[0].pair,'USD/EUR')
})
test('biodiversity keeps zero coordinates and excludes missing coordinates',()=>{
  const rows=biodiversityRecords({results:[{key:1,decimalLatitude:0,decimalLongitude:0,license:'CC0'},{key:2,decimalLatitude:null,decimalLongitude:5}]})
  assert.equal(rows.length,1)
  assert.equal(rows[0].latitude,0)
  assert.equal(rows[0].license,'CC0')
})
