/** Wordmark: a filled answer bubble beside the name. */
export function Logo({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-omr bg-omr text-[13px] font-bold text-white"
      >
        M
      </span>
      {!compact && (
        <span className={`text-[17px] font-bold tracking-tight ${inverted ? 'text-white' : 'text-ink'}`}>
          Misconcept<span className={inverted ? 'text-[#9db6f2]' : 'text-omr'}>Map</span>
        </span>
      )}
    </span>
  )
}
