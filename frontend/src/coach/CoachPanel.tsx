import { Expand, Sparkles, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCoach } from './CoachContext'
import { CoachThread } from './CoachThread'

/** Right-hand side panel, available on every signed-in screen. */
export function CoachPanel() {
  const { open, setOpen, screen, clear, messages } = useCoach()
  if (!open) return null
  return (
    <aside
      aria-label="AI coach"
      className="fixed inset-0 z-40 flex flex-col border-l border-rule bg-sheet md:sticky md:top-0 md:z-auto md:h-screen md:w-[400px] md:shrink-0"
    >
      <header className="flex items-center gap-2 border-b border-rule px-4 py-3">
        <Sparkles size={16} className="text-omr" aria-hidden />
        <h2 className="font-bold">Study coach</h2>
        <div className="ml-auto flex items-center gap-1">
          {messages.length > 0 && (
            <button onClick={clear} className="rounded p-1.5 text-ink-soft hover:bg-rule-soft" aria-label="Clear conversation">
              <Trash2 size={15} />
            </button>
          )}
          <Link to="/coach" className="rounded p-1.5 text-ink-soft hover:bg-rule-soft" aria-label="Open full page" onClick={() => setOpen(false)}>
            <Expand size={15} />
          </Link>
          <button onClick={() => setOpen(false)} className="rounded p-1.5 text-ink-soft hover:bg-rule-soft" aria-label="Close coach">
            <X size={16} />
          </button>
        </div>
      </header>
      <p className="border-b border-rule-soft bg-paper px-4 py-1.5 text-xs text-ink-soft">
        Looking at: <span className="text-ink">{screen.label}</span>
      </p>
      <div className="min-h-0 flex-1">
        <CoachThread />
      </div>
    </aside>
  )
}
