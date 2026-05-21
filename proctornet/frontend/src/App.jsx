import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from '@/context/AuthContext'

// Pages
import LandingPage from '@/pages/LandingPage'
import AdminLogin from '@/pages/admin/Login'
import FacultyLogin from '@/pages/faculty/Login'
import FacultyReg from '@/pages/faculty/Register'
import StudentLogin from '@/pages/student/Login'
import StudentReg from '@/pages/student/Register'
import InvLogin from '@/pages/invigilator/Login'

// Admin
import AdminDashboard from '@/pages/admin/Dashboard'
import AdminFaculty from '@/pages/admin/Faculty'
import AdminStudents from '@/pages/admin/Students'
import AdminExams from '@/pages/admin/Exams'
import AdminInvigilators from '@/pages/admin/Invigilators'
import AdminViolations from '@/pages/admin/Violations'
import AdminSettings from '@/pages/admin/Settings'
import AdminAnnouncements from '@/pages/admin/Announcements'
import AdminAuditLogs from '@/pages/admin/AuditLogs'
import AdminReports from '@/pages/admin/Reports'

// Faculty
import FacultyDashboard from '@/pages/faculty/Dashboard'
import FacultyStudents from '@/pages/faculty/Students'
import FacultyExams from '@/pages/faculty/Exams'
import CreateExam from '@/pages/faculty/CreateExam'
import ExamDetail from '@/pages/faculty/ExamDetail'
import QuestionPool from '@/pages/faculty/QuestionPool'
import FacultyResults from '@/pages/faculty/Results'

// Student
import StudentDashboard from '@/pages/student/Dashboard'
import StudentExams from '@/pages/student/Exams'
import ExamLobby from '@/pages/student/ExamLobby'
import SecurityCheck from '@/pages/student/SecurityCheck'
import ExamInterface from '@/pages/student/ExamInterface'
import StudentResults from '@/pages/student/Results'

// Invigilator
import InvDashboard from '@/pages/invigilator/Dashboard'

import ProtectedRoute from '@/components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
            },
            success: {
              style: {
                background: '#10B981',
              },
            },
            error: {
              style: {
                background: '#EF4444',
              },
            },
          }}
        />
        <Routes>
          {/* Landing / Redirect based on role */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Auth */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/faculty/login" element={<FacultyLogin />} />
          <Route path="/faculty/register" element={<FacultyReg />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/register" element={<StudentReg />} />
          <Route path="/invigilator-login" element={<InvLogin />} />

          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
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
          <Route path="/faculty/exams/:id/questions" element={<ProtectedRoute allowedRoles={['faculty']}><QuestionPool /></ProtectedRoute>} />
          <Route path="/faculty/exams/:id/results" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyResults /></ProtectedRoute>} />
          <Route path="/faculty/results" element={<ProtectedRoute allowedRoles={['faculty']}><FacultyResults /></ProtectedRoute>} />

          {/* Student Routes */}
          <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/exams" element={<ProtectedRoute allowedRoles={['student']}><StudentExams /></ProtectedRoute>} />
          <Route path="/student/exams/:id/lobby" element={<ProtectedRoute allowedRoles={['student']}><ExamLobby /></ProtectedRoute>} />
          <Route path="/student/exam-lobby/:id" element={<ProtectedRoute allowedRoles={['student']}><ExamLobby /></ProtectedRoute>} />
          <Route path="/student/exams/:id/security" element={<ProtectedRoute allowedRoles={['student']}><SecurityCheck /></ProtectedRoute>} />
          <Route path="/student/exams/:id/exam" element={<ProtectedRoute allowedRoles={['student']}><ExamInterface /></ProtectedRoute>} />
          <Route path="/student/results" element={<ProtectedRoute allowedRoles={['student']}><StudentResults /></ProtectedRoute>} />

          {/* Invigilator Routes */}
          <Route path="/invigilator/exam/:examId" element={<ProtectedRoute allowedRoles={['invigilator']}><InvDashboard /></ProtectedRoute>} />

          {/* Default Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
