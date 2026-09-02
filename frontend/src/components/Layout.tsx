import type { ReactNode } from 'react'
import Footer from './Footer'
import Navbar from './Navbar'
import type { Page } from '../App'

export default function Layout({ children, activePage, onNavigate }: { children: ReactNode; activePage: Page; onNavigate: (page: Page) => void }) {
  return <div className="app-shell">
    <div className="grain" />
    <Navbar activePage={activePage} onNavigate={onNavigate} />
    <main>{children}</main>
    <Footer onNavigate={onNavigate} />
  </div>
}
