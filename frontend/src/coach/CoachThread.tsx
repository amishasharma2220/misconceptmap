import { ArrowUp, CalendarDays, Lightbulb, Play, RotateCcw, Target } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Markdown } from '../components/Markdown'
import { btn, Chip } from '../components/ui'
import { useStudent } from '../data/student'
import { useCoach } from './CoachContext'
import { suggestionsFor } from './sampleCoach'
import type { CoachCard, CoachMessage } from './types'

/** The conversation + composer. Used by the side panel and the full /coach page. */
export function CoachThread({ wide = false }: { wide?: boolean }) {
  const { messages, thinking, send, screen } = useCoach()
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [messages.length, thinking])

  const submit = () => {
    send(draft)
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 ${wide ? 'mx-auto w-full max-w-3xl' : ''}`}>
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">
              Ask for questions to practise, a hint on the question in front of you, why an answer was wrong, a
              study plan, or any GATE CS concept.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {thinking && (
          <div className="flex items-center gap-1.5 px-1 text-ink-faint" role="status" aria-label="Coach is typing">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" />
          </div>
        )}
        <div ref={end} />
      </div>

      <div className={`border-t border-rule bg-sheet px-4 pb-3 pt-3 ${wide ? 'mx-auto w-full max-w-3xl' : ''}`}>
        {messages.length === 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {suggestionsFor(screen).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-rule bg-paper px-3 py-1 text-left text-xs text-ink hover:border-omr hover:text-omr"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-lg border border-rule bg-sheet p-1.5 focus-within:border-omr">
          <textarea
            aria-label="Message the coach"
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask your coach…"
            className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm focus:outline-none focus-visible:outline-none"
          />
          <button
            onClick={submit}
            disabled={!draft.trim() || thinking}
            aria-label="Send"
            className="rounded-md bg-omr p-2 text-white disabled:opacity-40"
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          Enter to send, Shift+Enter for a new line. The coach can make mistakes; check important answers.
        </p>
      </div>
    </div>
  )
}

function Message({ m }: { m: CoachMessage }) {
  if (m.role === 'user')
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-omr px-3 py-2 text-sm text-white">{m.text}</p>
      </div>
    )
  return (
    <div className="space-y-2">
      <Markdown className="text-sm">{m.text}</Markdown>
      {m.card && <Card card={m.card} />}
    </div>
  )
}

function Card({ card }: { card: CoachCard }) {
  const navigate = useNavigate()
  const { conceptName } = useStudent()
  const { send } = useCoach()

  if (card.kind === 'recommend')
    return (
      <div className="overflow-hidden rounded-lg border border-rule bg-sheet">
        <div className="flex items-center gap-2 border-b border-rule-soft px-3 py-2 text-xs font-bold text-ink-soft">
          <Target size={14} /> Recommended for you
        </div>
        <ul className="divide-y divide-rule-soft">
          {card.items.map((it) => (
            <li key={it.questionId} className="flex items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">{it.stem}</p>
                <p className="mt-1 flex flex-wrap gap-1.5 text-xs text-ink-soft">
                  <Chip>{it.concept}</Chip>
                  <span>{it.reason}</span>
                </p>
              </div>
              <button className={btn.quiet} onClick={() => navigate(`/practice?q=${it.questionId}`)}>
                <Play size={13} /> Start
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-rule-soft p-2">
          <button
            className={`${btn.primary} w-full`}
            onClick={() => navigate(`/practice?q=${card.items.map((i) => i.questionId).join(',')}`)}
          >
            Start all {card.items.length} as a session
          </button>
        </div>
      </div>
    )

  if (card.kind === 'mistake')
    return (
      <div
        className={`rounded-lg border px-3 py-3 text-sm ${card.hintOnly ? 'border-omr/30 bg-omr-tint/50' : 'border-pen/30 bg-pen-tint/60'}`}
      >
        <p className={`mb-2 flex items-center gap-2 text-xs font-bold ${card.hintOnly ? 'text-omr' : 'text-pen'}`}>
          <Lightbulb size={14} /> {card.hintOnly ? `Hint · ${card.concept}` : card.concept}
        </p>
        {card.misconceptionTitle && (
          <p className="mb-2 border-l-2 border-pen pl-2 font-bold text-pen">You may be thinking: {card.misconceptionTitle.replace(/^Believes /, '')}</p>
        )}
        <ol className="list-decimal space-y-1 pl-5">
          {card.steps.map((s) => (
            <li key={s}>
              <Markdown>{s}</Markdown>
            </li>
          ))}
        </ol>
        {card.similarQuestionId && (
          <button className={`${btn.quiet} mt-3`} onClick={() => navigate(`/practice?q=${card.similarQuestionId}`)}>
            Show me a similar question
          </button>
        )}
      </div>
    )

  if (card.kind === 'plan')
    return (
      <div className="overflow-hidden rounded-lg border border-rule bg-sheet">
        <div className="flex items-center justify-between gap-2 border-b border-rule-soft px-3 py-2 text-xs text-ink-soft">
          <span className="flex items-center gap-2 font-bold">
            <CalendarDays size={14} /> Your next 7 days
          </span>
          <span className="tnum">{card.daysToGate} days to GATE</span>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="text-ink-faint">
            <tr>
              <th className="px-3 py-1.5 font-normal">Day</th>
              <th className="px-1 py-1.5 font-normal">Focus</th>
              <th className="px-1 py-1.5 text-right font-normal">Qs</th>
              <th className="px-3 py-1.5 text-right font-normal">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule-soft">
            {card.days.map((d) => (
              <tr key={d.day}>
                <td className="px-3 py-1.5 font-bold">{d.day}</td>
                <td className="px-1 py-1.5">{d.concepts.join(', ')}</td>
                <td className="tnum px-1 py-1.5 text-right">{d.questions}</td>
                <td className="tnum px-3 py-1.5 text-right">{d.reviews}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2 border-t border-rule-soft p-2">
          <button className={`${btn.primary} flex-1`} onClick={() => navigate('/practice')}>
            Start today’s set
          </button>
          <button className={btn.quiet} onClick={() => send('Make me a different plan for this week')}>
            <RotateCcw size={13} /> Regenerate
          </button>
        </div>
      </div>
    )

  return (
    <div className="rounded-lg border border-rule bg-sheet px-3 py-3 text-sm">
      <Markdown>{card.markdown}</Markdown>
      <button className={`${btn.quiet} mt-3`} onClick={() => navigate(`/practice?concept=${card.concept}`)}>
        Practise {conceptName(card.concept)}
      </button>
    </div>
  )
}
