import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import type { Role } from '../../../shared/constants'

export interface Me {
  id: number; name: string; email: string; role: Role; status: 'active' | 'pending' | 'blocked'
  avatar: string; avatar_emoji: string; city: string; school: string; bio: string; headline: string
  interests: string[]; show_in_rating: boolean; allow_messages: boolean; created_at: string; rulesAccepted: boolean
}
export interface Session { user: Me | null; counts?: { unreadNotifications: number; unreadMessages: number; moderationQueue: number } }

export function useSession() {
  const query = useQuery({ queryKey: ['me'], queryFn: () => api.get<Session>('/auth/me'), refetchInterval: 30_000 })
  const user = query.data?.user ?? null
  return {
    ...query,
    user,
    counts: query.data?.counts ?? { unreadNotifications: 0, unreadMessages: 0, moderationQueue: 0 },
    isStaff: !!user && (user.role === 'mentor' || user.role === 'admin') && user.status === 'active',
    isAdmin: user?.role === 'admin',
  }
}

export function useLogout() {
  const qc = useQueryClient()
  return async () => {
    await api.post('/auth/logout')
    qc.clear()
    window.location.href = '/'
  }
}
