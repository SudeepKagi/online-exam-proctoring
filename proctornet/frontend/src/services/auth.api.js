import api from './api'

// ── Admin ──────────────────────────────────────────
export const adminLogin = (email, password) =>
  api.post('/auth/admin/login', { email, password })

// ── Faculty ────────────────────────────────────────
export const facultyLogin = (email, password) =>
  api.post('/auth/faculty/login', { email, password })

export const facultyRegister = (data) =>
  api.post('/auth/faculty/register', data)

// ── Student ────────────────────────────────────────
export const studentLogin = (usn, password) =>
  api.post('/auth/student/login', { usn, password })

export const studentRegister = (data) =>
  api.post('/auth/student/register', data)

// ── Invigilator ────────────────────────────────────
export const invigilatorLogin = (formData) =>
  api.post('/auth/invigilator/login', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// ── Verify token ────────────────────────────────────
export const verifyMe = () => api.get('/auth/me')
