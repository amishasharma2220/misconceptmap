import { describe, expect, test } from 'vitest'
import { bktUpdate, dueLabel, formatClock, sessionRequest } from './practiceLogic'

describe('bktUpdate', () => {
  test('a correct answer raises mastery and a wrong one lowers it', () => {
    expect(bktUpdate(0.4, true)).toBeGreaterThan(0.4)
    expect(bktUpdate(0.4, false)).toBeLessThan(0.4)
  })

  test('matches the hand-worked BKT values', () => {
    // P(L|correct) = 0.2*0.9 / (0.2*0.9 + 0.8*0.25) = 0.4737; + (1-0.4737)*0.15
    expect(bktUpdate(0.2, true)).toBeCloseTo(0.5526, 3)
    // P(L|wrong) = 0.2*0.1 / (0.2*0.1 + 0.8*0.75) = 0.03226; + (1-0.03226)*0.15
    expect(bktUpdate(0.2, false)).toBeCloseTo(0.1774, 3)
  })

  test('stays inside (0, 1)', () => {
    expect(bktUpdate(0.99, true)).toBeLessThanOrEqual(0.99)
    expect(bktUpdate(0.01, false)).toBeGreaterThan(0)
  })
})

describe('sessionRequest', () => {
  const req = (q: string) => sessionRequest(new URLSearchParams(q))
  test('explicit ids become a questions session, ignoring junk', () => {
    expect(req('q=103,x,101')).toEqual({ mode: 'questions', questions: [103, 101] })
  })
  test('concept, review and subject', () => {
    expect(req('concept=heap-sort')).toMatchObject({ mode: 'concept', concept: 'heap-sort' })
    expect(req('mode=review&subject=DSA')).toMatchObject({ mode: 'review', subject: 'DSA' })
    expect(req('subject=OS')).toMatchObject({ mode: 'adaptive', subject: 'OS' })
  })
  test('defaults to adaptive', () => {
    expect(req('')).toEqual({ mode: 'adaptive', subject: undefined, size: 10 })
  })
})

test('dueLabel', () => {
  const now = Date.parse('2026-11-10T09:00:00Z')
  expect(dueLabel('2026-11-11T09:00:00Z', now)).toBe('tomorrow')
  expect(dueLabel('2026-11-13T09:00:00Z', now)).toBe('in 3 days')
  expect(dueLabel('2026-11-10T14:00:00Z', now)).toBe('in 5 hours')
})

test('formatClock pads seconds', () => {
  expect(formatClock(65)).toBe('1:05')
})
