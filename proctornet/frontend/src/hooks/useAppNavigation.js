import { useNavigate } from 'react-router-dom'

export function useAppNavigation() {
  const navigate = useNavigate()
  
  return {
    // Auth
    goHome: () => navigate('/'),
    goToLogin: () => navigate('/login'),
    goToStudentLogin: () => 
      navigate('/student/login'),
    goToFacultyLogin: () => 
      navigate('/faculty/login'),
    goToAdminLogin: () => 
      navigate('/admin/login'),
    goToInvigilatorLogin: () => 
      navigate('/invigilator-login'),
    goToStudentRegister: () => 
      navigate('/student/register'),
    goToFacultyRegister: () => 
      navigate('/faculty/register'),
    
    // Admin
    goToAdminDashboard: () => 
      navigate('/admin/dashboard'),
    goToAdminFaculty: () => 
      navigate('/admin/faculty'),
    goToAdminStudents: () => 
      navigate('/admin/students'),
    goToAdminExams: () => 
      navigate('/admin/exams'),
    goToAdminSettings: () => 
      navigate('/admin/settings'),
    goToAdminViolations: () => 
      navigate('/admin/violations'),
    goToAdminAnnouncements: () => 
      navigate('/admin/announcements'),
    goToAdminAuditLogs: () => 
      navigate('/admin/audit-logs'),
    
    // Faculty
    goToFacultyDashboard: () => 
      navigate('/faculty/dashboard'),
    goToFacultyExams: () => 
      navigate('/faculty/exams'),
    goToCreateExam: () => 
      navigate('/faculty/exams/create'),
    goToExamDetail: (id) => 
      navigate(`/faculty/exams/${id}`),
    goToQuestionPool: (id) => 
      navigate(`/faculty/exams/${id}/questions`),
    goToExamResults: (id) => 
      navigate(`/faculty/exams/${id}/results`),
    goToFacultyStudents: () => 
      navigate('/faculty/students'),
    
    // Student
    goToStudentDashboard: () => 
      navigate('/student/dashboard'),
    goToStudentExams: () => 
      navigate('/student/exams'),
    goToExamLobby: (id) => 
      navigate(`/student/exams/${id}/lobby`),
    goToSecurityCheck: (id) => 
      navigate(`/student/exams/${id}/security`),
    goToExamInterface: (id) => 
      navigate(`/student/exams/${id}/exam`),
    goToStudentResults: () => 
      navigate('/student/results'),
    
    // Invigilator
    goToInvigilatorDashboard: (examId) => 
      navigate(`/invigilator/exam/${examId}`),
    
    // Utility
    goBack: () => navigate(-1),
  }
}
