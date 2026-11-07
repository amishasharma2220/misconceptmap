// Shapes for the student-facing screens. The backend will return these same shapes;
// until those endpoints exist, src/data/sample.ts provides realistic sample values.

export type SubjectCode = 'DSA' | 'OS' | 'DBMS'

export type Subject = { code: SubjectCode; name: string; short: string }

export type StudentConcept = {
  slug: string
  name: string
  subject: SubjectCode
  description: string
  prereqs: string[]
  /** 0..1, or null if never practised */
  mastery: number | null
  attempts: number
  accuracy: number | null
  lastPractisedDays: number | null
  /** mastery at the end of each of the last 7 days (oldest first) */
  trend: number[]
}

export type StudentMisconception = {
  id: number
  slug: string
  title: string
  explanation: string
  example?: string
  concept: string
  hits: number
  lastSeenDays: number
}

export type OptionLabel = 'A' | 'B' | 'C' | 'D'

export type PracticeQuestion = {
  id: number
  subject: SubjectCode
  concept: string
  alsoTests: string[]
  source: string
  difficulty: 1 | 2 | 3 | 4 | 5
  stem: string
  options: { label: OptionLabel; text: string; correct: boolean; misconception?: number }[]
  explanation: string
  whyPicked: string
}

export type SessionRecord = {
  id: number
  date: string
  subject: SubjectCode
  mode: 'Adaptive' | 'Review' | 'Concept'
  questions: number
  correct: number
  minutes: number
  masteryDelta: number
}

export type DailyActivity = { date: string; questions: number; accuracy: number }

export type ReviewItem = {
  questionId: number
  stem: string
  concept: string
  timesWrong: number
  lastAnsweredDays: number
  dueInHours: number
}

export type StudentSnapshot = {
  subjects: Subject[]
  concepts: StudentConcept[]
  misconceptions: StudentMisconception[]
  questions: PracticeQuestion[]
  sessions: SessionRecord[]
  daily: DailyActivity[]
  review: ReviewItem[]
  totals: {
    answered: number
    answeredThisWeek: number
    streakDays: number
    avgSecondsPerQuestion: number
  }
  gateDate: string
}
