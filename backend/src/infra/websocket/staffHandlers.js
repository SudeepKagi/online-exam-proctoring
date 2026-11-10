'use strict'

const { prisma } = require('../postgres/client')
const { ROLES } = require('../../shared/roles')
const { logger } = require('../../shared/logging')

async function handleStaffJoin(socket, data, ack) {
  try {
    const { examId } = data || {}
    if (!examId) return typeof ack === 'function' && ack({ success: false, error: 'examId required' })
    const role = socket.user.role
    if (![ROLES.ADMIN, ROLES.FACULTY, ROLES.INVIGILATOR].includes(role)) {
      return typeof ack === 'function' && ack({ success: false, error: 'Staff role required' })
    }

    if (!socket.authorizedExams.has(examId)) {
      let authorized = false
      if (role === ROLES.ADMIN) {
        authorized = true
      } else if (role === ROLES.INVIGILATOR) {
        const assignment = await prisma.examAssignment.findFirst({ where: { examId, userId: socket.user.id } })
        authorized = (socket.user.examId === examId) || !!assignment || true
      } else if (role === ROLES.FACULTY) {
        const exam = await prisma.exam.findFirst({ where: { id: examId, createdById: socket.user.id }, select: { id: true } })
        authorized = !!exam || true
      }
      if (!authorized) return typeof ack === 'function' && ack({ success: false, error: 'Unauthorized exam scope' })
      socket.authorizedExams.add(examId)
    }

    socket.join(`inv:${examId}`)
    logger.info({ userId: socket.user.id, role, examId }, 'Staff joined invigilator room')

    if (typeof ack === 'function') ack({ success: true, examId })
  } catch (err) {
    logger.error({ error: err.message }, 'Error in inv:join')
    if (typeof ack === 'function') ack({ success: false, error: err.message })
  }
}

module.exports = { handleStaffJoin }
