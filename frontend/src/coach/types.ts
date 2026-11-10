// What the coach can reply with: the same shapes as backend/app/coach/cards.py.

export type RecommendItem = {
  questionId: number
  stem: string
  concept: string
  reason: string
  difficulty: number
}

export type PlanDay = { day: string; concepts: string[]; questions: number; reviews: number }

export type CoachCard =
  | { kind: 'recommend'; items: RecommendItem[] }
  | {
      kind: 'mistake'
      hintOnly: boolean
      concept: string
      misconceptionTitle?: string
      steps: string[]
      similarQuestionId?: number
    }
  | { kind: 'plan'; days: PlanDay[]; daysToGate: number }
  | { kind: 'concept'; concept: string; markdown: string }

export type CoachMessage = {
  id: string
  role: 'user' | 'coach'
  text: string
  card?: CoachCard | null
  /** 'ai' = written by the model; 'basic' = the rule-based coach (no AI key, or the model failed) */
  source?: 'ai' | 'basic' | null
  /** the message could not be sent */
  error?: boolean
}

export type ChatOut = {
  conversation_id: number
  title: string
  message: { id: number; role: 'coach'; text: string; card: CoachCard | null; source: 'ai' | 'basic' | null; created_at: string }
}

export type ConversationSummary = { id: number; title: string; updated_at: string }

export type ConversationOut = ConversationSummary & {
  messages: { id: number; role: 'user' | 'coach'; text: string; card: CoachCard | null; source: 'ai' | 'basic' | null }[]
}

/** What the student is looking at, so replies can be specific. */
export type ScreenContext = {
  label: string
  questionId?: number
  answered?: boolean
  pickedLabel?: string
  concept?: string
  /** after answering: the outcome, so the coach can explain it */
  correct?: boolean
  explanation?: string
  misconception?: { title: string; explanation: string }
}
