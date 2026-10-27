import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** The data model as a graph. Positions are fractions of the backdrop, kept in the side margins. */
const NODES = [
  { id: 'contact', x: 0.07, y: 0.36 },
  { id: 'billing_account', x: 0.15, y: 0.62 },
  { id: 'billing_event', x: 0.055, y: 0.8 },
  { id: 'contract', x: 0.84, y: 0.27 },
  { id: 'product', x: 0.935, y: 0.12 },
  { id: 'price_component', x: 0.945, y: 0.42 },
  { id: 'meter', x: 0.855, y: 0.6 },
  { id: 'meter_counter', x: 0.94, y: 0.7 },
  { id: 'meter_reading', x: 0.83, y: 0.83 },
] as const

type NodeId = (typeof NODES)[number]['id']

const EDGES: [NodeId, NodeId][] = [
  ['contact', 'billing_account'],
  ['contact', 'contract'],
  ['billing_account', 'billing_event'],
  ['contract', 'billing_account'],
  ['contract', 'product'],
  ['product', 'price_component'],
  ['contract', 'meter'],
  ['meter', 'meter_counter'],
  ['meter_counter', 'meter_reading'],
]

// Fade out towards the title in the middle and towards the content below.
const MASK = 'radial-gradient(ellipse 42% 70% at 50% 45%, transparent 35%, black 85%), linear-gradient(to bottom, black 80%, transparent)'

// Fixed per-node and per-edge rhythm so the motion looks organic but never changes between visits.
const drift = NODES.map((_, i) => ({ period: 11 + ((i * 7) % 9), phase: i * 1.7, ax: 7 + (i % 3) * 3, ay: 5 + ((i + 1) % 3) * 3 }))
const travel = EDGES.map((_, i) => ({ period: 9 + ((i * 5) % 8), phase: (i * 0.37) % 1 }))

/**
 * A slowly drifting graph of the entities, drawn behind the hero. Purely decorative: hidden from
 * assistive tech, ignores the pointer, and holds still for people who prefer reduced motion.
 */
export function GraphBackdrop({ className }: { className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const nodes = [...svg.querySelectorAll<SVGGElement>('[data-node]')]
    const edges = [...svg.querySelectorAll<SVGLineElement>('[data-edge]')]
    const dots = [...svg.querySelectorAll<SVGCircleElement>('[data-dot]')]
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let frame = 0

    const draw = (seconds: number) => {
      const pos = new Map<string, [number, number]>()
      NODES.forEach((n, i) => {
        const d = drift[i]!
        const t = (seconds / d.period) * Math.PI * 2 + d.phase
        const x = n.x * width + Math.sin(t) * d.ax
        const y = n.y * height + Math.cos(t * 0.8) * d.ay
        pos.set(n.id, [x, y])
        nodes[i]!.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`)
      })
      EDGES.forEach(([from, to], i) => {
        const [x1, y1] = pos.get(from)!
        const [x2, y2] = pos.get(to)!
        const line = edges[i]!
        line.setAttribute('x1', x1.toFixed(1))
        line.setAttribute('y1', y1.toFixed(1))
        line.setAttribute('x2', x2.toFixed(1))
        line.setAttribute('y2', y2.toFixed(1))
        // A dot travels each edge, fading in and out at the ends.
        const p = (seconds / travel[i]!.period + travel[i]!.phase) % 1
        const dot = dots[i]!
        dot.setAttribute('cx', (x1 + (x2 - x1) * p).toFixed(1))
        dot.setAttribute('cy', (y1 + (y2 - y1) * p).toFixed(1))
        dot.style.opacity = reduced.matches ? '0' : String(Math.sin(p * Math.PI) * 0.9)
      })
    }

    const tick = (ms: number) => {
      draw(ms / 1000)
      frame = requestAnimationFrame(tick)
    }

    const start = () => {
      cancelAnimationFrame(frame)
      if (reduced.matches) draw(0)
      else frame = requestAnimationFrame(tick)
    }

    const observer = new ResizeObserver(([entry]) => {
      width = entry!.contentRect.width
      height = entry!.contentRect.height
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
      draw(performance.now() / 1000)
    })
    observer.observe(svg)
    reduced.addEventListener('change', start)
    start()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      reduced.removeEventListener('change', start)
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className={cn('pointer-events-none select-none', className)}
      style={{ maskImage: MASK, WebkitMaskImage: MASK, maskComposite: 'intersect', WebkitMaskComposite: 'source-in' }}
    >
      <g className="stroke-muted-foreground/25" strokeWidth={1}>
        {EDGES.map(([from, to]) => (
          <line key={`${from}-${to}`} data-edge strokeDasharray="2 5" />
        ))}
      </g>
      <g className="fill-brand">
        {EDGES.map(([from, to]) => (
          <circle key={`${from}-${to}`} data-dot r={2} />
        ))}
      </g>
      {NODES.map((n) => (
        <g key={n.id} data-node>
          <circle r={9} className="fill-brand/10" />
          <circle r={3.5} className="fill-card stroke-brand/70" strokeWidth={1.5} />
          <text y={22} textAnchor="middle" className="fill-muted-foreground/70 font-mono text-[10px] tracking-[0.12em] uppercase">
            {n.id}
          </text>
        </g>
      ))}
    </svg>
  )
}
