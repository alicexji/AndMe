import type { Page } from '../App'

export default function Footer({ onNavigate }: { onNavigate: (page: Page) => void }) {
  return <footer className="site-footer">
    <div><strong>MACHINE / ME</strong><p>Computational self-portrait study<br />Human archive / machine record</p></div>
    <div><span>PLATFORM</span><button onClick={() => onNavigate('studio')}>Studio</button><button onClick={() => onNavigate('archive')}>Archive</button><button onClick={() => onNavigate('docs')}>Docs</button></div>
    <div><span>SYSTEM</span><p className="status"><i /> Collection endpoint ready</p><p>Local prototype / v0.3</p></div>
    <p className="copyright">© 2026 MACHINE / ME<br />RAW DATA REMAINS RAW</p>
  </footer>
}

