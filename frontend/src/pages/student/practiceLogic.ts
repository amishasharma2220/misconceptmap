// Pure logic for practice sessions, kept apart from the UI so it can be unit-tested.
import type { SessionIn } from '../../api/types'

/**
 * Bayesian Knowledge Tracing update, same defaults as backend/app/engine/bkt.py.
 * The server is the source of truth; this powers the landing-page demo.
 */
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

/**
 * What kind of session to start, from the practice URL:
 *   /practice?q=12,15         a chosen set of questions
 *   /practice?concept=slug    one concept
 *   /practice?mode=review     questions due for review
 *   /practice?subject=DSA     adaptive, limited to a subject
 *   /practice                 adaptive across everything
 */
export function sessionRequest(params: URLSearchParams): SessionIn {
  const ids = (params.get('q') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
  if (ids.length) return { mode: 'questions', questions: ids }
  const concept = params.get('concept')
  if (concept) return { mode: 'concept', concept, size: 8 }
  const subject = params.get('subject') ?? undefined
  if (params.get('mode') === 'review') return { mode: 'review', subject, size: 15 }
  return { mode: 'adaptive', subject, size: 10 }
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** "in 3 days", "tomorrow", "in 5 hours" for a review due date. */
export function dueLabel(iso: string, now = Date.now()): string {
  const hours = Math.round((Date.parse(iso) - now) / 36e5)
  if (hours < 1) return 'now'
  if (hours < 20) return `in ${hours} hours`
  const days = Math.round(hours / 24)
  return days <= 1 ? 'tomorrow' : `in ${days} days`
}
