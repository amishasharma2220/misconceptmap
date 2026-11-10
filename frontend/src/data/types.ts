// Shapes for the student-facing screens, as returned by GET /me/snapshot.
// src/data/sample.ts holds a sample student in the same shape for the landing page and tests.

/** Subject code from the backend, e.g. 'DSA'. */
export type SubjectCode = string

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
  lastSeenDays: number | null
}

export type OptionLabel = 'A' | 'B' | 'C' | 'D' | 'E'

/** A question as listed in the snapshot: no options, no answer. */
export type QuestionPreview = {
  id: number
  subject: SubjectCode
  concept: string
  alsoTests: string[]
  difficulty: number | null
  source: string | null
  stem: string
}

/** A complete question with answers; only used by the landing-page demo. */
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
  mode: 'Adaptive' | 'Review' | 'Concept' | 'Set'
  title: string
  questions: number
  correct: number
  minutes: number
  masteryDelta: number
}

/** accuracy is null on days with no questions answered */
export type DailyActivity = { date: string; questions: number; accuracy: number | null }

export type ReviewItem = {
  questionId: number
  stem: string
  concept: string
  timesWrong: number
  lastAnsweredDays: number | null
  /** negative = overdue */
  dueInHours: number
}

export type StudentSnapshot = {
  subjects: Subject[]
  concepts: StudentConcept[]
  misconceptions: StudentMisconception[]
  questions: QuestionPreview[]
  sessions: SessionRecord[]
  daily: DailyActivity[]
  review: ReviewItem[]
  totals: {
    answered: number
    answeredThisWeek: number
    streakDays: number
    avgSecondsPerQuestion: number | null
  }
  byDifficulty: { level: string; questions: number; accuracy: number | null }[]
  timeBuckets: { bucket: string; questions: number }[]
  gateDate: string
}
