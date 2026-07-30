const xlsx = require('xlsx')
const pdfParse = require('pdf-parse')
const bcrypt = require('bcryptjs')

/**
 * Generate a random 4-digit temporary password: Pnet#XXXX
 */
function generateTempPassword() {
  const randNum = Math.floor(1000 + Math.random() * 9000)
  return `Pnet#${randNum}`
}

/**
 * Parse uploaded Excel or PDF file for student/faculty preview
 */
async function parseBulkFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' })
    }

    const { role } = req.body // 'student' or 'faculty'
    const fileBuffer = req.file.buffer
    const fileName = req.file.originalname.toLowerCase()
    let parsedRows = []

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' })
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: '' })

      parsedRows = rawData.map((row, idx) => {
        const getVal = (keys) => {
          const foundKey = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()))
          return foundKey ? String(row[foundKey]).trim() : ''
        }

        if (role === 'faculty') {
          return {
            id: idx + 1,
            name: getVal(['name', 'full name', 'fullname', 'faculty name', 'teacher name']),
            employeeId: getVal(['employeeid', 'empid', 'emp id', 'employee id', 'id']),
            department: getVal(['department', 'dept', 'subject', 'stream']) || 'Computer Science',
            phone: getVal(['phone', 'phone number', 'mobile', 'contact']),
            email: getVal(['email', 'email address', 'mail']),
          }
        } else {
          return {
            id: idx + 1,
            name: getVal(['name', 'full name', 'fullname', 'student name']),
            usn: getVal(['usn', 'roll number', 'rollno', 'roll no', 'registration number', 'id']),
            department: getVal(['department', 'dept', 'branch', 'stream']) || 'CSE',
            semester: parseInt(getVal(['semester', 'sem', 'year'])) || 1,
            phone: getVal(['phone', 'phone number', 'mobile', 'contact']),
            email: getVal(['email', 'email address', 'mail']),
          }
        }
      })
    } else if (fileName.endsWith('.pdf')) {
      const pdfData = await pdfParse(fileBuffer)
      const lines = pdfData.text.split('\n').map(l => l.trim()).filter(Boolean)

      let currentIdx = 1
      for (const line of lines) {
        const parts = line.split(/[,;\t]|\s{2,}/)
        if (parts.length >= 2) {
          if (role === 'faculty') {
            parsedRows.push({
              id: currentIdx++,
              name: parts[0] || 'Faculty Member',
              employeeId: parts[1] || `EMP${100 + currentIdx}`,
              department: parts[2] || 'Computer Science',
              phone: parts[3] || '',
              email: parts[4] || '',
            })
          } else {
            parsedRows.push({
              id: currentIdx++,
              name: parts[0] || 'Student Candidate',
              usn: parts[1] || `1MS21CS${String(currentIdx).padStart(3, '0')}`,
              department: parts[2] || 'CSE',
              semester: parseInt(parts[3]) || 1,
              phone: parts[4] || '',
              email: parts[5] || '',
            })
          }
        }
      }
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported file format. Please upload .xlsx, .xls, or .pdf files.' })
    }

    const validRows = parsedRows.filter(r => role === 'faculty' ? (r.name || r.employeeId) : (r.name || r.usn))

    return res.json({
      success: true,
      role,
      totalParsed: validRows.length,
      records: validRows,
    })
  } catch (error) {
    console.error('[adminBulk.parseBulkFile] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to parse file: ' + error.message })
  }
}

/**
 * Confirm preview records and bulk-create or update user accounts in database
 */
async function confirmBulkCreate(req, res) {
  try {
    const { role, records } = req.body // 'student' or 'faculty'

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'No records provided for account creation.' })
    }

    const createdCredentials = []
    const errors = []

    for (const record of records) {
      const tempPassword = generateTempPassword()
      const hashedPassword = await bcrypt.hash(tempPassword, 10)

      if (role === 'faculty') {
        const empId = (record.employeeId || `EMP${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase().trim()
        const email = (record.email || `${empId.toLowerCase()}@mit.ac.in`).toLowerCase().trim()
        const name = record.name?.trim() || 'Faculty Member'
        const department = record.department?.trim() || 'Computer Science'
        const phone = record.phone?.trim() || null

        try {
          const existing = await global.prisma.faculty.findFirst({
            where: { OR: [{ employeeId: empId }, { email }] }
          })

          if (existing) {
            // Update existing faculty password and reset mustChangePassword
            await global.prisma.faculty.update({
              where: { id: existing.id },
              data: {
                name,
                password: hashedPassword,
                department,
                phone,
                mustChangePassword: true,
                isApproved: true,
              }
            })
          } else {
            await global.prisma.faculty.create({
              data: {
                name,
                email,
                password: hashedPassword,
                employeeId: empId,
                department,
                phone,
                isApproved: true,
                mustChangePassword: true,
              }
            })
          }

          createdCredentials.push({
            name,
            identifier: empId,
            email,
            phone: phone || 'N/A',
            role: 'Faculty',
            department,
            tempPassword,
          })
        } catch (err) {
          errors.push({ identifier: empId, name, reason: err.message })
        }
      } else {
        // Student role
        const usn = (record.usn || `1MS21CS${Math.floor(100 + Math.random() * 900)}`).toUpperCase().trim()
        const email = (record.email || `${usn.toLowerCase()}@mit.ac.in`).toLowerCase().trim()
        const name = record.name?.trim() || 'Student Candidate'
        const department = record.department?.trim() || 'CSE'
        const semester = parseInt(record.semester) || 1
        const phone = record.phone?.trim() || null

        try {
          const existing = await global.prisma.student.findFirst({
            where: { OR: [{ usn }, { email }] }
          })

          if (existing) {
            // Update existing student password and reset mustChangePassword
            await global.prisma.student.update({
              where: { id: existing.id },
              data: {
                name,
                password: hashedPassword,
                department,
                semester,
                phone,
                mustChangePassword: true,
                approvalStatus: 'APPROVED',
              }
            })
          } else {
            await global.prisma.student.create({
              data: {
                name,
                usn,
                email,
                password: hashedPassword,
                department,
                semester,
                phone,
                facePhotoUrl: '',
                idCardPhotoUrl: '',
                faceMatchScore: 1.0,
                approvalStatus: 'APPROVED',
                mustChangePassword: true,
              }
            })
          }

          createdCredentials.push({
            name,
            identifier: usn,
            email,
            phone: phone || 'N/A',
            role: 'Student',
            department,
            tempPassword,
          })
        } catch (err) {
          errors.push({ identifier: usn, name, reason: err.message })
        }
      }
    }

    return res.json({
      success: true,
      message: `Successfully processed ${createdCredentials.length} ${role} accounts.`,
      totalCreated: createdCredentials.length,
      totalErrors: errors.length,
      credentials: createdCredentials,
      errors,
    })
  } catch (error) {
    console.error('[adminBulk.confirmBulkCreate] Error:', error)
    return res.status(500).json({ success: false, message: 'Failed to create accounts: ' + error.message })
  }
}

module.exports = {
  parseBulkFile,
  confirmBulkCreate,
}
