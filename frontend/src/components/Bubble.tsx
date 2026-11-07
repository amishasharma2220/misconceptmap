/** An OMR answer-sheet bubble. Filled blue = selected, green = correct answer, red ring = wrong pick. */
export function Bubble({
  label,
  filled,
  wrong = false,
  correct = false,
  size = 'md',
}: {
  label: string
  filled: boolean
  wrong?: boolean
  correct?: boolean
  size?: 'sm' | 'md'
}) {
  const dims = size === 'sm' ? 'h-7 w-7 text-sm' : 'h-9 w-9 text-base'
  const tone = correct
    ? 'border-ok bg-ok text-white'
    : filled
      ? 'border-omr bg-omr text-white'
      : wrong
        ? 'border-pen text-pen'
        : 'border-ink-soft/60 text-ink-soft'
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 font-bold ${dims} ${tone}`}
    >
      {label}
    </span>
  )
}
