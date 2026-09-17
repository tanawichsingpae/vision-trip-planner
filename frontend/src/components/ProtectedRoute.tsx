import { Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from '@/context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, role, isDev, actualRole } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading...</div>
  
  if (!user) return <Navigate to="/login" replace />

  // If user is a developer/admin, allow access to all routes even if previewing expert/user
  if (isDev || actualRole === 'dev') {
    return <>{children}</>
  }

  // Otherwise, check if user's actual database role is allowed
  const userEffectiveRole = actualRole || role
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userEffectiveRole)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}