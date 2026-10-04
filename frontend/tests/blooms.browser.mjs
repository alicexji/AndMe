import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json()
const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const pending = new Map(), errors = []
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})
const fixture = { features: Array.from({ length: 180 }, (_, index) => ({ properties: { place: `Test region ${index}`, mag: 1 + (index % 9), time: 1700000000000 + index * 10000 }, geometry: { coordinates: [0, 0, index % 40] } })) }
socket.addEventListener('message', async ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const item = pending.get(message.id); pending.delete(message.id)
    if (message.error) item?.reject(new Error(JSON.stringify(message.error))); else item?.resolve(message.result)
  } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args)
  else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry)
  else if (message.method === 'Fetch.requestPaused') {
    await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(JSON.stringify(fixture)).toString('base64') })
  }
})
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
try {
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false })
  await send('Fetch.enable', { patterns: [{ urlPattern: '*earthquake.usgs.gov*' }] })
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200); await send('Log.clear'); errors.length = 0
  await send('Page.navigate', { url: `http://127.0.0.1:5175/?perf&check=${Date.now()}#/playground` })
  for (let i = 0; i < 60; i++) {
    if (await evaluate(`!!document.querySelector('.pixi-bloom-canvas')`)) break
    await sleep(250)
  }

  assert.equal(await evaluate(`!!document.querySelector('.pixi-bloom-canvas')`), true, 'WebGL renderer should mount')
  await evaluate(`document.querySelector('.art-stage').scrollIntoView()`)
  await sleep(6500)
  console.log('Integration stats:', await evaluate(`document.querySelector('.pixi-performance')?.textContent`))
  const screenshot = await send('Page.captureScreenshot', { format: 'png' })
  const screenshotPath = join(tmpdir(), 'dissolving-blooms.png')
  await writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'))
  console.log('Screenshot:', screenshotPath)
  assert.deepEqual(errors, [], 'No browser errors during integration')

  // Exercise renderer lifecycle and visibility with reproducible input, independent of network timing.
  await evaluate(`(async () => {
    location.hash = '#/docs';
    await new Promise(resolve => setTimeout(resolve, 200));
    const { PixiBloomRenderer } = await import('/bloom-check/entry.js');
    const { buildBloomFeatures } = await import('/bloom-check/entry.js');
    const host = document.createElement('div'); host.style.cssText='position:fixed;inset:0;z-index:99999'; document.body.appendChild(host);
    const renderer = new PixiBloomRenderer(host, error => console.error(error));
    window.bloomCheck = { renderer, host };
    await renderer.init();
    const events = Array.from({length:180},(_,i)=>({id:'test-'+i,label:'Region '+i,value:i,secondary:i%40,time:1700000000000+i,born:performance.now()-2000,rawFieldCount:5}));
    renderer.setFeatures(buildBloomFeatures({events,reference:events,axis:'value',scale:'linear'}));
  })()`)
  await sleep(1500)
  const count = await evaluate(`bloomCheck.renderer.geometry.instanceCount`)
  console.log('Dense renderer stats:', await evaluate(`bloomCheck.host.querySelector('.pixi-performance')?.textContent`));
  assert.ok(count > 0 && count <= 153, `expected visible budget, got ${count}`)
  await evaluate(`bloomCheck.renderer.setControls({lifetime:16,density:10,intensity:82,complexity:78,motion:65})`)
  await sleep(650)
  assert.equal(await evaluate(`bloomCheck.renderer.simulation.states.size`), 45)
  assert.equal(await evaluate(`bloomCheck.renderer.geometry.instanceCount`), 45)
  await evaluate(`bloomCheck.host.style.left='-10000px'; bloomCheck.host.style.right='auto'; bloomCheck.host.style.width='1440px'`)
  await sleep(200)
  assert.equal(await evaluate(`bloomCheck.renderer.app.ticker.started`), false)
  await evaluate(`bloomCheck.host.style.left='0'; bloomCheck.host.style.right='0'; bloomCheck.host.style.width='375px'`)
  await sleep(200)
  assert.equal(await evaluate(`bloomCheck.renderer.app.ticker.started`), true)
  await sleep(200)
  assert.equal(await evaluate(`bloomCheck.renderer.app.screen.width`), 375)
  await evaluate(`bloomCheck.renderer.setControls({lifetime:1,density:10,intensity:82,complexity:78,motion:65})`)
  await sleep(200)
  assert.equal(await evaluate(`bloomCheck.renderer.simulation.states.size`), 0)
  assert.equal(await evaluate(`bloomCheck.renderer.geometry.instanceCount`), 0)
  await evaluate(`bloomCheck.renderer.destroy(); bloomCheck.renderer.destroy(); bloomCheck.host.remove()`)
  await evaluate(`(async () => {
    const { PixiBloomRenderer } = await import('/bloom-check/entry.js');
    for(let i=0;i<3;i++) {
      const host=document.createElement('div');document.body.appendChild(host);
      const renderer=new PixiBloomRenderer(host,error=>console.error(error));
      const pending=renderer.init();renderer.destroy();await pending;host.remove();
    }
  })()`)
  assert.deepEqual(errors, [], 'No browser errors during lifecycle checks')
  console.log('PASS: real WebGL rendering, density retirement, expiry removal, offscreen suspension, resize, repeated destruction and async initialization cleanup')
} finally { socket.close() }
