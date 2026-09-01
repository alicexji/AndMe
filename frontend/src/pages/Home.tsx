import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowRight, Database, Eye, Fingerprint, Radio, ScanLine } from 'lucide-react'
import GenerativeCanvas from '../components/GenerativeCanvas'
import HeroCanvas from '../components/HeroCanvas'
import { PALETTES, SELECTED_ARTIFACTS } from '../constants'
import type { ArchiveDay, DataPoint } from '../types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const localDate = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }
const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

export default function Home() {
  const [date, setDate] = useState(localDate())
  const [day, setDay] = useState<ArchiveDay | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    fetch(`${API}/api/days/${date}/observations`)
      .then(r => { if (!r.ok) throw new Error('Archive connection unavailable'); return r.json() })
      .then(setDay).catch(e => setError(e.message))
  }, [date])

  const previewData = useMemo<DataPoint[]>(() => Array.from({ length: 54 }, (_, i) => ({
    value: ((i * 17) % 37) / 37, secondary: (Math.sin(i * .71) + 1) / 2,
    timestamp: Date.now() - i * 60000,
  })), [])

  return <>
    <section className="hero" id="studio">
      <HeroCanvas className="hero-canvas" />
      <div className="data-ticker" aria-hidden="true">{Array(8).fill('UTC 19:42:08 · HUMAN SIGNAL 01 · NODE 0084 · LAT — · NOTICE PRESERVED · ').join('')}</div>
      <motion.div className="hero-copy" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9 }}>
        <p className="section-code">COMPUTATIONAL PORTRAIT STUDY / 2026</p>
        <h1>DATA BECOMES<br /><em>VISUAL POETRY</em></h1>
        <div className="hero-lower">
          <p>Two witnesses observe the same life.<br />The machine records continuously.<br />The human chooses what survives.</p>
          <button className="brutal-button" onClick={() => go('archive')}>Enter the archive <ArrowDownRight /></button>
        </div>
      </motion.div>
      <div className="hero-index"><span>01</span><span>HUMAN / MACHINE</span><span>LIVE STUDY</span></div>
    </section>

    <section className="manifesto ruled-section">
      <p className="section-code">THESIS / 001</p>
      <div className="manifesto-grid"><h2>ONE LIFE.<br />TWO RECORDS.</h2><p>Machine / Me is a personal data-art experiment asking what changes when a person and their devices witness the same day. The archive is permanent. Every artwork is only an interpretation.</p></div>
    </section>

    <section className="artifacts ruled-section">
      <div className="section-heading"><div><p className="section-code">SELECTED ARTIFACTS / STUDIES</p><h2>PORTRAITS IN<br />PROGRESS</h2></div><p className="aside-copy">Conceptual frames for a system that does not exist yet. Raw collection comes first.</p></div>
      <div className="artifact-track">
        {SELECTED_ARTIFACTS.map((art, i) => <article className={`artifact artifact-${i + 1}`} key={art.id}>
          <div className="artifact-visual"><span>{art.id}</span><i /><b /></div>
          <div className="artifact-meta"><span>{art.dataSummary}</span><span>{art.tags.join(' / ')}</span></div>
          <h3>{art.title}</h3><p>{art.description}</p>
        </article>)}
      </div>
    </section>

    <section className="engines ruled-section" id="engine">
      <p className="section-code">CORE ENGINES / SYSTEM MAP</p><h2>THREE LAYERS.<br />ONE ARCHIVE.</h2>
      <div className="engine-grid">
        <article><span>01</span><Fingerprint /><h3>Human Notice</h3><p>Typed thought, dictated fragment, or photograph—recorded only when you decide it matters.</p><b>ACTIVE</b></article>
        <article><span>02</span><Radio /><h3>Machine Stream</h3><p>Continuous passive device measurements remain a distinct source of evidence.</p><b className="future">FUTURE</b></article>
        <article><span>03</span><ScanLine /><h3>Art Engine</h3><p>Multiple visual interpretations can emerge later without altering the raw archive.</p><b className="future">FUTURE</b></article>
      </div>
    </section>

    <section className="archive-section ruled-section" id="archive">
      <div className="section-heading"><div><p className="section-code">RAW PERSONAL ARCHIVE / HUMAN</p><h2>WHAT I CHOSE<br />TO PRESERVE</h2></div><label className="date-control">Archive date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
      <div className="archive-status"><span><i className={error ? 'offline' : ''} /> {error || 'Archive connected'}</span><span>{day?.timezone ?? '—'}</span><span>{String(day?.observations.length ?? 0).padStart(2, '0')} records</span></div>
      {day?.observations.length === 0 && <p className="empty">No notices were preserved on this day.</p>}
      <ol className="observation-list">{day?.observations.map((o, index) => <motion.li key={o.id} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
        <div className="observation-number">{String(index + 1).padStart(2, '0')}</div><time>{o.local_time}</time>
        <article>{o.raw_text && <p>“{o.raw_text}”</p>}<div className="observation-media">{o.media.map(m => m.media_type.startsWith('image/') ? <img key={m.id} src={m.url} alt="Raw human observation" /> : <a key={m.id} href={m.url}>Open media</a>)}</div></article>
        <span className="observation-type">HUMAN / NOTICE</span>
      </motion.li>)}</ol>
    </section>

    <section className="generator ruled-section">
      <div className="generator-copy"><p className="section-code">LIVE ENGINE TEASER / NOT DATA-BOUND</p><h2>THE ARCHIVE<br />CAN BECOME<br /><em>MANY THINGS.</em></h2><p>This canvas is a visual study—not an analysis of your observations. Future engines will remain downstream from the raw record.</p><div className="legend">{PALETTES[0].colors.map(c => <i key={c} style={{ background: c }} />)}</div></div>
      <div className="generator-card"><GenerativeCanvas data={previewData} settings={{ palette: PALETTES[0].colors, density: 1, speed: 1, randomness: .8 }} /><div className="generator-label"><span>FLOW STUDY / 001</span><Eye /><span>LIVE RENDER</span></div></div>
    </section>

    <section className="closing"><Database /><p>COLLECT → STORE RAW → PRESERVE</p><h2>THE ARCHIVE<br />COMES FIRST.</h2><button className="brutal-button inverse" onClick={() => go('archive')}>Open today's record <ArrowRight /></button></section>
  </>
}

