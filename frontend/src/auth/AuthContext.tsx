import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { apiGet, apiSend, getToken, setToken } from '../api/client'
import type { TokenOut, User } from '../api/types'

type AuthState = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (data: {
    email: string
    password: string
    display_name?: string
    consent_research: boolean
  }) => Promise<User>
  logout: () => void
  /** save a changed name or research-use choice */
  updateProfile: (changes: { display_name?: string; consent_research?: boolean }) => Promise<User>
  /** permanently delete the account, then sign out */
  deleteAccount: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [hasToken, setHasToken] = useState(() => !!getToken())

  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<User>('/me'),
    enabled: hasToken,
    retry: false,
    staleTime: Infinity,
  })

  const accept = useCallback(
    (out: TokenOut) => {
      setToken(out.access_token)
      qc.clear()
      qc.setQueryData(['me'], out.user)
      setHasToken(true)
      return out.user
    },
    [qc],
  )

  const value = useMemo<AuthState>(
    () => ({
      user: hasToken && !me.isError ? (me.data ?? null) : null,
      loading: hasToken && me.isPending,
      login: async (email, password) =>
        accept(await apiSend<TokenOut>('POST', '/auth/login', { email, password })),
      register: async (data) => accept(await apiSend<TokenOut>('POST', '/auth/register', data)),
      logout: () => {
        setToken(null)
        setHasToken(false)
        qc.clear()
      },
      updateProfile: async (changes) => {
        const user = await apiSend<User>('PATCH', '/me', changes)
        qc.setQueryData(['me'], user)
        return user
      },
      deleteAccount: async (password) => {
        await apiSend('POST', '/me/delete', { password })
        setToken(null)
        setHasToken(false)
        qc.clear()
      },
    }),
    [hasToken, me.data, me.isError, me.isPending, accept, qc],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
