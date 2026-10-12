import { useRef, useState } from 'react'
import { ArrowUpRight, Images, X } from 'lucide-react'
import './Portfolio.css'

const files = import.meta.glob<string>('../assets/portfolio/**/*', {
  eager: true, query: '?url', import: 'default',
})
const artworks = Object.entries(files)
  .filter(([path]) => /\.(jpe?g|png|webp|gif|avif)$/i.test(path))
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, url]) => ({ url, title: path.split('/').at(-1)!.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }))

export default function Portfolio() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<(typeof artworks)[number] | null>(null)
  return <div className="page-wrap portfolio-page">
    <header className="page-hero"><p className="section-code">PORTFOLIO / COLLECTED WORKS</p><h1>TRACES<br /><em>MADE VISIBLE</em></h1><p>From the screen to the page. A collection of data, drawings, and experiments.</p></header>
    <section className="portfolio-collection" aria-label="Art collection">
      <div className="portfolio-heading"><h2>Selected works</h2><span>{String(artworks.length).padStart(2, '0')} {artworks.length === 1 ? 'WORK' : 'WORKS'}</span></div>
      {artworks.length ? <div className="portfolio-grid">{artworks.map((art, index) => <figure key={art.url}>
        <button className="portfolio-image" onClick={() => { setSelected(art); dialog.current?.showModal() }} aria-label={`View ${art.title}`}>
          <img src={art.url} alt={art.title} loading="lazy" decoding="async" />
          <span aria-hidden="true"><ArrowUpRight /></span>
        </button>
        <figcaption><span>{String(index + 1).padStart(2, '0')}</span><h3>{art.title}</h3></figcaption>
      </figure>)}</div> : <div className="portfolio-empty"><Images size={40} strokeWidth={1} /><h2>Your collection starts here.</h2><p>Screenshots, sketches, and photographs of work in progress.<br />A place to keep the images you want to return to.</p></div>}
    </section>
    <dialog ref={dialog} className="portfolio-viewer" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close() }}>
      <button className="portfolio-close" aria-label="Close artwork" onClick={() => dialog.current?.close()} autoFocus><X /></button>
      {selected && <figure><img src={selected.url} alt={selected.title} /><figcaption>{selected.title}<a href={selected.url} target="_blank" rel="noreferrer">Open original <ArrowUpRight size={16} /></a></figcaption></figure>}
    </dialog>
  </div>
}
