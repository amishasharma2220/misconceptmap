import { ArrowRight, Check, Clock, Flag, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCoach, useCoachScreen } from '../../coach/CoachContext'
import { Bubble } from '../../components/Bubble'
import { Markdown } from '../../components/Markdown'
import { btn, Chip, MasteryBar, masteryTone, pct, toneText } from '../../components/ui'
import { useStudent } from '../../data/student'
import type { OptionLabel } from '../../data/types'
import { bktUpdate, formatClock, pickQuestions, type Answer, type SessionResult } from './practiceLogic'

export function PracticePage() {
  const [params] = useSearchParams()
  const { data, concept, conceptName, misconception } = useStudent()
  const navigate = useNavigate()
  const coach = useCoach()

  const { questions, title } = useMemo(() => pickQuestions(data.questions, params), [data.questions, params])
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<Record<number, OptionLabel>>({})
  const [answers, setAnswers] = useState<Record<number, Answer>>({})
  const [mastery, setMastery] = useState<Record<string, number>>({})
  const [elapsed, setElapsed] = useState(0)
  const [questionStart, setQuestionStart] = useState(0)

  // Reset when the set of questions changes (e.g. the coach starts a new set).
  const key = questions.map((q) => q.id).join(',')
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setIndex(0)
    setPicked({})
    setAnswers({})
    setElapsed(0)
    setQuestionStart(0)
  }

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(t)
  }, [])

  const q = questions[index]
  const answer = q ? answers[q.id] : undefined
  const choice = q ? picked[q.id] : undefined
  const masteryOf = useCallback(
    (slug: string) => mastery[slug] ?? concept(slug)?.mastery ?? 0.2,
    [mastery, concept],
  )

  useCoachScreen({
    label: q ? `Question ${index + 1} · ${conceptName(q.concept)}` : 'Practice',
    questionId: q?.id,
    answered: !!answer,
    pickedLabel: answer?.label ?? choice,
    concept: q?.concept,
  })

  const submit = useCallback(() => {
    if (!q || !choice || answer) return
    const correct = !!q.options.find((o) => o.label === choice)?.correct
    const before = masteryOf(q.concept)
    const after = bktUpdate(before, correct)
    setMastery((m) => ({ ...m, [q.concept]: after }))
    setAnswers((a) => ({ ...a, [q.id]: { label: choice, correct, seconds: elapsed - questionStart, before, after } }))
  }, [q, choice, answer, masteryOf, elapsed, questionStart])

  const finish = useCallback(() => {
    const result: SessionResult = {
      title,
      seconds: elapsed,
      items: questions.map((x) => ({ question: x, answer: answers[x.id] ?? null })),
    }
    navigate('/practice/summary', { state: result })
  }, [title, elapsed, questions, answers, navigate])

  const next = useCallback(() => {
    if (index + 1 >= questions.length) finish()
    else {
      setIndex(index + 1)
      setQuestionStart(elapsed)
    }
  }, [index, questions.length, finish, elapsed])

  // Keyboard: 1-4 pick, Enter submits / goes next.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('textarea, input, [contenteditable]')) return
      if (!q) return
      const n = Number(e.key)
      if (!answer && n >= 1 && n <= q.options.length) setPicked((p) => ({ ...p, [q.id]: q.options[n - 1].label }))
      if (e.key === 'Enter') {
        e.preventDefault()
        if (answer) next()
        else submit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, answer, next, submit])

  if (!q) return <p className="text-ink-soft">No questions match this selection.</p>

  const done = Object.values(answers)
  const correctSoFar = done.filter((a) => a.correct).length
  const pickedOpt = answer ? q.options.find((o) => o.label === answer.label) : undefined
  const mis = pickedOpt?.misconception ? misconception(pickedOpt.misconception) : undefined
  const c = concept(q.concept)
  const prereqs = (c?.prereqs ?? []).map((s) => ({ slug: s, name: conceptName(s), m: masteryOf(s) }))
  const weakestPrereq = [...prereqs].sort((a, b) => a.m - b.m)[0]
  const linkedMis = data.misconceptions.filter((m) => m.concept === q.concept)
  const similar = data.questions.filter((x) => x.id !== q.id && (x.concept === q.concept || x.alsoTests.includes(q.concept) || q.alsoTests.includes(x.concept))).slice(0, 3)

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_320px]">
      {/* ---------------------------------------------------------- left: session */}
      <aside className="space-y-4 rounded-lg border border-rule bg-sheet p-4 lg:sticky lg:top-20 lg:self-start">
        <div>
          <p className="text-xs text-ink-soft">{title}</p>
          <p className="tnum text-lg font-bold">
            {index + 1} <span className="text-ink-faint">of {questions.length}</span>
          </p>
        </div>
        <ol className="flex flex-wrap gap-1.5" aria-label="Questions in this session">
          {questions.map((x, i) => {
            const a = answers[x.id]
            const tone = a ? (a.correct ? 'border-ok bg-ok text-white' : 'border-pen bg-pen text-white') : i === index ? 'border-omr text-omr' : 'border-rule text-ink-faint'
            return (
              <li key={x.id}>
                <button
                  onClick={() => {
                    setIndex(i)
                    setQuestionStart(elapsed)
                  }}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={`Question ${i + 1}${a ? (a.correct ? ', correct' : ', wrong') : ''}`}
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
            <dt className="flex items-center gap-1 text-xs text-ink-soft"><Clock size={12} /> Time</dt>
            <dd className="tnum font-bold">{formatClock(elapsed)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Correct</dt>
            <dd className="tnum font-bold">
              {correctSoFar}/{done.length}
            </dd>
          </div>
        </dl>
        <button className={`${btn.quiet} w-full`} onClick={finish}>
          <Flag size={14} /> End session
        </button>
        <p className="hidden text-xs text-ink-faint lg:block">Keys: 1–4 to choose, Enter to submit or go on.</p>
      </aside>

      {/* ---------------------------------------------------------- centre: question */}
      <section className="min-w-0 space-y-4">
        <div className="rounded-lg border border-rule bg-sheet">
          <div className="flex flex-wrap items-center gap-2 border-b border-rule-soft px-5 py-3 text-xs">
            <Chip tone="omr">{conceptName(q.concept)}</Chip>
            {q.alsoTests.map((s) => (
              <Chip key={s}>{conceptName(s)}</Chip>
            ))}
            <span className="text-ink-soft">Difficulty {q.difficulty}/5</span>
            <span className="ml-auto text-ink-faint">{q.source}</span>
          </div>
          <div className="space-y-5 px-5 py-5">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-xs text-ink-soft">
              Why this question: {q.whyPicked}
            </p>
            <Markdown className="text-[17px] leading-relaxed">{q.stem}</Markdown>

            <ul className="space-y-2" role="radiogroup" aria-label="Options">
              {q.options.map((o, i) => {
                const isPicked = (answer?.label ?? choice) === o.label
                const showCorrect = !!answer && o.correct
                const showWrong = !!answer && isPicked && !o.correct
                const om = showWrong && o.misconception ? misconception(o.misconception) : undefined
                return (
                  <li key={o.label}>
                    <button
                      role="radio"
                      aria-checked={isPicked}
                      disabled={!!answer}
                      onClick={() => setPicked((p) => ({ ...p, [q.id]: o.label }))}
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
                      <Bubble label={o.label} filled={isPicked && !answer} correct={showCorrect} wrong={showWrong} />
                      <Markdown className="flex-1">{o.text}</Markdown>
                      <span className="hidden text-xs text-ink-faint sm:inline">{i + 1}</span>
                      {showCorrect && <Check size={18} className="text-ok" aria-label="Correct answer" />}
                      {showWrong && <X size={18} className="text-pen" aria-label="Your answer" />}
                    </button>
                    {om && (
                      <p className="ml-12 mt-1.5 border-l-2 border-pen pl-2 text-sm font-bold text-pen">{om.title}</p>
                    )}
                  </li>
                )
              })}
            </ul>

            {!answer ? (
              <div className="flex flex-wrap items-center gap-3">
                <button className={btn.primary} onClick={submit} disabled={!choice}>
                  Submit answer
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
                  className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-4 py-3 ${answer.correct ? 'bg-ok-tint text-ok' : 'bg-pen-tint text-pen'}`}
                >
                  <span className="font-bold">{answer.correct ? 'Correct' : `Not quite: the answer is ${q.options.find((o) => o.correct)?.label}`}</span>
                  <span className="tnum text-sm">
                    {conceptName(q.concept)} mastery {pct(answer.before)} → {pct(answer.after)}
                  </span>
                </div>

                {mis && (
                  <div className="rounded-md border border-pen/30 bg-sheet p-4">
                    <p className="text-sm text-pen">The belief behind option {answer.label}</p>
                    <p className="mt-0.5 text-lg font-bold text-pen">{mis.title}</p>
                    <Markdown className="mt-2">{mis.explanation}</Markdown>
                    {mis.example && <p className="mt-2 rounded bg-paper px-3 py-2 text-sm">Example: {mis.example}</p>}
                  </div>
                )}

                <div className="rounded-md bg-paper p-4">
                  <p className="mb-1 text-sm font-bold">Explanation</p>
                  <Markdown>{q.explanation}</Markdown>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button className={btn.primary} onClick={next}>
                    {index + 1 >= questions.length ? 'See session summary' : 'Next question'} <ArrowRight size={16} />
                  </button>
                  {!answer.correct && (
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
                  {!answer.correct && <span className="text-sm text-ink-soft">Added to your review queue</span>}
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
            <span className={`tnum text-3xl font-bold ${toneText[masteryTone(masteryOf(q.concept))]}`}>{pct(masteryOf(q.concept))}</span>
            <span className="text-sm text-ink-soft">mastery</span>
            {answer && (
              <span className={`tnum ml-auto text-sm font-bold ${answer.after >= answer.before ? 'text-ok' : 'text-pen'}`}>
                {answer.after >= answer.before ? '+' : '−'}
                {Math.abs((answer.after - answer.before) * 100).toFixed(0)} pts
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
              {prereqs.map((p) => (
                <li key={p.slug} className={`rounded-md px-2 py-1.5 ${p === weakestPrereq && p.m < 0.6 ? 'bg-pen-tint/60' : ''}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{p.name}</span>
                    {p === weakestPrereq && p.m < 0.6 && <span className="text-xs text-pen">weakest</span>}
                  </div>
                  <MasteryBar value={p.m} className="mt-1" />
                </li>
              ))}
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
              {similar.map((s) => (
                <li key={s.id}>
                  <Link to={`/practice?q=${s.id}`} className="line-clamp-2 text-omr hover:underline">
                    {s.stem.replace(/\$|\*\*/g, '')}
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
