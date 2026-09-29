import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import {
  fetchUserRoles,
  saveUserRole,
  fetchSystemDefaultRole,
  saveSystemDefaultRole,
  batchUpdateUsersRole,
  type UserRoleRecord,
} from '@/api/blindEvalApi'

export type UserRole = 'dev' | 'expert' | 'user'

function createGuestUser(): User {
  return {
    id: `guest_${Math.random().toString(36).substring(2, 10)}`,
    app_metadata: { provider: 'anonymous' },
    user_metadata: {
      full_name: 'Guest Traveler',
      name: 'Guest Traveler',
      is_guest: true,
    },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    email: 'guest@pixinerary.local',
  } as unknown as User
}

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
  defaultInitialRole: UserRole // System default initial role for new users
  setDefaultInitialRole: (role: UserRole) => Promise<void>
  batchUpdateRoles: (fromRole: UserRole, toRole: UserRole) => Promise<number>
  signOut: () => Promise<void>
  isDev: boolean // True if user is a system developer/admin
  isGuest: boolean // True if current user is logged in as a guest
  loginAsGuest: () => void // Enter guest session
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
  defaultInitialRole: 'expert',
  setDefaultInitialRole: async () => {},
  batchUpdateRoles: async () => 0,
  signOut: async () => {},
  isDev: true,
  isGuest: false,
  loginAsGuest: () => {}
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRolesList, setUserRolesList] = useState<UserRoleRecord[]>([])

  const isGuest = useMemo(() => {
    return Boolean(user?.user_metadata?.is_guest) || (user?.id ? user.id.startsWith('guest_') : false)
  }, [user])

  // Default role from localStorage or fallback to 'dev' for smooth testing
  const [previewRole, setPreviewRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('pix_active_role') as UserRole
    if (saved === 'dev' || saved === 'expert' || saved === 'user') return saved
    return 'dev'
  })

  // System-wide default role for newly registered/unassigned users (defaults to 'expert')
  const [defaultInitialRole, setDefaultInitialRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('pix_default_initial_role') as UserRole
    if (saved === 'dev' || saved === 'expert' || saved === 'user') return saved
    return 'expert'
  })

  // Known developer emails for instant recognition
  const KNOWN_DEV_EMAILS = useMemo(
    () => ['tanawichsingpae@gmail.com', 'supannika1212548@gmail.com', 'dev@pixinerary.com'],
    []
  )

  // Compute actual account role from Supabase/Backend records
  const actualRole: UserRole = useMemo(() => {
    if (isGuest) {
      return 'user'
    }
    if (!user?.email) {
      // Offline / local sandbox default to dev
      return 'dev'
    }
    const emailLower = user.email.toLowerCase()
    if (KNOWN_DEV_EMAILS.includes(emailLower)) return 'dev'
    const found = userRolesList.find((u) => u.email.toLowerCase() === emailLower)
    if (found?.role) return found.role
    return defaultInitialRole
  }, [isGuest, user?.email, userRolesList, KNOWN_DEV_EMAILS, defaultInitialRole])

  const isDev = useMemo(() => !isGuest && actualRole === 'dev', [isGuest, actualRole])

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

  const loginAsGuest = useCallback(() => {
    const guest = createGuestUser()
    localStorage.setItem('pix_is_guest', 'true')
    setUser(guest)
    setRole('user')
  }, [setRole])

  const refreshUserRoles = useCallback(async () => {
    // 1. Synchronize system-wide default role
    let currentDefRole: UserRole = defaultInitialRole
    try {
      const defRole = await fetchSystemDefaultRole()
      if (defRole && ['dev', 'expert', 'user'].includes(defRole)) {
        currentDefRole = defRole
        setDefaultInitialRoleState(defRole)
      }
    } catch {}

    if (isGuest || !user?.email || user.email === 'guest@pixinerary.local') {
      return
    }

    try {
      let records = await fetchUserRoles()

      if (user?.email) {
        const emailLower = user.email.toLowerCase()
        const isKnownDev = KNOWN_DEV_EMAILS.includes(emailLower)
        const found = records.find((r) => r.email.toLowerCase() === emailLower)

        if (isKnownDev) {
          if (!found || found.role !== 'dev') {
            const devRecord: UserRoleRecord = {
              email: user.email,
              role: 'dev',
              name: user.user_metadata?.full_name || found?.name || user.email.split('@')[0],
              updated_at: new Date().toISOString(),
            }
            records = records.map((r) => (r.email.toLowerCase() === emailLower ? devRecord : r))
            if (!found) records = [devRecord, ...records]
            saveUserRole(devRecord).catch(() => {})
          }
        } else if (!found) {
          // Brand new user not found in records: assign system default role
          const newRecord: UserRoleRecord = {
            email: user.email,
            role: currentDefRole,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            updated_at: new Date().toISOString(),
          }
          records = [newRecord, ...records]
          saveUserRole(newRecord).catch(() => {})
        } else if (
          found.role === 'user' &&
          currentDefRole !== 'user' &&
          !localStorage.getItem(`pix_role_assigned_${emailLower}`)
        ) {
          // Supabase trigger automatically created a profile with hardcoded role 'user' on signup.
          // Because system default role is 'expert' (or 'dev'), initialize this new user to the default role.
          const newRecord: UserRoleRecord = {
            ...found,
            role: currentDefRole,
            updated_at: new Date().toISOString(),
          }
          records = records.map((r) => (r.email.toLowerCase() === emailLower ? newRecord : r))
          saveUserRole(newRecord).catch(() => {})
          localStorage.setItem(`pix_role_assigned_${emailLower}`, 'true')
        }
      }

      setUserRolesList(records)
    } catch (err) {
      console.warn('refreshUserRoles error:', err)
    }
  }, [isGuest, user?.email, user?.user_metadata, KNOWN_DEV_EMAILS, defaultInitialRole])

  // Admin function: explicitly update a user's role in DB
  const updateUserRole = async (email: string, targetRole: UserRole, name?: string) => {
    const emailLower = email.trim().toLowerCase()
    localStorage.setItem(`pix_role_assigned_${emailLower}`, 'true')

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

  // Admin function: update system-wide default role for new users
  const setDefaultInitialRole = useCallback(async (targetRole: UserRole) => {
    setDefaultInitialRoleState(targetRole)
    localStorage.setItem('pix_default_initial_role', targetRole)
    try {
      await saveSystemDefaultRole(targetRole)
    } catch (err) {
      console.warn('setDefaultInitialRole error:', err)
      throw err
    }
    await refreshUserRoles()
  }, [refreshUserRoles])

  // Admin function: batch update existing users with fromRole to toRole
  const batchUpdateRoles = useCallback(
    async (fromRole: UserRole, toRole: UserRole): Promise<number> => {
      setUserRolesList((prev) =>
        prev.map((u) => {
          if (u.role === fromRole) {
            localStorage.setItem(`pix_role_assigned_${u.email.toLowerCase()}`, 'true')
            return { ...u, role: toRole, updated_at: new Date().toISOString() }
          }
          return u
        })
      )
      const count = await batchUpdateUsersRole(fromRole, toRole)
      await refreshUserRoles()
      return count
    },
    [refreshUserRoles]
  )

  useEffect(() => {
    const storedIsGuest = localStorage.getItem('pix_is_guest') === 'true'

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        localStorage.removeItem('pix_is_guest')
      } else if (storedIsGuest) {
        setSession(null)
        setUser(createGuestUser())
      } else {
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSession(session)
        setUser(session.user)
        localStorage.removeItem('pix_is_guest')
      } else {
        const stillGuest = localStorage.getItem('pix_is_guest') === 'true'
        if (stillGuest) {
          setSession(null)
          setUser(createGuestUser())
        } else {
          setSession(null)
          setUser(null)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    refreshUserRoles()
  }, [refreshUserRoles])

  const signOut = async () => {
    localStorage.removeItem('pix_is_guest')
    localStorage.removeItem('pix_active_role')
    setUser(null)
    setSession(null)
    await supabase.auth.signOut().catch(() => {})
  }

  const userEmail = isGuest
    ? 'guest@pixinerary.local'
    : user?.email || (role === 'dev' ? 'dev@pixinerary.com' : role === 'expert' ? 'expert@pixinerary.com' : 'user@pixinerary.com')

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
      defaultInitialRole,
      setDefaultInitialRole,
      batchUpdateRoles,
      signOut,
      isDev,
      isGuest,
      loginAsGuest
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)