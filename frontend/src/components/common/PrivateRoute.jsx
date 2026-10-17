import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/**
 * PrivateRoute — wraps protected routes.
 * Redirects to the appropriate login page if not authenticated
 * or if the user's role doesn't match the required role.
 */
export default function PrivateRoute({ role }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: 'var(--color-bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" style={{ width: '2.5rem', height: '2.5rem' }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Verifying session…
          </p>
        </div>
      </div>
    )
  }

  // Not logged in → redirect to role-specific login
  if (!isAuthenticated) {
    const loginPaths = {
      admin:       '/admin/login',
      faculty:     '/faculty/login',
      student:     '/student/login',
      invigilator: '/invigilator-login',
    }
    return <Navigate to={loginPaths[role] || '/'} replace />
  }

  // Wrong role
  if (user.role !== role) {
    const dashPaths = {
      admin:       '/admin/dashboard',
      faculty:     '/faculty/dashboard',
      student:     '/student/dashboard',
      invigilator: '/invigilator-login',
    }
    return <Navigate to={dashPaths[user.role] || '/'} replace />
  }

  return <Outlet />
}
