import { Actor } from './actors'

export interface AttemptServerState {
  id: string
  status: string
  currentScore?: number
  answersByQuestion?: Record<string, string[]>
}

export class ApiReadHelper {
  private actor: Actor
  private baseUrl: string

  constructor(actor: Actor, baseUrl = 'http://localhost:5000') {
    this.actor = actor
    this.baseUrl = baseUrl
  }

  private async request(method: string, path: string) {
    const cookies = await this.actor.context.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const res = await this.actor.page.request.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Cookie': cookieHeader,
        'Accept': 'application/json'
      }
    })

    const body = await res.json().catch(() => null)
    return { status: res.status(), body }
  }

  async getAdminDepartments() {
    return this.request('GET', '/api/v1/admin/departments')
  }

  async getAdminFaculty() {
    return this.request('GET', '/api/v1/admin/faculty')
  }

  async getAdminStudents() {
    return this.request('GET', '/api/v1/admin/students')
  }

  async getExamDetails(examId: string) {
    return this.request('GET', `/api/v1/exams/${examId}`)
  }

  async getAttemptAnswers(attemptId: string) {
    return this.request('GET', `/api/v1/student/attempts/${attemptId}/answers`)
  }

  async getStudentExams() {
    return this.request('GET', '/api/v1/student/exams')
  }

  async getAuditLogs(limit = 20) {
    return this.request('GET', `/api/v1/audit/logs?limit=${limit}`)
  }

  async getAuthMe() {
    return this.request('GET', '/api/v1/auth/me')
  }

  async getStudentProfile() {
    return this.request('GET', '/api/v1/student/profile')
  }

  async getAttemptDetails(attemptId: string) {
    return this.request('GET', `/api/v1/attempts/${attemptId}`)
  }

  async getFacultyExamResults(examId: string) {
    return this.request('GET', `/api/v1/faculty/exams/${examId}/results`)
  }

  async postRaw(path: string, payload: any) {
    const cookies = await this.actor.context.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

    const res = await this.actor.page.request.fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: JSON.stringify(payload)
    })

    const body = await res.json().catch(() => null)
    return { status: res.status(), body }
  }
}

export const api = {
  for: (actor: Actor) => new ApiReadHelper(actor)
}
