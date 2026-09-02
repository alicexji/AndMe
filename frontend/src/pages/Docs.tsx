export default function Docs() {
  return <div className="page-wrap docs-page">
    <header className="page-hero"><p className="section-code">DOCUMENTATION / PROJECT LOG</p><h1>HOW THE<br /><em>SYSTEM WORKS</em></h1><p>A small, explicit collection pipeline built around preservation.</p></header>
    <section className="docs-grid ruled-section"><article><span>01</span><h2>Human</h2><p>The Notice Shortcut sends intentional text or photographs directly to FastAPI. Original content is stored without tags, scores, prompts, or interpretation.</p></article><article><span>02</span><h2>Machine</h2><p>Future passive sources write to a separate machine-event stream. Human observations are never forced into the same schema.</p></article><article><span>03</span><h2>Archive</h2><p>PostgreSQL preserves structured records; media storage preserves uploaded bytes. Derived artwork must remain downstream.</p></article></section>
    <section className="api-panel"><p className="section-code">LOCAL DEVELOPER REFERENCE</p><h2>FASTAPI / OPENAPI</h2><p>The interactive API reference is available while the backend is running.</p><a className="brutal-button" href="http://localhost:8000/docs" target="_blank" rel="noreferrer">Open API docs ↗</a></section>
  </div>
}

