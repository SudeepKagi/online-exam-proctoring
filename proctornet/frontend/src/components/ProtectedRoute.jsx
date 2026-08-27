import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import LoadingSpinner from '@/components/common/LoadingSpinner'

export default function ProtectedRoute({ children, allowedRoles, role }) {
  const { user, isAuthenticated, role: userRole, isLoading } = useAuth()
  const invToken = localStorage.getItem('inv_token')
  
  // Normalize roles to an array
  const roles = allowedRoles || (role ? [role] : [])

  if (isLoading) {
    return <LoadingSpinner />
  }

  // Force password change if account is flagged
  if (isAuthenticated && user?.mustChangePassword && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  // Mandatory student biometric enrollment & admin verification guard
  if (
    isAuthenticated &&
    userRole === 'student' &&
    !user?.mustChangePassword &&
    user?.profileStatus !== 'VERIFIED' &&
    user?.profileStatus !== 'LOCKED' &&
    window.location.pathname !== '/student/enrollment'
  ) {
    return <Navigate to="/student/enrollment" replace />
  }

  // Invigilator logic: if role is invigilator, check inv_token
  if (roles.includes('invigilator')) {
    if (invToken) {
      return children
    }
  }

  if (!isAuthenticated) {
    const loginRoutes = {
      admin: '/admin/login',
      faculty: '/faculty/login',
      student: '/student/login',
      invigilator: '/invigilator-login'
    }
    // Find the first matching login route from the required roles
    const targetRole = roles.find(r => loginRoutes[r]) || 'student'
    return <Navigate to={loginRoutes[targetRole] || '/login'} replace />
  }

  if (roles.length > 0 && !roles.includes(userRole)) {
    const dashRoutes = {
      admin: '/admin/dashboard',
      faculty: '/faculty/dashboard',
      student: '/student/dashboard'
    }
    return <Navigate to={dashRoutes[userRole] || '/login'} replace />
  }

  return children
}

