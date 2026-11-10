import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { apiGet, apiSend } from '../api/client'
import type { ChatOut, CoachMessage, ConversationOut, ScreenContext } from './types'

type CoachState = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  messages: CoachMessage[]
  thinking: boolean
  send: (text: string) => void
  /** start a new conversation */
  clear: () => void
  conversationId: number | null
  openConversation: (id: number) => Promise<void>
  /** true when the backend has an AI key; false = basic coach */
  aiEnabled: boolean | undefined
  screen: ScreenContext
  setScreen: (s: ScreenContext) => void
}

const Ctx = createContext<CoachState | null>(null)
const STORE = 'mm.coach.conversation'
// eslint-disable-next-line react-refresh/only-export-components
export const CONVERSATIONS_KEY = ['coach-conversations']

const tzOffset = () => -new Date().getTimezoneOffset()

function storedId(): number | null {
  try {
    return Number(sessionStorage.getItem(STORE)) || null
  } catch {
    return null
  }
}

function toMessages(c: ConversationOut): CoachMessage[] {
  return c.messages.map((m) => ({ id: String(m.id), role: m.role, text: m.text, card: m.card, source: m.source }))
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [thinking, setThinking] = useState(false)
  const [conversationId, setConversationId] = useState<number | null>(storedId)
  const [screen, setScreen] = useState<ScreenContext>({ label: 'Dashboard' })
  const screenRef = useRef(screen)
  const convRef = useRef(conversationId)
  useEffect(() => {
    screenRef.current = screen
  }, [screen])
  useEffect(() => {
    convRef.current = conversationId
    try {
      if (conversationId) sessionStorage.setItem(STORE, String(conversationId))
      else sessionStorage.removeItem(STORE)
    } catch {
      /* storage unavailable: the conversation is still saved on the server */
    }
  }, [conversationId])

  const status = useQuery({
    queryKey: ['coach-status'],
    queryFn: () => apiGet<{ ai: boolean; model: string | null }>('/coach/status'),
    staleTime: 5 * 60_000,
  })

  const openConversation = useCallback(async (id: number) => {
    const c = await apiGet<ConversationOut>(`/coach/conversations/${id}`)
    setConversationId(c.id)
    setMessages(toMessages(c))
  }, [])

  // Pick up the conversation from this browser tab after a reload.
  const restored = useRef(false)
  useEffect(() => {
    if (restored.current || !conversationId) return
    restored.current = true
    openConversation(conversationId).catch(() => setConversationId(null))
  }, [conversationId, openConversation])

  const send = useCallback(
    (text: string) => {
      const clean = text.trim()
      if (!clean) return
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: clean }])
      setThinking(true)
      const s = screenRef.current
      apiSend<ChatOut>('POST', `/coach/chat?tz=${tzOffset()}`, {
        conversation_id: convRef.current ?? undefined,
        message: clean,
        screen: { label: s.label, question_id: s.questionId, answered: !!s.answered, concept: s.concept },
      })
        .then((out) => {
          setConversationId(out.conversation_id)
          convRef.current = out.conversation_id
          const r = out.message
          setMessages((m) => [...m, { id: String(r.id), role: 'coach', text: r.text, card: r.card, source: r.source }])
          void client.invalidateQueries({ queryKey: CONVERSATIONS_KEY })
        })
        .catch((e: Error) => {
          setMessages((m) => [
            ...m,
            { id: `e${Date.now()}`, role: 'coach', text: `Couldn't reach the coach: ${e.message}`, error: true },
          ])
        })
        .finally(() => setThinking(false))
    },
    [client],
  )

  // Ctrl/Cmd + J toggles the panel anywhere in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<CoachState>(
    () => ({
      open,
      setOpen,
      toggle: () => setOpen((o) => !o),
      messages,
      thinking,
      send,
      clear: () => {
        setMessages([])
        setConversationId(null)
        convRef.current = null
      },
      conversationId,
      openConversation,
      aiEnabled: status.data?.ai,
      screen,
      setScreen,
    }),
    [open, messages, thinking, send, conversationId, openConversation, status.data?.ai, screen],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCoach(): CoachState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCoach must be used inside <CoachProvider>')
  return ctx
}

/** Pages call this to tell the coach what is on screen. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCoachScreen(screen: ScreenContext) {
  const { setScreen } = useCoach()
  const key = JSON.stringify(screen)
  useEffect(() => {
    setScreen(JSON.parse(key))
  }, [key, setScreen])
}
