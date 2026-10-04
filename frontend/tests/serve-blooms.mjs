import { build } from 'rolldown'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'

await build({ input: 'tests/blooms.browser-entry.ts', platform: 'browser', transform: { define: { 'import.meta.env.DEV': 'true' } }, output: { dir: 'dist/bloom-check', format: 'es', entryFileNames: 'entry.js' } })
const root = resolve('dist')
createServer(async (request, response) => {
  try {
    if (request.url === '/favicon.ico') { response.writeHead(204).end(); return }
    const path = resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/\/$/, '/index.html'))
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return }
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' }
    const content = await readFile(path)
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' })
    response.end(content)
  } catch { response.writeHead(404).end() }
}).listen(5175, '127.0.0.1', () => console.log('Bloom browser test server: http://127.0.0.1:5175'))
