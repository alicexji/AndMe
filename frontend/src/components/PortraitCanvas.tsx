import { useEffect, useMemo, useRef } from 'react'
import { portraitBins, type PortraitMark } from '../rendering/PortraitFeatures'

export default function PortraitCanvas({ data, start, end, label }: { data: PortraitMark[]; start: number; end: number; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const bins = useMemo(() => portraitBins(data, start, end).sort((a, b) => a.x - b.x || a.y - b.y), [data, start, end])
  const binsRef = useRef(bins)
  const redraw = useRef<() => void>(() => {})
  useEffect(() => { binsRef.current = bins; redraw.current() }, [bins])
  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0, height = 0, frame = 0, last = 0, visible = false
    const draw = () => {
      if (!width || !height) return
      // A common clock keeps the paired canvases in phase, including after data refresh.
      const time = reduced.matches ? 0 : performance.now() / 1000
      const bins = binsRef.current
      ctx.globalAlpha = 1
      ctx.fillStyle = '#071b39'; ctx.fillRect(0, 0, width, height)
      const left = 32, top = 145, w = Math.max(1, width - 64), h = Math.max(1, height - 185)
      ctx.fillStyle = '#9ab8d533'
      for (let x = 0; x <= 24; x++) for (let y = 0; y <= 12; y++) ctx.fillRect(left + x / 24 * w, top + y / 12 * h, 1, 1)
      ctx.save()
      ctx.beginPath(); ctx.rect(0, 125, width, height - 125); ctx.clip()
      // Fine curved threads connect neighboring occupied time bins.
      for (let i = 1; i < bins.length; i++) {
        const a = bins[i - 1], b = bins[i]
        const ax = left + a.x * w, ay = top + a.y * h, bx = left + b.x * w, by = top + b.y * h
        const bend = Math.sin(time * .24 + a.y * 7) * 15
        const mx = (ax + bx) / 2 + bend, my = (ay + by) / 2 - 18
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by)
        ctx.strokeStyle = '#6eaecf'; ctx.globalAlpha = .12; ctx.lineWidth = .65; ctx.stroke()
        const t = (time * .055 + a.x * .7 + a.y * .3) % 1, u = 1 - t
        ctx.globalAlpha = .55; ctx.fillStyle = '#b8e7ed'
        ctx.beginPath(); ctx.arc(u * u * ax + 2 * u * t * mx + t * t * bx, u * u * ay + 2 * u * t * my + t * t * by, 1.1, 0, Math.PI * 2); ctx.fill()
      }
      for (const bin of bins) {
        const cx = left + bin.x * w, cy = top + bin.y * h
        const phase = bin.x * 6 + bin.y * 4
        const radius = (8 + bin.weight * Math.min(w, h) * .13) * (1 + Math.sin(time * .6 + phase) * .045)
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.65)
        glow.addColorStop(0, '#428ecb28'); glow.addColorStop(1, '#428ecb00')
        ctx.globalAlpha = 1; ctx.fillStyle = glow
        ctx.fillRect(cx - radius * 1.65, cy - radius * 1.65, radius * 3.3, radius * 3.3)
        const rings = 5 + Math.min(9, Math.floor(Math.log2(bin.count + 1) * 2))
        for (let ring = 1; ring <= rings; ring++) {
          ctx.beginPath()
          for (let step = 0; step <= 72; step++) {
            const a = step / 72 * Math.PI * 2
            const fraction = ring / rings
            const warp = Math.sin(a * 3 + phase + time * .23 + fraction) * .12
              + Math.cos(a * 5 - time * .17 + bin.y * 4) * (.04 + bin.texture * .12)
              + Math.sin(a * 8 + fraction * 3 + time * .32) * .025
            const r = radius * fraction * (1 + warp)
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
            if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          }
          ctx.closePath(); ctx.strokeStyle = ring === rings ? '#b8e7ed' : ring % 3 === 0 ? '#6dc4ca' : '#458fcb'
          ctx.globalAlpha = .2 + ring / rings * .45; ctx.lineWidth = ring === rings ? 1 : .65; ctx.stroke()
        }
        // Broken outer orbits and warm satellites add a second scale of detail.
        ctx.strokeStyle = '#88becf'; ctx.globalAlpha = .24; ctx.lineWidth = .6
        for (let orbit = 0; orbit < 2; orbit++) {
          const a = time * (.12 + orbit * .04) + phase + orbit * Math.PI
          const r = radius * (1.2 + orbit * .16)
          ctx.beginPath(); ctx.arc(cx, cy, r, a, a + Math.PI * .85); ctx.stroke()
          ctx.fillStyle = '#e6b87a'
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2, 0, Math.PI * 2); ctx.fill()
        }
        ctx.globalAlpha = .75 + Math.sin(time * .8 + phase) * .15; ctx.fillStyle = '#e6b87a'
        ctx.beginPath(); ctx.arc(cx, cy, 1.7, 0, Math.PI * 2); ctx.fill()
      }
      ctx.restore(); ctx.globalAlpha = 1
      if (!bins.length) { ctx.fillStyle = '#91aac8'; ctx.font = '12px monospace'; ctx.fillText('No observations yet', left, top + h / 2) }
    }
    const tick = (now: number) => {
      if (now - last >= 1000 / 30) { last = now; draw() }
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      if (visible && !document.hidden) {
        draw()
        if (!reduced.matches) frame = requestAnimationFrame(tick)
      }
    }
    redraw.current = sync
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height
      const dpr = Math.min(devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sync()
    })
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync() })
    observer.observe(canvas); intersection.observe(canvas)
    reduced.addEventListener('change', sync); document.addEventListener('visibilitychange', sync)
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect()
      reduced.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync)
      redraw.current = () => {}
    }
  }, [])
  return <canvas ref={ref} role="img" aria-label={`${label}: Animated contour atlas, ${data.length} records. Horizontal position is archive time; vertical position is local time of day.`} />
}
