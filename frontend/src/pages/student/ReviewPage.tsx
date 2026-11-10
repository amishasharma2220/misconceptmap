import { Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoachScreen } from '../../coach/CoachContext'
import { btn, Chip, EmptyNote, Panel } from '../../components/ui'
import { useStudent } from '../../data/student'
import type { SubjectCode } from '../../data/types'

function dueLabel(h: number) {
  if (h <= 0) return h === 0 ? 'Due now' : `Overdue ${-h} h`
  return h < 24 ? `in ${h} h` : `in ${Math.round(h / 24)} d`
}

export function ReviewPage() {
  const { data, concept, conceptName } = useStudent()
  const navigate = useNavigate()
  const [subject, setSubject] = useState<SubjectCode | ''>('')
  const [onlyDue, setOnlyDue] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [previewId, setPreviewId] = useState<number | null>(data.review[0]?.questionId ?? null)
  useCoachScreen({ label: 'Review queue' })

  const rows = useMemo(
    () =>
      data.review
        .filter((r) => !subject || concept(r.concept)?.subject === subject)
        .filter((r) => !onlyDue || r.dueInHours <= 0)
        .sort((a, b) => a.dueInHours - b.dueInHours),
    [data.review, subject, onlyDue, concept],
  )
  const available = new Set(data.questions.map((q) => q.id))
  const preview = data.questions.find((q) => q.id === previewId)
  const previewRow = data.review.find((r) => r.questionId === previewId)
  const dueNow = data.review.filter((r) => r.dueInHours <= 0).length
  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const startIds = [...selected].filter((id) => available.has(id))

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value as SubjectCode | '')}
          className="rounded-md border border-rule bg-sheet px-2 py-1.5 text-sm"
        >
          <option value="">All subjects</option>
          {data.subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} /> Due now only
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            className={btn.quiet}
            disabled={!startIds.length}
            onClick={() => navigate(`/practice?q=${startIds.join(',')}`)}
          >
            Review selected ({startIds.length})
          </button>
          <button
            className={btn.primary}
            disabled={!dueNow}
            onClick={() => navigate(`/practice?mode=review${subject ? `&subject=${subject}` : ''}`)}
          >
            <Play size={14} /> Review all due ({dueNow})
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel bodyClass="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="p-4">
              <EmptyNote>
                {data.review.length === 0
                  ? 'Your review queue is empty. Questions you get wrong come back here a day later, then at growing gaps until you get them right three times.'
                  : 'Nothing matches these filters.'}
              </EmptyNote>
            </div>
          ) : (
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs text-ink-soft">
                <tr className="border-b border-rule-soft">
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={rows.length > 0 && rows.every((r) => selected.has(r.questionId))}
                      onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.questionId)) : new Set())}
                    />
                  </th>
                  <th className="px-2 py-2 font-normal">Question</th>
                  <th className="px-2 py-2 font-normal">Concept</th>
                  <th className="px-2 py-2 text-right font-normal">Times wrong</th>
                  <th className="px-2 py-2 text-right font-normal">Last answered</th>
                  <th className="px-4 py-2 text-right font-normal">Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.questionId}
                    onClick={() => setPreviewId(r.questionId)}
                    className={`cursor-pointer border-b border-rule-soft last:border-0 ${previewId === r.questionId ? 'bg-omr-tint/50' : 'hover:bg-paper'}`}
                  >
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select: ${r.stem}`}
                        checked={selected.has(r.questionId)}
                        onChange={() => toggle(r.questionId)}
                      />
                    </td>
                    <td className="max-w-xs truncate px-2 py-2">{r.stem}</td>
                    <td className="px-2 py-2 text-ink-soft">{conceptName(r.concept)}</td>
                    <td className="tnum px-2 py-2 text-right text-pen">{r.timesWrong}</td>
                    <td className="tnum whitespace-nowrap px-2 py-2 text-right text-ink-soft">{r.lastAnsweredDays == null ? '—' : r.lastAnsweredDays === 0 ? 'Today' : `${r.lastAnsweredDays}d ago`}</td>
                    <td className={`tnum whitespace-nowrap px-4 py-2 text-right ${r.dueInHours <= 0 ? 'font-bold text-pen' : 'text-ink-soft'}`}>
                      {dueLabel(r.dueInHours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Preview" className="xl:sticky xl:top-20 xl:self-start">
          {preview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="omr">{conceptName(preview.concept)}</Chip>
                {previewRow && <Chip tone="pen">wrong {previewRow.timesWrong}×</Chip>}
                {preview.difficulty && <Chip>Difficulty {preview.difficulty}/5</Chip>}
              </div>
              <p className="text-sm">{preview.stem}</p>
              <p className="text-xs text-ink-soft">Options are hidden until you answer, so the review is a real test.</p>
              <button className={btn.primary} onClick={() => navigate(`/practice?q=${preview.id}`)}>
                Answer this now
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">
              {data.review.length ? 'Pick a row to preview it.' : 'Nothing to preview yet.'}
            </p>
          )}
        </Panel>
      </div>
    </div>
  )
}
