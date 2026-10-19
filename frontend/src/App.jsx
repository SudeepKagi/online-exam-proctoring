import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const OnboardingPage = lazy(() => import('@/pages/auth/OnboardingPage'))
const PendingApprovalPage = lazy(() => import('@/pages/auth/PendingApprovalPage'))
const SettingsPage = lazy(() => import('@/pages/common/SettingsPage'))
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'))
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage'))
const AdminExamsPage = lazy(() => import('@/pages/admin/AdminExamsPage'))
const FacultyExamsPage = lazy(() => import('@/pages/faculty/FacultyExamsPage'))
const ExamManagePage = lazy(() => import('@/pages/faculty/ExamManagePage'))
const LiveConsolePage = lazy(() => import('@/pages/invigilator/LiveConsolePage')) // terms-ok: internal import
const StudentDashboardPage = lazy(() => import('@/pages/student/StudentDashboardPage'))
const PreExamCheckPage = lazy(() => import('@/pages/student/PreExamCheckPage'))
const ExamArenaPage = lazy(() => import('@/pages/student/ExamArenaPage'))

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">Loading session...</div>
  }
  if (!user) return <Navigate to="/login" replace />

  const status = user.status
  if (status === 'PENDING_SETUP' || status === 'REJECTED') {
    return <Navigate to="/onboarding" replace />
  }
  if (status === 'PENDING_APPROVAL') {
    return <Navigate to="/pending-approval" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role?.toUpperCase())) {
    const role = user.role?.toUpperCase()
    if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />
    if (role === 'FACULTY') return <Navigate to="/faculty/exams" replace />
    if (role === 'INVIGILATOR') return <Navigate to="/invigilator/console" replace /> // terms-ok: internal role guard
    return <Navigate to="/student/dashboard" replace />
  }
  return children
}

function OnboardingGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.status === 'ACTIVE') {
    const role = user.role?.toUpperCase()
    if (role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />
    if (role === 'FACULTY') return <Navigate to="/faculty/exams" replace />
    if (role === 'INVIGILATOR') return <Navigate to="/invigilator/console" replace /> // terms-ok: internal role guard
    return <Navigate to="/student/dashboard" replace />
  }
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">Loading view...</div>}>
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />

            {/* Role-Specific Tabbed Login Gate */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/faculty/login" element={<LoginPage />} />
            <Route path="/invigilator/login" element={<LoginPage />} /> {/* // terms-ok: internal route */}
            <Route path="/invigilator-login" element={<LoginPage />} /> {/* // terms-ok: internal route */}
            <Route path="/student/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* Onboarding & Approval Queue */}
            <Route path="/onboarding" element={<OnboardingGuard><OnboardingPage /></OnboardingGuard>} />
            <Route path="/pending-approval" element={<OnboardingGuard><PendingApprovalPage /></OnboardingGuard>} />

            {/* Common Settings Routes */}
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['STUDENT', 'FACULTY', 'ADMIN']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/student/settings" element={<ProtectedRoute allowedRoles={['STUDENT']}><SettingsPage /></ProtectedRoute>} />
            <Route path="/faculty/settings" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><SettingsPage /></ProtectedRoute>} />

            {/* Role Base Aliases */}
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/faculty" element={<Navigate to="/faculty/exams" replace />} />
            <Route path="/invigilator" element={<Navigate to="/invigilator/console" replace />} /> {/* // terms-ok: internal route */}
            <Route path="/student" element={<Navigate to="/student/dashboard" replace />} />
            <Route path="/student/enrollment" element={<Navigate to="/student/dashboard" replace />} />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboardPage /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminUsersPage /></ProtectedRoute>} />
            <Route path="/admin/exams" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminExamsPage /></ProtectedRoute>} />

            {/* Faculty Routes */}
            <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyExamsPage /></ProtectedRoute>} />
            <Route path="/faculty/exams" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><FacultyExamsPage /></ProtectedRoute>} />
            <Route path="/faculty/exams/:id" element={<ProtectedRoute allowedRoles={['FACULTY', 'ADMIN']}><ExamManagePage /></ProtectedRoute>} />

            {/* Invigilator Routes */}
            <Route path="/invigilator/dashboard" element={<ProtectedRoute allowedRoles={['INVIGILATOR', 'FACULTY', 'ADMIN']}><LiveConsolePage /></ProtectedRoute>} /> {/* // terms-ok: internal route */}
            <Route path="/invigilator/console" element={<ProtectedRoute allowedRoles={['INVIGILATOR', 'FACULTY', 'ADMIN']}><LiveConsolePage /></ProtectedRoute>} /> {/* // terms-ok: internal route */}

            {/* Student Routes */}
            <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboardPage /></ProtectedRoute>} />
            <Route path="/student/exams" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboardPage /></ProtectedRoute>} />
            <Route path="/student/exams/:id/pre-check" element={<ProtectedRoute allowedRoles={['STUDENT']}><PreExamCheckPage /></ProtectedRoute>} />
            <Route path="/student/exams/:id/lobby" element={<ProtectedRoute allowedRoles={['STUDENT']}><PreExamCheckPage /></ProtectedRoute>} />
            <Route path="/student/exams/:id/security" element={<ProtectedRoute allowedRoles={['STUDENT']}><PreExamCheckPage /></ProtectedRoute>} />
            <Route path="/student/exams/:id/arena" element={<ProtectedRoute allowedRoles={['STUDENT']}><ExamArenaPage /></ProtectedRoute>} /> {/* // terms-ok: internal route */}
            <Route path="/student/exams/:id/exam" element={<ProtectedRoute allowedRoles={['STUDENT']}><ExamArenaPage /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
