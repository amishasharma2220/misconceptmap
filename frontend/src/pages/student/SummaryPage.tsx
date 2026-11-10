import { useQuery } from '@tanstack/react-query'
import { Check, Minus, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiGet } from '../../api/client'
import type { PracticeSessionOut } from '../../api/types'
import { useCoachScreen } from '../../coach/CoachContext'
import { btn, MasteryBar, Panel, pct } from '../../components/ui'
import { useStudent } from '../../data/student'
import { formatClock } from './practiceLogic'

export function SummaryPage() {
  const id = Number(useSearchParams()[0].get('session'))
  const { conceptName } = useStudent()
  useCoachScreen({ label: 'Session summary' })
  const session = useQuery({
    queryKey: ['session', id],
    queryFn: () => apiGet<PracticeSessionOut>(`/sessions/${id}`),
    enabled: id > 0,
  })
  const result = session.data

  if (id > 0 && session.isPending) return <p className="text-ink-soft">Loading summary…</p>
  if (!result)
    return (
      <div className="mx-auto max-w-xl space-y-3 py-12 text-center">
        <h2 className="text-xl font-bold">No session to summarise</h2>
        <p className="text-ink-soft">
          {session.error?.message ?? 'Finish a practice session and its results will appear here.'}
        </p>
        <Link to="/practice" className={btn.primary}>
          Start practice
        </Link>
      </div>
    )

  const answered = result.items.filter((i) => i.result)
  const correct = answered.filter((i) => i.result!.correct).length
  // Per concept: first "before" and last "after".
  const concepts = new Map<string, { before: number; after: number }>()
  for (const i of answered)
    for (const m of i.result!.mastery) {
      const prev = concepts.get(m.concept)
      concepts.set(m.concept, { before: prev?.before ?? m.before, after: m.after })
    }
  const misCounts = new Map<number, { title: string; n: number }>()
  for (const i of answered)
    for (const m of i.result!.misconceptions)
      misCounts.set(m.id, { title: m.title, n: (misCounts.get(m.id)?.n ?? 0) + 1 })
  // Time spent answering, which ignores breaks between questions.
  const seconds = Math.round(answered.reduce((t, i) => t + (i.result!.time_taken_ms ?? 0), 0) / 1000)

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Score', `${correct}/${answered.length}`],
          ['Accuracy', answered.length ? pct(correct / answered.length) : '—'],
          ['Time', formatClock(seconds)],
          ['Skipped', String(result.items.length - answered.length)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-rule bg-sheet px-4 py-3">
            <p className="text-xs text-ink-soft">{l}</p>
            <p className="tnum text-2xl font-bold">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title={`${result.title}: question by question`} bodyClass="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr className="border-b border-rule-soft">
                <th className="px-4 py-2 font-normal">#</th>
                <th className="px-2 py-2 font-normal">Question</th>
                <th className="px-2 py-2 font-normal">Concept</th>
                <th className="px-2 py-2 font-normal">Result</th>
                <th className="px-4 py-2 text-right font-normal">Time</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map(({ question: q, result: a }, i) => (
                <tr key={q.id} className="border-b border-rule-soft last:border-0">
                  <td className="tnum px-4 py-2 text-ink-soft">{i + 1}</td>
                  <td className="max-w-xs truncate px-2 py-2">{q.preview}</td>
                  <td className="px-2 py-2 text-ink-soft">{conceptName(q.concept)}</td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {!a ? (
                      <span className="inline-flex items-center gap-1 text-ink-faint"><Minus size={14} /> Skipped</span>
                    ) : a.correct ? (
                      <span className="inline-flex items-center gap-1 text-ok"><Check size={14} /> Correct</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-pen"><X size={14} /> Picked {a.chosen.join(', ') || a.nat_value}</span>
                    )}
                  </td>
                  <td className="tnum px-4 py-2 text-right">{a?.time_taken_ms != null ? formatClock(Math.round(a.time_taken_ms / 1000)) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="space-y-4">
          <Panel title="Mastery changes">
            {concepts.size === 0 ? (
              <p className="text-sm text-ink-soft">Answer a question to see mastery move.</p>
            ) : (
              <ul className="space-y-3">
                {[...concepts.entries()].map(([slug, v]) => (
                  <li key={slug}>
                    <div className="flex justify-between text-sm">
                      <span>{conceptName(slug)}</span>
                      <span className={`tnum font-bold ${v.after >= v.before ? 'text-ok' : 'text-pen'}`}>
                        {pct(v.before)} → {pct(v.after)}
                      </span>
                    </div>
                    <MasteryBar value={v.after} label={false} className="mt-1" />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Misconceptions you hit">
            {misCounts.size === 0 ? (
              <p className="text-sm text-ink-soft">None this session.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {[...misCounts].map(([mid, { title, n }]) => (
                  <li key={mid} className="flex justify-between gap-3 border-l-2 border-pen pl-2 text-pen">
                    <span>{title}</span>
                    <span className="tnum">{n}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="flex flex-wrap gap-2">
            <Link to="/practice" className={btn.primary}>
              Practise again
            </Link>
            <Link to="/home" className={btn.quiet}>
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
