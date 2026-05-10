import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

class SocketService {
  constructor() {
    this.socket = null
  }

  connect() {
    if (this.socket) return
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    })

    this.socket.on('connect', () => {
      console.log('Connected to ProctorNet Socket Cluster')
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinExam(studentId, examId, name, usn) {
    this.socket?.emit('exam:join', { studentId, examId, name, usn })
  }

  joinInvigilator(examId) {
    this.socket?.emit('inv:join', { examId })
  }

  sendFlag(data) {
    this.socket?.emit('exam:flag', data)
  }

  onViolation(callback) {
    this.socket?.on('student:violation', callback)
  }

  onStudentOnline(callback) {
    this.socket?.on('student:online', callback)
  }

  onWarning(callback) {
    this.socket?.on('exam:warning', callback)
  }

  onTerminated(callback) {
    this.socket?.on('exam:terminated', callback)
  }

  sendWarning(studentId, message) {
    this.socket?.emit('inv:warn', { studentId, message })
  }

  terminateExam(studentId, reason) {
    this.socket?.emit('inv:terminate', { studentId, reason })
  }

  sendFrame(data) {
    this.socket?.emit('exam:frame', data)
  }

  onFrame(callback) {
    this.socket?.on('student:frame', callback)
  }
}

export default new SocketService()
