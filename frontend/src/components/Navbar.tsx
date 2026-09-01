import { Menu, X } from 'lucide-react'
import { useState } from 'react'

const links = [
  ['Studio', 'studio'], ['Archive', 'archive'], ['Engine', 'engine'], ['Docs', 'docs'],
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setOpen(false)
  }
  return <>
    <nav className="site-nav" aria-label="Primary navigation">
      <button className="brand" onClick={() => go('studio')}>MACHINE / ME <span>MM—01</span></button>
      <div className="nav-links">
        {links.map(([label, id]) => <button key={id} onClick={() => go(id)}>{label}</button>)}
      </div>
      <button className="nav-action" onClick={() => go('archive')}>View archive ↘</button>
      <button className="menu-button" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
    </nav>
    {open && <div className="mobile-menu">
      <button aria-label="Close menu" onClick={() => setOpen(false)}><X /></button>
      {links.map(([label, id]) => <button key={id} onClick={() => go(id)}>{label}</button>)}
    </div>}
  </>
}

