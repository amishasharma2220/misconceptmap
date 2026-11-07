import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiGet, apiSend } from '../../api/client'
import type {
  ApproveOut,
  Concept,
  Draft,
  Label,
  Misconception,
  OptionIn,
  QType,
  Question,
  Subject,
} from '../../api/types'
import { Bubble } from '../../components/Bubble'
import { Layout, Notice } from '../../components/Layout'
import { Markdown } from '../../components/Markdown'
import {
  addOption,
  applyDraft,
  emptyForm,
  fromQuestion,
  removeLastOption,
  sameForm,
  setPrimary,
  setQType,
  toggleCorrect,
  toggleSecondary,
  toPayload,
  updateOption,
  type Form,
} from './editorState'
import { StatusPill } from './QuestionsPage'

const field =
  'w-full rounded border border-rule bg-sheet px-3 py-2 focus:border-omr focus:outline-none'
const quietButton =
  'rounded border border-rule bg-sheet px-3 py-1.5 text-sm hover:border-ink-soft disabled:opacity-50'
const primaryButton =
  'rounded bg-omr px-4 py-2 font-bold text-white hover:bg-omr/90 disabled:opacity-60'

type Flash = { tone: 'error' | 'ok' | 'info'; text: ReactNode } | null

export function QuestionEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new'
  const questionId = isNew ? null : Number(id)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [form, setForm] = useState<Form>(emptyForm)
  const [saved, setSaved] = useState<Form>(emptyForm)
  const [subjectChoice, setSubjectChoice] = useState('')
  const [loadedFrom, setLoadedFrom] = useState<Question | undefined>()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash>(null)

  const subjects = useQuery({ queryKey: ['subjects'], queryFn: () => apiGet<Subject[]>('/subjects') })
  const allConcepts = useQuery({ queryKey: ['concepts'], queryFn: () => apiGet<Concept[]>('/concepts') })
  const question = useQuery({
    queryKey: ['question', questionId],
    queryFn: () => apiGet<Question>(`/admin/questions/${questionId}`),
    enabled: questionId != null,
  })
  // Load the server copy into the form whenever it changes (React's "adjust state while
  // rendering" pattern, which avoids an extra render pass from an effect).
  if (question.data && question.data !== loadedFrom) {
    const f = fromQuestion(question.data)
    setLoadedFrom(question.data)
    setForm(f)
    setSaved(f)
  }

  // Subject: what you picked, else the subject of the question's first concept, else the first.
  const inferredSubject = allConcepts.data?.find(
    (c) => c.id === form.concepts[0]?.concept_id,
  )?.subject_code
  const subject = subjectChoice || inferredSubject || subjects.data?.[0]?.code || ''

  const misconceptions = useQuery({
    queryKey: ['misconceptions', subject],
    queryFn: () => apiGet<Misconception[]>(`/admin/misconceptions?subject=${subject}`),
    enabled: !!subject,
  })

  const concepts = useMemo(
    () => allConcepts.data?.filter((c) => c.subject_code === subject) ?? [],
    [allConcepts.data, subject],
  )
  const conceptName = useMemo(
    () => new Map(allConcepts.data?.map((c) => [c.id, c.name])),
    [allConcepts.data],
  )
  const misById = useMemo(
    () => new Map(misconceptions.data?.map((m) => [m.id, m])),
    [misconceptions.data],
  )
  const primaryId = form.concepts.find((c) => c.is_primary)?.concept_id ?? null
  const status = question.data?.status ?? 'draft'
  const dirty = isNew || !sameForm(form, saved)

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label)
    setFlash(null)
    try {
      return await fn()
    } catch (e) {
      setFlash({ tone: 'error', text: (e as Error).message })
      return undefined
    } finally {
      setBusy(null)
    }
  }

  /** Save if needed; returns the question id. Throws on validation errors. */
  async function ensureSaved(): Promise<number> {
    if (!dirty && questionId != null) return questionId
    const payload = toPayload(form)
    const q = questionId
      ? await apiSend<Question>('PUT', `/admin/questions/${questionId}`, payload)
      : await apiSend<Question>('POST', '/admin/questions', payload)
    qc.setQueryData(['question', q.id], q)
    qc.invalidateQueries({ queryKey: ['admin-questions'] })
    const f = fromQuestion(q)
    setForm(f)
    setSaved(f)
    if (isNew) navigate(`/admin/questions/${q.id}`, { replace: true })
    return q.id
  }

  const save = () =>
    run('save', async () => {
      await ensureSaved()
      setFlash({ tone: 'ok', text: 'Saved.' })
    })

  const approve = () =>
    run('approve', async () => {
      const qid = await ensureSaved()
      const out = await apiSend<ApproveOut>('POST', `/admin/questions/${qid}/approve`)
      qc.setQueryData(['question', qid], out.question)
      qc.invalidateQueries({ queryKey: ['admin-questions'] })
      const note =
        out.draft_accepted_unchanged == null
          ? ''
          : out.draft_accepted_unchanged
            ? ' The AI draft was accepted unchanged.'
            : ' You changed the AI draft before approving.'
      setFlash({ tone: 'ok', text: `Approved. Students can now get this question.${note}` })
    })

  const setStatus = (action: 'retire' | 'reopen') =>
    run(action, async () => {
      const q = await apiSend<Question>('POST', `/admin/questions/${questionId}/${action}`)
      qc.setQueryData(['question', q.id], q)
      qc.invalidateQueries({ queryKey: ['admin-questions'] })
      setFlash({ tone: 'info', text: action === 'retire' ? 'Retired.' : 'Moved back to drafts.' })
    })

  const generateDraft = () =>
    run('draft', async () => {
      const qid = await ensureSaved()
      const d = await apiSend<Draft>('POST', `/admin/questions/${qid}/draft-tags`, { subject })
      setDraft(d)
      qc.setQueryData(['question', qid], (q: Question | undefined) => q && { ...q, has_draft: true })
    })

  const applySuggestions = (d: Draft) =>
    run('apply', async () => {
      const created: Partial<Record<Label, number>> = {}
      const known = [...(misconceptions.data ?? [])]
      for (const o of d.options) {
        const p = o.new_misconception
        if (!p) continue
        const existing = known.find(
          (m) => m.concept_id === p.concept_id && m.title.toLowerCase() === p.title.toLowerCase(),
        )
        if (existing) created[o.label] = existing.id
        else {
          const m = await apiSend<Misconception>('POST', '/admin/misconceptions', p)
          known.push(m)
          created[o.label] = m.id
        }
      }
      qc.setQueryData(['misconceptions', subject], known)
      setForm((f) => applyDraft(f, d, created))
      setFlash({ tone: 'info', text: 'Suggestions applied. Review them, then save or approve.' })
    })

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (!busy) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (question.isError)
    return (
      <Layout>
        <Notice tone="error">{(question.error as Error).message}</Notice>
      </Layout>
    )

  return (
    <Layout wide>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin/questions" className="text-sm text-ink-soft hover:text-ink">
          Questions
        </Link>
        <span className="text-ink-soft">/</span>
        <h1 className="text-xl font-bold">{isNew ? 'New question' : `Question #${questionId}`}</h1>
        {!isNew && <StatusPill status={status} />}
        {dirty && !isNew && <span className="text-sm text-ink-soft">Unsaved changes</span>}
      </div>

      {flash && (
        <div className="mb-4">
          <Notice tone={flash.tone}>{flash.text}</Notice>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* ------------------------------------------------ left: the form */}
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <label className="space-y-1">
              <span className="block text-sm text-ink-soft">Subject</span>
              <select
                className={field}
                value={subject}
                onChange={(e) => setSubjectChoice(e.target.value)}
              >
                {subjects.data?.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-ink-soft">Type</span>
              <select
                className={field}
                value={form.qtype}
                onChange={(e) => setForm(setQType(form, e.target.value as QType))}
              >
                <option value="MCQ">MCQ (one answer)</option>
                <option value="MSQ">MSQ (one or more)</option>
                <option value="NAT">NAT (numerical)</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-sm text-ink-soft">Difficulty</span>
              <select
                className={field}
                value={form.difficulty ?? ''}
                onChange={(e) =>
                  setForm({ ...form, difficulty: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">Not set</option>
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-40 flex-1 space-y-1">
              <span className="block text-sm text-ink-soft">Source</span>
              <input
                className={field}
                placeholder="GATE 2021 Set 1 Q23, or original"
                value={form.source ?? ''}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="block text-sm text-ink-soft">
              Question (Markdown; use $…$ for maths)
            </span>
            <textarea
              className={`${field} min-h-32 font-sans`}
              value={form.stem_md}
              onChange={(e) => setForm({ ...form, stem_md: e.target.value })}
            />
          </label>

          {form.qtype === 'NAT' ? (
            <fieldset className="flex flex-wrap gap-4">
              <legend className="mb-1 text-sm text-ink-soft">Accepted answer range</legend>
              {(['nat_answer_min', 'nat_answer_max'] as const).map((k) => (
                <label key={k} className="space-y-1">
                  <span className="block text-sm">{k === 'nat_answer_min' ? 'From' : 'To'}</span>
                  <input
                    className={field}
                    inputMode="decimal"
                    value={form[k] ?? ''}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </label>
              ))}
            </fieldset>
          ) : (
            <fieldset className="space-y-3">
              <legend className="mb-1 text-sm text-ink-soft">
                Options. Click a bubble to mark the correct answer
                {form.qtype === 'MSQ' ? 's' : ''}; tag each wrong option with the belief behind it.
              </legend>
              {form.options.map((o) => (
                <OptionRow
                  key={o.label}
                  option={o}
                  qtype={form.qtype}
                  misconceptions={misconceptions.data ?? []}
                  conceptName={conceptName}
                  concepts={concepts}
                  defaultConceptId={primaryId}
                  onToggle={() => setForm(toggleCorrect(form, o.label))}
                  onChange={(patch) => setForm((f) => updateOption(f, o.label, patch))}
                  onCreated={(m) => {
                    qc.setQueryData(['misconceptions', subject], [...(misconceptions.data ?? []), m])
                    setForm((f) => updateOption(f, o.label, { misconception_id: m.id }))
                  }}
                />
              ))}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={quietButton}
                  onClick={() => setForm(addOption(form))}
                  disabled={form.options.length >= 5}
                >
                  Add option
                </button>
                <button
                  type="button"
                  className={quietButton}
                  onClick={() => setForm(removeLastOption(form))}
                  disabled={form.options.length <= 2}
                >
                  Remove option {form.options.at(-1)?.label}
                </button>
              </div>
            </fieldset>
          )}

          <ConceptPicker
            concepts={concepts}
            primaryId={primaryId}
            secondaryIds={form.concepts.filter((c) => !c.is_primary).map((c) => c.concept_id)}
            onPrimary={(cid) => setForm(setPrimary(form, cid))}
            onToggleSecondary={(cid) => setForm(toggleSecondary(form, cid))}
          />

          <label className="block space-y-1">
            <span className="block text-sm text-ink-soft">Explanation of the correct answer</span>
            <textarea
              className={`${field} min-h-24`}
              value={form.explanation_md ?? ''}
              onChange={(e) => setForm({ ...form, explanation_md: e.target.value })}
            />
          </label>

          <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur">
            <button className={quietButton} onClick={save} disabled={!!busy || !dirty}>
              {busy === 'save' ? 'Saving…' : 'Save draft'}
            </button>
            {status !== 'approved' ? (
              <button className={primaryButton} onClick={approve} disabled={!!busy}>
                {busy === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            ) : (
              <button className={quietButton} onClick={() => setStatus('reopen')} disabled={!!busy}>
                Move back to drafts
              </button>
            )}
            {!isNew && status !== 'retired' && (
              <button
                className="ml-auto text-sm text-pen hover:underline disabled:opacity-50"
                onClick={() => setStatus('retire')}
                disabled={!!busy}
              >
                Retire question
              </button>
            )}
            <span className="hidden text-xs text-ink-soft sm:inline">Ctrl/⌘ S saves</span>
          </div>
        </div>

        {/* ------------------------------------------------ right: preview + AI */}
        <aside className="space-y-6 lg:sticky lg:top-4 lg:self-start">
          <Preview form={form} misById={misById} conceptName={conceptName} primaryId={primaryId} />
          <AIPanel
            draft={draft}
            busy={busy}
            canDraft={form.stem_md.trim().length >= 5 && !!subject}
            misById={misById}
            conceptName={conceptName}
            onGenerate={generateDraft}
            onApply={applySuggestions}
            onUseExplanation={(text) => setForm({ ...form, explanation_md: text })}
          />
        </aside>
      </div>
    </Layout>
  )
}

/* ================================================================== pieces */

function OptionRow({
  option: o,
  qtype,
  misconceptions,
  conceptName,
  concepts,
  defaultConceptId,
  onToggle,
  onChange,
  onCreated,
}: {
  option: OptionIn
  qtype: QType
  misconceptions: Misconception[]
  conceptName: Map<number, string>
  concepts: Concept[]
  defaultConceptId: number | null
  onToggle: () => void
  onChange: (patch: Partial<OptionIn>) => void
  onCreated: (m: Misconception) => void
}) {
  const [creating, setCreating] = useState(false)
  const grouped = useMemo(() => {
    const g = new Map<number, Misconception[]>()
    for (const m of misconceptions) g.set(m.concept_id, [...(g.get(m.concept_id) ?? []), m])
    return [...g.entries()]
  }, [misconceptions])

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={o.is_correct}
        aria-label={`Mark option ${o.label} as ${o.is_correct ? 'not correct' : 'correct'}`}
        className="mt-1 h-fit rounded-full"
        title={qtype === 'MCQ' ? 'Mark as the correct answer' : 'Toggle correct'}
      >
        <Bubble label={o.label} filled={o.is_correct} wrong={!o.is_correct && !!o.misconception_id} />
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <textarea
          aria-label={`Option ${o.label} text`}
          className={`${field} min-h-11`}
          rows={1}
          value={o.text_md}
          onChange={(e) => onChange({ text_md: e.target.value })}
        />
        {!o.is_correct && (
          <select
            aria-label={`Misconception for option ${o.label}`}
            className={`${field} py-1.5 text-sm ${o.misconception_id ? 'border-pen/50 text-pen' : 'text-ink-soft'}`}
            value={creating ? '__new' : (o.misconception_id ?? '')}
            onChange={(e) => {
              if (e.target.value === '__new') setCreating(true)
              else {
                setCreating(false)
                onChange({ misconception_id: e.target.value ? Number(e.target.value) : null })
              }
            }}
          >
            <option value="">No misconception (careless slip or untagged)</option>
            {grouped.map(([cid, ms]) => (
              <optgroup key={cid} label={conceptName.get(cid) ?? 'Concept'}>
                {ms.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__new">New misconception…</option>
          </select>
        )}
        {creating && !o.is_correct && (
          <NewMisconceptionForm
            concepts={concepts}
            defaultConceptId={defaultConceptId}
            onCancel={() => setCreating(false)}
            onCreated={(m) => {
              setCreating(false)
              onCreated(m)
            }}
          />
        )}
      </div>
    </div>
  )
}

function NewMisconceptionForm({
  concepts,
  defaultConceptId,
  onCancel,
  onCreated,
}: {
  concepts: Concept[]
  defaultConceptId: number | null
  onCancel: () => void
  onCreated: (m: Misconception) => void
}) {
  const [conceptId, setConceptId] = useState<number | ''>(defaultConceptId ?? '')
  const [title, setTitle] = useState('')
  const [explanation, setExplanation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    setError(null)
    try {
      onCreated(
        await apiSend<Misconception>('POST', '/admin/misconceptions', {
          concept_id: conceptId,
          title,
          explanation,
        }),
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded border border-pen/30 bg-pen-tint/50 p-3">
      {error && <Notice tone="error">{error}</Notice>}
      <select
        aria-label="Concept for the new misconception"
        className={`${field} text-sm`}
        value={conceptId}
        onChange={(e) => setConceptId(e.target.value ? Number(e.target.value) : '')}
      >
        <option value="">Which concept is it about?</option>
        {concepts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        aria-label="Misconception title"
        className={`${field} text-sm`}
        placeholder="What the student believes, e.g. Believes heap sort is stable"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        aria-label="Why it is wrong"
        className={`${field} text-sm`}
        placeholder="Why that belief is wrong"
        value={explanation}
        onChange={(e) => setExplanation(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-pen px-3 py-1.5 text-sm font-bold text-white disabled:opacity-60"
          disabled={busy || !conceptId || title.length < 3 || explanation.length < 3}
          onClick={create}
        >
          {busy ? 'Adding…' : 'Add misconception'}
        </button>
        <button type="button" className={quietButton} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ConceptPicker({
  concepts,
  primaryId,
  secondaryIds,
  onPrimary,
  onToggleSecondary,
}: {
  concepts: Concept[]
  primaryId: number | null
  secondaryIds: number[]
  onPrimary: (id: number | null) => void
  onToggleSecondary: (id: number) => void
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm text-ink-soft">Concepts tested</legend>
      <label className="block space-y-1">
        <span className="block text-sm">Primary concept (mastery updates fully)</span>
        <select
          className={field}
          value={primaryId ?? ''}
          onChange={(e) => onPrimary(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Choose…</option>
          {concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <details className="rounded border border-rule bg-sheet">
        <summary className="cursor-pointer px-3 py-2 text-sm">
          Also tests{secondaryIds.length ? ` (${secondaryIds.length})` : ''}
        </summary>
        <div className="grid max-h-56 gap-1 overflow-y-auto px-3 pb-3 sm:grid-cols-2">
          {concepts
            .filter((c) => c.id !== primaryId)
            .map((c) => (
              <label key={c.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={secondaryIds.includes(c.id)}
                  onChange={() => onToggleSecondary(c.id)}
                />
                {c.name}
              </label>
            ))}
        </div>
      </details>
    </fieldset>
  )
}

function Preview({
  form,
  misById,
  conceptName,
  primaryId,
}: {
  form: Form
  misById: Map<number, Misconception>
  conceptName: Map<number, string>
  primaryId: number | null
}) {
  return (
    <section aria-label="Preview" className="rounded border border-rule bg-sheet p-5">
      <h2 className="mb-3 flex flex-wrap justify-between gap-x-3 text-sm text-ink-soft">
        <span>Student preview</span>
        {primaryId && <span>{conceptName.get(primaryId)}</span>}
      </h2>
      {form.stem_md.trim() ? (
        <Markdown className="mb-4">{form.stem_md}</Markdown>
      ) : (
        <p className="mb-4 text-ink-soft">The question text will appear here.</p>
      )}
      {form.qtype === 'NAT' ? (
        <p className="text-sm">
          Accepts {form.nat_answer_min || '?'} to {form.nat_answer_max || '?'}
        </p>
      ) : (
        <ul className="space-y-3">
          {form.options.map((o) => {
            const m = o.misconception_id ? misById.get(o.misconception_id) : undefined
            return (
              <li key={o.label}>
                <div className="flex items-start gap-3">
                  <Bubble label={o.label} filled={o.is_correct} wrong={!!m} size="sm" />
                  <Markdown className="pt-0.5">{o.text_md || '…'}</Markdown>
                </div>
                {m && (
                  <p className="ml-10 mt-1 border-l-2 border-pen pl-2 text-sm text-pen">
                    {m.title}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {form.explanation_md?.trim() && (
        <div className="mt-4 border-t border-rule pt-3 text-sm">
          <Markdown>{form.explanation_md}</Markdown>
        </div>
      )}
    </section>
  )
}

function AIPanel({
  draft,
  busy,
  canDraft,
  misById,
  conceptName,
  onGenerate,
  onApply,
  onUseExplanation,
}: {
  draft: Draft | null
  busy: string | null
  canDraft: boolean
  misById: Map<number, Misconception>
  conceptName: Map<number, string>
  onGenerate: () => void
  onApply: (d: Draft) => void
  onUseExplanation: (text: string) => void
}) {
  return (
    <section aria-label="AI tagging" className="rounded border border-dashed border-omr/40 bg-omr-tint/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">AI tag suggestions</h2>
        <button
          className="rounded border border-omr/40 bg-sheet px-3 py-1.5 text-sm text-omr hover:border-omr disabled:opacity-50"
          onClick={onGenerate}
          disabled={!!busy || !canDraft}
        >
          {busy === 'draft' ? 'Drafting…' : draft ? 'Draft again' : 'Draft tags'}
        </button>
      </div>
      {!draft ? (
        <p className="text-sm text-ink-soft">
          Saves the question, then asks the model which concepts it tests and what belief each
          wrong option reveals. Nothing changes until you apply the suggestions.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-ink-soft">Primary: </span>
            {draft.primary_concept_id ? conceptName.get(draft.primary_concept_id) : 'none'}
            {draft.secondary_concept_ids.length > 0 && (
              <>
                <span className="text-ink-soft">; also tests </span>
                {draft.secondary_concept_ids.map((id) => conceptName.get(id)).join(', ')}
              </>
            )}
          </p>
          <ul className="space-y-2">
            {draft.options.map((o) => {
              const existing = o.misconception_id ? misById.get(o.misconception_id) : undefined
              return (
                <li key={o.label} className="flex gap-2">
                  <span className="w-5 shrink-0 font-bold">{o.label}</span>
                  <span>
                    {existing ? (
                      <span className="text-pen">{existing.title}</span>
                    ) : o.new_misconception ? (
                      <span className="text-pen">
                        New: {o.new_misconception.title}
                        <span className="block text-ink-soft">{o.new_misconception.explanation}</span>
                      </span>
                    ) : (
                      <span className="text-ink-soft">No misconception</span>
                    )}
                    {o.reason && <span className="block text-ink-soft">{o.reason}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
          {draft.warnings.length > 0 && (
            <details className="text-ink-soft">
              <summary className="cursor-pointer">
                {draft.warnings.length} suggestion{draft.warnings.length > 1 ? 's' : ''} ignored
              </summary>
              <ul className="ml-4 list-disc">
                {draft.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              className="rounded bg-omr px-3 py-1.5 font-bold text-white disabled:opacity-60"
              onClick={() => onApply(draft)}
              disabled={!!busy}
            >
              {busy === 'apply' ? 'Applying…' : 'Apply suggestions'}
            </button>
            {draft.explanation_md && (
              <button className={quietButton} onClick={() => onUseExplanation(draft.explanation_md)}>
                Use suggested explanation
              </button>
            )}
          </div>
          <p className="text-xs text-ink-soft">Drafted by {draft.model}</p>
        </div>
      )}
    </section>
  )
}
