import { ArrowRight, Check, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bubble } from '../components/Bubble'
import { Logo } from '../components/Logo'
import { Markdown } from '../components/Markdown'
import { MasteryBar, masteryTone, pct, toneBg, toneText } from '../components/ui'
import { sample, sampleQuestions } from '../data/sample'
import { daysUntil } from '../data/student'
import type { OptionLabel } from '../data/types'
import { bktUpdate } from './student/practiceLogic'

const YEAR = new Date().getFullYear()
const EASE = [0.22, 1, 0.36, 1] as const
const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const

const nav = [
  ['How it works', '#how'],
  ['Features', '#features'],
  ['AI coach', '#coach'],
  ['FAQ', '#faq'],
]

export function LandingPage() {
  return (
    // Every animation below is skipped for visitors who ask their OS for reduced motion.
    <MotionConfig reducedMotion="user">
      <div className="bg-sheet">
        <Header />
        <Hero />
        <Facts />
        <HowItWorks />
        <Features />
        <CoachSection />
        <Syllabus />
        <Faq />
        <FinalCta />
        <Footer />
      </div>
    </MotionConfig>
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-sheet/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link to="/" aria-label="MisconceptMap home">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden gap-5 text-sm text-ink-soft md:flex">
          {nav.map(([label, href]) => (
            <a key={href} href={href} className="hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/login" className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:text-ink">
            Sign in
          </Link>
          <Link to="/signup" className="rounded-md bg-omr px-3 py-1.5 text-sm font-bold text-white hover:bg-omr/90">
            Create account
          </Link>
        </div>
      </div>
    </header>
  )
}

/* ================================================================== hero */

const reveal = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.6, ease: EASE } }),
}

function Hero() {
  return (
    <section className="border-b border-rule bg-paper">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 lg:grid-cols-[1fr_1.05fr] lg:py-20">
        <motion.div initial="hidden" animate="show">
          <motion.p custom={0} variants={reveal} className="mb-4 text-sm font-bold text-omr">
            GATE Computer Science practice
          </motion.p>
          <h1 className="text-[2.6rem] font-bold leading-[1.04] tracking-tight sm:text-6xl">
            <motion.span custom={1} variants={reveal} className="block">
              Find out why
            </motion.span>{' '}
            <motion.span custom={2} variants={reveal} className="block">
              you got it wrong.
            </motion.span>
          </h1>
          <motion.p custom={3} variants={reveal} className="mt-6 max-w-xl text-lg text-ink-soft">
            Every wrong option is tagged with the belief that leads to it. MisconceptMap shows you that belief,
            tracks how well you know each concept, and picks your next question from the prerequisite holding you
            back.
          </motion.p>
          <motion.div custom={4} variants={reveal} className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-md bg-omr px-5 py-3 font-bold text-white hover:bg-omr/90"
            >
              Start practising free <ArrowRight size={18} />
            </Link>
            <a href="#how" className="rounded-md border border-rule bg-sheet px-5 py-3 font-bold hover:border-ink-faint">
              See how it works
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: EASE }}
          className="min-w-0"
        >
          <TryIt />
        </motion.div>
      </div>
    </section>
  )
}

/** A real question you can answer in the hero. */
const DEMO_IDS = [101, 102, 104]

function TryIt() {
  const [qi, setQi] = useState(0)
  const [picked, setPicked] = useState<OptionLabel | null>(null)
  const q = sampleQuestions.find((x) => x.id === DEMO_IDS[qi])!
  const concept = sample.concepts.find((c) => c.slug === q.concept)!
  const before = concept.mastery ?? 0.3
  const choice = picked ? q.options.find((o) => o.label === picked)! : null
  const after = choice ? bktUpdate(before, choice.correct) : before
  const mis = choice?.misconception ? sample.misconceptions.find((m) => m.id === choice.misconception) : undefined

  const nextQuestion = () => {
    setPicked(null)
    setQi((i) => (i + 1) % DEMO_IDS.length)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-rule bg-sheet shadow-[0_1px_0_rgba(26,34,50,0.04),0_24px_48px_-24px_rgba(26,34,50,0.25)]">
      <div className="flex items-center gap-2 border-b border-rule-soft px-5 py-2.5 text-xs">
        <span className="font-bold">Try it</span>
        <span className="text-ink-soft">a real question from the app</span>
        <span className="ml-auto text-ink-faint">
          {qi + 1} of {DEMO_IDS.length}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.25 }}
          className="space-y-4 p-5"
        >
          <Markdown className="text-[15px]">{q.stem}</Markdown>
          <ul className="space-y-2" role="radiogroup" aria-label="Answer options">
            {q.options.map((o) => {
              const isPicked = picked === o.label
              const showCorrect = !!picked && o.correct
              const showWrong = isPicked && !o.correct
              return (
                <li key={o.label}>
                  <motion.button
                    role="radio"
                    aria-checked={isPicked}
                    disabled={!!picked}
                    onClick={() => setPicked(o.label)}
                    whileTap={picked ? undefined : { scale: 0.985 }}
                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                      showCorrect
                        ? 'border-ok/50 bg-ok-tint'
                        : showWrong
                          ? 'border-pen/50 bg-pen-tint/40'
                          : picked
                            ? 'border-rule opacity-60'
                            : 'border-rule hover:border-omr hover:bg-omr-tint/40'
                    }`}
                  >
                    <motion.span
                      animate={isPicked || showCorrect ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                      transition={{ duration: 0.35 }}
                    >
                      <Bubble label={o.label} filled={false} correct={showCorrect} wrong={showWrong} size="sm" />
                    </motion.span>
                    <Markdown className="flex-1">{o.text}</Markdown>
                  </motion.button>
                  <AnimatePresence>
                    {showWrong && mis && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        transition={SPRING}
                        className="ml-10 overflow-hidden border-l-2 border-pen pl-2 text-sm font-bold text-pen"
                      >
                        <span className="block pt-1.5">You may believe: {mis.title.replace(/^Believes /, '')}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </li>
              )
            })}
          </ul>

          <div className="rounded-md bg-paper px-3 py-2.5">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-soft">{concept.name}</span>
              <span className={`tnum font-bold ${toneText[masteryTone(after)]}`}>
                {picked ? `${pct(before)} → ${pct(after)}` : `${pct(before)} mastery`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-rule-soft">
              <motion.div
                className={`h-full rounded-full ${toneBg[masteryTone(after)]}`}
                initial={false}
                animate={{ width: `${after * 100}%` }}
                transition={SPRING}
              />
            </div>
          </div>

          <div className="flex min-h-9 flex-wrap items-center gap-3 text-sm">
            {!picked ? (
              <span className="text-ink-soft">Pick an answer to see what happens.</span>
            ) : (
              <>
                <span className={choice?.correct ? 'font-bold text-ok' : 'font-bold text-pen'}>
                  {choice?.correct ? 'Correct.' : mis ? 'Wrong, and now you know why.' : 'Not quite.'}
                </span>
                <button onClick={nextQuestion} className="ml-auto inline-flex items-center gap-1.5 text-omr hover:underline">
                  <RotateCcw size={14} /> Try another
                </button>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Facts() {
  const dsa = sample.concepts.filter((c) => c.subject === 'DSA').length
  const facts = [
    [`${dsa}`, 'DSA concepts mapped with their prerequisites'],
    ['Every', 'wrong option tagged with the belief behind it'],
    ['3', 'GATE CS subjects in the first release'],
    ['Free', 'while MisconceptMap is in beta'],
  ]
  return (
    <section className="border-b border-rule">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-rule lg:grid-cols-4">
        {facts.map(([n, label]) => (
          <div key={label} className="bg-sheet px-6 py-6">
            <dt className="text-2xl font-bold text-omr">{n}</dt>
            <dd className="mt-1 text-sm text-ink-soft">{label}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* ================================================================== how it works: scroll-linked */

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.55'] })
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const [active, setActive] = useState(0)
  useMotionValueEvent(progress, 'change', (v) => setActive(v < 0.2 ? 0 : v < 0.6 ? 1 : 2))

  const steps: { title: string; text: string; art: ReactNode }[] = [
    {
      title: 'Answer a GATE question',
      text: 'Past-paper style MCQs with maths rendered properly and a timer, one at a time.',
      art: (
        <div className="flex gap-2">
          {(['A', 'B', 'C', 'D'] as const).map((l) => (
            <Bubble key={l} label={l} filled={l === 'B'} size="sm" />
          ))}
        </div>
      ),
    },
    {
      title: 'See the belief behind your mistake',
      text: 'A wrong pick shows the specific misconception it reveals, why it is wrong, and a counter-example.',
      art: <p className="border-l-2 border-pen pl-2 text-sm font-bold text-pen">Drops the log factor in master theorem case 2</p>,
    },
    {
      title: 'Practise the weakest prerequisite next',
      text: 'Mastery is tracked per concept, and the next question targets what is holding the others back.',
      art: (
        <div className="w-full space-y-1.5">
          <MasteryBar value={0.29} />
          <MasteryBar value={0.52} />
          <MasteryBar value={0.86} />
        </div>
      ),
    },
  ]

  return (
    <section id="how" className="scroll-mt-16 border-b border-rule">
      <div ref={ref} className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Practice that diagnoses, not just scores</h2>

        <div className="relative mt-12">
          {/* the progress rail: horizontal on wide screens, vertical on phones */}
          <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-rule md:left-4 md:right-4 md:top-[15px] md:bottom-auto md:h-0.5 md:w-auto" aria-hidden>
            <motion.div style={{ scaleY: progress }} className="h-full w-full origin-top bg-omr md:hidden" />
            <motion.div style={{ scaleX: progress }} className="hidden h-full w-full origin-left bg-omr md:block" />
          </div>

          <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
            {steps.map((s, i) => {
              const on = i <= active
              return (
                <li key={s.title} className="flex gap-4 md:block">
                  <span
                    className={`tnum relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors duration-300 ${
                      on ? 'border-omr bg-omr text-white' : 'border-rule bg-sheet text-ink-faint'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="md:mt-5">
                    <div
                      className={`mb-4 flex h-20 items-center rounded-md px-4 transition-colors duration-300 ${on ? 'bg-paper' : 'bg-paper/50 opacity-60'}`}
                    >
                      {s.art}
                    </div>
                    <h3 className="text-lg font-bold">{s.title}</h3>
                    <p className="mt-2 text-ink-soft">{s.text}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== features: previews animate in view */

const inView = { once: true, margin: '-15% 0px' } as const

function Features() {
  const rows: { title: string; text: string; points: string[]; preview: ReactNode }[] = [
    {
      title: 'Feedback that names the mistake',
      text: 'Instead of a red cross, you see the exact belief your answer reveals, with an explanation and an example that breaks it.',
      points: ['Misconceptions written as beliefs you can recognise', 'Full explanation of the correct answer', 'Mastery change shown after every answer'],
      preview: <RedPenPreview />,
    },
    {
      title: 'Mastery for every concept',
      text: 'A knowledge-tracing model updates how well you know each concept after every answer, so weak spots show at a glance.',
      points: ['Per-concept mastery heatmap', 'Accuracy and volume over time', 'Weakest prerequisites ranked'],
      preview: <HeatmapPreview />,
    },
    {
      title: 'A map of what depends on what',
      text: 'GATE topics build on each other. The concept map shows prerequisites, so you fix the root of a problem instead of its symptoms.',
      points: ['Prerequisite graph per subject', 'Coloured by your mastery', 'Practise any concept in one click'],
      preview: <MiniMap />,
    },
    {
      title: 'Mistakes come back before you forget them',
      text: 'Questions you get wrong return on a spaced-repetition schedule, with longer gaps each time you get them right.',
      points: ['Review queue with due times', 'Grows gaps as you improve', 'Review a whole concept at once'],
      preview: <ReviewPreview />,
    },
  ]
  return (
    <section id="features" className="scroll-mt-16 border-b border-rule bg-paper">
      <div className="mx-auto max-w-6xl space-y-20 px-4 py-20">
        {rows.map((r, i) => (
          <div key={r.title} className="grid items-center gap-10 lg:grid-cols-2">
            <div className={`min-w-0 ${i % 2 ? 'lg:order-2' : ''}`}>
              <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{r.title}</h3>
              <p className="mt-3 max-w-lg text-ink-soft">{r.text}</p>
              <ul className="mt-5 space-y-2">
                {r.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-ok" aria-hidden /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0 rounded-xl border border-rule bg-sheet p-5">{r.preview}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

/** The misconception note "writes itself" in red pen. */
function RedPenPreview() {
  return (
    <div className="space-y-3 rounded-lg border border-pen/30 bg-pen-tint/60 p-4">
      <motion.p
        initial={{ clipPath: 'inset(0 100% 0 0)' }}
        whileInView={{ clipPath: 'inset(0 0% 0 0)' }}
        viewport={inView}
        transition={{ duration: 0.9, ease: EASE }}
        className="text-sm font-bold text-pen"
      >
        You may believe a TLB miss is a page fault
      </motion.p>
      <p className="text-sm">
        A miss only means the translation is not cached. The page table is read from memory; the page itself is usually
        still there.
      </p>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-ink-soft">TLB and effective access time</span>
        <motion.span
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inView}
          transition={{ delay: 0.8 }}
          className="tnum font-bold text-pen"
        >
          33% → 27%
        </motion.span>
      </div>
    </div>
  )
}

/** Heatmap cells fill in one by one. */
function HeatmapPreview() {
  const dsa = sample.concepts.filter((c) => c.subject === 'DSA')
  return (
    <div className="rounded-lg border border-rule p-4">
      <p className="mb-3 text-xs text-ink-soft">Data Structures and Algorithms</p>
      <motion.div
        className="grid grid-cols-9 gap-1"
        initial="off"
        whileInView="on"
        viewport={inView}
        variants={{ on: { transition: { staggerChildren: 0.025 } } }}
      >
        {dsa.map((c) => (
          <motion.span
            key={c.slug}
            title={c.name}
            variants={{ off: { opacity: 0.15, scale: 0.6 }, on: { opacity: 1, scale: 1 } }}
            transition={{ duration: 0.3 }}
            className={`h-6 rounded-sm ${toneBg[masteryTone(c.mastery)]}`}
          />
        ))}
      </motion.div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-pen" /> Below 40%</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber" /> 40–70%</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ok" /> Above 70%</span>
      </div>
    </div>
  )
}

/** Prerequisite arrows draw themselves. */
function MiniMap() {
  const nodes = [
    { x: 10, y: 50, label: 'Recurrences', m: 0.52 },
    { x: 150, y: 20, label: 'Master theorem', m: 0.29 },
    { x: 150, y: 90, label: 'Merge sort', m: 0.71 },
    { x: 290, y: 55, label: 'Stability', m: 0.35 },
  ]
  const edges = [
    [0, 1],
    [0, 2],
    [2, 3],
  ]
  const color = { low: '#b42347', mid: '#c07a12', high: '#1d7044', none: '#d6dce6' }
  return (
    <svg viewBox="0 0 420 130" className="w-full" aria-label="Recurrences leads to Master theorem and Merge sort; Merge sort leads to Stability" role="img">
      {edges.map(([a, b], i) => (
        <motion.path
          key={`${a}-${b}`}
          d={`M${nodes[a].x + 120} ${nodes[a].y + 14} L${nodes[b].x} ${nodes[b].y + 14}`}
          stroke="#9aa3b2"
          strokeWidth="1.5"
          fill="none"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={inView}
          transition={{ delay: 0.25 + i * 0.25, duration: 0.5 }}
        />
      ))}
      {nodes.map((n, i) => (
        <motion.g
          key={n.label}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={inView}
          transition={{ delay: i * 0.12 }}
        >
          <rect x={n.x} y={n.y} width="120" height="28" rx="6" fill="#fff" stroke={color[masteryTone(n.m)]} strokeWidth="1.5" />
          <text x={n.x + 10} y={n.y + 18} fontSize="11" fill="#1a2232">
            {n.label}
          </text>
        </motion.g>
      ))}
    </svg>
  )
}

/** Review items slot into the queue. */
function ReviewPreview() {
  return (
    <motion.ul
      className="divide-y divide-rule-soft overflow-hidden rounded-lg border border-rule text-sm"
      initial="off"
      whileInView="on"
      viewport={inView}
      variants={{ on: { transition: { staggerChildren: 0.12 } } }}
    >
      {sample.review.slice(0, 4).map((r) => (
        <motion.li
          key={r.questionId}
          variants={{ off: { opacity: 0, x: 24 }, on: { opacity: 1, x: 0 } }}
          transition={{ duration: 0.4, ease: EASE }}
          className="flex items-center justify-between gap-3 px-4 py-2.5"
        >
          <span className="truncate">{r.stem}</span>
          <span className={`tnum shrink-0 text-xs ${r.dueInHours <= 0 ? 'font-bold text-pen' : 'text-ink-soft'}`}>
            {r.dueInHours <= 0 ? 'Due now' : `in ${r.dueInHours} h`}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  )
}

/* ================================================================== coach: the conversation plays out */

function CoachSection() {
  const items = [
    ['Solve T(n) = 2T(n/2) + n', 'You got this wrong 3 times'],
    ['Which statement about schedules is true?', 'Due for review'],
    ['Worst-case time of bottom-up build-heap', 'Weak prerequisite of Heap sort'],
  ]
  const step = (delay: number) => ({
    initial: { opacity: 0, y: 8 },
    whileInView: { opacity: 1, y: 0 },
    viewport: inView,
    transition: { delay, duration: 0.4, ease: EASE },
  })
  return (
    <section id="coach" className="scroll-mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#9db6f2]">
            <Sparkles size={16} /> Study coach
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">A coach that knows your mistakes</h2>
          <p className="mt-4 max-w-lg text-[#c9d1e1]">
            Open it from any screen. It sees your mastery, your review queue and the question in front of you, so it can
            do more than a general chatbot.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              ['Recommends questions', 'from your wrong answers and weak prerequisites'],
              ['Hints first', 'never reveals the answer before you submit'],
              ['Explains mistakes', 'in simpler words, with a similar question'],
              ['Plans your week', 'around what is due and the GATE date'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-md border border-white/10 bg-white/5 p-3">
                <p className="font-bold">{t}</p>
                <p className="text-sm text-[#c9d1e1]">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-sheet p-4 text-ink">
          <motion.div {...step(0)} className="flex justify-end">
            <p className="max-w-[80%] rounded-lg bg-omr px-3 py-2 text-sm text-white">What should I practise today?</p>
          </motion.div>
          <motion.p {...step(0.6)} className="mt-4 text-sm">
            These target your mistakes and the prerequisites holding other concepts back.
          </motion.p>
          <ul className="mt-3 divide-y divide-rule-soft rounded-lg border border-rule text-sm">
            {items.map(([q, why], i) => (
              <motion.li key={q} {...step(0.9 + i * 0.15)} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="block">{q}</span>
                  <span className="text-xs text-ink-soft">{why}</span>
                </span>
                <span className="shrink-0 rounded-md border border-rule px-2 py-1 text-xs">Start</span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== syllabus, faq, cta */

function Syllabus() {
  const live = [
    ['Data Structures and Algorithms', 'Recurrences, sorting, heaps, trees, hashing, graphs, greedy, DP'],
    ['Operating Systems', 'Scheduling, synchronization, deadlocks, paging, virtual memory, file systems'],
    ['Databases', 'ER model, relational algebra, SQL, normalization, transactions, indexing'],
  ]
  const soon = ['Computer Networks', 'Theory of Computation', 'Computer Organization', 'Compiler Design', 'Discrete Mathematics', 'Digital Logic']
  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built around the GATE CS syllabus</h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <ul className="divide-y divide-rule rounded-lg border border-rule">
            {live.map(([s, d]) => (
              <li key={s} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
                <span className="shrink-0 font-bold sm:w-72">{s}</span>
                <span className="text-sm text-ink-soft">{d}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-dashed border-rule p-5">
            <p className="font-bold">Coming next</p>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
              {soon.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

const FAQ: [string, string][] = [
  ['Is it free?', 'Yes. MisconceptMap is free while it is in beta.'],
  ['Which subjects are covered?', 'Data Structures and Algorithms, Operating Systems and Databases first. The rest of the GATE CS syllabus follows.'],
  ['Where do the questions come from?', 'Past GATE papers and original questions in the same style. Every question is reviewed by hand before it is published, including the misconception tagged on each wrong option.'],
  ['How is mastery calculated?', 'With Bayesian Knowledge Tracing: after each answer, the probability that you know the concept is updated, accounting for lucky guesses and careless slips.'],
  ['What can the AI coach do, and what can’t it?', 'It recommends questions, gives hints, explains mistakes, plans your week and explains concepts using your own practice data. It can be wrong, so check important answers against the explanation or your notes. It never reveals an answer before you submit.'],
  ['What happens to my data?', 'Only your answers, timings and account details are stored. Research use is opt-in, and a delete-my-data option is being added to Settings.'],
]

function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-b border-rule bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1fr_2fr]">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions</h2>
        <div className="divide-y divide-rule rounded-lg border border-rule bg-sheet">
          {FAQ.map(([q, a]) => (
            <FaqItem key={q} q={q} a={a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-bold"
      >
        {q}
        {open ? <Minus size={18} className="shrink-0" /> : <Plus size={18} className="shrink-0" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-ink-soft">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FinalCta() {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="max-w-xl text-3xl font-bold tracking-tight">Your next wrong answer can be the useful kind.</h2>
        <Link to="/signup" className="inline-flex items-center gap-2 rounded-md bg-omr px-5 py-3 font-bold text-white hover:bg-omr/90">
          Create a free account <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  )
}

/* ================================================================== footer: large typographic */

function Footer() {
  const days = daysUntil(sample.gateDate)
  const cols: [string, [string, string][]][] = [
    ['Product', [['How it works', '#how'], ['Features', '#features'], ['AI coach', '#coach'], ['FAQ', '#faq']]],
    ['Subjects', [['Algorithms', '#features'], ['Operating systems', '#features'], ['Databases', '#features']]],
    ['Account', [['Sign in', '/login'], ['Create account', '/signup']]],
  ]
  return (
    <footer className="overflow-hidden bg-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <p className="max-w-xs text-lg font-bold leading-snug">GATE CS practice that names the belief behind every mistake.</p>
          <p className="inline-flex items-baseline gap-2 rounded-md border border-rule bg-sheet px-3 py-2 text-sm">
            <span className="tnum text-xl font-bold text-omr">{days}</span>
            <span className="text-ink-soft">days to GATE CS 2027</span>
          </p>
        </div>
        {cols.map(([title, links]) => (
          <nav key={title} aria-label={title}>
            <p className="mb-3 text-sm font-bold">{title}</p>
            <ul className="space-y-2 text-sm text-ink-soft">
              {links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('/') ? (
                    <Link to={href} className="hover:text-ink">
                      {label}
                    </Link>
                  ) : (
                    <a href={href} className="hover:text-ink">
                      {label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-4">
        <motion.p
          aria-hidden
          initial={{ y: '40%', opacity: 0 }}
          whileInView={{ y: '0%', opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE }}
          className="select-none whitespace-nowrap pb-[0.14em] text-[clamp(2.5rem,11.8vw,9.4rem)] font-bold leading-none tracking-[-0.045em] text-ink"
        >
          Misconcept<span className="text-omr">Map</span>
        </motion.p>
      </div>

      <div className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-ink-faint">
          <span>© {YEAR} MisconceptMap</span>
          <span>Made for GATE CS aspirants</span>
        </div>
      </div>
    </footer>
  )
}
