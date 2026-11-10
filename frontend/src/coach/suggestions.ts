import type { StudentSnapshot } from '../data/types'
import type { ScreenContext } from './types'

/** Starter prompts for an empty thread, based on the screen and the student's own data. */
export function suggestionsFor(ctx: ScreenContext, data: StudentSnapshot): string[] {
  if (ctx.questionId)
    return ctx.answered
      ? ['Why was my answer wrong?', 'Explain this concept simply', 'What should I practise next?']
      : ["Give me a hint, don't reveal the answer", 'Explain this concept simply', 'What should I practise next?']
  const weakest = data.concepts
    .filter((c) => c.mastery != null)
    .sort((a, b) => a.mastery! - b.mastery!)[0]
  const topMis = [...data.misconceptions].sort((a, b) => b.hits - a.hits).find((m) => m.hits > 0)
  const concept = weakest?.name.replace(/\s*\(.*\)$/, '') ?? 'the master theorem'
  const out = [
    /review/i.test(ctx.label) ? 'Which of these should I review first?' : 'What should I practise today?',
    'Make me a plan for this week',
    `Explain ${concept} simply`,
  ]
  if (topMis) out.push(`Why do I keep thinking "${topMis.title.toLowerCase()}"?`)
  return out
}
