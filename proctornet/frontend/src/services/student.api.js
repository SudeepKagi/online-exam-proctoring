import api from './api'

export const getMyExams = (params) => api.get('/student/exams', { params })
export const getExamDetails = (id) => api.get(`/student/exams/${id}`)
export const startExam = (id) => api.post(`/student/exams/${id}/start`)
