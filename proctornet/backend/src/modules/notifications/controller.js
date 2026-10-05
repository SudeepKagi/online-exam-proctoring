const express = require('express')
const { requireAuth } = require('../../middleware/authentication')
const { prisma } = require('../../infra/postgres/client')
const { ROLES, normalizeRole } = require('../../shared/roles')

const router = express.Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role) || ROLES.STUDENT
    const userId = req.user?.id
    const notifications = []

    // 1. Fetch system announcements
    const announcements = await prisma.announcement.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' }
    }).catch(() => [])

    for (const a of announcements) {
      notifications.push({
        id: `announcement-${a.id}`,
        type: 'ANNOUNCEMENT',
        title: a.title,
        desc: a.message,
        urgency: a.priority.toLowerCase(),
        time: a.createdAt
      })
    }

    // 2. Role-specific alerts
    if (role === ROLES.ADMIN) {
      const [pendingStudents, pendingFaculty] = await Promise.all([
        prisma.student.findMany({
          where: { approvalStatus: 'PENDING' },
          select: { id: true, name: true, usn: true, createdAt: true },
          take: 5
        }).catch(() => []),
        prisma.faculty.findMany({
          where: { isApproved: false },
          select: { id: true, name: true, employeeId: true, createdAt: true },
          take: 5
        }).catch(() => [])
      ])

      for (const s of pendingStudents) {
        notifications.push({
          id: `student-approval-${s.id}`,
          type: 'STUDENT_APPROVAL',
          title: 'Student Biometric Approval Needed',
          desc: `${s.name} (${s.usn || 'N/A'}) submitted ID verification credentials.`,
          link: '/admin/students',
          urgency: 'high',
          time: s.createdAt
        })
      }

      for (const f of pendingFaculty) {
        notifications.push({
          id: `faculty-approval-${f.id}`,
          type: 'FACULTY_APPROVAL',
          title: 'Faculty Account Pending Approval',
          desc: `${f.name} (${f.employeeId || 'N/A'}) requires portal authorization.`,
          link: '/admin/faculty',
          urgency: 'high',
          time: f.createdAt
        })
      }
    } else if (role === ROLES.FACULTY) {
      const liveExams = await prisma.exam.findMany({
        where: { facultyId: userId, status: 'LIVE' },
        select: { id: true, title: true, startTime: true }
      }).catch(() => [])

      for (const e of liveExams) {
        notifications.push({
          id: `live-exam-${e.id}`,
          type: 'EXAM_LIVE',
          title: 'Exam Currently In Progress',
          desc: `${e.title} is currently active and being proctored.`,
          link: `/faculty/exams/${e.id}`,
          urgency: 'medium',
          time: e.startTime
        })
      }
    } else if (role === ROLES.STUDENT) {
      const student = await prisma.student.findUnique({
        where: { id: userId },
        select: { departmentCode: true, semester: true }
      }).catch(() => null)

      if (student) {
        const upcomingExams = await prisma.exam.findMany({
          where: {
            status: { in: ['PUBLISHED', 'LIVE'] },
            allowedDepartments: { has: student.departmentCode },
            allowedSemesters: { has: student.semester },
            endTime: { gt: new Date() }
          },
          select: { id: true, title: true, startTime: true },
          take: 5
        }).catch(() => [])

        for (const e of upcomingExams) {
          notifications.push({
            id: `upcoming-exam-${e.id}`,
            type: 'UPCOMING_EXAM',
            title: 'Upcoming Scheduled Examination',
            desc: `${e.title} is scheduled for your department.`,
            link: `/student/exam/${e.id}`,
            urgency: 'high',
            time: e.startTime
          })
        }
      }
    }

    res.status(200).json({
      success: true,
      unreadCount: notifications.length,
      notifications
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
