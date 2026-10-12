import { useEffect, useMemo, useState } from 'react'
import PortraitCanvas from './PortraitCanvas'
import { humanMarks, minuteOfDay, type PortraitObservation } from '../rendering/PortraitFeatures'
import mock from '../data/machine-observations.json'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
export default function LivePortraits() {
  const [archive, setArchive] = useState<{ timezone: string; observations: PortraitObservation[] } | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true, timer = 0
    const controller = new AbortController()
    const refresh = async () => {
      try {
        const response = await fetch(`${API}/api/portrait/observations`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]), cache: 'no-store' })
        if (!response.ok) throw new Error('Archive unavailable')
        const body = await response.json()
        if (alive) { setArchive(body); setUpdated(new Date()); setError(false) }
      } catch { if (alive) setError(true) }
      finally { if (alive) timer = window.setTimeout(refresh, 5000) }
    }
    void refresh()
    return () => { alive = false; controller.abort(); window.clearTimeout(timer) }
  }, [])
  const timezone = archive?.timezone ?? 'America/New_York'
  const human = useMemo(() => humanMarks(archive?.observations ?? [], timezone), [archive, timezone])
  const machine = useMemo(() => mock.events.map(item => ({ timestamp: Date.parse(item.timestamp), minute: minuteOfDay(item.timestamp, timezone), weight: item.value / 100, texture: item.value / 100 })), [timezone])
  const [start, end] = useMemo(() => {
    const times = [...human, ...machine].map(mark => mark.timestamp)
    return [times.reduce((a, b) => Math.min(a, b), Infinity), times.reduce((a, b) => Math.max(a, b), -Infinity)]
  }, [human, machine])
  return <section className="live-portraits">
    <div className="live-heading"><div><p className="section-code">DOUBLE PORTRAIT / COMPLETE ARCHIVE</p><h2>TWO WITNESSES.<br />ONE LANGUAGE.</h2></div><p>One palette, one contour system, one timeline. The records change the image. Machine measurements are simulated; your observations come from your saved logs.</p></div>
    <div className="portrait-grid">
      {[{ name: 'MACHINE', data: machine, status: 'MOCK DATA', caption: 'simulated measurements', note: 'Fixture / activity intensity, 0–100' },
        { name: 'ME', data: human, status: error ? 'CONNECTION LOST' : archive ? 'ARCHIVE CONNECTED' : 'CONNECTING', caption: 'saved observations', note: 'All past logs / refreshed every 5 seconds' }].map((panel, index) =>
        <article className="portrait-panel" key={panel.name}>
          <div className="portrait-top"><span>0{index + 1} / {panel.name}</span><span><i className={index === 0 || error || !archive ? 'waiting' : ''} />{panel.status}</span></div>
          <div className="portrait-canvas"><PortraitCanvas data={panel.data} start={start} end={end} label={panel.name} />
            <div className="portrait-art-title"><span>SHARED PRESET / 01</span><h3>Contour atlas</h3><p>{index === 0 ? 'A simulated rhythm of passive attention.' : 'The accumulated shape of what you noticed.'}</p></div>
            </div>
          <div className="portrait-bottom"><strong>{String(panel.data.length).padStart(3, '0')}</strong><span>{panel.caption}</span><span>{panel.note}</span></div>
        </article>)}
    </div>
    <p className="last-update" role="status">{error ? 'ARCHIVE UNAVAILABLE / SHOWING LAST SUCCESSFUL SNAPSHOT' : `LAST SYNC / ${updated ? updated.toLocaleTimeString() : 'CONNECTING'}`} / {timezone}</p>
    <details><summary>How the same preset reads both archives</summary>
      <p>Left to right: date across the shared archive range ({new Date(start).toLocaleDateString()}–{new Date(end).toLocaleDateString()}). Top to bottom: local time of day, midnight to midnight. Each contour groups records in the same time bin. More records add rings; higher weight widens the contour. Empty bins stay empty.</p>
      <p>Human weight uses log-scaled word count plus 40 per photo, capped at 400; photo byte size shapes contour irregularity. Mock machine weight and irregularity use activity intensity divided by 100. These are artistic encodings, not equivalent scientific measurements. Both use identical colors, geometry, temporal bins, and fixed scales.</p>
      <p>Metadata includes original text, observation time, source, timezone, submission context, word and character counts, attachment sizes and hashes, and available image dimensions and EXIF. No mood or meaning is inferred.</p>
      <a href={`${API}/api/portrait/observations`} target="_blank" rel="noreferrer">Inspect your archive and extracted metadata (JSON)</a>
    </details>
  </section>
}
