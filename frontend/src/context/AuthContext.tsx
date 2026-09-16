import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'
import { fetchUserRoles, saveUserRole, type UserRoleRecord } from '@/api/blindEvalApi'

export type UserRole = 'dev' | 'expert' | 'user'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  role: UserRole
  setRole: (role: UserRole) => void
  userEmail: string
  userRolesList: UserRoleRecord[]
  refreshUserRoles: () => Promise<void>
  updateUserRole: (email: string, role: UserRole, name?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: 'dev',
  setRole: () => {},
  userEmail: '',
  userRolesList: [],
  refreshUserRoles: async () => {},
  updateUserRole: async () => {},
  signOut: async () => {}
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRolesList, setUserRolesList] = useState<UserRoleRecord[]>([])

  // Default role from localStorage or fallback to 'dev' for smooth local testing
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('pix_active_role') as UserRole
    if (saved === 'dev' || saved === 'expert' || saved === 'user') return saved
    return 'dev'
  })

  const setRole = (newRole: UserRole) => {
    localStorage.setItem('pix_active_role', newRole)
    setRoleState(newRole)
  }

  const refreshUserRoles = useCallback(async () => {
    try {
      let records = await fetchUserRoles()

      // Also query Supabase profiles table if it exists
      try {
        const { data: profiles, error } = await supabase.from('profiles').select('*')
        if (!error && profiles && profiles.length > 0) {
          const map = new Map<string, UserRoleRecord>()
          for (const r of records) map.set(r.email.toLowerCase(), r)
          for (const p of profiles) {
            if (p.email) {
              map.set(p.email.toLowerCase(), {
                email: p.email,
                role: (p.role as UserRole) || 'user',
                name: p.name || p.full_name || p.email.split('@')[0],
                updated_at: p.updated_at || p.created_at,
              })
            }
          }
          records = Array.from(map.values())
        }
      } catch {
        // Fallback gracefully if profiles table does not exist yet
      }

      // If user is logged in via Supabase, ensure their email is visible in the management list!
      if (user?.email) {
        const emailLower = user.email.toLowerCase()
        const found = records.find(r => r.email.toLowerCase() === emailLower)
        if (!found) {
          const defaultRole = (localStorage.getItem('pix_active_role') as UserRole) || 'dev'
          const newRecord: UserRoleRecord = {
            email: user.email,
            role: defaultRole,
            name: user.user_metadata?.full_name || user.email.split('@')[0],
            updated_at: new Date().toLocaleString(),
          }
          records = [newRecord, ...records]
          saveUserRole(newRecord).catch(() => {})
        } else if (found && found.role && !localStorage.getItem('pix_active_role')) {
          setRoleState(found.role)
        }
      }

      setUserRolesList(records)
    } catch (err) {
      console.warn('refreshUserRoles error:', err)
    }
  }, [user?.email, user?.user_metadata])

  const updateUserRole = async (email: string, targetRole: UserRole, name?: string) => {
    // 1. Save to backend user_roles.json
    await saveUserRole({ email, role: targetRole, name })

    // 2. Also attempt to save to Supabase profiles table if present
    try {
      await supabase.from('profiles').upsert({
        email: email.toLowerCase(),
        role: targetRole,
        name: name || email.split('@')[0],
        updated_at: new Date().toISOString()
      }, { onConflict: 'email' })
    } catch {
      // Ignored if profiles table doesn't exist
    }

    await refreshUserRoles()
    if (user?.email && user.email.toLowerCase() === email.toLowerCase()) {
      setRole(targetRole)
    }
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
      userEmail,
      userRolesList,
      refreshUserRoles,
      updateUserRole,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)