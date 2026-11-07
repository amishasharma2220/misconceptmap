import { describe, expect, test } from 'vitest'
import type { Draft } from '../../api/types'
import {
  addOption,
  applyDraft,
  emptyForm,
  removeLastOption,
  sameForm,
  setPrimary,
  setQType,
  toggleCorrect,
  toggleSecondary,
  toPayload,
  updateOption,
} from './editorState'

const correct = (f: ReturnType<typeof emptyForm>) =>
  f.options.filter((o) => o.is_correct).map((o) => o.label)

describe('marking the correct answer', () => {
  test('MCQ bubbles behave like radio buttons', () => {
    let f = toggleCorrect(emptyForm(), 'B')
    expect(correct(f)).toEqual(['B'])
    f = toggleCorrect(f, 'C')
    expect(correct(f)).toEqual(['C'])
  })

  test('MSQ bubbles behave like checkboxes', () => {
    let f = setQType(emptyForm(), 'MSQ')
    f = toggleCorrect(toggleCorrect(f, 'A'), 'D')
    expect(correct(f)).toEqual(['A', 'D'])
  })

  test('switching MSQ to MCQ keeps only the first correct option', () => {
    let f = setQType(emptyForm(), 'MSQ')
    f = toggleCorrect(toggleCorrect(f, 'B'), 'D')
    expect(correct(setQType(f, 'MCQ'))).toEqual(['B'])
  })

  test('marking an option correct clears its misconception', () => {
    let f = updateOption(emptyForm(), 'A', { misconception_id: 7 })
    f = toggleCorrect(f, 'A')
    expect(f.options[0].misconception_id).toBeNull()
  })
})

test('options can be added up to E and removed down to two', () => {
  let f = addOption(emptyForm())
  expect(f.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D', 'E'])
  expect(addOption(f)).toBe(f)
  f = removeLastOption(removeLastOption(removeLastOption(f)))
  expect(f.options).toHaveLength(2)
  expect(removeLastOption(f)).toBe(f)
})

test('primary and secondary concepts never overlap', () => {
  let f = setPrimary(emptyForm(), 10)
  f = toggleSecondary(f, 11)
  f = toggleSecondary(f, 10) // already primary: ignored
  expect(f.concepts).toEqual([
    { concept_id: 10, is_primary: true },
    { concept_id: 11, is_primary: false },
  ])
  f = setPrimary(f, 11) // promote the secondary
  expect(f.concepts).toEqual([{ concept_id: 11, is_primary: true }])
})

test('payload turns blanks into nulls and drops options for NAT', () => {
  const f = { ...setQType(emptyForm(), 'NAT'), nat_answer_min: '2', nat_answer_max: '' }
  const p = toPayload(f)
  expect(p.options).toEqual([])
  expect(p.source).toBeNull()
  expect(p.nat_answer_min).toBe('2')
  expect(p.nat_answer_max).toBeNull()
})

test('applying a draft sets concepts and tags only wrong options', () => {
  let f = toggleCorrect(emptyForm(), 'C')
  const draft: Draft = {
    draft_id: 1,
    model: 'fake',
    primary_concept_id: 5,
    secondary_concept_ids: [6],
    options: [
      { label: 'A', misconception_id: null, new_misconception: { concept_id: 6, title: 'x', explanation: 'y', example: null }, reason: '' },
      { label: 'B', misconception_id: 9, new_misconception: null, reason: '' },
      { label: 'C', misconception_id: 9, new_misconception: null, reason: '' },
      { label: 'D', misconception_id: null, new_misconception: null, reason: '' },
    ],
    explanation_md: '',
    warnings: [],
  }
  f = applyDraft(f, draft, { A: 42 })
  expect(f.concepts).toEqual([
    { concept_id: 5, is_primary: true },
    { concept_id: 6, is_primary: false },
  ])
  expect(f.options.map((o) => o.misconception_id)).toEqual([42, 9, null, null])
})

test('sameForm ignores blank-vs-null differences', () => {
  const a = emptyForm()
  expect(sameForm(a, { ...a, source: null })).toBe(true)
  expect(sameForm(a, { ...a, stem_md: 'changed' })).toBe(false)
})
