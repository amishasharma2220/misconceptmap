// The single place the student screens get their data from.
// Today it resolves sample data; when the practice/analytics endpoints land, swap the
// queryFn for `apiGet<StudentSnapshot>('/me/snapshot')` and nothing else changes.
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { sample } from './sample'
import type { StudentConcept, StudentSnapshot, SubjectCode } from './types'

export const IS_SAMPLE_DATA = true

export function useStudent() {
  const q = useQuery({
    queryKey: ['student-snapshot'],
    queryFn: async (): Promise<StudentSnapshot> => sample,
    staleTime: Infinity,
  })
  const data = q.data ?? sample
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
