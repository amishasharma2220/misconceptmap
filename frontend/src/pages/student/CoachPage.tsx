import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useEffect } from 'react'
import { apiGet, apiSend } from '../../api/client'
import { CONVERSATIONS_KEY, useCoach, useCoachScreen } from '../../coach/CoachContext'
import { CoachThread } from '../../coach/CoachThread'
import type { ConversationSummary } from '../../coach/types'

export function CoachPage() {
  const { clear, setOpen, conversationId, openConversation } = useCoach()
  const client = useQueryClient()
  useCoachScreen({ label: 'AI coach' })
  // The full page replaces the side panel.
  useEffect(() => setOpen(false), [setOpen])

  const list = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => apiGet<ConversationSummary[]>('/coach/conversations'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => apiSend('DELETE', `/coach/conversations/${id}`),
    onSuccess: (_, id) => {
      if (id === conversationId) clear()
      void client.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
    },
  })

  return (
    <div className="mx-auto flex max-w-[1600px] gap-4 lg:h-[calc(100vh-7.5rem)]">
      <aside className="hidden w-64 shrink-0 flex-col rounded-lg border border-rule bg-sheet lg:flex">
        <div className="border-b border-rule-soft p-3">
          <button
            onClick={clear}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-rule px-3 py-1.5 text-sm hover:border-ink-faint"
          >
            <Plus size={14} /> New conversation
          </button>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 text-sm" aria-label="Past conversations">
          {list.data?.length === 0 && <li className="px-2.5 py-2 text-xs text-ink-faint">No conversations yet.</li>}
          {list.data?.map((c) => {
            const active = c.id === conversationId
            return (
              <li key={c.id} className="group flex items-center">
                <button
                  onClick={() => void openConversation(c.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-2 text-left ${active ? 'bg-omr-tint/60 text-omr' : 'hover:bg-paper'}`}
                >
                  <MessageSquare size={14} className="shrink-0" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={() => remove.mutate(c.id)}
                  aria-label={`Delete conversation: ${c.title}`}
                  className="ml-1 rounded p-1.5 text-ink-faint opacity-0 hover:text-pen focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            )
          })}
        </ul>
        <p className="border-t border-rule-soft p-3 text-xs text-ink-faint">
          Conversations are saved to your account. Only you can see them.
        </p>
      </aside>
      <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-rule bg-sheet">
        <CoachThread wide />
      </section>
    </div>
  )
}
