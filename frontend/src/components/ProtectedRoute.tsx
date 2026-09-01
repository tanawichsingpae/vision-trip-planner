import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>
  
  // QoL Development bypass for local sandbox testing
  if (import.meta.env.DEV) {
    return <>{children}</>
  }
  
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}