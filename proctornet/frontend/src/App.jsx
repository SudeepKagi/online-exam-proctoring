import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'

// ── Lazy page imports (added as each step is built) ──
import LandingPage from '@/pages/LandingPage'

// Auth pages
import AdminLogin    from '@/pages/admin/Login'
import FacultyLogin  from '@/pages/faculty/Login'
import FacultyReg    from '@/pages/faculty/Register'
import StudentLogin  from '@/pages/student/Login'
import StudentReg    from '@/pages/student/Register'
import InvLogin      from '@/pages/invigilator/Login'

// Admin pages
import AdminDashboard     from '@/pages/admin/Dashboard'
import AdminFaculty       from '@/pages/admin/Faculty'
import AdminStudents      from '@/pages/admin/Students'
import AdminExams         from '@/pages/admin/Exams'
import AdminInvigilators  from '@/pages/admin/Invigilators'
import AdminViolations    from '@/pages/admin/Violations'
import AdminSettings      from '@/pages/admin/Settings'
import AdminAnnouncements from '@/pages/admin/Announcements'
import AdminAuditLogs     from '@/pages/admin/AuditLogs'
import AdminReports       from '@/pages/admin/Reports'

// Faculty pages
import FacultyDashboard from '@/pages/faculty/Dashboard'
import FacultyStudents  from '@/pages/faculty/Students'
import FacultyExams     from '@/pages/faculty/Exams'
import CreateExam       from '@/pages/faculty/CreateExam'
import ExamDetail       from '@/pages/faculty/ExamDetail'
import QuestionPool     from '@/pages/faculty/QuestionPool'
import FacultyResults   from '@/pages/faculty/Results'

// Student pages
import StudentDashboard from '@/pages/student/Dashboard'
import StudentExams     from '@/pages/student/Exams'
import ExamLobby        from '@/pages/student/ExamLobby'
import SecurityCheck    from '@/pages/student/SecurityCheck'
import ExamInterface    from '@/pages/student/ExamInterface'
import StudentResults   from '@/pages/student/Results'

// Invigilator pages
import InvDashboard from '@/pages/invigilator/Dashboard'

// Route guards
import PrivateRoute from '@/components/common/PrivateRoute'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Landing ── */}
          <Route path="/" element={<LandingPage />} />

          {/* ── Auth Routes ── */}
          <Route path="/admin/login"          element={<AdminLogin />} />
          <Route path="/faculty/login"        element={<FacultyLogin />} />
          <Route path="/faculty/register"     element={<FacultyReg />} />
          <Route path="/student/login"        element={<StudentLogin />} />
          <Route path="/student/register"     element={<StudentReg />} />
          <Route path="/invigilator-login"    element={<InvLogin />} />

          {/* ── Admin Routes (protected) ── */}
          <Route path="/admin" element={<PrivateRoute role="admin" />}>
            <Route path="dashboard"     element={<AdminDashboard />} />
            <Route path="faculty"       element={<AdminFaculty />} />
            <Route path="students"      element={<AdminStudents />} />
            <Route path="exams"         element={<AdminExams />} />
            <Route path="invigilators"  element={<AdminInvigilators />} />
            <Route path="violations"    element={<AdminViolations />} />
            <Route path="settings"      element={<AdminSettings />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="audit-logs"    element={<AdminAuditLogs />} />
            <Route path="reports"       element={<AdminReports />} />
            {/* Default redirect */}
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ── Faculty Routes (protected) ── */}
          <Route path="/faculty" element={<PrivateRoute role="faculty" />}>
            <Route path="dashboard"            element={<FacultyDashboard />} />
            <Route path="students"             element={<FacultyStudents />} />
            <Route path="exams"                element={<FacultyExams />} />
            <Route path="exams/create"         element={<CreateExam />} />
            <Route path="exams/:id"            element={<ExamDetail />} />
            <Route path="exams/:id/questions"  element={<QuestionPool />} />
            <Route path="exams/:id/results"    element={<FacultyResults />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ── Student Routes (protected) ── */}
          <Route path="/student" element={<PrivateRoute role="student" />}>
            <Route path="dashboard"            element={<StudentDashboard />} />
            <Route path="exams"                element={<StudentExams />} />
            <Route path="exams/:id/lobby"      element={<ExamLobby />} />
            <Route path="exams/:id/security"   element={<SecurityCheck />} />
            <Route path="exams/:id/exam"       element={<ExamInterface />} />
            <Route path="results"              element={<StudentResults />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          {/* ── Invigilator Routes (protected) ── */}
          <Route path="/invigilator" element={<PrivateRoute role="invigilator" />}>
            <Route path="exam/:id" element={<InvDashboard />} />
          </Route>

          {/* ── 404 ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
