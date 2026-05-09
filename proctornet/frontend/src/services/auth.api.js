import api from './api'

// ── Admin ──────────────────────────────────────────
export const adminLogin = (email, password) =>
  api.post('/api/auth/admin/login', { email, password })

// ── Faculty ────────────────────────────────────────
export const facultyLogin = (email, password) =>
  api.post('/api/auth/faculty/login', { email, password })

export const facultyRegister = (data) =>
  api.post('/api/auth/faculty/register', data)

// ── Student ────────────────────────────────────────
export const studentLogin = (usn, password) =>
  api.post('/api/auth/student/login', { usn, password })

export const studentRegister = (data) =>
  api.post('/api/auth/student/register', data)

// ── Invigilator ────────────────────────────────────
export const invigilatorLogin = (formData) =>
  api.post('/api/auth/invigilator/login', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// ── Verify token ────────────────────────────────────
export const verifyMe = () => api.get('/api/auth/me')
