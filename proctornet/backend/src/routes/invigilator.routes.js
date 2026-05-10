const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/invigilator.controller')
const { authenticate } = require('../middleware/auth.middleware')
const { isInvigilator } = require('../middleware/role.middleware')
const multer  = require('multer')
const upload  = multer({ dest: 'uploads/' })

// Public login route
router.post('/login', upload.single('idCard'), ctrl.login)

// Protected routes
router.get('/exams/:examId/students', authenticate, isInvigilator, ctrl.getExamStudents)

module.exports = router
