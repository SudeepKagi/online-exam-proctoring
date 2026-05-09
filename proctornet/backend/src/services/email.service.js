const nodemailer = require('nodemailer')

// Create reusable transporter
let transporter = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
      port:   parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }
  return transporter
}

/**
 * Send an email. Returns false (not throws) if email is not configured.
 */
async function sendEmail({ to, subject, html, text }) {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your_email@gmail.com') {
    console.log(`[Email] Not configured — would send to ${to}: ${subject}`)
    return false
  }
  try {
    const info = await getTransporter().sendMail({
      from: `"ProctorNet" <${process.env.EMAIL_USER}>`,
      to, subject, html, text,
    })
    console.log(`[Email] Sent to ${to}: ${info.messageId}`)
    return true
  } catch (e) {
    console.warn(`[Email] Failed to send to ${to}:`, e.message)
    return false
  }
}

// ── Email templates ────────────────────────────────────────────────

async function sendFacultyRegisteredEmail(faculty) {
  await sendEmail({
    to:      process.env.ADMIN_EMAIL || 'admin@proctornet.com',
    subject: `[ProctorNet] New Faculty Registration: ${faculty.name}`,
    html: `
      <h2>New Faculty Registration</h2>
      <p><b>Name:</b> ${faculty.name}</p>
      <p><b>Email:</b> ${faculty.email}</p>
      <p><b>Department:</b> ${faculty.department}</p>
      <p><b>Employee ID:</b> ${faculty.employeeId}</p>
      <p>Please login to the admin panel to approve or reject this registration.</p>
      <a href="${process.env.FRONTEND_URL}/admin/faculty">Review Faculty</a>
    `,
  })
}

async function sendFacultyApprovedEmail(faculty) {
  await sendEmail({
    to:      faculty.email,
    subject: `[ProctorNet] Your registration has been approved!`,
    html: `
      <h2>Welcome to ProctorNet, ${faculty.name}!</h2>
      <p>Your faculty account has been approved by the administrator.</p>
      <p>You can now login at: <a href="${process.env.FRONTEND_URL}/faculty/login">Faculty Login</a></p>
    `,
  })
}

async function sendFacultyRejectedEmail(faculty) {
  await sendEmail({
    to:      faculty.email,
    subject: `[ProctorNet] Registration status update`,
    html: `
      <h2>Registration Update — ${faculty.name}</h2>
      <p>We regret to inform you that your faculty registration could not be approved at this time.</p>
      <p>Please contact the administrator for more information.</p>
    `,
  })
}

async function sendStudentApprovedEmail(student) {
  await sendEmail({
    to:      student.email,
    subject: `[ProctorNet] Your account has been approved!`,
    html: `
      <h2>Welcome to ProctorNet, ${student.name}!</h2>
      <p>Your student account has been approved. You can now login and take exams.</p>
      <a href="${process.env.FRONTEND_URL}/student/login">Login Now</a>
    `,
  })
}

module.exports = {
  sendEmail,
  sendFacultyRegisteredEmail,
  sendFacultyApprovedEmail,
  sendFacultyRejectedEmail,
  sendStudentApprovedEmail,
}
