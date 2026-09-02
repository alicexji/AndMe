import { Eye, Fingerprint, Radio, ScanLine } from 'lucide-react'
import { useMemo } from 'react'
import GenerativeCanvas from '../components/GenerativeCanvas'
import { PALETTES, SELECTED_ARTIFACTS } from '../constants'
import type { DataPoint } from '../types'

export default function Engine() {
  const data = useMemo<DataPoint[]>(() => Array.from({ length: 54 }, (_, i) => ({ value:((i*17)%37)/37,secondary:(Math.sin(i*.71)+1)/2,timestamp:Date.now()-i*60000 })), [])
  return <div className="page-wrap">
    <header className="page-hero dark"><p className="section-code">SYSTEM / INTERPRETATION</p><h1>THE ART<br /><em>ENGINES</em></h1><p>Many possible readings. One immutable source archive.</p></header>
    <section className="engines ruled-section"><p className="section-code">CORE ENGINES / SYSTEM MAP</p><h2>THREE LAYERS.<br />ONE ARCHIVE.</h2><div className="engine-grid">
      <article><span>01</span><Fingerprint /><h3>Human Notice</h3><p>Typed thought, dictated fragment, or photograph—recorded only when you decide it matters.</p><b>ACTIVE</b></article>
      <article><span>02</span><Radio /><h3>Machine Stream</h3><p>Continuous passive device measurements remain a distinct source of evidence.</p><b className="future">FUTURE</b></article>
      <article><span>03</span><ScanLine /><h3>Art Engine</h3><p>Multiple visual interpretations can emerge without altering the raw archive.</p><b className="future">STUDY</b></article>
    </div></section>
    <section className="artifacts ruled-section"><div className="section-heading"><div><p className="section-code">SELECTED ARTIFACTS / STUDIES</p><h2>PORTRAITS IN<br />PROGRESS</h2></div><p className="aside-copy">Conceptual frames for the eventual comparison.</p></div><div className="artifact-track">{SELECTED_ARTIFACTS.map((art,i)=><article className={`artifact artifact-${i+1}`} key={art.id}><div className="artifact-visual"><span>{art.id}</span><i/><b/></div><div className="artifact-meta"><span>{art.dataSummary}</span><span>{art.tags.join(' / ')}</span></div><h3>{art.title}</h3><p>{art.description}</p></article>)}</div></section>
    <section className="generator ruled-section"><div className="generator-copy"><p className="section-code">LIVE ENGINE TEASER / NOT DATA-BOUND</p><h2>THE ARCHIVE<br />CAN BECOME<br /><em>MANY THINGS.</em></h2><p>This canvas is a visual study, not analysis. Future engines remain downstream from the raw record.</p><div className="legend">{PALETTES[0].colors.map(c=><i key={c} style={{background:c}}/>)}</div></div><div className="generator-card"><GenerativeCanvas data={data} settings={{palette:PALETTES[0].colors,density:1,speed:1,randomness:.8}}/><div className="generator-label"><span>FLOW STUDY / 001</span><Eye/><span>LIVE RENDER</span></div></div></section>
  </div>
}

