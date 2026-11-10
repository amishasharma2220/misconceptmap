import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Clock, Flag, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiGet, apiSend } from '../../api/client'
import type { AnswerIn, AnswerResult, Label, PracticeSessionOut, SessionItem } from '../../api/types'
import { useCoach, useCoachScreen } from '../../coach/CoachContext'
import { Bubble } from '../../components/Bubble'
import { Markdown } from '../../components/Markdown'
import { btn, Chip, EmptyNote, MasteryBar, masteryTone, pct, toneText } from '../../components/ui'
import { useRefreshStudent, useStudent } from '../../data/student'
import { dueLabel, formatClock, sessionRequest } from './practiceLogic'

const sessionKey = (id: number) => ['session', id]

/** /practice?session=ID shows a session; any other /practice URL starts one first. */
export function PracticePage() {
  const [params] = useSearchParams()
  const id = Number(params.get('session'))
  if (id > 0) return <SessionView key={id} id={id} />
  return <StartSession key={params.toString()} params={params} />
}

// ------------------------------------------------------------------ starting

function StartSession({ params }: { params: URLSearchParams }) {
  const navigate = useNavigate()
  const client = useQueryClient()
  const start = useMutation({
    mutationFn: () => apiSend<PracticeSessionOut>('POST', '/sessions', sessionRequest(params)),
    onSuccess: (s) => {
      client.setQueryData(sessionKey(s.id), s)
      navigate(`/practice?session=${s.id}`, { replace: true })
    },
  })
  // One request per mount, even when React runs effects twice in development.
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    start.mutate()
  }, [start])

  if (start.isError) {
    const review = params.get('mode') === 'review'
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <EmptyNote
          action={
            <div className="flex flex-wrap gap-2">
              {review && (
                <Link className={btn.primary} to="/practice">
                  Start an adaptive session
                </Link>
              )}
              <Link className={btn.quiet} to="/home">
                Back to dashboard
              </Link>
            </div>
          }
        >
          {start.error.message}
        </EmptyNote>
      </div>
    )
  }
  return (
    <p className="text-ink-soft" role="status">
      Choosing your first question…
    </p>
  )
}

// ------------------------------------------------------------------ the session

function SessionView({ id }: { id: number }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const refreshStudent = useRefreshStudent()
  const session = useQuery({
    queryKey: sessionKey(id),
    queryFn: () => apiGet<PracticeSessionOut>(`/sessions/${id}`),
  })

  if (session.isPending) return <p className="text-ink-soft">Loading session…</p>
  if (session.isError)
    return (
      <EmptyNote action={<Link className={btn.primary} to="/practice">Start a new session</Link>}>
        {session.error.message}
      </EmptyNote>
    )
  return (
    <Session
      s={session.data}
      onUpdate={(s) => client.setQueryData(sessionKey(id), s)}
      onAnswered={(r) => {
        client.setQueryData<PracticeSessionOut>(sessionKey(id), (old) =>
          old && {
            ...old,
            items: old.items.map((i) => (i.question.id === r.question_id ? { ...i, result: r } : i)),
          },
        )
        refreshStudent()
      }}
      onFinish={() => navigate(`/practice/summary?session=${id}`)}
    />
  )
}

function Session({
  s,
  onUpdate,
  onAnswered,
  onFinish,
}: {
  s: PracticeSessionOut
  onUpdate: (s: PracticeSessionOut) => void
  onAnswered: (r: AnswerResult) => void
  onFinish: () => void
}) {
  const { data, concept, conceptName } = useStudent()
  const coach = useCoach()
  const [index, setIndex] = useState(() => {
    const open = s.items.findIndex((i) => !i.result)
    return open >= 0 ? open : s.items.length - 1
  })
  const [picked, setPicked] = useState<Record<number, Label[]>>({})
  const [natInput, setNatInput] = useState<Record<number, string>>({})
  const shownAt = useRef(0)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    shownAt.current = Date.now()
  }, [])

  useEffect(() => {
    if (s.ended_at) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [s.ended_at])

  const goTo = useCallback((i: number) => {
    setIndex(i)
    shownAt.current = Date.now()
  }, [])

  const item: SessionItem | undefined = s.items[index]
  const q = item?.question
  const result = item?.result ?? null
  const choice = useMemo(() => (q ? (picked[q.id] ?? []) : []), [q, picked])

  const answer = useMutation({
    mutationFn: (body: AnswerIn) => apiSend<AnswerResult>('POST', `/sessions/${s.id}/answer`, body),
    onSuccess: onAnswered,
  })
  const next = useMutation({
    mutationFn: () => apiSend<PracticeSessionOut>('POST', `/sessions/${s.id}/next`),
  })
  const end = useMutation({
    mutationFn: () => apiSend<PracticeSessionOut>('POST', `/sessions/${s.id}/end`),
    onSuccess: (out) => {
      onUpdate(out)
      onFinish()
    },
  })

  const ready = q && (q.qtype === 'NAT' ? (natInput[q.id] ?? '').trim() !== '' : choice.length > 0)

  const submit = useCallback(() => {
    if (!q || result || !ready || answer.isPending) return
    answer.mutate({
      question_id: q.id,
      chosen: q.qtype === 'NAT' ? [] : choice,
      nat_value: q.qtype === 'NAT' ? natInput[q.id].trim() : undefined,
      time_taken_ms: Date.now() - shownAt.current,
    })
  }, [q, result, ready, answer, choice, natInput])

  const goNext = useCallback(async () => {
    if (index + 1 < s.items.length) return goTo(index + 1)
    if (s.done || (s.items.length >= s.size && s.items.every((i) => i.result))) return end.mutate()
    const out = await next.mutateAsync()
    onUpdate(out)
    if (out.items.length > s.items.length) goTo(s.items.length)
    else end.mutate()
  }, [index, s.items, s.size, s.done, goTo, end, next, onUpdate])

  const pick = useCallback(
    (label: Label) => {
      if (!q || result) return
      setPicked((p) => {
        const cur = p[q.id] ?? []
        if (q.qtype === 'MSQ') {
          return { ...p, [q.id]: cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label].sort() }
        }
        return { ...p, [q.id]: [label] }
      })
    },
    [q, result],
  )

  const firstMis = result?.misconceptions[0]
  useCoachScreen({
    label: q ? `Question ${index + 1} · ${conceptName(q.concept)}` : 'Practice',
    questionId: q?.id,
    answered: !!result,
    pickedLabel: (result?.chosen ?? choice).join(',') || undefined,
    concept: q?.concept,
    correct: result?.correct,
    explanation: result?.explanation_md ?? undefined,
    misconception: firstMis ? { title: firstMis.title, explanation: firstMis.explanation } : undefined,
  })

  // Keyboard: number keys choose, Enter submits / goes on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (!q) return
      const typing = el.closest('textarea, input, [contenteditable]')
      if (e.key === 'Enter' && (!typing || el.getAttribute('data-nat') !== null)) {
        e.preventDefault()
        if (result) void goNext()
        else submit()
        return
      }
      if (typing) return
      const n = Number(e.key)
      if (!result && n >= 1 && n <= q.options.length) pick(q.options[n - 1].label)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, result, goNext, submit, pick])

  if (!q) return <p className="text-ink-soft">This session has no questions.</p>

  // Mastery: the latest value seen in this session, else the dashboard's value.
  const sessionMastery = new Map<string, number>()
  for (const i of s.items) for (const m of i.result?.mastery ?? []) sessionMastery.set(m.concept, m.after)
  const masteryOf = (slug: string): number | null => sessionMastery.get(slug) ?? concept(slug)?.mastery ?? null

  const answered = s.items.filter((i) => i.result)
  const correctSoFar = answered.filter((i) => i.result!.correct).length
  const delta = result?.mastery[0]
  const c = concept(q.concept)
  const prereqs = (c?.prereqs ?? []).map((slug) => ({ slug, name: conceptName(slug), m: masteryOf(slug) }))
  const weakestPrereq = [...prereqs].filter((p) => p.m != null).sort((a, b) => a.m! - b.m!)[0]
  const linkedMis = data.misconceptions.filter((m) => m.concept === q.concept)
  const similar = data.questions
    .filter((x) => x.id !== q.id && (x.concept === q.concept || x.alsoTests.includes(q.concept)))
    .slice(0, 3)
  const elapsed = Math.max(0, Math.round(((s.ended_at ? Date.parse(s.ended_at) : now) - Date.parse(s.started_at)) / 1000))
  const busy = next.isPending || end.isPending
  const lastServed = index + 1 >= s.items.length
  // The server's `done` is from before this answer; a full, fully answered session is done too.
  const finished = s.done || (s.items.length >= s.size && s.items.every((i) => i.result))
  const error = answer.error ?? next.error ?? end.error

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_320px]">
      {/* ---------------------------------------------------------- left: session */}
      <aside className="space-y-4 rounded-lg border border-rule bg-sheet p-4 lg:sticky lg:top-20 lg:self-start">
        <div>
          <p className="text-xs text-ink-soft">{s.title}</p>
          <p className="tnum text-lg font-bold">
            {index + 1} <span className="text-ink-faint">of {s.size}</span>
          </p>
        </div>
        <ol className="flex flex-wrap gap-1.5" aria-label="Questions in this session">
          {Array.from({ length: s.size }, (_, i) => {
            const it = s.items[i]
            const r = it?.result
            const tone = r
              ? r.correct
                ? 'border-ok bg-ok text-white'
                : 'border-pen bg-pen text-white'
              : i === index
                ? 'border-omr text-omr'
                : it
                  ? 'border-rule text-ink-soft'
                  : 'border-dashed border-rule text-ink-faint/60'
            return (
              <li key={i}>
                <button
                  onClick={() => it && goTo(i)}
                  disabled={!it}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`Question ${i + 1}${r ? (r.correct ? ', correct' : ', wrong') : it ? '' : ', not served yet'}`}
                  className={`tnum h-8 w-8 rounded-full border-2 text-xs font-bold ${tone} ${i === index ? 'ring-2 ring-omr/30' : ''}`}
                >
                  {i + 1}
                </button>
              </li>
            )
          })}
        </ol>
        <dl className="grid grid-cols-2 gap-3 border-t border-rule-soft pt-3 text-sm">
          <div>
            <dt className="flex items-center gap-1 text-xs text-ink-soft">
              <Clock size={12} /> Time
            </dt>
            <dd className="tnum font-bold">{formatClock(elapsed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Correct</dt>
            <dd className="tnum font-bold">
              {correctSoFar}/{answered.length}
            </dd>
          </div>
        </dl>
        <button className={`${btn.quiet} w-full`} onClick={() => end.mutate()} disabled={busy}>
          <Flag size={14} /> End session
        </button>
        <p className="hidden text-xs text-ink-faint lg:block">Keys: 1–{q.options.length || 4} to choose, Enter to submit or go on.</p>
      </aside>

      {/* ---------------------------------------------------------- centre: question */}
      <section className="min-w-0 space-y-4">
        <div className="rounded-lg border border-rule bg-sheet">
          <div className="flex flex-wrap items-center gap-2 border-b border-rule-soft px-5 py-3 text-xs">
            <Chip tone="omr">{conceptName(q.concept)}</Chip>
            {q.also_tests.map((slug) => (
              <Chip key={slug}>{conceptName(slug)}</Chip>
            ))}
            {q.difficulty && <span className="text-ink-soft">Difficulty {q.difficulty}/5</span>}
            {q.qtype !== 'MCQ' && <span className="text-ink-soft">{q.qtype === 'MSQ' ? 'One or more correct' : 'Numerical answer'}</span>}
            <span className="ml-auto text-ink-faint">{q.source}</span>
          </div>
          <div className="space-y-5 px-5 py-5">
            {item.reason && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft">
                Why this question: {item.reason}
              </p>
            )}
            <Markdown className="text-[17px] leading-relaxed">{q.stem_md}</Markdown>

            {q.qtype === 'NAT' ? (
              <label className="block max-w-xs text-sm">
                <span className="text-ink-soft">Your answer</span>
                <input
                  data-nat
                  inputMode="decimal"
                  disabled={!!result}
                  value={result?.nat_value ?? natInput[q.id] ?? ''}
                  onChange={(e) => setNatInput((v) => ({ ...v, [q.id]: e.target.value }))}
                  className={`tnum mt-1 w-full rounded-md border px-3 py-2 text-lg ${result ? (result.correct ? 'border-ok bg-ok-tint' : 'border-pen bg-pen-tint/50') : 'border-rule'}`}
                />
              </label>
            ) : (
              <ul className="space-y-2" role={q.qtype === 'MSQ' ? 'group' : 'radiogroup'} aria-label="Options">
                {q.options.map((o, i) => {
                  const isPicked = (result?.chosen ?? choice).includes(o.label)
                  const showCorrect = !!result && result.correct_labels.includes(o.label)
                  const showWrong = !!result && isPicked && !showCorrect
                  const om = showWrong ? result.misconceptions.find((m) => m.label === o.label) : undefined
                  return (
                    <li key={o.label}>
                      <button
                        role={q.qtype === 'MSQ' ? 'checkbox' : 'radio'}
                        aria-checked={isPicked}
                        disabled={!!result}
                        onClick={() => pick(o.label)}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                          showCorrect
                            ? 'border-ok/60 bg-ok-tint'
                            : showWrong
                              ? 'border-pen/60 bg-pen-tint/50'
                              : isPicked
                                ? 'border-omr bg-omr-tint/60'
                                : 'border-rule hover:border-ink-faint disabled:hover:border-rule'
                        }`}
                      >
                        <Bubble label={o.label} filled={isPicked && !result} correct={showCorrect} wrong={showWrong} />
                        <Markdown className="flex-1">{o.text_md}</Markdown>
                        <span className="hidden text-xs text-ink-faint sm:inline">{i + 1}</span>
                        {showCorrect && <Check size={18} className="text-ok" aria-label="Correct answer" />}
                        {showWrong && <X size={18} className="text-pen" aria-label="Your answer" />}
                      </button>
                      {om && <p className="ml-12 mt-1.5 border-l-2 border-pen pl-2 text-sm font-bold text-pen">{om.title}</p>}
                    </li>
                  )
                })}
              </ul>
            )}

            {error && (
              <p role="alert" className="text-sm text-pen">
                {error.message}
              </p>
            )}

            {!result ? (
              <div className="flex flex-wrap items-center gap-3">
                <button className={btn.primary} onClick={submit} disabled={!ready || answer.isPending}>
                  {answer.isPending ? 'Checking…' : 'Submit answer'}
                </button>
                <button
                  className={btn.ghost}
                  onClick={() => {
                    coach.setOpen(true)
                    coach.send("Give me a hint, don't reveal the answer")
                  }}
                >
                  <Sparkles size={14} /> Ask for a hint
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  role="status"
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-4 py-3 ${result.correct ? 'bg-ok-tint text-ok' : 'bg-pen-tint text-pen'}`}
                >
                  <span className="font-bold">
                    {result.correct ? 'Correct' : `Not quite: the answer is ${answerText(result)}`}
                  </span>
                  {delta && (
                    <span className="tnum text-sm">
                      {conceptName(delta.concept)} mastery {pct(delta.before)} → {pct(delta.after)}
                    </span>
                  )}
                </div>

                {result.misconceptions.map((m) => (
                  <div key={m.id} className="rounded-md border border-pen/30 bg-sheet p-4">
                    <p className="text-sm text-pen">The belief behind option {m.label}</p>
                    <p className="mt-0.5 text-lg font-bold text-pen">{m.title}</p>
                    <Markdown className="mt-2">{m.explanation}</Markdown>
                    {m.example && <p className="mt-2 rounded bg-paper px-3 py-2 text-sm">Example: {m.example}</p>}
                  </div>
                ))}

                {result.explanation_md && (
                  <div className="rounded-md bg-paper p-4">
                    <p className="mb-1 text-sm font-bold">Explanation</p>
                    <Markdown>{result.explanation_md}</Markdown>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button className={btn.primary} onClick={() => void goNext()} disabled={busy}>
                    {lastServed && finished ? 'See session summary' : 'Next question'} <ArrowRight size={16} />
                  </button>
                  {!result.correct && (
                    <button
                      className={btn.ghost}
                      onClick={() => {
                        coach.setOpen(true)
                        coach.send('Why was my answer wrong?')
                      }}
                    >
                      <Sparkles size={14} /> Ask the coach why
                    </button>
                  )}
                  {result.review_due_at && (
                    <span className="text-sm text-ink-soft">
                      {result.correct ? 'Next review' : 'Added to your review queue'}: {dueLabel(result.review_due_at)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- right: concept context */}
      <aside className="space-y-4 lg:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-20 2xl:self-start">
        <div className="rounded-lg border border-rule bg-sheet p-4">
          <p className="text-xs text-ink-soft">Concept</p>
          <p className="font-bold">{conceptName(q.concept)}</p>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`tnum text-3xl font-bold ${toneText[masteryTone(masteryOf(q.concept))]}`}>
              {masteryOf(q.concept) == null ? 'New' : pct(masteryOf(q.concept))}
            </span>
            <span className="text-sm text-ink-soft">mastery</span>
            {delta && (
              <span className={`tnum ml-auto text-sm font-bold ${delta.after >= delta.before ? 'text-ok' : 'text-pen'}`}>
                {delta.after >= delta.before ? '+' : '−'}
                {Math.abs((delta.after - delta.before) * 100).toFixed(0)} pts
              </span>
            )}
          </div>
          <MasteryBar value={masteryOf(q.concept)} label={false} className="mt-2" />
          {c?.description && <p className="mt-3 text-sm text-ink-soft">{c.description}</p>}
        </div>

        {prereqs.length > 0 && (
          <div className="rounded-lg border border-rule bg-sheet p-4">
            <p className="mb-2 text-sm font-bold">Builds on</p>
            <ul className="space-y-2">
              {prereqs.map((p) => {
                const weak = p === weakestPrereq && p.m! < 0.6
                return (
                  <li key={p.slug} className={`rounded-md px-2 py-1.5 ${weak ? 'bg-pen-tint/60' : ''}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{p.name}</span>
                      {weak && <span className="text-xs text-pen">weakest</span>}
                    </div>
                    <MasteryBar value={p.m} className="mt-1" />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {linkedMis.length > 0 && (
          <div className="rounded-lg border border-rule bg-sheet p-4">
            <p className="mb-2 text-sm font-bold">Common misconceptions here</p>
            <ul className="space-y-2 text-sm">
              {linkedMis.map((m) => (
                <li key={m.id} className="flex justify-between gap-3 border-l-2 border-pen/60 pl-2">
                  <span>{m.title}</span>
                  <span className="tnum shrink-0 text-xs text-ink-soft">you: {m.hits}×</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {similar.length > 0 && (
          <div className="rounded-lg border border-rule bg-sheet p-4">
            <p className="mb-2 text-sm font-bold">Similar questions</p>
            <ul className="space-y-2 text-sm">
              {similar.map((x) => (
                <li key={x.id}>
                  <Link to={`/practice?q=${x.id}`} className="line-clamp-2 text-omr hover:underline">
                    {x.stem}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}

function answerText(r: AnswerResult): string {
  if (r.correct_labels.length) return r.correct_labels.join(', ')
  if (r.nat_answer_min == null) return '—'
  return r.nat_answer_min === r.nat_answer_max ? r.nat_answer_min : `between ${r.nat_answer_min} and ${r.nat_answer_max}`
}
