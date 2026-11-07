import { ArrowRight, Check, Minus, Plus, Sparkles } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bubble } from '../components/Bubble'
import { Logo } from '../components/Logo'
import { Markdown } from '../components/Markdown'
import { MasteryBar, masteryTone, toneBg } from '../components/ui'
import { sample } from '../data/sample'

const YEAR = new Date().getFullYear()

const nav = [
  ['How it works', '#how'],
  ['Features', '#features'],
  ['AI coach', '#coach'],
  ['FAQ', '#faq'],
]

export function LandingPage() {
  return (
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
  )
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-sheet/95 backdrop-blur">
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

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section className="border-b border-rule bg-paper">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1fr_1.05fr] lg:py-24">
        <div>
          <p className="mb-4 text-sm font-bold text-omr">GATE Computer Science practice</p>
          <h1 className="text-[2.6rem] font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Find out why you got it wrong.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-soft">
            Every wrong option is tagged with the belief that leads to it. MisconceptMap shows you that belief,
            tracks how well you know each concept, and picks your next question from the prerequisite that is
            holding you back.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-md bg-omr px-5 py-3 font-bold text-white hover:bg-omr/90">
              Start practising free <ArrowRight size={18} />
            </Link>
            <a href="#how" className="rounded-md border border-rule bg-sheet px-5 py-3 font-bold hover:border-ink-faint">
              See how it works
            </a>
          </div>
        </div>
        <ProductPreview />
      </div>
    </section>
  )
}

/** A composed, static preview built from the app's own components. */
function ProductPreview() {
  const q = sample.questions[0]
  return (
    <div className="relative min-w-0 lg:mb-10" aria-label="Preview of a practice question with misconception feedback" role="img">
      <div className="overflow-hidden rounded-xl border border-rule bg-sheet shadow-[0_1px_0_rgba(26,34,50,0.04),0_24px_48px_-24px_rgba(26,34,50,0.25)]">
        <div className="flex items-center gap-2 border-b border-rule-soft px-4 py-2.5 text-xs text-ink-soft">
          <span className="font-bold text-ink">Practice</span>
          <span>Question 4 of 10</span>
          <span className="ml-auto flex gap-1">
            {[1, 1, 0, 2, 3, 3].map((s, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${['bg-ok', 'bg-pen', 'bg-omr', 'bg-rule'][s === 2 ? 2 : s === 3 ? 3 : s]}`}
              />
            ))}
          </span>
        </div>
        <div className="space-y-4 p-5">
          <Markdown className="text-[15px]">{q.stem}</Markdown>
          <ul className="space-y-2">
            {q.options.map((o) => {
              const picked = o.label === 'A'
              return (
                <li key={o.label}>
                  <div
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                      o.correct ? 'border-ok/50 bg-ok-tint' : picked ? 'border-pen/50' : 'border-rule'
                    }`}
                  >
                    <Bubble label={o.label} filled={o.correct} wrong={picked} size="sm" />
                    <span>{o.text}</span>
                  </div>
                  {picked && (
                    <p className="ml-10 mt-1.5 border-l-2 border-pen pl-2 text-sm font-bold text-pen">
                      You may believe heap sort is stable
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="flex items-center gap-3 rounded-md bg-paper px-3 py-2 text-xs">
            <span className="text-ink-soft">Stability and in-place sorting</span>
            <MasteryBar value={0.35} className="flex-1" />
          </div>
        </div>
      </div>
      <div className="absolute -bottom-16 -left-4 hidden w-72 rounded-lg border border-rule bg-sheet p-3 text-sm shadow-[0_16px_32px_-16px_rgba(26,34,50,0.3)] sm:block lg:-left-10">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-omr">
          <Sparkles size={13} /> Study coach
        </p>
        <p>
          Heap sort swaps elements that are far apart, so equal keys can swap places. Want 3 questions on
          stability next?
        </p>
      </div>
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
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-rule px-0 lg:grid-cols-4">
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

/* ------------------------------------------------------------------ how it works */

function HowItWorks() {
  const steps: { title: string; text: string; art: ReactNode }[] = [
    {
      title: 'Answer a GATE question',
      text: 'Practise past-paper style MCQs with maths rendered properly and a timer, one at a time.',
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
      art: (
        <p className="border-l-2 border-pen pl-2 text-sm font-bold text-pen">Drops the log factor in master theorem case 2</p>
      ),
    },
    {
      title: 'Practise the weakest prerequisite next',
      text: 'Mastery is tracked per concept, and the next question targets what is holding the others back.',
      art: (
        <div className="space-y-1.5">
          <MasteryBar value={0.29} />
          <MasteryBar value={0.52} />
          <MasteryBar value={0.86} />
        </div>
      ),
    },
  ]
  return (
    <section id="how" className="scroll-mt-16 border-b border-rule">
      <div className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Practice that diagnoses, not just scores</h2>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-lg border border-rule p-5">
              <div className="mb-5 flex h-20 items-center rounded-md bg-paper px-4">{s.art}</div>
              <p className="text-sm font-bold text-omr">Step {i + 1}</p>
              <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-ink-soft">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ features */

function Features() {
  const dsa = sample.concepts.filter((c) => c.subject === 'DSA')
  const rows: { title: string; text: string; points: string[]; preview: ReactNode }[] = [
    {
      title: 'Feedback that names the mistake',
      text: 'Instead of a red cross, you see the exact belief your answer reveals, with an explanation and an example that breaks it.',
      points: ['Misconceptions written as beliefs you can recognise', 'Full explanation of the correct answer', 'Mastery change shown after every answer'],
      preview: (
        <div className="space-y-3 rounded-lg border border-pen/30 bg-pen-tint/60 p-4">
          <p className="text-sm font-bold text-pen">You may believe a TLB miss is a page fault</p>
          <p className="text-sm">
            A miss only means the translation is not cached. The page table is read from memory; the page itself is
            usually still there.
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-ink-soft">TLB and effective access time</span>
            <span className="tnum font-bold text-pen">33% → 27%</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Mastery for every concept',
      text: 'A knowledge-tracing model updates how well you know each concept after every answer, so you can see weak spots at a glance.',
      points: ['Per-concept mastery heatmap', 'Accuracy and volume over time', 'Weakest prerequisites ranked'],
      preview: (
        <div className="rounded-lg border border-rule p-4">
          <p className="mb-3 text-xs text-ink-soft">Data Structures and Algorithms</p>
          <div className="grid grid-cols-9 gap-1">
            {dsa.map((c) => (
              <span key={c.slug} title={c.name} className={`h-6 rounded-sm ${toneBg[masteryTone(c.mastery)]}`} />
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-pen" /> Below 40%</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber" /> 40–70%</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ok" /> Above 70%</span>
          </div>
        </div>
      ),
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
      preview: (
        <ul className="divide-y divide-rule-soft rounded-lg border border-rule text-sm">
          {sample.review.slice(0, 4).map((r) => (
            <li key={r.questionId} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="truncate">{r.stem}</span>
              <span className={`tnum shrink-0 text-xs ${r.dueInHours <= 0 ? 'font-bold text-pen' : 'text-ink-soft'}`}>
                {r.dueInHours <= 0 ? 'Due now' : `in ${r.dueInHours} h`}
              </span>
            </li>
          ))}
        </ul>
      ),
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
  return (
    <svg viewBox="0 0 420 130" className="w-full" aria-hidden>
      {edges.map(([a, b]) => (
        <line
          key={`${a}-${b}`}
          x1={nodes[a].x + 120}
          y1={nodes[a].y + 14}
          x2={nodes[b].x}
          y2={nodes[b].y + 14}
          stroke="#d6dce6"
          strokeWidth="1.5"
        />
      ))}
      {nodes.map((n) => {
        const tone = masteryTone(n.m)
        const color = { low: '#b42347', mid: '#c07a12', high: '#1d7044', none: '#d6dce6' }[tone]
        return (
          <g key={n.label}>
            <rect x={n.x} y={n.y} width="120" height="28" rx="6" fill="#fff" stroke={color} strokeWidth="1.5" />
            <text x={n.x + 10} y={n.y + 18} fontSize="11" fill="#1a2232">
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ------------------------------------------------------------------ coach */

function CoachSection() {
  return (
    <section id="coach" className="scroll-mt-16 bg-navy text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[#9db6f2]">
            <Sparkles size={16} /> Study coach
          </p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">A coach that knows your mistakes</h2>
          <p className="mt-4 max-w-lg text-[#c9d1e1]">
            Open it from any screen. It sees your mastery, your review queue and the question in front of you, so
            it can do more than a general chatbot.
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
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-lg bg-omr px-3 py-2 text-sm text-white">What should I practise today?</p>
          </div>
          <p className="mt-4 text-sm">These target your mistakes and the prerequisites holding other concepts back.</p>
          <ul className="mt-3 divide-y divide-rule-soft rounded-lg border border-rule text-sm">
            {[
              ['Solve T(n) = 2T(n/2) + n', 'You got this wrong 3 times'],
              ['Which statement about schedules is true?', 'Due for review'],
              ['Worst-case time of bottom-up build-heap', 'Weak prerequisite of Heap sort'],
            ].map(([q, why]) => (
              <li key={q} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span>
                  <span className="block">{q}</span>
                  <span className="text-xs text-ink-soft">{why}</span>
                </span>
                <span className="shrink-0 rounded-md border border-rule px-2 py-1 text-xs">Start</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ syllabus, faq, footer */

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
                <span className="w-72 shrink-0 font-bold">{s}</span>
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
      {open && <p className="px-5 pb-4 text-ink-soft">{a}</p>}
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

function Footer() {
  return (
    <footer className="bg-sheet">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-ink-soft sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <p>GATE CS practice that diagnoses misconceptions.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2">
          <a href="#how" className="hover:text-ink">How it works</a>
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#coach" className="hover:text-ink">AI coach</a>
          <a href="#faq" className="hover:text-ink">FAQ</a>
          <Link to="/login" className="hover:text-ink">Sign in</Link>
          <Link to="/signup" className="hover:text-ink">Create account</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-faint">© {YEAR} MisconceptMap</p>
    </footer>
  )
}
