// The single place the student screens get their data from: GET /me/snapshot.
// StudentDataGate (in the app shell) waits for the first load, so screens can read
// `data` directly without loading checks of their own.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { apiGet } from '../api/client'
import type { StudentConcept, StudentSnapshot, SubjectCode } from './types'

export const SNAPSHOT_KEY = ['student-snapshot']

const EMPTY: StudentSnapshot = {
  subjects: [],
  concepts: [],
  misconceptions: [],
  questions: [],
  sessions: [],
  daily: [],
  review: [],
  totals: { answered: 0, answeredThisWeek: 0, streakDays: 0, avgSecondsPerQuestion: null },
  byDifficulty: [],
  timeBuckets: [],
  gateDate: '2027-02-06',
}

/** Minutes ahead of UTC, so "today" and streaks follow the student's own clock. */
const tzOffset = () => -new Date().getTimezoneOffset()

export function useSnapshotQuery() {
  return useQuery({
    queryKey: SNAPSHOT_KEY,
    queryFn: () => apiGet<StudentSnapshot>(`/me/snapshot?tz=${tzOffset()}`),
    staleTime: 30_000,
  })
}

export function useStudent() {
  const q = useSnapshotQuery()
  const data = q.data ?? EMPTY
  const helpers = useMemo(() => {
    const bySlug = new Map(data.concepts.map((c) => [c.slug, c]))
    const misById = new Map(data.misconceptions.map((m) => [m.id, m]))
    return {
      concept: (slug: string): StudentConcept | undefined => bySlug.get(slug),
      conceptName: (slug: string) => bySlug.get(slug)?.name ?? slug,
      misconception: (id: number) => misById.get(id),
      inSubject: (code: SubjectCode) => data.concepts.filter((c) => c.subject === code),
    }
  }, [data])
  return { data, ...helpers }
}

/** Call after answering questions so the dashboard, map and review queue catch up. */
export function useRefreshStudent() {
  const client = useQueryClient()
  return useCallback(() => client.invalidateQueries({ queryKey: SNAPSHOT_KEY }), [client])
}

/** Concepts whose own mastery is low, preferring ones that block others. */
export function weakest(concepts: StudentConcept[], n: number): StudentConcept[] {
  const dependants = new Map<string, number>()
  for (const c of concepts) for (const p of c.prereqs) dependants.set(p, (dependants.get(p) ?? 0) + 1)
  return concepts
    .filter((c) => c.mastery != null)
    .sort((a, b) => a.mastery! - (dependants.get(a.slug) ?? 0) * 0.02 - (b.mastery! - (dependants.get(b.slug) ?? 0) * 0.02))
    .slice(0, n)
}

export function subjectMastery(concepts: StudentConcept[]): number | null {
  const started = concepts.filter((c) => c.mastery != null)
  if (!started.length) return null
  return started.reduce((s, c) => s + c.mastery!, 0) / started.length
}

export function daysUntil(isoDate: string, from = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(isoDate) - from.getTime()) / 864e5))
}

/** Accuracy over a run of days, weighted by questions; null if nothing was answered. */
export function weightedAccuracy(days: { questions: number; accuracy: number | null }[]): number | null {
  const n = days.reduce((s, d) => s + d.questions, 0)
  if (!n) return null
  return days.reduce((s, d) => s + (d.accuracy ?? 0) * d.questions, 0) / n
}
