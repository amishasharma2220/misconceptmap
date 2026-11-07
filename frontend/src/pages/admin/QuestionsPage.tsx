import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../api/client'
import type { QStatus, QuestionSummary, Subject } from '../../api/types'
import { Layout, Notice } from '../../components/Layout'

const STATUSES: { value: QStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'approved', label: 'Approved' },
  { value: 'retired', label: 'Retired' },
]

export function StatusPill({ status }: { status: QStatus }) {
  const tone = {
    draft: 'bg-paper text-ink-soft border-rule',
    approved: 'bg-ok/10 text-ok border-ok/30',
    retired: 'bg-pen-tint text-pen border-pen/30',
  }[status]
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${tone}`}>{status}</span>
}

export function QuestionsPage() {
  const [status, setStatus] = useState<QStatus | ''>('')
  const [subject, setSubject] = useState('')
  const [search, setSearch] = useState('')

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => apiGet<Subject[]>('/subjects') })
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (subject) params.set('subject', subject)
  if (search.trim()) params.set('q', search.trim())
  const questions = useQuery({
    queryKey: ['admin-questions', status, subject, search.trim()],
    queryFn: () => apiGet<QuestionSummary[]>(`/admin/questions?${params}`),
  })

  return (
    <Layout wide>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Questions</h1>
          <p className="text-sm text-ink-soft">
            {questions.data ? `${questions.data.length} shown` : ' '}
          </p>
        </div>
        <Link
          to="/admin/questions/new"
          className="rounded bg-omr px-4 py-2 font-bold text-white hover:bg-omr/90"
        >
          Add question
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Status" className="flex rounded border border-rule bg-sheet p-0.5">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={status === s.value}
              onClick={() => setStatus(s.value)}
              className={`rounded px-3 py-1 text-sm ${status === s.value ? 'bg-omr-tint font-bold text-omr' : 'text-ink-soft'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded border border-rule bg-sheet px-2 py-1.5 text-sm"
        >
          <option value="">All subjects</option>
          {subjects.data?.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="Search questions"
          placeholder="Search text or source"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-48 flex-1 rounded border border-rule bg-sheet px-3 py-1.5 text-sm"
        />
      </div>

      {questions.isError && <Notice tone="error">{(questions.error as Error).message}</Notice>}
      {questions.data?.length === 0 && (
        <div className="rounded border border-dashed border-rule bg-sheet p-8 text-center">
          <p className="mb-3 text-ink-soft">
            {status || subject || search ? 'No questions match these filters.' : 'No questions yet.'}
          </p>
          <Link to="/admin/questions/new" className="text-omr underline">
            Add your first question
          </Link>
        </div>
      )}
      {!!questions.data?.length && (
        <ul className="divide-y divide-rule rounded border border-rule bg-sheet">
          {questions.data.map((q) => (
            <li key={q.id}>
              <Link
                to={`/admin/questions/${q.id}`}
                className="flex flex-col gap-1 px-4 py-3 hover:bg-paper sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="w-10 shrink-0 text-sm text-ink-soft">#{q.id}</span>
                <span className="min-w-0 flex-1 truncate">{q.stem_preview}</span>
                <span className="shrink-0 text-sm text-ink-soft">
                  {q.primary_concept ?? 'No concept yet'}
                </span>
                <span
                  className="shrink-0 text-sm text-pen"
                  title="Wrong options tagged with a misconception"
                >
                  {q.n_tagged_options} tagged
                </span>
                <StatusPill status={q.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}
