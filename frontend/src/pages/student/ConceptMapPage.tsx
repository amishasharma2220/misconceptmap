import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCoachScreen } from '../../coach/CoachContext'
import { btn, MasteryBar, masteryTone, pct, toneText } from '../../components/ui'
import { useStudent } from '../../data/student'
import type { StudentConcept, SubjectCode } from '../../data/types'

type ConceptNodeData = { concept: StudentConcept; dim: boolean; selected: boolean }
type ConceptNode = Node<ConceptNodeData, 'concept'>

const BORDER = { low: '#b42347', mid: '#c07a12', high: '#1d7044', none: '#d6dce6' }

function ConceptCard({ data }: NodeProps<ConceptNode>) {
  const c = data.concept
  const tone = masteryTone(c.mastery)
  return (
    <div
      className={`w-[168px] rounded-md border-2 bg-sheet px-2.5 py-1.5 text-left ${data.dim ? 'opacity-30' : ''} ${data.selected ? 'ring-2 ring-omr ring-offset-1' : ''}`}
      style={{ borderColor: BORDER[tone] }}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !border-0 !bg-rule" />
      <p className="truncate text-xs font-bold text-ink">{c.name}</p>
      <p className={`tnum text-[11px] font-bold ${toneText[tone]}`}>{c.mastery == null ? 'Not started' : pct(c.mastery)}</p>
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !border-0 !bg-rule" />
    </div>
  )
}
const nodeTypes = { concept: ConceptCard }

/** Left-to-right layout: column = longest prerequisite chain, rows spread within a column. */
function layout(concepts: StudentConcept[]) {
  const bySlug = new Map(concepts.map((c) => [c.slug, c]))
  const level = new Map<string, number>()
  const depth = (slug: string, seen = new Set<string>()): number => {
    if (level.has(slug)) return level.get(slug)!
    if (seen.has(slug)) return 0
    seen.add(slug)
    const c = bySlug.get(slug)
    const d = c && c.prereqs.some((p) => bySlug.has(p)) ? 1 + Math.max(...c.prereqs.filter((p) => bySlug.has(p)).map((p) => depth(p, seen))) : 0
    level.set(slug, d)
    return d
  }
  concepts.forEach((c) => depth(c.slug))
  const columns = new Map<number, StudentConcept[]>()
  for (const c of concepts) columns.set(level.get(c.slug)!, [...(columns.get(level.get(c.slug)!) ?? []), c])
  const pos = new Map<string, { x: number; y: number }>()
  for (const [col, cs] of columns) cs.forEach((c, i) => pos.set(c.slug, { x: col * 205, y: i * 70 }))
  return pos
}

export function ConceptMapPage() {
  const { subject = 'DSA' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { data, inSubject, concept, conceptName, misconception } = useStudent()
  const [weakOnly, setWeakOnly] = useState(false)
  const [hideNew, setHideNew] = useState(false)
  const code = (data.subjects.some((s) => s.code === subject) ? subject : 'DSA') as SubjectCode
  const focus = params.get('focus')
  const selected = focus ? concept(focus) : undefined
  useCoachScreen({ label: selected ? `Concept map · ${selected.name}` : `Concept map · ${code}`, concept: selected?.slug })

  const concepts = inSubject(code)
  const { nodes, edges } = useMemo(() => {
    const pos = layout(concepts)
    const visible = (c: StudentConcept) =>
      (!weakOnly || (c.mastery != null && c.mastery < 0.4)) && (!hideNew || c.mastery != null)
    const nodes: ConceptNode[] = concepts.map((c) => ({
      id: c.slug,
      type: 'concept',
      position: pos.get(c.slug)!,
      data: { concept: c, dim: !visible(c), selected: c.slug === focus },
    }))
    const edges: Edge[] = concepts.flatMap((c) =>
      c.prereqs
        .filter((p) => pos.has(p))
        .map((p) => ({
          id: `${p}->${c.slug}`,
          source: p,
          target: c.slug,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#9aa3b2', width: 14, height: 14 },
          style: { stroke: c.slug === focus || p === focus ? '#2450b8' : '#c3cad6', strokeWidth: c.slug === focus || p === focus ? 2 : 1.25 },
        })),
    )
    return { nodes, edges }
  }, [concepts, weakOnly, hideNew, focus])

  const dependants = selected ? concepts.filter((c) => c.prereqs.includes(selected.slug)) : []
  const mis = selected ? data.misconceptions.filter((m) => m.concept === selected.slug) : []

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:h-[calc(100vh-7.5rem)] lg:flex-row">
      <aside className="space-y-4 rounded-lg border border-rule bg-sheet p-4 lg:w-56 lg:shrink-0">
        <label className="block space-y-1">
          <span className="text-xs text-ink-soft">Subject</span>
          <select
            value={code}
            onChange={(e) => navigate(`/map/${e.target.value}`)}
            className="w-full rounded-md border border-rule bg-sheet px-2 py-1.5 text-sm"
          >
            {data.subjects.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 text-xs text-ink-soft">Show</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={weakOnly} onChange={(e) => setWeakOnly(e.target.checked)} /> Only weak (below 40%)
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hideNew} onChange={(e) => setHideNew(e.target.checked)} /> Hide not started
          </label>
        </fieldset>
        <div className="space-y-1.5 border-t border-rule-soft pt-3 text-xs text-ink-soft">
          {[
            ['#b42347', 'below 40%'],
            ['#c07a12', '40–70%'],
            ['#1d7044', '70% and above'],
            ['#d6dce6', 'not started'],
          ].map(([c, l]) => (
            <p key={l} className="flex items-center gap-2">
              <span className="h-3 w-5 rounded-sm border-2" style={{ borderColor: c }} /> {l}
            </p>
          ))}
          <p className="pt-1">Arrows point from a prerequisite to the concept that needs it.</p>
        </div>
      </aside>

      <div className="relative h-[520px] min-w-0 flex-1 overflow-hidden rounded-lg border border-rule bg-sheet lg:h-auto">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1, minZoom: 0.62, maxZoom: 1, nodes: focus ? [{ id: focus }] : undefined }}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, n) => setParams({ focus: n.id })}
          onPaneClick={() => setParams({})}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
        >
          <Background color="#e9edf3" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      {selected && (
        <aside className="space-y-4 overflow-y-auto rounded-lg border border-rule bg-sheet p-4 lg:w-80 lg:shrink-0" aria-label={`${selected.name} details`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-ink-soft">{code}</p>
              <h2 className="text-lg font-bold">{selected.name}</h2>
            </div>
            <button onClick={() => setParams({})} aria-label="Close details" className="rounded p-1 text-ink-soft hover:bg-rule-soft">
              <X size={16} />
            </button>
          </div>
          <p className="text-sm text-ink-soft">{selected.description}</p>
          <MasteryBar value={selected.mastery} />
          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ['Attempts', String(selected.attempts)],
              ['Accuracy', pct(selected.accuracy)],
              ['Last', selected.lastPractisedDays == null ? 'Never' : `${selected.lastPractisedDays}d ago`],
            ].map(([l, v]) => (
              <div key={l} className="rounded-md bg-paper py-2">
                <dt className="text-ink-soft">{l}</dt>
                <dd className="tnum font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <Link to={`/practice?concept=${selected.slug}`} className={`${btn.primary} w-full`}>
            Practise this concept
          </Link>
          {selected.prereqs.length > 0 && (
            <Section title="Prerequisites">
              {selected.prereqs.map((p) => (
                <ConceptRow key={p} slug={p} name={conceptName(p)} m={concept(p)?.mastery ?? null} onPick={() => setParams({ focus: p })} />
              ))}
            </Section>
          )}
          {dependants.length > 0 && (
            <Section title="Needed for">
              {dependants.map((d) => (
                <ConceptRow key={d.slug} slug={d.slug} name={d.name} m={d.mastery} onPick={() => setParams({ focus: d.slug })} />
              ))}
            </Section>
          )}
          {mis.length > 0 && (
            <Section title="Your misconceptions here">
              {mis.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 border-l-2 border-pen pl-2 text-sm">
                  <span>{misconception(m.id)?.title}</span>
                  <span className="tnum shrink-0 text-xs text-ink-soft">{m.hits}×</span>
                </li>
              ))}
            </Section>
          )}
        </aside>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-bold">{title}</p>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function ConceptRow({ name, m, onPick }: { slug: string; name: string; m: number | null; onPick: () => void }) {
  return (
    <li>
      <button onClick={onPick} className="w-full text-left text-sm hover:text-omr">
        {name}
      </button>
      <MasteryBar value={m} className="mt-0.5" />
    </li>
  )
}
