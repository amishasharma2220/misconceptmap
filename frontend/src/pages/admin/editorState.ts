// Pure helpers for the question editor, kept separate so they can be unit-tested.
import type { Draft, Label, OptionIn, QType, Question, QuestionIn } from '../../api/types'

export const LABELS: Label[] = ['A', 'B', 'C', 'D', 'E']

export type Form = QuestionIn

export function emptyForm(): Form {
  return {
    qtype: 'MCQ',
    stem_md: '',
    explanation_md: '',
    source: '',
    difficulty: null,
    nat_answer_min: null,
    nat_answer_max: null,
    options: LABELS.slice(0, 4).map((label) => ({
      label,
      text_md: '',
      is_correct: false,
      misconception_id: null,
    })),
    concepts: [],
  }
}

export function fromQuestion(q: Question): Form {
  return {
    qtype: q.qtype,
    stem_md: q.stem_md,
    explanation_md: q.explanation_md ?? '',
    source: q.source ?? '',
    difficulty: q.difficulty,
    nat_answer_min: q.nat_answer_min,
    nat_answer_max: q.nat_answer_max,
    options: q.options.map(({ label, text_md, is_correct, misconception_id }) => ({
      label,
      text_md,
      is_correct,
      misconception_id,
    })),
    concepts: q.concepts,
  }
}

/** What the API expects: empty strings become null, NAT has no options. */
export function toPayload(f: Form): QuestionIn {
  const blank = (s: string | null) => (s && s.trim() ? s : null)
  return {
    ...f,
    explanation_md: blank(f.explanation_md),
    source: blank(f.source),
    nat_answer_min: f.qtype === 'NAT' ? blank(f.nat_answer_min) : null,
    nat_answer_max: f.qtype === 'NAT' ? blank(f.nat_answer_max) : null,
    options: f.qtype === 'NAT' ? [] : f.options,
  }
}

export function setQType(f: Form, qtype: QType): Form {
  let options = f.options
  if (qtype === 'MCQ') {
    // keep at most one correct option
    let seen = false
    options = options.map((o) => {
      if (o.is_correct && !seen) {
        seen = true
        return o
      }
      return { ...o, is_correct: false }
    })
  }
  if (qtype !== 'NAT' && options.length === 0) options = emptyForm().options
  return { ...f, qtype, options }
}

/** Clicking a bubble: MCQ behaves like a radio, MSQ like a checkbox. */
export function toggleCorrect(f: Form, label: Label): Form {
  return {
    ...f,
    options: f.options.map((o): OptionIn => {
      const isThis = o.label === label
      const is_correct = f.qtype === 'MCQ' ? isThis && !o.is_correct : isThis ? !o.is_correct : o.is_correct
      // a correct option cannot carry a misconception
      return { ...o, is_correct, misconception_id: is_correct ? null : o.misconception_id }
    }),
  }
}

export function updateOption(f: Form, label: Label, patch: Partial<OptionIn>): Form {
  return { ...f, options: f.options.map((o) => (o.label === label ? { ...o, ...patch } : o)) }
}

export function addOption(f: Form): Form {
  if (f.options.length >= LABELS.length) return f
  const label = LABELS[f.options.length]
  return {
    ...f,
    options: [...f.options, { label, text_md: '', is_correct: false, misconception_id: null }],
  }
}

/** Remove the last option (labels stay contiguous A, B, C…). */
export function removeLastOption(f: Form): Form {
  return f.options.length <= 2 ? f : { ...f, options: f.options.slice(0, -1) }
}

export function setPrimary(f: Form, conceptId: number | null): Form {
  const others = f.concepts.filter((c) => !c.is_primary && c.concept_id !== conceptId)
  return {
    ...f,
    concepts: conceptId == null ? others : [{ concept_id: conceptId, is_primary: true }, ...others],
  }
}

export function toggleSecondary(f: Form, conceptId: number): Form {
  const has = f.concepts.some((c) => c.concept_id === conceptId && !c.is_primary)
  if (f.concepts.some((c) => c.concept_id === conceptId && c.is_primary)) return f
  return {
    ...f,
    concepts: has
      ? f.concepts.filter((c) => c.concept_id !== conceptId)
      : [...f.concepts, { concept_id: conceptId, is_primary: false }],
  }
}

/**
 * Apply an AI draft. `createdIds` maps option label -> id of a misconception that was
 * created from that option's proposal (the caller creates them via the API first).
 */
export function applyDraft(f: Form, d: Draft, createdIds: Partial<Record<Label, number>>): Form {
  const concepts =
    d.primary_concept_id == null
      ? f.concepts
      : [
          { concept_id: d.primary_concept_id, is_primary: true },
          ...d.secondary_concept_ids.map((id) => ({ concept_id: id, is_primary: false })),
        ]
  const byLabel = new Map(d.options.map((o) => [o.label, o]))
  const options = f.options.map((o) => {
    const p = byLabel.get(o.label)
    if (!p || o.is_correct) return o
    return { ...o, misconception_id: createdIds[o.label] ?? p.misconception_id ?? null }
  })
  return { ...f, concepts, options }
}

export function sameForm(a: Form, b: Form): boolean {
  return JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b))
}
