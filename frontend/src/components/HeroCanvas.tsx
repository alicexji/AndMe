import React, { useEffect, useRef } from 'react';

interface HeroCanvasProps {
  className?: string;
}

export default function HeroCanvas({ className }: HeroCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;

    // Palette inspired by contemporary graphic design & Swiss/Bauhaus data art
    const PALETTE = [
      '#FF3E00', // Vermillion
      '#0047AB', // Cobalt Blue
      '#FFD700', // Ochre Gold
      '#00E599', // Emerald Mint
      '#FF2A85', // Electric Magenta
      '#00D4FF', // Cyan
      '#111111', // Deep Ink
      '#777777', // Neutral Gray
      '#FFFFFF', // Pure White
    ];

    const LABELS = [
      '01', '02', '03', '04', '08', '16', '32', '64', '88', '99',
      '0.84', '0.92', '1.04', '+', '//', 'RX', 'TX', '0xF3', '4K',
      'LAT', 'LON', 'NODE', 'VAL', '98.2%', 'μ', 'Δ', 'Σ', 'λ', 'Ω'
    ];

    // Primary Interactive Particles & Shapes (floating bars, discs, crosses, numbers)
    class FloatingItem {
      x: number;
      y: number;
      homeX: number;
      homeY: number;
      vx: number;
      vy: number;
      width: number;
      height: number;
      color: string;
      angle: number;
      angularSpeed: number;
      speed: number;
      opacity: number;
      baseOpacity: number;
      type: 'bar' | 'disc' | 'line' | 'cross' | 'square' | 'ring' | 'label';
      label: string;
      phase: number;
      sizeFactor: number;

      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.homeX = this.x;
        this.homeY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        this.angle = Math.random() * Math.PI * 2;
        this.angularSpeed = (Math.random() - 0.5) * 0.02;
        this.speed = Math.random() * 0.7 + 0.2;
        this.baseOpacity = Math.random() * 0.35 + 0.55;
        this.opacity = this.baseOpacity;
        this.phase = Math.random() * Math.PI * 2;
        this.sizeFactor = Math.random() * 0.8 + 0.6;

        const randType = Math.random();
        if (randType < 0.32) {
          this.type = 'bar';
          this.width = (Math.random() * 5 + 1.5) * this.sizeFactor;
          this.height = (Math.random() * 55 + 12) * this.sizeFactor;
        } else if (randType < 0.52) {
          this.type = 'disc';
          this.width = (Math.random() * 4 + 1.5) * this.sizeFactor;
          this.height = this.width;
        } else if (randType < 0.68) {
          this.type = 'line';
          this.width = Math.random() * 0.8 + 0.4;
          this.height = (Math.random() * 45 + 15) * this.sizeFactor;
        } else if (randType < 0.78) {
          this.type = 'ring';
          this.width = (Math.random() * 6 + 3) * this.sizeFactor;
          this.height = this.width;
        } else if (randType < 0.88) {
          this.type = 'cross';
          this.width = (Math.random() * 8 + 4) * this.sizeFactor;
          this.height = this.width;
        } else if (randType < 0.94) {
          this.type = 'square';
          this.width = (Math.random() * 6 + 2.5) * this.sizeFactor;
          this.height = this.width;
        } else {
          this.type = 'label';
          this.width = 0;
          this.height = 0;
        }

        this.label = Math.random() > 0.65 ? LABELS[Math.floor(Math.random() * LABELS.length)] : '';
      }

      update(time: number, mouseX: number, mouseY: number, mouseActive: boolean) {
        // Multi-harmonic flow field vector
        const noise = (
          Math.sin(this.x * 0.0012 + time * 0.7 + this.phase) +
          Math.cos(this.y * 0.0014 + time * 0.5) +
          Math.sin((this.x + this.y) * 0.0006 + time * 0.3)
        ) * Math.PI;

        this.angle += this.angularSpeed;

        const targetVx = Math.cos(noise) * this.speed;
        const targetVy = Math.sin(noise) * this.speed;

        this.vx += (targetVx - this.vx) * 0.05;
        this.vy += (targetVy - this.vy) * 0.05;

        this.x += this.vx;
        this.y += this.vy;

        // Elastic return force to anchor/home region so elements never empty out
        this.x += (this.homeX - this.x) * 0.0035;
        this.y += (this.homeY - this.y) * 0.0035;

        // Interactive mouse dynamics
        if (mouseActive) {
          const dx = mouseX - this.x;
          const dy = mouseY - this.y;
          const distSq = dx * dx + dy * dy;
          const radius = 320;
          if (distSq < radius * radius && distSq > 1) {
            const dist = Math.sqrt(distSq);
            const force = (radius - dist) / radius;
            
            // Tangential swirl + gentle push
            const angleToMouse = Math.atan2(dy, dx);
            this.x -= Math.cos(angleToMouse) * force * 3.5;
            this.y -= Math.sin(angleToMouse) * force * 3.5;
            this.x += -Math.sin(angleToMouse) * force * 2.0;
            this.y += Math.cos(angleToMouse) * force * 2.0;

            this.opacity = Math.min(0.95, this.baseOpacity + force * 0.5);
          } else {
            this.opacity += (this.baseOpacity - this.opacity) * 0.03;
          }
        } else {
          this.opacity += (this.baseOpacity - this.opacity) * 0.03;
        }

        // Seamless wrap around edges
        if (this.x > width + 100) this.x = -100;
        else if (this.x < -100) this.x = width + 100;
        if (this.y > height + 100) this.y = -100;
        else if (this.y < -100) this.y = height + 100;
      }

      draw(context: CanvasRenderingContext2D) {
        context.save();
        context.translate(this.x, this.y);
        context.rotate(this.angle);
        context.globalAlpha = this.opacity;
        context.fillStyle = this.color;
        context.strokeStyle = this.color;

        switch (this.type) {
          case 'bar': {
            context.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
            // Internal highlight stripe
            context.fillStyle = '#ffffff';
            context.globalAlpha = this.opacity * 0.6;
            context.fillRect(-this.width / 4, -this.height / 2, this.width / 2, this.height * 0.35);
            break;
          }
          case 'disc': {
            context.beginPath();
            context.arc(0, 0, this.width, 0, Math.PI * 2);
            context.fill();
            break;
          }
          case 'ring': {
            context.lineWidth = 1.2;
            context.beginPath();
            context.arc(0, 0, this.width, 0, Math.PI * 2);
            context.stroke();
            // Core dot
            context.beginPath();
            context.arc(0, 0, 1.5, 0, Math.PI * 2);
            context.fill();
            break;
          }
          case 'cross': {
            context.lineWidth = 1.2;
            const sz = this.width;
            context.beginPath();
            context.moveTo(-sz, 0);
            context.lineTo(sz, 0);
            context.moveTo(0, -sz);
            context.lineTo(0, sz);
            context.stroke();
            break;
          }
          case 'square': {
            context.fillRect(-this.width / 2, -this.width / 2, this.width, this.width);
            break;
          }
          case 'line': {
            context.lineWidth = this.width;
            context.beginPath();
            context.moveTo(0, -this.height / 2);
            context.lineTo(0, this.height / 2);
            context.stroke();
            break;
          }
          case 'label': {
            if (this.label) {
              context.rotate(-this.angle); // Keep typography level
              context.font = 'bold 8px monospace';
              context.fillText(this.label, 0, 0);
            }
            break;
          }
        }

        // Secondary floating micro-label
        if (this.label && this.type !== 'label') {
          context.rotate(-this.angle);
          context.font = '7px monospace';
          context.fillStyle = '#111111';
          context.globalAlpha = this.opacity * 0.6;
          context.fillText(this.label, 8, 3);
        }

        context.restore();
      }
    }

    // Micro Dense Nodes for high-density background data mesh (thousands of points)
    class MicroNode {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      baseAlpha: number;
      phase: number;

      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 1.8 + 0.6;
        this.color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
        this.baseAlpha = Math.random() * 0.4 + 0.40;
        this.phase = Math.random() * Math.PI * 2;
      }

      update(time: number, mouseX: number, mouseY: number, mouseActive: boolean) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = width;
        else if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        else if (this.y > height) this.y = 0;

        if (mouseActive) {
          const dx = mouseX - this.x;
          const dy = mouseY - this.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 40000) { // 200px
            const force = (200 - Math.sqrt(distSq)) / 200;
            this.x -= (dx / (Math.sqrt(distSq) + 0.1)) * force * 1.5;
            this.y -= (dy / (Math.sqrt(distSq) + 0.1)) * force * 1.5;
          }
        }
      }
    }

    let items: FloatingItem[] = [];
    let microNodes: MicroNode[] = [];
    const mouse = { x: -1000, y: -1000, smoothX: -1000, smoothY: -1000, active: false };

    const init = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;

      // Calculate ultra-dense counts (20x+ higher than original baseline)
      // Original baseline was (width * height) / 8000 (~250 items on desktop)
      // New density: ~1,500 rich floating items + ~3,500 micro-nodes = 5,000+ total visual elements!
      const totalPixels = width * height;
      const itemCount = Math.min(Math.floor(totalPixels / 950), 1600);
      const microCount = Math.min(Math.floor(totalPixels / 420), 3800);

      items = [];
      for (let i = 0; i < itemCount; i++) {
        items.push(new FloatingItem(width, height));
      }

      microNodes = [];
      for (let i = 0; i < microCount; i++) {
        microNodes.push(new MicroNode(width, height));
      }
    };

    const resize = () => {
      init();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    init();

    // Spatial hash grid for high-performance dense line connections
    const cellSize = 75;

    const animate = () => {
      const time = Date.now() * 0.00035;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse tracking
      if (mouse.active) {
        mouse.smoothX += (mouse.x - mouse.smoothX) * 0.15;
        mouse.smoothY += (mouse.y - mouse.smoothY) * 0.15;
      } else {
        mouse.smoothX += (-1000 - mouse.smoothX) * 0.05;
        mouse.smoothY += (-1000 - mouse.smoothY) * 0.05;
      }

      // 1. LAYER 1: Ultra-Dense Matrix Dot Grid
      const gridStep = 32;
      ctx.save();
      ctx.fillStyle = '#111111';
      for (let gx = 0; gx < width; gx += gridStep) {
        for (let gy = 0; gy < height; gy += gridStep) {
          const wave = Math.sin(gx * 0.008 + gy * 0.008 + time * 2);
          const alpha = 0.09 + (wave + 1) * 0.04;
          
          let dSize = 1;
          let dAlpha = alpha;

          if (mouse.active) {
            const mdx = gx - mouse.smoothX;
            const mdy = gy - mouse.smoothY;
            const mDistSq = mdx * mdx + mdy * mdy;
            if (mDistSq < 35000) {
              const mDist = Math.sqrt(mDistSq);
              const mFactor = 1 - mDist / 187;
              dSize = 1.2 + mFactor * 2.5;
              dAlpha = alpha + mFactor * 0.45;
            }
          }

          ctx.globalAlpha = dAlpha;
          ctx.fillRect(gx - dSize / 2, gy - dSize / 2, dSize, dSize);
        }
      }
      ctx.restore();

      // 2. LAYER 2: Spatial Hash Constellation Lines (Efficient Bucket Search)
      const cols = Math.ceil(width / cellSize);
      const rows = Math.ceil(height / cellSize);
      const grid: number[][] = Array.from({ length: cols * rows }, () => []);

      // Populate grid with item indices
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const c = Math.floor(it.x / cellSize);
        const r = Math.floor(it.y / cellSize);
        if (c >= 0 && c < cols && r >= 0 && r < rows) {
          grid[r * cols + c].push(i);
        }
      }

      // Batch line connections
      ctx.beginPath();
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 0.55;
      ctx.globalAlpha = 0.16;

      const maxDistSq = 4500; // ~67px
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellItems = grid[r * cols + c];
          if (!cellItems || cellItems.length === 0) continue;

          // Check current cell and neighbors
          for (let dr = 0; dr <= 1; dr++) {
            for (let dc = (dr === 0 ? 0 : -1); dc <= 1; dc++) {
              const nc = c + dc;
              const nr = r + dr;
              if (nc < 0 || nc >= cols || nr >= rows) continue;

              const neighborItems = grid[nr * cols + nc];
              const isSameCell = dr === 0 && dc === 0;

              for (let i = 0; i < cellItems.length; i++) {
                const idxA = cellItems[i];
                const itemA = items[idxA];
                const startJ = isSameCell ? i + 1 : 0;

                for (let j = startJ; j < neighborItems.length; j++) {
                  const idxB = neighborItems[j];
                  const itemB = items[idxB];

                  const dx = itemA.x - itemB.x;
                  const dy = itemA.y - itemB.y;
                  const dSq = dx * dx + dy * dy;
                  if (dSq < maxDistSq) {
                    ctx.moveTo(itemA.x, itemA.y);
                    ctx.lineTo(itemB.x, itemB.y);
                  }
                }
              }
            }
          }
        }
      }
      ctx.stroke();

      // 3. LAYER 3: Dynamic Mouse Proximity Spiderweb Rays
      if (mouse.active) {
        ctx.beginPath();
        ctx.strokeStyle = '#FF3E00';
        ctx.lineWidth = 0.9;
        ctx.globalAlpha = 0.42;
        let links = 0;
        for (let i = 0; i < items.length && links < 40; i++) {
          const it = items[i];
          const dx = it.x - mouse.smoothX;
          const dy = it.y - mouse.smoothY;
          const dSq = dx * dx + dy * dy;
          if (dSq < 26000) { // ~160px
            ctx.moveTo(mouse.smoothX, mouse.smoothY);
            ctx.lineTo(it.x, it.y);
            links++;
          }
        }
        ctx.stroke();
      }

      // 4. LAYER 4: Render High-Density Micro Nodes (Fast batching)
      for (let i = 0; i < microNodes.length; i++) {
        const node = microNodes[i];
        node.update(time, mouse.smoothX, mouse.smoothY, mouse.active);

        ctx.fillStyle = node.color;
        ctx.globalAlpha = node.baseAlpha;
        ctx.fillRect(node.x - node.size / 2, node.y - node.size / 2, node.size, node.size);
      }

      // 5. LAYER 5: Render Floating Geometric Items, Bars, and Discs
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        item.update(time, mouse.smoothX, mouse.smoothY, mouse.active);
        item.draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className={className}
      style={{ 
        filter: 'contrast(1.1) brightness(1.02)',
        maskImage: 'radial-gradient(circle at center, black 50%, transparent 96%)',
        WebkitMaskImage: 'radial-gradient(circle at center, black 50%, transparent 96%)'
      }}
    />
  );
}

