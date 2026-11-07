import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCoachScreen } from '../../coach/CoachContext'
import { BarSeries } from '../../components/charts'
import { MasteryBar, Panel, pct, SampleDataNote, Sparkline } from '../../components/ui'
import { useStudent } from '../../data/student'
import type { StudentConcept, SubjectCode } from '../../data/types'

type SortKey = 'name' | 'mastery' | 'attempts' | 'accuracy' | 'lastPractisedDays'

// Sample breakdowns until analytics endpoints exist.
const BY_DIFFICULTY = [
  { level: 'Level 1', accuracy: 0.86 },
  { level: 'Level 2', accuracy: 0.74 },
  { level: 'Level 3', accuracy: 0.61 },
  { level: 'Level 4', accuracy: 0.47 },
  { level: 'Level 5', accuracy: 0.32 },
]
const TIME_BUCKETS = [
  { bucket: '< 30s', questions: 96 },
  { bucket: '30–60s', questions: 212 },
  { bucket: '1–2 min', questions: 431 },
  { bucket: '2–3 min', questions: 288 },
  { bucket: '3–5 min', questions: 142 },
  { bucket: '> 5 min', questions: 41 },
]

export function AnalyticsPage() {
  const { data } = useStudent()
  const [subject, setSubject] = useState<SubjectCode | 'ALL'>('ALL')
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'mastery', asc: true })
  useCoachScreen({ label: 'Analytics' })

  const rows = useMemo(() => {
    const value = (c: StudentConcept) => {
      const v = c[sort.key]
      return v == null ? (sort.asc ? Infinity : -Infinity) : v
    }
    return data.concepts
      .filter((c) => subject === 'ALL' || c.subject === subject)
      .sort((a, b) => {
        const va = value(a)
        const vb = value(b)
        const r = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)
        return sort.asc ? r : -r
      })
  }, [data.concepts, subject, sort])

  const misFreq = [...data.misconceptions]
    .filter((m) => subject === 'ALL' || data.concepts.find((c) => c.slug === m.concept)?.subject === subject)
    .sort((a, b) => b.hits - a.hits)
    .map((m) => ({ title: m.title.length > 30 ? m.title.slice(0, 29) + '…' : m.title, hits: m.hits }))

  const header = (key: SortKey, label: string, right = false) => (
    <th className={`px-2 py-2 font-normal ${right ? 'text-right' : ''}`} aria-sort={sort.key === key ? (sort.asc ? 'ascending' : 'descending') : 'none'}>
      <button
        className={`inline-flex items-center gap-1 hover:text-ink ${sort.key === key ? 'text-ink' : ''}`}
        onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }))}
      >
        {label}
        {sort.key === key && (sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Subject" className="flex rounded-md border border-rule bg-sheet p-0.5">
          {(['ALL', ...data.subjects.map((s) => s.code)] as const).map((code) => (
            <button
              key={code}
              role="tab"
              aria-selected={subject === code}
              onClick={() => setSubject(code)}
              className={`rounded px-3 py-1 text-sm ${subject === code ? 'bg-omr-tint font-bold text-omr' : 'text-ink-soft'}`}
            >
              {code === 'ALL' ? 'All subjects' : code}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <SampleDataNote />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title={`Concepts (${rows.length})`} bodyClass="max-h-[640px] overflow-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-sheet text-xs text-ink-soft">
              <tr className="border-b border-rule-soft">
                {header('name', 'Concept')}
                {header('mastery', 'Mastery')}
                {header('attempts', 'Attempts', true)}
                {header('accuracy', 'Accuracy', true)}
                {header('lastPractisedDays', 'Last practised', true)}
                <th className="px-4 py-2 font-normal">7-day trend</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.slug} className="border-b border-rule-soft last:border-0 hover:bg-paper">
                  <td className="px-2 py-1.5">
                    <Link to={`/map/${c.subject}?focus=${c.slug}`} className="hover:text-omr">
                      {c.name}
                    </Link>
                    {subject === 'ALL' && <span className="ml-1.5 text-xs text-ink-faint">{c.subject}</span>}
                  </td>
                  <td className="w-40 px-2 py-1.5">
                    <MasteryBar value={c.mastery} />
                  </td>
                  <td className="tnum px-2 py-1.5 text-right">{c.attempts}</td>
                  <td className="tnum px-2 py-1.5 text-right">{pct(c.accuracy)}</td>
                  <td className="tnum px-2 py-1.5 text-right text-ink-soft">
                    {c.lastPractisedDays == null ? 'Never' : c.lastPractisedDays === 0 ? 'Today' : `${c.lastPractisedDays}d ago`}
                  </td>
                  <td className="px-4 py-1.5">
                    {c.mastery == null ? <span className="text-xs text-ink-faint">—</span> : <Sparkline values={c.trend} width={80} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="space-y-4">
          <Panel title="Accuracy by difficulty">
            <BarSeries data={BY_DIFFICULTY} x="level" y="accuracy" format={(v) => pct(v)} yMax={1} height={170} />
          </Panel>
          <Panel title="Time per question">
            <BarSeries data={TIME_BUCKETS} x="bucket" y="questions" height={170} />
          </Panel>
          <Panel title="Misconception frequency">
            {misFreq.length ? (
              <BarSeries data={misFreq} x="title" y="hits" horizontal color="#b42347" height={Math.max(120, misFreq.length * 30)} format={(v) => `${v}×`} />
            ) : (
              <p className="text-sm text-ink-soft">No misconceptions recorded in this subject yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
