import { Check, Minus, X } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useCoachScreen } from '../../coach/CoachContext'
import { btn, MasteryBar, Panel, pct } from '../../components/ui'
import { useStudent } from '../../data/student'
import { formatClock, type SessionResult } from './practiceLogic'

export function SummaryPage() {
  const result = useLocation().state as SessionResult | null
  const { conceptName, misconception } = useStudent()
  useCoachScreen({ label: 'Session summary' })

  if (!result)
    return (
      <div className="mx-auto max-w-xl space-y-3 py-12 text-center">
        <h2 className="text-xl font-bold">No session to summarise yet</h2>
        <p className="text-ink-soft">Finish a practice session and its results will appear here.</p>
        <Link to="/practice" className={btn.primary}>
          Start practice
        </Link>
      </div>
    )

  const answered = result.items.filter((i) => i.answer)
  const correct = answered.filter((i) => i.answer!.correct).length
  // Per concept: first "before" and last "after".
  const concepts = new Map<string, { before: number; after: number }>()
  for (const i of answered) {
    const prev = concepts.get(i.question.concept)
    concepts.set(i.question.concept, { before: prev?.before ?? i.answer!.before, after: i.answer!.after })
  }
  const hit = answered
    .filter((i) => !i.answer!.correct)
    .map((i) => i.question.options.find((o) => o.label === i.answer!.label)?.misconception)
    .filter((id): id is number => id != null)
  const misCounts = [...new Set(hit)].map((id) => ({ m: misconception(id), n: hit.filter((x) => x === id).length }))

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Score', `${correct}/${answered.length}`],
          ['Accuracy', answered.length ? pct(correct / answered.length) : '—'],
          ['Time', formatClock(result.seconds)],
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
              {result.items.map(({ question: q, answer: a }, i) => (
                <tr key={q.id} className="border-b border-rule-soft last:border-0">
                  <td className="tnum px-4 py-2 text-ink-soft">{i + 1}</td>
                  <td className="max-w-xs truncate px-2 py-2">{q.stem.replace(/\$|\*\*/g, '')}</td>
                  <td className="px-2 py-2 text-ink-soft">{conceptName(q.concept)}</td>
                  <td className="px-2 py-2">
                    {!a ? (
                      <span className="inline-flex items-center gap-1 text-ink-faint"><Minus size={14} /> Skipped</span>
                    ) : a.correct ? (
                      <span className="inline-flex items-center gap-1 text-ok"><Check size={14} /> Correct</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-pen"><X size={14} /> Picked {a.label}</span>
                    )}
                  </td>
                  <td className="tnum px-4 py-2 text-right">{a ? formatClock(a.seconds) : '—'}</td>
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
            {misCounts.length === 0 ? (
              <p className="text-sm text-ink-soft">None this session.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {misCounts.map(({ m, n }) => (
                  <li key={m?.id} className="flex justify-between gap-3 border-l-2 border-pen pl-2 text-pen">
                    <span>{m?.title}</span>
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
