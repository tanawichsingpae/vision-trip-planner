import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { fetchUserRoles, saveUserRole, type UserRoleRecord } from '@/api/blindEvalApi'

export type UserRole = 'dev' | 'expert' | 'user'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  role: UserRole // Current active perspective / preview role
  setRole: (role: UserRole) => void // Switch active perspective
  actualRole: UserRole // Permanent database/system role
  userEmail: string
  userRolesList: UserRoleRecord[]
  refreshUserRoles: () => Promise<void>
  updateUserRole: (email: string, role: UserRole, name?: string) => Promise<void>
  signOut: () => Promise<void>
  isDev: boolean // True if user is a system developer/admin
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: 'dev',
  setRole: () => {},
  actualRole: 'dev',
  userEmail: '',
  userRolesList: [],
  refreshUserRoles: async () => {},
  updateUserRole: async () => {},
  signOut: async () => {},
  isDev: true
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRolesList, setUserRolesList] = useState<UserRoleRecord[]>([])

  // Default role from localStorage or fallback to 'dev' for smooth testing
  const [previewRole, setPreviewRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('pix_active_role') as UserRole
    if (saved === 'dev' || saved === 'expert' || saved === 'user') return saved
    return 'dev'
  })

  // Known developer emails for instant recognition
  const KNOWN_DEV_EMAILS = useMemo(
    () => ['tanawichsingpae@gmail.com', 'supannika1212548@gmail.com', 'dev@pixinerary.com'],
    []
  )

  // Compute actual account role from Supabase/Backend records
  const actualRole: UserRole = useMemo(() => {
    if (!user?.email) {
      // Offline / local sandbox default to dev
      return 'dev'
    }
    const emailLower = user.email.toLowerCase()
    const found = userRolesList.find((u) => u.email.toLowerCase() === emailLower)
    if (found?.role) return found.role
    if (KNOWN_DEV_EMAILS.includes(emailLower)) return 'dev'
    return 'user'
  }, [user?.email, userRolesList, KNOWN_DEV_EMAILS])

  const isDev = useMemo(() => actualRole === 'dev', [actualRole])

  // Active role: If user is Dev, they can preview any role. If user is not Dev, their active role matches actualRole
  const role: UserRole = useMemo(() => {
    if (isDev) {
      return previewRole
    }
    return actualRole
  }, [isDev, previewRole, actualRole])

  // Switch preview role (dev only preview toggle) - does NOT overwrite DB role
  const setRole = useCallback((newRole: UserRole) => {
    localStorage.setItem('pix_active_role', newRole)
    setPreviewRole(newRole)
  }, [])

  const refreshUserRoles = useCallback(async () => {
    try {
      let records = await fetchUserRoles()

      // If user is logged in via Supabase, ensure their record is tracked
      if (user?.email) {
        const emailLower = user.email.toLowerCase()
        const found = records.find((r) => r.email.toLowerCase() === emailLower)
        if (!found) {
          const isKnownDev = KNOWN_DEV_EMAILS.includes(emailLower)
          const newRecord: UserRoleRecord = {
            email: user.email,
            role: isKnownDev ? 'dev' : 'expert',
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            updated_at: new Date().toISOString(),
          }
          records = [newRecord, ...records]
          saveUserRole(newRecord).catch(() => {})
        }
      }

      setUserRolesList(records)
    } catch (err) {
      console.warn('refreshUserRoles error:', err)
    }
  }, [user?.email, user?.user_metadata, KNOWN_DEV_EMAILS])

  // Admin function: explicitly update a user's role in DB
  const updateUserRole = async (email: string, targetRole: UserRole, name?: string) => {
    const emailLower = email.trim().toLowerCase()

    // 1. Optimistic UI update immediately
    setUserRolesList((prev) => {
      const exists = prev.some((u) => u.email.toLowerCase() === emailLower)
      if (exists) {
        return prev.map((u) =>
          u.email.toLowerCase() === emailLower
            ? { ...u, role: targetRole, name: name || u.name, updated_at: new Date().toISOString() }
            : u
        )
      }
      return [
        ...prev,
        {
          email: emailLower,
          role: targetRole,
          name: name || emailLower.split('@')[0],
          updated_at: new Date().toISOString(),
        },
      ]
    })

    // 2. Persist to Supabase profiles & backend
    try {
      await saveUserRole({ email: emailLower, role: targetRole, name })
    } catch (err) {
      console.warn('updateUserRole error:', err)
      throw err
    }

    // 3. Refresh to ensure state is synchronized
    await refreshUserRoles()
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    refreshUserRoles()
  }, [refreshUserRoles])

  const signOut = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('pix_active_role')
  }

  const userEmail = user?.email || (role === 'dev' ? 'dev@pixinerary.com' : role === 'expert' ? 'expert@pixinerary.com' : 'user@pixinerary.com')

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      role,
      setRole,
      actualRole,
      userEmail,
      userRolesList,
      refreshUserRoles,
      updateUserRole,
      signOut,
      isDev
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)