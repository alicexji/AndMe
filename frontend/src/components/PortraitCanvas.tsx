import { useEffect, useRef } from 'react'
import type { DataPoint } from '../types'

// Seeded gradient Perlin noise: quintic interpolation keeps the contours smooth.
function createNoise(seed: number) {
  const permutation = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 255; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[permutation[i], permutation[j]] = [permutation[j], permutation[i]]
  }
  const p = [...permutation, ...permutation]
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  const gradient = (h: number, x: number, y: number) => {
    switch (h & 7) {
      case 0: return x + y
      case 1: return x - y
      case 2: return -x + y
      case 3: return -x - y
      case 4: return x
      case 5: return -x
      case 6: return y
      default: return -y
    }
  }
  return (x: number, y: number) => {
    const ix = Math.floor(x), iy = Math.floor(y)
    const X = ix & 255, Y = iy & 255
    x -= ix; y -= iy
    return mix(
      mix(gradient(p[p[X] + Y], x, y), gradient(p[p[X + 1] + Y], x - 1, y), fade(x)),
      mix(gradient(p[p[X] + Y + 1], x, y - 1), gradient(p[p[X + 1] + Y + 1], x - 1, y - 1), fade(x)), fade(y))
  }
}

export default function PortraitCanvas({ data, kind }: { data: DataPoint[]; kind: 'machine' | 'human' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const machine = kind === 'machine'
    const noise = createNoise(machine ? 84 : 2026)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0, height = 0, frame = 0, last = 0, time = 0, visible = false

    function draw() {
      if (!ctx || !width || !height) return
      const records = dataRef.current
      const energy = records.length ? records.reduce((sum, d) => sum + d.value, 0) / records.length : .18
      ctx.fillStyle = machine ? '#071b39' : '#eee5d6'
      ctx.fillRect(0, 0, width, height)
      const scale = Math.min(width, height)
      ctx.lineWidth = 1
      ctx.strokeStyle = machine ? '#adc7e010' : '#603e2610'
      for (let x = 24; x < width; x += 32) {
        for (let y = 24; y < height; y += 32) {
          ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y)
          ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2); ctx.stroke()
        }
      }
      if (machine) {
        const lines = 65 + Math.min(25, records.length)
        for (let line = 0; line < lines; line++) {
          const v = line / (lines - 1)
          const record = records.length ? records[line % records.length] : undefined
          ctx.beginPath()
          for (let step = 0; step <= 110; step++) {
            const u = step / 110
            const envelope = Math.sin(u * Math.PI)
            const field = noise(u * 2.4 + time * .12, v * 2.2 + time * .05)
            const detail = noise(u * 5 + 11, v * 3 + time * .08) * .15
            const x = u * width
            const y = height * (.16 + v * .68) + (field + detail) * scale * (.28 + energy * .16) * envelope
            if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          }
          ctx.strokeStyle = line % 13 === 0 ? '#c5e8ed' : line % 3 === 0 ? '#3989f4' : '#2360b4'
          ctx.globalAlpha = .4 + (record?.value ?? .3) * .4
          ctx.lineWidth = line % 13 === 0 ? 1.25 : .75
          ctx.stroke()
        }
      } else {
        // A small number of nested forms keeps individual moments legible.
        const forms = records.length ? Math.min(5, records.length) : 1
        for (let form = 0; form < forms; form++) {
          const record = records[form]
          const phase = (record?.secondary ?? .46) * Math.PI * 2
          const cx = width * .5 + (forms > 1 ? Math.cos(phase) * width * .19 : 0)
          const cy = height * .48 + (forms > 1 ? Math.sin(phase) * height * .16 : 0)
          const radius = scale * (forms > 1 ? .2 : .32) * (.85 + (record?.value ?? .3) * .35)
          for (let ring = 0; ring < 46; ring++) {
            const fraction = (ring + 6) / 51
            ctx.beginPath()
            for (let step = 0; step <= 160; step++) {
              const angle = step / 160 * Math.PI * 2
              const nx = Math.cos(angle), ny = Math.sin(angle)
              const warp = noise(nx * 1.2 + form * 7 + time * .08, ny * 1.2 + fraction * .7 + time * .06)
              const r = radius * fraction * (1 + warp * .35)
              const x = cx + nx * r, y = cy + ny * r * 1.12
              if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y)
            }
            ctx.closePath()
            ctx.strokeStyle = ['#bc482d', '#d47041', '#a73735', '#947134', '#cc654e'][form]
            ctx.globalAlpha = .25 + fraction * .5
            ctx.lineWidth = ring % 9 === 0 ? 1.5 : .8
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
    }
    function tick(now: number) {
      if (now - last >= 1000 / 30) {
        time += Math.min((now - last) / 1000, .05)
        last = now
        draw()
      }
      frame = requestAnimationFrame(tick)
    }
    function sync() {
      cancelAnimationFrame(frame)
      draw()
      if (visible && !document.hidden && !reduced.matches) { last = performance.now(); frame = requestAnimationFrame(tick) }
    }
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    })
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    resize.observe(canvas); intersection.observe(canvas)
    reduced.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    // Refresh static artwork too when reduced motion is enabled.
    const refresh = window.setInterval(() => { if (visible && reduced.matches) draw() }, 1000)
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); window.clearInterval(refresh)
      reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync)
    }
  }, [kind])

  return <canvas ref={canvasRef} role="img" aria-label={`${kind === 'machine' ? 'Blue flowing contours representing machine events' : 'Warm organic rings representing chosen moments'}. ${data.length ? `${data.length} records today.` : 'Ambient study; no records yet.'}`} />
}
