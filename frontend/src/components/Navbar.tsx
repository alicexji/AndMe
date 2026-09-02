import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import type { Page } from '../App'

const links: [string, Page][] = [
  ['Studio', 'studio'], ['Archive', 'archive'], ['Engine', 'engine'], ['Docs', 'docs'],
]

export default function Navbar({ activePage, onNavigate }: { activePage: Page; onNavigate: (page: Page) => void }) {
  const [open, setOpen] = useState(false)
  const go = (page: Page) => { onNavigate(page); setOpen(false) }
  return <>
    <nav className="site-nav" aria-label="Primary navigation">
      <button className="brand" onClick={() => go('studio')}>MACHINE / ME <span>MM—01</span></button>
      <div className="nav-links">{links.map(([label, page]) => <button className={activePage === page ? 'active' : ''} key={page} onClick={() => go(page)}>{label}</button>)}</div>
      <button className="nav-action" onClick={() => go('archive')}>View archive ↘</button>
      <button className="menu-button" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
    </nav>
    {open && <div className="mobile-menu">
      <button aria-label="Close menu" onClick={() => setOpen(false)}><X /></button>
      {links.map(([label, page]) => <button key={page} onClick={() => go(page)}>{label}</button>)}
    </div>}
  </>
}

