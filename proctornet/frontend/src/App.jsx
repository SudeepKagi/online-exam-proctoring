import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import ProtectedRoute from '@/components/ProtectedRoute'

// Lazy-loaded Public & Auth Pages
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const AdminLogin = lazy(() => import('@/pages/admin/Login'))
const FacultyLogin = lazy(() => import('@/pages/faculty/Login'))
const StudentLogin = lazy(() => import('@/pages/student/Login'))
const InvLogin = lazy(() => import('@/pages/invigilator/Login'))
const ChangePassword = lazy(() => import('@/pages/ChangePassword'))

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminFaculty = lazy(() => import('@/pages/admin/Faculty'))
const AdminStudents = lazy(() => import('@/pages/admin/Students'))
const AdminExams = lazy(() => import('@/pages/admin/Exams'))
const AdminInvigilators = lazy(() => import('@/pages/admin/Invigilators'))
const AdminViolations = lazy(() => import('@/pages/admin/Violations'))
const AdminSettings = lazy(() => import('@/pages/admin/Settings'))
const AdminAnnouncements = lazy(() => import('@/pages/admin/Announcements'))
const AdminAuditLogs = lazy(() => import('@/pages/admin/AuditLogs'))
const AdminReports = lazy(() => import('@/pages/admin/Reports'))
const BulkCreateAccounts = lazy(() => import('@/pages/admin/BulkCreateAccounts'))
const AdminEnrollmentReview = lazy(() => import('@/pages/admin/AdminEnrollmentReview'))
const CreateStudentAccount = lazy(() => import('@/pages/admin/CreateStudentAccount'))
const CreateFacultyAccount = lazy(() => import('@/pages/admin/CreateFacultyAccount'))

// Lazy-loaded Faculty Pages
const FacultyDashboard = lazy(() => import('@/pages/faculty/Dashboard'))
const FacultyStudents = lazy(() => import('@/pages/faculty/Students'))
const FacultyExams = lazy(() => import('@/pages/faculty/Exams'))
const CreateExam = lazy(() => import('@/pages/faculty/CreateExam'))
const ExamDetail = lazy(() => import('@/pages/faculty/ExamDetail'))
const QuestionPool = lazy(() => import('@/pages/faculty/QuestionPool'))
const FacultyResults = lazy(() => import('@/pages/faculty/Results'))
const StudentDossier = lazy(() => import('@/pages/faculty/StudentDossier'))

// Lazy-loaded Student Pages
const StudentDashboard = lazy(() => import('@/pages/student/Dashboard'))
const StudentExams = lazy(() => import('@/pages/student/Exams'))
const ExamLobby = lazy(() => import('@/pages/student/ExamLobby'))
const SecurityCheck = lazy(() => import('@/pages/student/SecurityCheck'))
const ExamInterface = lazy(() => import('@/pages/student/ExamInterface'))
const StudentResults = lazy(() => import('@/pages/student/Results'))
const StudentEnrollment = lazy(() => import('@/pages/student/StudentEnrollment'))
const BYODDeviceCheck = lazy(() => import('@/pages/student/BYODDeviceCheck'))
const StudentProfile = lazy(() => import('@/pages/student/Profile'))
const SupportAndRules = lazy(() => import('@/pages/student/SupportAndRules'))

// Lazy-loaded Invigilator Pages
const InvDashboard = lazy(() => import('@/pages/invigilator/Dashboard'))
const InvigilatorLiveGrid = lazy(() => import('@/pages/invigilator/InvigilatorLiveGrid'))
const InvigilatorViolations = lazy(() => import('@/pages/invigilator/Violations'))

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#091a2f] flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center animate-spin">
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
        </div>
        <span className="text-sm font-semibold text-slate-300 tracking-wide">Loading workspace...</span>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#091a2f',
              color: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #13335f',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'Satoshi, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
              boxShadow: '0 4px 12px -2px rgba(9, 26, 47, 0.15)'
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
        <ErrorBoundary>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              {/* Landing / Redirect based on role */}
              <Route path="/" element={<LandingPage />} />
              
              {/* Auth */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/faculty/login" element={<FacultyLogin />} />
              <Route path="/student/login" element={<StudentLogin />} />
              <Route path="/invigilator-login" element={<InvLogin />} />
              <Route path="/invigilator/login" element={<InvLogin />} />

              {/* Forced Password Change */}
              <Route path="/change-password" element={<ProtectedRoute allowedRoles={['student', 'faculty', 'admin']}><ChangePassword /></ProtectedRoute>} />

              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/create-student" element={<ProtectedRoute allowedRoles={['admin']}><CreateStudentAccount /></ProtectedRoute>} />
              <Route path="/admin/create-faculty" element={<ProtectedRoute allowedRoles={['admin']}><CreateFacultyAccount /></ProtectedRoute>} />
              <Route path="/admin/bulk-create" element={<ProtectedRoute allowedRoles={['admin']}><BulkCreateAccounts /></ProtectedRoute>} />
              <Route path="/admin/enrollment-review" element={<ProtectedRoute allowedRoles={['admin']}><AdminEnrollmentReview /></ProtectedRoute>} />
              <Route path="/admin/faculty" element={<ProtectedRoute allowedRoles={['admin']}><AdminFaculty /></ProtectedRoute>} />
              <Route path="/admin/students" element={<ProtectedRoute allowedRoles={['admin']}><AdminStudents /></ProtectedRoute>} />
              <Route path="/admin/exams" element={<ProtectedRoute allowedRoles={['admin']}><AdminExams /></ProtectedRoute>} />
              <Route path="/admin/invigilators" element={<ProtectedRoute allowedRoles={['admin']}><AdminInvigilators /></ProtectedRoute>} />
              <Route path="/admin/violations" element={<ProtectedRoute allowedRoles={['admin']}><AdminViolations /></ProtectedRoute>} />
              <Route path="/admin/announcements" element={<ProtectedRoute allowedRoles={['admin']}><AdminAnnouncements /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><AdminSettings /></ProtectedRoute>} />
              <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><AdminAuditLogs /></ProtectedRoute>} />
              <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><AdminReports /></ProtectedRoute>} />

              {/* Faculty Routes */}
              <Route path="/faculty/dashboard" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyDashboard /></ProtectedRoute>} />
              <Route path="/faculty/students" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyStudents /></ProtectedRoute>} />
              <Route path="/faculty/exams" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyExams /></ProtectedRoute>} />
              <Route path="/faculty/exams/create" element={<ProtectedRoute allowedRoles={['faculty']}><CreateExam /></ProtectedRoute>} />
              <Route path="/faculty/exams/:id" element={<ProtectedRoute allowedRoles={['faculty']}><ExamDetail /></ProtectedRoute>} />
              <Route path="/faculty/exams/:id/edit" element={<ProtectedRoute allowedRoles={['faculty']}><ExamDetail /></ProtectedRoute>} />
              <Route path="/faculty/exams/:id/questions" element={<ProtectedRoute allowedRoles={['faculty']}><QuestionPool /></ProtectedRoute>} />
              <Route path="/faculty/results" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyResults /></ProtectedRoute>} />
              <Route path="/faculty/results/:id" element={<ProtectedRoute allowedRoles={['faculty']}><StudentDossier /></ProtectedRoute>} />

              {/* Student Routes */}
              <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/profile" element={<ProtectedRoute allowedRoles={['student']}><StudentProfile /></ProtectedRoute>} />
              <Route path="/student/enrollment" element={<ProtectedRoute allowedRoles={['student']}><StudentEnrollment /></ProtectedRoute>} />
              <Route path="/student/device-check" element={<ProtectedRoute allowedRoles={['student']}><BYODDeviceCheck /></ProtectedRoute>} />
              <Route path="/student/device-check/:examId" element={<ProtectedRoute allowedRoles={['student']}><BYODDeviceCheck /></ProtectedRoute>} />
              <Route path="/student/exams" element={<ProtectedRoute allowedRoles={['student']}><StudentExams /></ProtectedRoute>} />
              <Route path="/student/exams/:id/lobby" element={<ProtectedRoute allowedRoles={['student']}><ExamLobby /></ProtectedRoute>} />
              <Route path="/student/exams/:id/security" element={<ProtectedRoute allowedRoles={['student']}><SecurityCheck /></ProtectedRoute>} />
              <Route path="/student/exams/:id/exam" element={<ProtectedRoute allowedRoles={['student']}><ExamInterface /></ProtectedRoute>} />
              <Route path="/student/results" element={<ProtectedRoute allowedRoles={['student']}><StudentResults /></ProtectedRoute>} />
              <Route path="/student/support" element={<ProtectedRoute allowedRoles={['student']}><SupportAndRules /></ProtectedRoute>} />
              <Route path="/student/rules" element={<ProtectedRoute allowedRoles={['student']}><SupportAndRules /></ProtectedRoute>} />

              {/* Invigilator Routes */}
              <Route path="/invigilator/dashboard" element={<ProtectedRoute allowedRoles={['invigilator']}><InvDashboard /></ProtectedRoute>} />
              <Route path="/invigilator/history" element={<ProtectedRoute allowedRoles={['invigilator']}><InvDashboard /></ProtectedRoute>} />
              <Route path="/invigilator/violations" element={<ProtectedRoute allowedRoles={['invigilator']}><InvigilatorViolations /></ProtectedRoute>} />
              <Route path="/invigilator/live-grid/:examId" element={<ProtectedRoute allowedRoles={['invigilator']}><InvigilatorLiveGrid /></ProtectedRoute>} />
              <Route path="/invigilator/exam/:examId" element={<ProtectedRoute allowedRoles={['invigilator']}><InvigilatorLiveGrid /></ProtectedRoute>} />

              {/* Catch-all redirect to Landing */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
