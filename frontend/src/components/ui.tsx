// Small shared building blocks for the app screens.
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-md bg-omr px-4 py-2 text-sm font-bold text-white hover:bg-omr/90 disabled:opacity-60',
  quiet:
    'inline-flex items-center justify-center gap-2 rounded-md border border-rule bg-sheet px-3 py-1.5 text-sm text-ink hover:border-ink-faint disabled:opacity-50',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-md px-2 py-1.5 text-sm text-ink-soft hover:bg-rule-soft hover:text-ink',
}

/** A bordered panel with a small header row. */
export function Panel({
  title,
  action,
  children,
  className = '',
  bodyClass = 'p-4',
  bodyStyle,
}: {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
  bodyStyle?: CSSProperties
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-rule bg-sheet ${className}`}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-rule-soft px-4 py-2.5">
          <h2 className="text-sm font-bold">{title}</h2>
          {action && <div className="shrink-0 text-sm">{action}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass}`} style={bodyStyle}>
        {children}
      </div>
    </section>
  )
}

export function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-omr hover:underline">
      {children}
    </Link>
  )
}

export type Tone = 'low' | 'mid' | 'high' | 'none'

export function masteryTone(m: number | null | undefined): Tone {
  if (m == null) return 'none'
  return m < 0.4 ? 'low' : m < 0.7 ? 'mid' : 'high'
}

export const toneBg: Record<Tone, string> = {
  low: 'bg-pen',
  mid: 'bg-amber',
  high: 'bg-ok',
  none: 'bg-rule',
}
export const toneText: Record<Tone, string> = {
  low: 'text-pen',
  mid: 'text-amber',
  high: 'text-ok',
  none: 'text-ink-faint',
}
export const toneTint: Record<Tone, string> = {
  low: 'bg-pen-tint border-pen/40',
  mid: 'bg-amber-tint border-amber/40',
  high: 'bg-ok-tint border-ok/40',
  none: 'bg-paper border-rule',
}

export const pct = (x: number | null | undefined, digits = 0) =>
  x == null ? '—' : `${(x * 100).toFixed(digits)}%`

/** Horizontal mastery bar with its value. */
export function MasteryBar({
  value,
  label = true,
  className = '',
}: {
  value: number | null
  label?: boolean
  className?: string
}) {
  const tone = masteryTone(value)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-rule-soft"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value == null ? undefined : Math.round(value * 100)}
        aria-label="Mastery"
      >
        <div className={`h-full rounded-full ${toneBg[tone]}`} style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      {label && (
        <span className={`tnum w-10 text-right text-xs font-bold ${toneText[tone]}`}>
          {value == null ? 'New' : pct(value)}
        </span>
      )}
    </div>
  )
}

/** Tiny inline trend line. Decorative: the value it summarises is always printed beside it. */
export function Sparkline({
  values,
  width = 72,
  height = 22,
  className = 'text-omr',
}: {
  values: number[]
  width?: number
  height?: number
  className?: string
}) {
  if (values.length < 2) return null
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const span = hi - lo || 1
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * (width - 2) + 1},${height - 2 - ((v - lo) / span) * (height - 4)}`)
    .join(' ')
  return (
    <svg width={width} height={height} aria-hidden className={className}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function Stat({
  label,
  value,
  sub,
  spark,
  sparkClass,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  spark?: number[]
  sparkClass?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-rule bg-sheet px-4 py-3">
      <span className="truncate text-xs text-ink-soft">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="tnum text-2xl font-bold leading-none">{value}</span>
        {spark && <Sparkline values={spark} className={sparkClass} />}
      </div>
      {sub && <span className="truncate text-xs text-ink-soft">{sub}</span>}
    </div>
  )
}

export function Chip({ children, tone = 'plain' }: { children: ReactNode; tone?: 'plain' | 'pen' | 'omr' | 'ok' }) {
  const tones = {
    plain: 'border-rule bg-paper text-ink-soft',
    pen: 'border-pen/30 bg-pen-tint text-pen',
    omr: 'border-omr/30 bg-omr-tint text-omr',
    ok: 'border-ok/30 bg-ok-tint text-ok',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${tones[tone]}`}>
      {children}
    </span>
  )
}

/** Shown in place of a chart or list before the student has practised. */
export function EmptyNote({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-rule bg-paper/60 px-4 py-5 text-sm text-ink-soft">
      <p>{children}</p>
      {action}
    </div>
  )
}
