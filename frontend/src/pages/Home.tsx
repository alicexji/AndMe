import { motion } from 'motion/react'
import { ArrowDownRight, ArrowRight, Database } from 'lucide-react'
import type { Page } from '../App'
import HeroCanvas from '../components/HeroCanvas'
import LivePortraits from '../components/LivePortraits'

export default function Home({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <>
    <section className="hero">
      <HeroCanvas className="hero-canvas" />
      <div className="data-ticker" aria-hidden="true">{Array(8).fill('UTC 19:42:08 · HUMAN SIGNAL 01 · NODE 0084 · LAT — · NOTICE PRESERVED · ').join('')}</div>
      <motion.div className="hero-copy" initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9 }}>
        <p className="section-code">COMPUTATIONAL PORTRAIT STUDY / 2026</p>
        <h1>DATA BECOMES<br /><em>VISUAL POETRY</em></h1>
        <div className="hero-lower">
          <p>Two witnesses observe the same life.<br />The machine records continuously.<br />The human chooses what survives.</p>
          <button className="brutal-button" onClick={() => onNavigate('archive')}>Enter the archive <ArrowDownRight /></button>
        </div>
      </motion.div>
      <div className="hero-index"><span>01</span><span>HUMAN / MACHINE</span><span>LIVE STUDY</span></div>
    </section>

    <LivePortraits />

    <section className="manifesto ruled-section">
      <p className="section-code">THESIS / 001</p>
      <div className="manifesto-grid"><h2>ONE LIFE.<br />TWO RECORDS.</h2><p>Machine / Me asks what changes when a person and their devices witness the same day. The paired canvases grow from different forms of attention. The archive is permanent; each image is only an interpretation.</p></div>
    </section>

    <section className="closing home-closing"><Database /><p>COLLECT → STORE RAW → PRESERVE</p><h2>THE ARCHIVE<br />COMES FIRST.</h2><button className="brutal-button inverse" onClick={() => onNavigate('archive')}>Open today's record <ArrowRight /></button></section>
  </>
}

