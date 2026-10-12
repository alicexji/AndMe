import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import Archive from './pages/Archive'
import Docs from './pages/Docs'
import Engine from './pages/Engine'
import Home from './pages/Home'
import Playground from './pages/Playground'
import Portfolio from './pages/Portfolio'

export type Page = 'studio' | 'archive' | 'engine' | 'playground' | 'portfolio' | 'docs'

const currentPage = (): Page => {
  const value = window.location.hash.replace('#/', '').replace('#', '')
  return ['archive', 'engine', 'playground', 'portfolio', 'docs'].includes(value) ? value as Page : 'studio'
}

export default function App() {
  const [page, setPage] = useState<Page>(currentPage)
  useEffect(() => {
    const onHashChange = () => { setPage(currentPage()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])
  const navigate = (next: Page) => {
    const hash = next === 'studio' ? '' : `#/${next}`
    if (window.location.hash === hash) window.scrollTo({ top: 0, behavior: 'smooth' })
    else window.location.hash = hash
  }
  const content = page === 'portfolio' ? <Portfolio /> : page === 'archive' ? <Archive /> : page === 'engine' ? <Engine /> : page === 'playground' ? <Playground /> : page === 'docs' ? <Docs /> : <Home onNavigate={navigate} />
  return <Layout activePage={page} onNavigate={navigate}>{content}</Layout>
}
