// Pure logic for a practice session, kept apart from the UI so it can be unit-tested.
import type { OptionLabel, PracticeQuestion } from '../../data/types'

/** Bayesian Knowledge Tracing update (same defaults the backend will use). */
export function bktUpdate(
  p: number,
  correct: boolean,
  { learn = 0.15, slip = 0.1, guess = 0.25 } = {},
): number {
  const posterior = correct
    ? (p * (1 - slip)) / (p * (1 - slip) + (1 - p) * guess)
    : (p * slip) / (p * slip + (1 - p) * (1 - guess))
  return Math.min(0.99, posterior + (1 - posterior) * learn)
}

/** Which questions a session should contain, from the URL. */
export function pickQuestions(
  all: PracticeQuestion[],
  params: URLSearchParams,
): { questions: PracticeQuestion[]; title: string } {
  const ids = params.get('q')
  if (ids) {
    const wanted = ids.split(',').map(Number)
    const qs = wanted.map((id) => all.find((q) => q.id === id)).filter((q): q is PracticeQuestion => !!q)
    if (qs.length) return { questions: qs, title: qs.length === 1 ? 'Single question' : 'Recommended set' }
  }
  const concept = params.get('concept')
  if (concept) {
    const qs = all.filter((q) => q.concept === concept || q.alsoTests.includes(concept))
    if (qs.length) return { questions: qs, title: 'Concept practice' }
  }
  return { questions: all, title: 'Adaptive session' }
}

export type Answer = { label: OptionLabel; correct: boolean; seconds: number; before: number; after: number }

export type SessionResult = {
  title: string
  seconds: number
  items: { question: PracticeQuestion; answer: Answer | null }[]
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
