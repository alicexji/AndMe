import { useEffect, useRef, useState } from 'react'
import type { Controls, Datum } from '../pages/Playground'
import type { PresetMode } from '../rendering/PresetShaders'
import type { BloomReference } from '../rendering/protocol'
import { BloomPreprocessor } from '../rendering/BloomPreprocessor'
import { PixiBloomRenderer } from '../rendering/PixiBloomRenderer'

export default function PixiBloomCanvas({ events, reference, controls, fallback, mode = 'bloom' }: { mode?: PresetMode; events: Datum[]; reference: BloomReference[]; controls: Controls; fallback: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const renderer = useRef<PixiBloomRenderer | null>(null)
  const submit = useRef<(() => void) | null>(null)
  const generation = useRef(0)
  const latest = useRef({ events, reference, axis: controls.axis, scale: controls.scale })
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!host.current || failed) return
    let alive = true, inFlight = false, dirty = false
    let processor: BloomPreprocessor
    const next = new PixiBloomRenderer(host.current, () => { if (alive) setFailed(true) }, mode)
    try { processor = new BloomPreprocessor() } catch { next.destroy(); setFailed(true); return }
    renderer.current = next
    void next.init()
    const pump = () => {
      dirty = true
      if (inFlight || !alive) return
      dirty = false; inFlight = true
      const version = generation.current, snapshot = latest.current
      const input = snapshot.events.map(event => ({ id: event.id, label: event.label, value: event.value, secondary: event.secondary, time: event.time, born: event.born, rawFieldCount: Object.keys(event.raw).length }))
      processor.preprocess(input, { reference: snapshot.reference, axis: snapshot.axis, scale: snapshot.scale })
        .then(features => { if (alive && version === generation.current) next.setFeatures(features) })
        .catch(() => { if (alive) setFailed(true) })
        .finally(() => { inFlight = false; if (alive && dirty) pump() })
    }
    submit.current = pump
    return () => { alive = false; submit.current = null; processor.destroy(); next.destroy(); renderer.current = null }
  }, [failed, mode])

  useEffect(() => {
    latest.current = { events, reference, axis: controls.axis, scale: controls.scale }
    generation.current++
    submit.current?.()
  }, [events, reference, controls.axis, controls.scale, mode])
  useEffect(() => { renderer.current?.setControls(controls) }, [controls, mode])
  if (failed) return fallback
  return <div ref={host} className={mode === 'bloom' ? 'pixi-bloom-host' : `pixi-art-host preset-${mode}`}  role="img" aria-label={`${mode} generative data artwork rendered with WebGL`} />
}
