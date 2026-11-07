import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStudent } from '../data/student'
import { sampleReply } from './sampleCoach'
import type { CoachMessage, ScreenContext } from './types'

type CoachState = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  messages: CoachMessage[]
  thinking: boolean
  send: (text: string) => void
  clear: () => void
  screen: ScreenContext
  setScreen: (s: ScreenContext) => void
}

const Ctx = createContext<CoachState | null>(null)
const STORE = 'mm.coach.thread'

function load(): CoachMessage[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) ?? '[]')
  } catch {
    return []
  }
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const { data } = useStudent()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<CoachMessage[]>(load)
  const [thinking, setThinking] = useState(false)
  const [screen, setScreen] = useState<ScreenContext>({ label: 'Dashboard' })
  const screenRef = useRef(screen)
  useEffect(() => {
    screenRef.current = screen
  }, [screen])

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-40)))
    } catch {
      /* storage unavailable: keep the thread in memory only */
    }
  }, [messages])

  const send = useCallback(
    (text: string) => {
      const clean = text.trim()
      if (!clean) return
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: clean }])
      setThinking(true)
      // Simulated latency so the UI behaves like the real endpoint will.
      window.setTimeout(() => {
        setMessages((m) => [...m, sampleReply(clean, screenRef.current, data)])
        setThinking(false)
      }, 650)
    },
    [data],
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
      clear: () => setMessages([]),
      screen,
      setScreen,
    }),
    [open, messages, thinking, send, screen],
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
