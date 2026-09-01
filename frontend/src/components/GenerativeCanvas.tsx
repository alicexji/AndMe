import { useEffect, useRef } from 'react'
import type { ArtSettings, DataPoint } from '../types'

export default function GenerativeCanvas({ data, settings, className = '' }: { data: DataPoint[]; settings: ArtSettings; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    const draw = (now: number) => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2)
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) { canvas.width=rect.width*dpr;canvas.height=rect.height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0) }
      const w=rect.width,h=rect.height,t=now*.00025*settings.speed
      ctx.fillStyle='#11110f';ctx.fillRect(0,0,w,h);ctx.lineWidth=.8
      const rows=Math.floor(28*settings.density)
      for(let r=0;r<rows;r++){ctx.beginPath();for(let x=0;x<=w;x+=7){const d=data[(r+Math.floor(x/20))%data.length];const y=(r/(rows-1))*h+Math.sin(x*.013+t+r*.23)*18*settings.randomness+(d.value-.5)*25;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)}ctx.strokeStyle=settings.palette[r%settings.palette.length];ctx.globalAlpha=.35;ctx.stroke()}
      data.forEach((d,i)=>{const x=(i/(data.length-1))*w,y=h*(.15+d.secondary*.7);ctx.fillStyle=settings.palette[i%settings.palette.length];ctx.globalAlpha=.85;ctx.beginPath();ctx.arc(x,y,2+d.value*6,0,Math.PI*2);ctx.fill()})
      ctx.globalAlpha=1;frame=requestAnimationFrame(draw)
    }
    frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame)
  },[data,settings])
  return <canvas ref={ref} className={className} aria-label="Live generative preview" />
}

