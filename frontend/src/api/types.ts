export type Role = 'student' | 'admin'
export type QType = 'MCQ' | 'MSQ' | 'NAT'
export type QStatus = 'draft' | 'approved' | 'retired'
export type Label = 'A' | 'B' | 'C' | 'D' | 'E'

export type User = {
  id: number
  email: string
  display_name: string | null
  role: Role
  consent_research: boolean
}

export type TokenOut = { access_token: string; token_type: string; user: User }

export type Subject = { id: number; code: string; name: string }

export type Concept = {
  id: number
  subject_code: string
  slug: string
  name: string
  description: string | null
  difficulty: number | null
  prereqs: string[]
}

export type Misconception = {
  id: number
  concept_id: number
  slug: string
  title: string
  explanation: string
  example: string | null
}

export type OptionIn = {
  label: Label
  text_md: string
  is_correct: boolean
  misconception_id: number | null
}

export type QuestionConcept = { concept_id: number; is_primary: boolean }

export type QuestionIn = {
  qtype: QType
  stem_md: string
  explanation_md: string | null
  source: string | null
  difficulty: number | null
  nat_answer_min: string | null
  nat_answer_max: string | null
  options: OptionIn[]
  concepts: QuestionConcept[]
}

export type Question = QuestionIn & {
  id: number
  status: QStatus
  options: (OptionIn & { id: number })[]
  has_draft: boolean
}

export type QuestionSummary = {
  id: number
  qtype: QType
  stem_preview: string
  source: string | null
  status: QStatus
  primary_concept: string | null
  n_tagged_options: number
}

export type ProposedMisconception = {
  concept_id: number
  title: string
  explanation: string
  example: string | null
}

export type DraftOption = {
  label: Label
  misconception_id: number | null
  new_misconception: ProposedMisconception | null
  reason: string
}

export type Draft = {
  draft_id: number
  model: string
  primary_concept_id: number | null
  secondary_concept_ids: number[]
  options: DraftOption[]
  explanation_md: string
  warnings: string[]
}

export type ApproveOut = { question: Question; draft_accepted_unchanged: boolean | null }
