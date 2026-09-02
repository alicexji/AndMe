import { useEffect, useMemo, useState } from 'react'
import { Activity, Fingerprint } from 'lucide-react'
import GenerativeCanvas from './GenerativeCanvas'
import type { ArchiveDay, DataPoint, MachineDay } from '../types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }
const fallback: DataPoint[] = Array.from({ length: 18 }, (_, i) => ({ value: .03, secondary: i / 18, timestamp: i }))

export default function LivePortraits() {
  const [human, setHuman] = useState<ArchiveDay | null>(null)
  const [machine, setMachine] = useState<MachineDay | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const day = today()
      try {
        const [humanResponse, machineResponse] = await Promise.all([
          fetch(`${API}/api/days/${day}/observations`),
          fetch(`${API}/api/days/${day}/machine-events`),
        ])
        if (!humanResponse.ok || !machineResponse.ok) throw new Error('Portrait stream unavailable')
        const [humanDay, machineDay] = await Promise.all([humanResponse.json(), machineResponse.json()])
        if (alive) { setHuman(humanDay); setMachine(machineDay); setUpdated(new Date()) }
      } catch { /* status labels remain in their waiting state */ }
    }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])

  const humanData = useMemo<DataPoint[]>(() => human?.observations.map((item, index) => ({
    value: Math.min(1, Math.max(.08, item.raw_text.length / 180 + item.media.length * .35)),
    secondary: ((new Date(item.received_at).getHours() * 60 + new Date(item.received_at).getMinutes()) / 1440),
    timestamp: new Date(item.received_at).getTime() + index,
  })) ?? [], [human])
  const values = machine?.events.map(event => Math.abs(event.value ?? 0)) ?? []
  const max = Math.max(1, ...values)
  const machineData = useMemo<DataPoint[]>(() => machine?.events.map((event, index) => ({
    value: Math.min(1, Math.abs(event.value ?? 0) / max),
    secondary: ((new Date(event.timestamp).getHours() * 60 + new Date(event.timestamp).getMinutes()) / 1440),
    timestamp: new Date(event.timestamp).getTime() + index,
  })) ?? [], [machine, max])

  return <section className="live-portraits">
    <div className="live-heading"><div><p className="section-code">LIVE DOUBLE PORTRAIT / TODAY</p><h2>TWO WITNESSES.<br />ONE DAY.</h2></div><p>Each canvas polls the raw archive every ten seconds and grows as its corresponding record accumulates.</p></div>
    <div className="portrait-grid">
      <article className="portrait-panel machine-portrait">
        <div className="portrait-top"><span>01 / MACHINE</span><span><i className={machineData.length ? '' : 'waiting'} /> {machineData.length ? 'STREAM ACTIVE' : 'AWAITING DATA'}</span></div>
        <div className="portrait-canvas"><GenerativeCanvas data={machineData.length ? machineData : fallback} settings={{ palette:['#1646d8','#f3f0e7','#6f716e','#ff4a22'], density:1.15, speed:.65, randomness:.35 }} /><div className="portrait-watermark"><Activity /> THE DAY ACCORDING TO THE MACHINE</div></div>
        <div className="portrait-bottom"><strong>{String(machineData.length).padStart(3,'0')}</strong><span>passive events today</span><span>{machine?.events.at(-1)?.metric ?? 'No machine source connected'}</span></div>
      </article>
      <article className="portrait-panel human-portrait">
        <div className="portrait-top"><span>02 / ME</span><span><i className={humanData.length ? '' : 'waiting'} /> {humanData.length ? 'ARCHIVE GROWING' : 'AWAITING NOTICE'}</span></div>
        <div className="portrait-canvas"><GenerativeCanvas data={humanData.length ? humanData : fallback} settings={{ palette:['#ff4a22','#f4cd24','#f3f0e7','#d84967'], density:.82, speed:.9, randomness:.9 }} /><div className="portrait-watermark"><Fingerprint /> THE DAY ACCORDING TO ME</div></div>
        <div className="portrait-bottom"><strong>{String(humanData.length).padStart(3,'0')}</strong><span>chosen moments today</span><span>{human?.observations.at(-1)?.local_time ?? 'No notice preserved yet'}</span></div>
      </article>
    </div>
    <p className="last-update">LIVE POLL / {updated ? updated.toLocaleTimeString() : 'CONNECTING'} / RAW INPUT ONLY</p>
  </section>
}

