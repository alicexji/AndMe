import { useEffect, useRef, useState } from 'react'
import type { Controls, Datum } from '../pages/Playground'
import { BloomPreprocessor } from '../rendering/BloomPreprocessor'
import { PixiBloomRenderer } from '../rendering/PixiBloomRenderer'

export default function PixiBloomCanvas({ events, controls, fallback }: { events: Datum[]; controls: Controls; fallback: React.ReactNode }) {
  const host = useRef<HTMLDivElement>(null)
  const renderer = useRef<PixiBloomRenderer | null>(null)
  const preprocessor = useRef<BloomPreprocessor | null>(null)
  const generation = useRef(0)
  const dirty = useRef(true)
  const latest = useRef({ events, axis: controls.axis, scale: controls.scale })
  const [failed, setFailed] = useState(false)
  latest.current = { events, axis: controls.axis, scale: controls.scale }
  dirty.current = true

  useEffect(() => {
    if (!host.current) return
    const nextRenderer = new PixiBloomRenderer(host.current, () => setFailed(true))
    const nextPreprocessor = new BloomPreprocessor()
    renderer.current = nextRenderer; preprocessor.current = nextPreprocessor
    nextRenderer.init()
    const pump = window.setInterval(() => {
      if (!dirty.current || !preprocessor.current) return
      dirty.current = false
      const currentGeneration = ++generation.current, snapshot = latest.current
      const input = snapshot.events.map(event => ({ id: event.id, label: event.label, value: event.value, secondary: event.secondary, time: event.time, born: event.born, rawFieldCount: Object.keys(event.raw).length }))
      preprocessor.current.preprocess(input, { axis: snapshot.axis, scale: snapshot.scale })
        .then(data => { if (currentGeneration === generation.current) renderer.current?.setFeatures(data) })
        .catch(() => { if (currentGeneration === generation.current) setFailed(true) })
    }, 200)
    return () => { window.clearInterval(pump); generation.current++; nextPreprocessor.destroy(); nextRenderer.destroy(); renderer.current = null; preprocessor.current = null }
  }, [])

  useEffect(() => { renderer.current?.setControls(controls) }, [controls])
  useEffect(() => {
    if (!failed) return
    renderer.current?.destroy(); preprocessor.current?.destroy()
    renderer.current = null; preprocessor.current = null
  }, [failed])
  if (failed) return fallback
  return <div ref={host} className="pixi-bloom-host" aria-label="WebGL dissolving blooms artwork" />
}
