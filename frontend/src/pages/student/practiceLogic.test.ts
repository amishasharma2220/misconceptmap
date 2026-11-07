import { describe, expect, test } from 'vitest'
import { sample } from '../../data/sample'
import { bktUpdate, formatClock, pickQuestions } from './practiceLogic'

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

describe('pickQuestions', () => {
  test('explicit ids keep their order and skip unknown ones', () => {
    const { questions } = pickQuestions(sample.questions, new URLSearchParams('q=103,999,101'))
    expect(questions.map((q) => q.id)).toEqual([103, 101])
  })

  test('a concept picks questions that test it, primary or secondary', () => {
    const { questions, title } = pickQuestions(sample.questions, new URLSearchParams('concept=heap-sort'))
    expect(title).toBe('Concept practice')
    expect(questions.every((q) => q.concept === 'heap-sort' || q.alsoTests.includes('heap-sort'))).toBe(true)
  })

  test('falls back to the adaptive set', () => {
    expect(pickQuestions(sample.questions, new URLSearchParams()).questions).toHaveLength(sample.questions.length)
  })
})

test('formatClock pads seconds', () => {
  expect(formatClock(65)).toBe('1:05')
})
