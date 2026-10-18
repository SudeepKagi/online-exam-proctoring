const ExcelJS = require('exceljs')

async function parseExcelBuffer(buffer) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Excel workbook contains no sheets')

  const rows = []
  let headerMap = {}

  worksheet.eachRow((row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    if (rowNumber === 1) {
      values.forEach((v, idx) => {
        headerMap[String(v || '').toLowerCase().trim()] = idx
      })
    } else {
      const getVal = (col) => {
        const idx = headerMap[col]
        return idx !== undefined && values[idx] !== undefined ? String(values[idx]).trim() : ''
      }

      const email = getVal('email')
      const name = getVal('name') || getVal('fullname') || getVal('full name')
      const usn = getVal('usn') || getVal('id') || getVal('institutionid') || getVal('employee id')
      const role = getVal('role') || 'STUDENT'
      const password = getVal('password') || 'Default#1234'

      if (email && name) {
        rows.push({ email, name, fullName: name, usn, institutionId: usn, role, password })
      }
    }
  })

  return rows
}

module.exports = { parseExcelBuffer }
