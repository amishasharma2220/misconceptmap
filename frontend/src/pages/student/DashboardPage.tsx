import type { CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useCoachScreen } from '../../coach/CoachContext'
import { BarSeries, LineSeries, shortDate } from '../../components/charts'
import {
  btn,
  MasteryBar,
  masteryTone,
  Panel,
  PanelLink,
  EmptyNote,
  pct,
  Stat,
  toneBg,
  toneText,
  toneTint,
} from '../../components/ui'
import { subjectMastery, useStudent, weakest, weightedAccuracy } from '../../data/student'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const { data, conceptName, inSubject } = useStudent()
  const navigate = useNavigate()
  useCoachScreen({ label: 'Dashboard' })

  const started = data.concepts.filter((c) => c.mastery != null)
  const mastered = data.concepts.filter((c) => (c.mastery ?? 0) >= 0.7).length
  const last14 = data.daily.slice(-14)
  const acc14 = weightedAccuracy(last14)
  const accSpark = last14.filter((d) => d.accuracy != null).map((d) => d.accuracy!)
  const due = data.review.filter((r) => r.dueInHours <= 0)
  const weak = weakest(data.concepts, 6)
  const topMis = data.misconceptions.filter((m) => m.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 6)
  const fresh = data.totals.answered === 0
  const avg = data.totals.avgSecondsPerQuestion
  const startFirst = (
    <Link to="/practice" className={btn.primary}>
      Start your first session
    </Link>
  )

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xl font-bold">
            {greeting()}, {user?.display_name?.split(' ')[0] ?? 'there'}
          </p>
          <p className="text-sm text-ink-soft">
            {fresh
              ? 'Answer your first questions and this page fills in with your own numbers.'
              : [
                  `${due.length} question${due.length === 1 ? '' : 's'} due for review`,
                  weak[0] && `${weak[0].name} is your weakest concept`,
                ]
                  .filter(Boolean)
                  .join(', and ') + '.'}
          </p>
        </div>
        <Link to="/practice" className={btn.primary}>
          {fresh ? 'Start your first session' : 'Start practice'}
        </Link>
      </div>

      {/* row 1: stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Questions answered" value={data.totals.answered.toLocaleString('en-IN')} sub={`+${data.totals.answeredThisWeek} this week`} spark={data.daily.slice(-14).map((d) => d.questions)} />
        <Stat label="Accuracy, last 14 days" value={pct(acc14)} sub="weighted by questions" spark={accSpark.length > 1 ? accSpark : undefined} />
        <Stat label="Concepts mastered" value={`${mastered}/${data.concepts.length}`} sub={`${started.length} started`} />
        <Stat label="Review due now" value={due.length} sub={<Link to="/review" className="text-omr hover:underline">Open review queue</Link>} />
        <Stat
          label="Study streak"
          value={`${data.totals.streakDays} ${data.totals.streakDays === 1 ? 'day' : 'days'}`}
          sub={data.totals.streakDays ? 'practised every day' : 'practise today to start one'}
        />
        <Stat label="Avg time per question" value={avg == null ? '—' : `${Math.floor(avg / 60)}m ${avg % 60}s`} sub="GATE pace: about 2m 45s" />
      </div>

      {/* row 2 */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          title="Mastery heatmap"
          action={<span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft"><Legend /></span>}
        >
          <div className="space-y-4">
            {data.subjects.map((s) => (
              <div key={s.code}>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <Link to={`/map/${s.code}`} className="font-bold hover:text-omr">{s.name}</Link>
                  <span className="tnum text-ink-soft">avg {pct(subjectMastery(inSubject(s.code)))}</span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-1">
                  {inSubject(s.code).map((c) => {
                    const tone = masteryTone(c.mastery)
                    return (
                      <button
                        key={c.slug}
                        onClick={() => navigate(`/map/${c.subject}?focus=${c.slug}`)}
                        title={`${c.name}: ${c.mastery == null ? 'not started' : pct(c.mastery)}`}
                        className={`relative flex h-11 flex-col justify-between overflow-hidden rounded border px-1.5 pb-1 pt-1.5 text-left text-[10.5px] leading-tight text-ink ${toneTint[tone]} hover:border-ink-soft`}
                      >
                        <span className={`absolute inset-x-0 top-0 h-[3px] ${toneBg[tone]}`} aria-hidden />
                        <span className="truncate">{c.name}</span>
                        <span className={`tnum font-bold ${toneText[tone]}`}>{c.mastery == null ? 'New' : pct(c.mastery)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-4" title="Weakest prerequisites" action={<PanelLink to="/analytics">All concepts</PanelLink>} bodyClass="p-0">
          {weak.length === 0 && (
            <div className="p-4">
              <EmptyNote>Your weakest concepts show up here once you have answered a few questions.</EmptyNote>
            </div>
          )}
          <ul className="divide-y divide-rule-soft">
            {weak.map((c, i) => (
              <li key={c.slug} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tnum w-4 text-xs text-ink-faint">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.name}</p>
                  <MasteryBar value={c.mastery} className="mt-1" />
                </div>
                <Link to={`/practice?concept=${c.slug}`} className={btn.quiet}>
                  Practise
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* row 3 */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Panel className="xl:col-span-4" title="Questions per day" action={<span className="text-xs text-ink-soft">last 30 days</span>}>
          {fresh ? (
            <EmptyNote action={startFirst}>No questions answered yet.</EmptyNote>
          ) : (
            <BarSeries data={data.daily} x="date" y="questions" xTick={shortDate} height={250} />
          )}
        </Panel>
        <Panel className="xl:col-span-4" title="Daily accuracy" action={<span className="text-xs text-ink-soft">last 30 days</span>}>
          {fresh ? (
            <EmptyNote>Your accuracy for each day you practise appears here.</EmptyNote>
          ) : (
            <LineSeries data={data.daily} x="date" y="accuracy" xTick={shortDate} format={(v) => pct(v)} yDomain={[0, 1]} height={250} />
          )}
        </Panel>
        <Panel className="lg:col-span-2 xl:col-span-4" title="Misconceptions you keep hitting" bodyClass="p-0">
          {topMis.length === 0 && (
            <div className="p-4">
              <EmptyNote>
                When you pick a wrong option, the belief behind it is named here, so you can see which ones keep coming back.
              </EmptyNote>
            </div>
          )}
          <ul className="divide-y divide-rule-soft">
            {topMis.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pen" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{m.title}</p>
                  <p className="text-xs text-ink-soft">
                    {conceptName(m.concept)} · last seen {m.lastSeenDays === 0 ? 'today' : `${m.lastSeenDays}d ago`}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm font-bold text-pen">{m.hits}×</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* row 4 */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8" title="Recent sessions" bodyClass="overflow-x-auto p-0">
          {data.sessions.length === 0 ? (
            <div className="p-4">
              <EmptyNote action={startFirst}>Your practice sessions will be listed here.</EmptyNote>
            </div>
          ) : (
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-ink-soft">
              <tr className="border-b border-rule-soft">
                <th className="px-4 py-2 font-normal">Date</th>
                <th className="px-2 py-2 font-normal">Subject</th>
                <th className="px-2 py-2 font-normal">Session</th>
                <th className="px-2 py-2 text-right font-normal">Questions</th>
                <th className="px-2 py-2 text-right font-normal">Accuracy</th>
                <th className="px-2 py-2 text-right font-normal">Time</th>
                <th className="px-4 py-2 text-right font-normal">Mastery</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {data.sessions.map((s, i) => (
                <tr key={s.id} className={i % 2 ? 'bg-paper/60' : ''}>
                  <td className="px-4 py-2">{shortDate(s.date)}</td>
                  <td className="px-2 py-2">{s.subject}</td>
                  <td className="px-2 py-2 text-ink-soft">
                    <Link to={`/practice/summary?session=${s.id}`} className="hover:text-omr hover:underline">
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-right">{s.questions}</td>
                  <td className="px-2 py-2 text-right">{pct(s.correct / s.questions)}</td>
                  <td className="px-2 py-2 text-right">{s.minutes} min</td>
                  <td className={`px-4 py-2 text-right font-bold ${s.masteryDelta >= 0 ? 'text-ok' : 'text-pen'}`}>
                    {s.masteryDelta >= 0 ? '+' : '−'}
                    {Math.abs(s.masteryDelta * 100).toFixed(0)} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </Panel>

        <Panel className="xl:col-span-4" title="Due for review" action={<PanelLink to="/review">See all</PanelLink>} bodyClass="flex flex-col p-0">
          {data.review.length === 0 && (
            <div className="flex-1 p-4">
              <EmptyNote>Questions you get wrong come back here a day later, then at growing gaps until they stick.</EmptyNote>
            </div>
          )}
          <ul className="flex-1 divide-y divide-rule-soft">
            {data.review.slice(0, 5).map((r) => (
              <li key={r.questionId} className="flex items-center justify-between gap-3 px-4 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{r.stem}</p>
                  <p className="text-xs text-ink-soft">{conceptName(r.concept)}</p>
                </div>
                <span className={`tnum shrink-0 text-xs ${r.dueInHours <= 0 ? 'font-bold text-pen' : 'text-ink-soft'}`}>
                  {r.dueInHours <= 0 ? 'Due now' : r.dueInHours < 24 ? `in ${r.dueInHours} h` : `in ${Math.round(r.dueInHours / 24)} d`}
                </span>
              </li>
            ))}
          </ul>
          {due.length > 0 && (
            <div className="border-t border-rule-soft p-3">
              <Link to="/practice?mode=review" className={`${btn.primary} w-full`}>
                Start review ({due.length})
              </Link>
            </div>
          )}
        </Panel>
      </div>

      {/* row 5 */}
      <Panel
        title="Subject breakdown"
        bodyClass="grid divide-y divide-rule-soft md:grid-cols-[repeat(var(--cols),minmax(0,1fr))] md:divide-x md:divide-y-0"
        bodyStyle={{ '--cols': Math.min(3, Math.max(1, data.subjects.length)) } as CSSProperties}
      >
        {data.subjects.map((s) => {
          const cs = inSubject(s.code)
          const m = subjectMastery(cs)
          const attempts = cs.reduce((t, c) => t + c.attempts, 0)
          const accs = cs.filter((c) => c.accuracy != null)
          const acc = accs.length ? accs.reduce((t, c) => t + c.accuracy!, 0) / accs.length : null
          const weakOne = weakest(cs, 1)[0]
          return (
            <div key={s.code} className="space-y-3 p-4">
              <div className="flex items-center gap-4">
                <Ring value={m} />
                <div>
                  <p className="font-bold">{s.name}</p>
                  <p className="tnum text-xs text-ink-soft">
                    {attempts} questions · {pct(acc)} accuracy
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {[...cs].filter((c) => c.mastery != null).sort((a, b) => a.mastery! - b.mastery!).slice(0, 5).map((c) => (
                  <li key={c.slug} className="grid grid-cols-[1fr_1.1fr] items-center gap-2 text-xs">
                    <span className="truncate">{c.name}</span>
                    <MasteryBar value={c.mastery} />
                  </li>
                ))}
              </ul>
              {weakOne && (
                <p className="text-xs text-ink-soft">
                  Start with <Link className="text-omr hover:underline" to={`/practice?concept=${weakOne.slug}`}>{weakOne.name}</Link>
                </p>
              )}
            </div>
          )
        })}
      </Panel>
    </div>
  )
}

function Legend() {
  return (
    <>
      {[
        ['bg-pen', 'below 40%'],
        ['bg-amber', '40–70%'],
        ['bg-ok', '70%+'],
        ['bg-rule', 'not started'],
      ].map(([c, l]) => (
        <span key={l} className="flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-sm ${c}`} /> {l}
        </span>
      ))}
    </>
  )
}

function Ring({ value }: { value: number | null }) {
  const r = 22
  const c = 2 * Math.PI * r
  const tone = masteryTone(value)
  const stroke = { low: '#b42347', mid: '#c07a12', high: '#1d7044', none: '#d6dce6' }[tone]
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e9edf3" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={stroke} strokeWidth="5" strokeDasharray={`${(value ?? 0) * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span className={`tnum absolute inset-0 flex items-center justify-center text-xs font-bold ${toneText[tone]}`}>{pct(value)}</span>
    </div>
  )
}
