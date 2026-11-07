import { MessageSquare, Plus } from 'lucide-react'
import { useEffect } from 'react'
import { useCoach, useCoachScreen } from '../../coach/CoachContext'
import { CoachThread } from '../../coach/CoachThread'

export function CoachPage() {
  const { messages, clear, setOpen } = useCoach()
  useCoachScreen({ label: 'AI coach' })
  // The full page replaces the side panel.
  useEffect(() => setOpen(false), [setOpen])
  const firstQuestion = messages.find((m) => m.role === 'user')?.text

  return (
    <div className="mx-auto flex max-w-[1600px] gap-4 lg:h-[calc(100vh-7.5rem)]">
      <aside className="hidden w-64 shrink-0 flex-col rounded-lg border border-rule bg-sheet lg:flex">
        <div className="border-b border-rule-soft p-3">
          <button onClick={clear} className="flex w-full items-center justify-center gap-2 rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink-faint">
            <Plus size={14} /> New conversation
          </button>
        </div>
        <ul className="flex-1 p-2 text-sm">
          <li className="flex items-center gap-2 rounded-md bg-omr-tint/60 px-2.5 py-2 text-omr">
            <MessageSquare size={14} className="shrink-0" />
            <span className="truncate">{firstQuestion ?? 'New conversation'}</span>
          </li>
        </ul>
        <p className="border-t border-rule-soft p-3 text-xs text-ink-faint">
          Past conversations will be listed here once the coach saves them to your account.
        </p>
      </aside>
      <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-rule bg-sheet">
        <CoachThread wide />
      </section>
    </div>
  )
}
