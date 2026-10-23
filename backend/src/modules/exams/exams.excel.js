'use strict'

async function parseQuestionsExcel(buffer) {
  const ExcelJS = require('exceljs')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('No sheet found in questions workbook')
  const questions = []
  let headerMap = {}
  worksheet.eachRow((row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    if (rowNumber === 1) {
      values.forEach((v, idx) => {
        headerMap[String(v || '').toLowerCase().trim()] = idx
      })
    } else {
      const getVal = (key) => {
        const idx = headerMap[key]
        return idx !== undefined && values[idx] !== undefined ? String(values[idx]).trim() : ''
      }
      const text = getVal('question') || getVal('question text') || getVal('prompt') || values[0]
      const optA = getVal('option a') || getVal('option 1') || values[1] || 'Option A'
      const optB = getVal('option b') || getVal('option 2') || values[2] || 'Option B'
      const optC = getVal('option c') || getVal('option 3') || values[3] || 'Option C'
      const optD = getVal('option d') || getVal('option 4') || values[4] || 'Option D'
      let correct = getVal('correct answer') || getVal('correct') || values[5] || '0'
      if (['A', 'B', 'C', 'D'].includes(String(correct).toUpperCase())) {
        correct = String(correct).toUpperCase().charCodeAt(0) - 65
      } else {
        correct = parseInt(correct, 10) || 0
      }
      const marks = parseFloat(getVal('marks') || values[6]) || 1
      if (text) {
        questions.push({
          questionText: String(text).trim(),
          options: [String(optA).trim(), String(optB).trim(), String(optC).trim(), String(optD).trim()],
          correctOptionIndex: correct,
          marks
        })
      }
    }
  })
  return questions
}

module.exports = { parseQuestionsExcel }
