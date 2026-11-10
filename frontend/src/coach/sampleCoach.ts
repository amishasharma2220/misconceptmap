// Stand-in for the coach endpoint: chooses a reply by keyword and screen context, using the
// student's snapshot. Replace `sampleReply` with a call to POST /coach when it exists.
import { daysUntil, weakest } from '../data/student'
import type { StudentSnapshot } from '../data/types'
import type { CoachMessage, PlanDay, RecommendItem, ScreenContext } from './types'

const CONCEPT_NOTES: Record<string, string> = {
  'master-theorem': `For $T(n) = aT(n/b) + f(n)$ with $a \\ge 1$, $b > 1$, compare $f(n)$ with $n^{\\log_b a}$:

1. **Case 1:** $f(n) = O(n^{\\log_b a - \\epsilon})$ → $T(n) = \\Theta(n^{\\log_b a})$. The leaves dominate.
2. **Case 2:** $f(n) = \\Theta(n^{\\log_b a})$ → $T(n) = \\Theta(n^{\\log_b a} \\log n)$. Every level costs the same, and there are $\\log n$ levels.
3. **Case 3:** $f(n) = \\Omega(n^{\\log_b a + \\epsilon})$ and $af(n/b) \\le cf(n)$ for some $c < 1$ → $T(n) = \\Theta(f(n))$. The root dominates.

Your most common slip here is dropping the $\\log n$ in case 2: $T(n) = 2T(n/2) + n$ is $\\Theta(n \\log n)$, not $\\Theta(n)$.

It does **not** apply when the gap is not polynomial, e.g. $T(n) = 2T(n/2) + n/\\log n$.`,
  'sorting-stability-inplace': `**Stable** means equal keys keep their input order. **In-place** means $O(1)$ (or $O(\\log n)$) extra space. They are independent:

- Merge sort: stable, not in-place ($O(n)$ extra).
- Heap sort: in-place, **not** stable.
- Quicksort: in-place (stack aside), not stable.
- Insertion sort: both stable and in-place.

A quick test: if the algorithm ever swaps elements that are far apart, assume it is not stable.`,
  tlb: `Effective access time with one-level paging:

$$EAT = h(t_{TLB} + m) + (1-h)(t_{TLB} + 2m)$$

A TLB **miss** costs one extra memory access to read the page table. It is **not** a page fault; a page fault only happens when the page itself is not in memory.`,
}

const pick = <T,>(xs: T[], n: number) => xs.slice(0, n)

function recommend(s: StudentSnapshot): RecommendItem[] {
  const name = (slug: string) => s.concepts.find((c) => c.slug === slug)?.name ?? slug
  const fromReview = s.review
    .filter((r) => s.questions.some((q) => q.id === r.questionId))
    .slice(0, 2)
    .map((r) => ({
      questionId: r.questionId,
      stem: r.stem,
      concept: name(r.concept),
      reason: `You got this wrong ${r.timesWrong} time${r.timesWrong > 1 ? 's' : ''}`,
      difficulty: s.questions.find((q) => q.id === r.questionId)!.difficulty ?? 3,
    }))
  const used = new Set(fromReview.map((r) => r.questionId))
  const weakSlugs = new Set(weakest(s.concepts, 8).map((c) => c.slug))
  const fromWeak = s.questions
    .filter((q) => !used.has(q.id) && weakSlugs.has(q.concept))
    .map((q) => ({
      questionId: q.id,
      stem: q.stem.replace(/\$|\*\*/g, ''),
      concept: name(q.concept),
      reason: `Practises ${name(q.concept)}, one of your weakest concepts`,
      difficulty: q.difficulty ?? 3,
    }))
  return pick([...fromReview, ...fromWeak], 4)
}

function plan(s: StudentSnapshot): PlanDay[] {
  const weak = weakest(s.concepts, 14).map((c) => c.name)
  const labels = ['Today', 'Tomorrow', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu']
  return labels.map((day, i) => ({
    day,
    concepts: i === 6 ? ['Mixed mock: all weak concepts'] : weak.slice(i * 2, i * 2 + 2),
    questions: i === 6 ? 30 : 15 + (i % 3) * 5,
    reviews: i < 2 ? s.review.filter((r) => r.dueInHours <= (i + 1) * 24).length : 3 + (i % 2),
  }))
}

let n = 0
const id = () => `c${Date.now()}-${n++}`

export function sampleReply(input: string, ctx: ScreenContext, s: StudentSnapshot): CoachMessage {
  const t = input.toLowerCase()
  const conceptName = (slug: string) => s.concepts.find((c) => c.slug === slug)?.name ?? slug

  // 1. Hints and mistake explanations about the question on screen
  if (ctx.questionId && ctx.concept && /hint|why|wrong|mistake|stuck|explain (this|my)|help/.test(t)) {
    const concept = ctx.concept
    const mis = ctx.misconception
    if (!ctx.answered) {
      return {
        id: id(),
        role: 'coach',
        text: "Here's a hint. I won't reveal the answer until you submit.",
        card: {
          kind: 'mistake',
          hintOnly: true,
          concept: conceptName(concept),
          steps: hintFor(concept),
        },
      }
    }
    return {
      id: id(),
      role: 'coach',
      text: ctx.correct
        ? 'You got this one right. Here is why it works, so it sticks.'
        : `Let's look at why ${ctx.pickedLabel ? `option ${ctx.pickedLabel}` : 'that answer'} doesn't work.`,
      card: {
        kind: 'mistake',
        hintOnly: false,
        concept: conceptName(concept),
        misconceptionTitle: mis?.title,
        steps: [...(mis ? [mis.explanation] : []), ...(ctx.explanation ? [ctx.explanation] : [])],
        similarQuestionId: s.questions.find(
          (x) => x.id !== ctx.questionId && (x.concept === concept || x.alsoTests.includes(concept)),
        )?.id,
      },
    }
  }

  // 2. Study plan
  if (/plan|week|schedule|timetable/.test(t)) {
    return {
      id: id(),
      role: 'coach',
      text: 'Here is a 7-day plan built from your weakest concepts and what is due for review.',
      card: { kind: 'plan', days: plan(s), daysToGate: daysUntil(s.gateDate) },
    }
  }

  // 3. Concept explanations
  const asked = s.concepts.find((c) => t.includes(c.name.toLowerCase()) || t.includes(c.slug.replace(/-/g, ' ')))
  if (/explain|what is|what's|how does|teach|difference/.test(t) || (asked && !/practi|recommend/.test(t))) {
    const slug = asked?.slug ?? ctx.concept ?? 'master-theorem'
    const c = s.concepts.find((x) => x.slug === slug)
    return {
      id: id(),
      role: 'coach',
      text: `Here's ${c?.name ?? 'that concept'} in short.`,
      card: {
        kind: 'concept',
        concept: slug,
        markdown: CONCEPT_NOTES[slug] ?? `${c?.description ?? ''}\n\nI don't have a worked note for this concept yet. Practising it is the fastest way to find your gaps.`,
      },
    }
  }

  // 4. Question recommendations (default for "what should I do")
  if (/practi|recommend|question|today|next|revise|what should/.test(t)) {
    return {
      id: id(),
      role: 'coach',
      text: 'These target your mistakes and the prerequisites that are holding other concepts back.',
      card: { kind: 'recommend', items: recommend(s) },
    }
  }

  return {
    id: id(),
    role: 'coach',
    text: 'I can recommend questions from your mistakes, give a hint on the current question, explain why an answer was wrong, make a study plan, or explain a GATE CS concept. Try one of the suggestions below.',
  }
}

function hintFor(concept: string): string[] {
  const hints: Record<string, string[]> = {
    'sorting-stability-inplace': [
      'Stability is about equal keys keeping their input order.',
      'For each option, ask: does it ever swap two elements that are far apart?',
    ],
    'master-theorem': ['Write down $a$, $b$ and compute $n^{\\log_b a}$.', 'Compare it with $f(n)$. Which case are you in?'],
    'binary-heaps': ['Most nodes in a heap are near the bottom.', 'How much work does heapify do on a node at height $h$?'],
    tlb: ['Split the access into the hit case and the miss case.', 'On a miss, how many memory accesses do you need?'],
    serializability: ['Recall which of the two conditions is stricter.', 'Blind writes are the key difference.'],
  }
  return hints[concept] ?? ['Re-read what the question is really asking.', 'Eliminate options you can rule out with one counter-example.']
}

export function suggestionsFor(ctx: ScreenContext): string[] {
  if (ctx.questionId)
    return ctx.answered
      ? ['Why was my answer wrong?', 'Explain this concept simply', 'What should I practise next?']
      : ["Give me a hint, don't reveal the answer", 'Explain this concept simply', 'What should I practise next?']
  if (/review/i.test(ctx.label)) return ['Which of these should I review first?', 'Make me a plan for this week', 'Explain the master theorem simply']
  return ['What should I practise today?', 'Make me a plan for this week', 'Explain the master theorem simply', 'Why do I keep getting TLB questions wrong?']
}
