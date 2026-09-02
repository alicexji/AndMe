import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import type { ArchiveDay } from '../types'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const localDate = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10) }

export default function Archive() {
  const [date, setDate] = useState(localDate())
  const [day, setDay] = useState<ArchiveDay | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    setError('')
    fetch(`${API}/api/days/${date}/observations`).then(r => { if (!r.ok) throw new Error('Archive connection unavailable'); return r.json() }).then(setDay).catch(e => setError(e.message))
  }, [date])
  return <div className="page-wrap">
    <header className="page-hero"><p className="section-code">RAW PERSONAL ARCHIVE / HUMAN</p><h1>WHAT I CHOSE<br /><em>TO PRESERVE</em></h1><p>Uninterpreted moments, recorded deliberately.</p></header>
    <section className="archive-section ruled-section">
      <div className="section-heading"><div><p className="section-code">DAILY RECORD / {date}</p><h2>HUMAN<br />NOTICES</h2></div><label className="date-control">Archive date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
      <div className="archive-status"><span><i className={error ? 'offline' : ''} /> {error || 'Archive connected'}</span><span>{day?.timezone ?? '—'}</span><span>{String(day?.observations.length ?? 0).padStart(2, '0')} records</span></div>
      {day?.observations.length === 0 && <p className="empty">No notices were preserved on this day.</p>}
      <ol className="observation-list">{day?.observations.map((o, index) => <motion.li key={o.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .04 }}>
        <div className="observation-number">{String(index + 1).padStart(2, '0')}</div><time>{o.local_time}</time>
        <article>{o.raw_text && <p>“{o.raw_text}”</p>}<div className="observation-media">{o.media.map(m => m.media_type.startsWith('image/') ? <img key={m.id} src={m.url} alt="Raw human observation" /> : <a key={m.id} href={m.url}>Open media</a>)}</div></article>
        <span className="observation-type">HUMAN / NOTICE</span>
      </motion.li>)}</ol>
    </section>
  </div>
}

