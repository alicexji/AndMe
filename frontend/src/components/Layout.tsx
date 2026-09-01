import type { ReactNode } from 'react'
import Footer from './Footer'
import Navbar from './Navbar'

export default function Layout({ children }: { children: ReactNode }) {
  return <div className="app-shell">
    <div className="grain" />
    <Navbar />
    <main>{children}</main>
    <Footer />
  </div>
}

