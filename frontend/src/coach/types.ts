// What the coach can reply with. The backend coach endpoint will return these same shapes.

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
  card?: CoachCard
}

/** What the student is looking at, so replies can be specific. */
export type ScreenContext = {
  label: string
  questionId?: number
  answered?: boolean
  pickedLabel?: string
  concept?: string
}
