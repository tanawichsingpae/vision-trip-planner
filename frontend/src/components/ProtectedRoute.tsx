import { Navigate } from 'react-router-dom'
import { useAuth, type UserRole } from '@/context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, loading, role } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading...</div>
  
  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}