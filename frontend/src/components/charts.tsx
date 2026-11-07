// Thin wrappers around Recharts with the app's chart conventions:
// one series per chart (no dual axes), recessive grid, hover tooltip, values in ink colours.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const AXIS = { fontSize: 11, fill: '#7a8496' }
const GRID = '#e9edf3'
const OMR = '#2450b8'

type Datum = Record<string, string | number>

function TooltipBox({
  active,
  payload,
  label,
  format,
  labelFormat,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  format: (v: number) => string
  labelFormat?: (v: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-rule bg-sheet px-2.5 py-1.5 text-xs shadow-sm">
      <p className="text-ink-soft">{label && labelFormat ? labelFormat(label) : label}</p>
      <p className="tnum font-bold text-ink">{format(payload[0].value)}</p>
    </div>
  )
}

export function BarSeries({
  data,
  x,
  y,
  height = 180,
  format = (v) => String(v),
  xTick,
  color = OMR,
  yMax,
  horizontal = false,
}: {
  data: Datum[]
  x: string
  y: string
  height?: number
  format?: (v: number) => string
  xTick?: (v: string) => string
  color?: string
  yMax?: number
  horizontal?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 8, bottom: 0, left: horizontal ? 8 : -18 }}>
        <CartesianGrid stroke={GRID} vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => format(v)} domain={[0, yMax ?? 'auto']} />
            <YAxis type="category" dataKey={x} tick={AXIS} axisLine={false} tickLine={false} width={190} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={xTick} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => format(v)} domain={[0, yMax ?? 'auto']} />
          </>
        )}
        <Tooltip cursor={{ fill: '#f6f7f9' }} content={<TooltipBox format={format} labelFormat={xTick} />} />
        <Bar dataKey={y} fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={horizontal ? 14 : 18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function LineSeries({
  data,
  x,
  y,
  height = 180,
  format = (v) => String(v),
  xTick,
  yDomain,
}: {
  data: Datum[]
  x: string
  y: string
  height?: number
  format?: (v: number) => string
  xTick?: (v: string) => string
  yDomain?: [number, number]
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={x} tick={AXIS} axisLine={false} tickLine={false} tickFormatter={xTick} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => format(v)} domain={yDomain ?? ['auto', 'auto']} />
        <Tooltip cursor={{ stroke: '#d6dce6' }} content={<TooltipBox format={format} labelFormat={xTick} />} />
        <Line dataKey={y} stroke={OMR} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
