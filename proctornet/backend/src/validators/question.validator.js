/**
 * MCQ Question Validator
 * Enforces strict single-correct MCQ validation rules for ProctorNet.
 *
 * Rules:
 * - 2 to 6 options per question.
 * - Exactly one correct option (isCorrect: true).
 * - marks > 0.
 * - 0 <= negativeMarks <= marks.
 * - option text non-empty and <= 500 characters.
 * - question text non-empty and <= 5000 characters.
 * - optional image via S3 key.
 */

function validateMcqQuestion(data = {}) {
  const errors = []

  // 1. Question text validation
  const rawQuestionText = data.questionText !== undefined ? data.questionText : (data.text !== undefined ? data.text : '')
  const questionText = typeof rawQuestionText === 'string' ? rawQuestionText.trim() : String(rawQuestionText || '').trim()

  if (!questionText) {
    errors.push('Question text is required and cannot be empty.')
  } else if (questionText.length > 5000) {
    errors.push(`Question text exceeds maximum length of 5000 characters (length: ${questionText.length}).`)
  }

  // 2. Marks validation
  const rawMarks = data.marks !== undefined && data.marks !== null ? data.marks : 1
  const parsedMarks = parseFloat(rawMarks)
  if (isNaN(parsedMarks) || parsedMarks <= 0) {
    errors.push('Marks must be a positive number greater than 0.')
  }

  // 3. Negative marks validation
  const rawNegMarks = data.negativeMarks !== undefined && data.negativeMarks !== null ? data.negativeMarks : 0
  const parsedNegMarks = parseFloat(rawNegMarks)
  if (isNaN(parsedNegMarks) || parsedNegMarks < 0) {
    errors.push('Negative marks must be a non-negative number (>= 0).')
  } else if (!isNaN(parsedMarks) && parsedNegMarks > parsedMarks) {
    errors.push(`Negative marks (${parsedNegMarks}) cannot exceed positive marks (${parsedMarks}).`)
  }

  // 4. Options normalization & count validation
  let rawOptions = data.options
  if (typeof rawOptions === 'string') {
    try { rawOptions = JSON.parse(rawOptions) } catch { rawOptions = [] }
  }
  if (!Array.isArray(rawOptions)) {
    rawOptions = []
  }

  // If options array is empty, check OptionA..OptionF fields (e.g. from Excel or flat form)
  if (rawOptions.length === 0) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F']
    letters.forEach((l, idx) => {
      const val = data[`Option${l}`] || data[`option${l}`] || data[`Option_${l}`] || data[`option_${l}`]
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        rawOptions.push(String(val).trim())
      }
    })
  }

  if (rawOptions.length < 2 || rawOptions.length > 6) {
    errors.push(`Question must have between 2 and 6 options (found ${rawOptions.length}).`)
  }

  // Determine correct option reference if provided at question level
  const explicitCorrect = data.correctOption !== undefined ? data.correctOption : data.correctAnswer

  // 5. Option item validation & exactly one correct check
  let correctCount = 0
  const letterMap = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5 }

  const normalizedOptions = rawOptions.map((opt, idx) => {
    let text = ''
    let isCorrect = false

    if (typeof opt === 'object' && opt !== null) {
      text = String(opt.text || opt.optionText || opt.label || opt.value || '').trim()
      isCorrect = Boolean(opt.isCorrect)
    } else {
      text = String(opt || '').trim()
    }

    // Match against explicit question-level correct option if specified
    if (!isCorrect && explicitCorrect !== undefined && explicitCorrect !== null) {
      if (typeof explicitCorrect === 'number' && explicitCorrect === idx) {
        isCorrect = true
      } else if (typeof explicitCorrect === 'string') {
        const trimmed = explicitCorrect.trim().toUpperCase()
        if (letterMap[trimmed] !== undefined && letterMap[trimmed] === idx) {
          isCorrect = true
        } else if (trimmed === String(idx + 1)) {
          isCorrect = true
        } else if (text.toLowerCase() === explicitCorrect.trim().toLowerCase()) {
          isCorrect = true
        }
      }
    }

    if (!text) {
      errors.push(`Option ${idx + 1} text cannot be empty.`)
    } else if (text.length > 500) {
      errors.push(`Option ${idx + 1} text exceeds maximum length of 500 characters (length: ${text.length}).`)
    }

    if (isCorrect) {
      correctCount++
    }

    return {
      text,
      isCorrect,
      order: opt && typeof opt.order === 'number' ? opt.order : idx
    }
  })

  // 6. Exactly one correct check
  if (correctCount === 0) {
    errors.push('Question must have exactly one correct option (found 0).')
  } else if (correctCount > 1) {
    errors.push(`Question must have exactly one correct option (found ${correctCount}).`)
  }

  if (errors.length > 0) {
    const error = new Error(`MCQ Validation Failed: ${errors.join(' ')}`)
    error.status = 400
    error.validationErrors = errors
    throw error
  }

  return {
    questionText,
    marks: parsedMarks,
    negativeMarks: parsedNegMarks,
    difficulty: (data.difficulty ? String(data.difficulty).trim() : 'MEDIUM').toUpperCase(),
    imageUrl: data.imageUrl ? String(data.imageUrl).trim() : null,
    order: data.order !== undefined && data.order !== null ? parseInt(data.order, 10) : 0,
    tags: Array.isArray(data.tags)
      ? data.tags.map(t => String(t).trim()).filter(Boolean)
      : (data.tags ? String(data.tags).split(',').map(t => t.trim()).filter(Boolean) : []),
    options: normalizedOptions
  }
}

/**
 * Normalizes an Excel question row.
 * Columns: Question, OptionA…OptionF, CorrectOption, Marks, NegativeMarks, Difficulty, Tags
 */
function normalizeExcelQuestionRow(row, rowIndex = 1) {
  if (!row || typeof row !== 'object') {
    throw new Error(`Row ${rowIndex}: Empty or invalid row data.`)
  }

  const questionText = row.Question || row.question || row.questionText || row['Question Text'] || ''
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']
  const options = []

  letters.forEach(letter => {
    const val = row[`Option${letter}`] || row[`Option ${letter}`] || row[`option${letter}`] || row[`option_${letter}`]
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      options.push(String(val).trim())
    }
  })

  const correctOption = row.CorrectOption !== undefined ? row.CorrectOption : (row['Correct Option'] || row.correctAnswer || row.CorrectAnswer)
  const marks = row.Marks !== undefined ? row.Marks : (row.marks || 1)
  const negativeMarks = row.NegativeMarks !== undefined ? row.NegativeMarks : (row.negativeMarks || row['Negative Marks'] || 0)
  const difficulty = row.Difficulty || row.difficulty || 'MEDIUM'
  const tags = row.Tags || row.tags || []

  return validateMcqQuestion({
    questionText,
    options,
    correctOption,
    marks,
    negativeMarks,
    difficulty,
    tags,
    order: rowIndex
  })
}

module.exports = {
  validateMcqQuestion,
  normalizeExcelQuestionRow
}
