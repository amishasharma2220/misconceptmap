import { useQuery } from '@tanstack/react-query'
import { apiGet, type Health } from '../api/client'

export function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<Health>('/health'),
    retry: false,
  })

  const [label, tone] = isPending
    ? ['Checking API…', 'bg-stone-200 text-stone-700']
    : isError || data?.status !== 'ok'
      ? ['API unreachable — is the backend running?', 'bg-red-100 text-red-800']
      : ['API and database connected', 'bg-emerald-100 text-emerald-800']

  return (
    <span role="status" className={`inline-block rounded-full px-3 py-1 text-sm ${tone}`}>
      {label}
    </span>
  )
}
