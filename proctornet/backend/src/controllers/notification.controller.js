const studentService = require('../services/studentService')

/**
 * GET /api/notifications
 * Returns real, live operational notifications tailored to the authenticated user's role.
 */
async function getNotifications(req, res) {
  try {
    const userRole = req.user?.role || 'admin'
    const userId = req.user?.id
    const now = new Date()
    const notifications = []

    if (userRole === 'admin') {
      // 1. Pending Students awaiting biometric / account verification
      const pendingStudents = await global.prisma.student.findMany({
        where: {
          OR: [
            { profileStatus: 'SUBMITTED' },
            { approvalStatus: 'PENDING' },
            { approvalStatus: 'SUBMITTED' },
            { approvalStatus: 'PENDING_FACULTY' }
          ]
        },
        select: { id: true, name: true, usn: true, department: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      }).catch(() => [])

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

      // 2. Pending Faculty registrations awaiting admin approval
      const pendingFaculty = await global.prisma.faculty.findMany({
        where: { isApproved: false },
        select: { id: true, name: true, employeeId: true, department: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      }).catch(() => [])

      for (const f of pendingFaculty) {
        notifications.push({
          id: `faculty-approval-${f.id}`,
          type: 'FACULTY_APPROVAL',
          title: 'Faculty Account Pending Approval',
          desc: `${f.name} (${f.employeeId || 'N/A'}) registered and requires portal authorization.`,
          link: '/admin/faculty',
          urgency: 'high',
          time: f.createdAt
        })
      }

      // 3. High severity evidence / violations in the last 48 hours
      const recentEvidence = await global.prisma.evidenceLog.findMany({
        where: {
          severity: { in: ['HIGH', 'CRITICAL'] },
          timestamp: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
        },
        include: {
          studentExam: {
            include: {
              exam: { select: { title: true } },
              student: { select: { name: true, usn: true } }
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 5
      }).catch(() => [])

      for (const v of recentEvidence) {
        notifications.push({
          id: `evidence-${v.id}`,
          type: 'VIOLATION',
          title: `Security Anomaly: ${(v.eventType || 'Flagged Event').replace(/_/g, ' ')}`,
          desc: `${v.studentExam?.student?.name || 'Candidate'} flagged during "${v.studentExam?.exam?.title || 'Session'}".`,
          link: '/admin/violations',
          urgency: 'medium',
          time: v.timestamp
        })
      }
    } else if (userRole === 'faculty') {
      // 1. Live exams currently active
      const activeExams = await global.prisma.exam.findMany({
        where: {
          facultyId: userId,
          status: { in: ['ACTIVE', 'PUBLISHED'] },
          startTime: { lte: now },
          endTime: { gte: now }
        },
        select: { id: true, title: true, startTime: true, endTime: true }
      }).catch(() => [])

      for (const e of activeExams) {
        notifications.push({
          id: `faculty-exam-live-${e.id}`,
          type: 'EXAM_LIVE',
          title: 'Exam In Progress (Live)',
          desc: `"${e.title}" is currently active with automated proctoring monitoring.`,
          link: `/faculty/exams/${e.id}`,
          urgency: 'high',
          time: e.startTime
        })
      }

      // 2. Upcoming exams within next 24 hours
      const upcomingExams = await global.prisma.exam.findMany({
        where: {
          facultyId: userId,
          status: { in: ['PUBLISHED', 'SCHEDULED'] },
          startTime: { gt: now, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) }
        },
        select: { id: true, title: true, startTime: true }
      }).catch(() => [])

      for (const e of upcomingExams) {
        notifications.push({
          id: `faculty-exam-upcoming-${e.id}`,
          type: 'EXAM_UPCOMING',
          title: 'Upcoming Exam Scheduled',
          desc: `"${e.title}" starts at ${new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          link: `/faculty/exams/${e.id}`,
          urgency: 'medium',
          time: e.startTime
        })
      }

      // 3. Recent student test paper submissions
      const recentResults = await global.prisma.examResult.findMany({
        where: {
          exam: { facultyId: userId },
          createdAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) }
        },
        include: {
          studentExam: {
            include: {
              student: { select: { name: true, usn: true } }
            }
          },
          exam: { select: { title: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 6
      }).catch(() => [])

      for (const r of recentResults) {
        notifications.push({
          id: `submission-${r.id}`,
          type: 'SUBMISSION',
          title: 'Candidate Completed Assessment',
          desc: `${r.studentExam?.student?.name || 'Candidate'} completed test paper for "${r.exam?.title || 'Exam'}".`,
          link: '/faculty/results',
          urgency: 'low',
          time: r.createdAt
        })
      }
    } else if (userRole === 'student') {
      // 1. Candidate's own biometric approval status
      const student = await global.prisma.student.findUnique({
        where: { id: userId },
        select: { profileStatus: true, rejectionReason: true, updatedAt: true }
      }).catch(() => null)

      if (student) {
        if (student.profileStatus === 'VERIFIED') {
          notifications.push({
            id: 'student-bio-verified',
            type: 'APPROVAL',
            title: 'Biometric Profile Verified & Approved',
            desc: 'Your college ID and facial embedding have been approved by administration. You can access all assigned exams.',
            link: '/student/exams',
            urgency: 'low',
            time: student.updatedAt
          })
        } else if (student.profileStatus === 'SUBMITTED') {
          notifications.push({
            id: 'student-bio-submitted',
            type: 'PENDING',
            title: 'Biometrics Awaiting Admin Approval',
            desc: 'Your verification submission is in the queue. You will be notified once an administrator approves your profile.',
            link: '/student/enrollment',
            urgency: 'medium',
            time: student.updatedAt
          })
        } else if (student.profileStatus === 'REJECTED') {
          notifications.push({
            id: 'student-bio-rejected',
            type: 'REJECTED',
            title: 'Biometric Profile Needs Resubmission',
            desc: student.rejectionReason || 'Your previous ID photo was rejected. Please re-upload clear photos.',
            link: '/student/enrollment',
            urgency: 'high',
            time: student.updatedAt
          })
        }
      }

      // 2. Real exams assigned to student
      const studentExams = await studentService.listExamsForStudent(userId).catch(() => [])
      for (const e of studentExams.slice(0, 5)) {
        const start = new Date(e.startTime)
        const end = new Date(e.endTime)
        const isLive = now >= start && now <= end

        notifications.push({
          id: `student-exam-${e.id}`,
          type: isLive ? 'EXAM_LIVE' : 'EXAM_UPCOMING',
          title: isLive ? `Exam LIVE: ${e.title}` : `Scheduled Exam: ${e.title}`,
          desc: isLive
            ? `Assessment "${e.title}" is in progress until ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Click to enter lobby.`
            : `Scheduled for ${start.toLocaleDateString()} at ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
          link: isLive ? `/student/exams/${e.id}/lobby` : `/student/exams`,
          urgency: isLive ? 'high' : 'medium',
          time: e.startTime
        })
      }

      // 3. Recent results published
      const studentResults = await global.prisma.examResult.findMany({
        where: {
          studentExam: { studentId: userId }
        },
        include: { exam: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3
      }).catch(() => [])

      for (const r of studentResults) {
        notifications.push({
          id: `student-result-${r.id}`,
          type: 'RESULT',
          title: `Result Available: ${r.exam?.title || 'Exam'}`,
          desc: `Your exam score of ${Math.round(r.percentage || 0)}% has been evaluated and recorded.`,
          link: '/student/results',
          urgency: 'low',
          time: r.createdAt
        })
      }
    }

    // Sort by time (most recent first)
    notifications.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))

    res.json({ notifications })
  } catch (err) {
    console.error('[getNotifications]', err)
    res.status(500).json({ error: 'Failed to fetch notifications.' })
  }
}

module.exports = {
  getNotifications
}
