const { authService } = require('./auth.service')
const { setAuthCookie, clearAuthCookie, setAccessCookie } = require('../../utils/cookies')

function sendAuthResponse(res, authResult, statusCode = 200) {
  const { user, accessToken, refreshToken } = authResult
  setAuthCookie(res, accessToken)
  setAccessCookie(res, accessToken)
  return res.status(statusCode).json({
    status: 'success',
    user,
    accessToken,
    refreshToken,
    token: accessToken
  })
}

async function login(req, res, next) {
  try {
    const { email, password, usn } = req.body
    const identifier = email || usn
    const result = await authService.authenticate(identifier, password, null)
    return sendAuthResponse(res, result)
  } catch (err) {
    next(err)
  }
}

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body
    const result = await authService.authenticate(email, password, 'ADMIN')
    return sendAuthResponse(res, result)
  } catch (err) {
    next(err)
  }
}

async function facultyLogin(req, res, next) {
  try {
    const { email, password } = req.body
    const result = await authService.authenticate(email, password, 'FACULTY')
    return sendAuthResponse(res, result)
  } catch (err) {
    next(err)
  }
}

async function studentLogin(req, res, next) {
  try {
    const { email, usn, password } = req.body
    const identifier = email || usn
    const result = await authService.authenticate(identifier, password, 'STUDENT')
    return sendAuthResponse(res, result)
  } catch (err) {
    next(err)
  }
}

async function invigilatorLogin(req, res, next) {
  try {
    const { email, invId, password } = req.body
    const identifier = email || invId
    const result = await authService.authenticate(identifier, password, 'INVIGILATOR')
    return sendAuthResponse(res, result)
  } catch (err) {
    next(err)
  }
}

async function register(req, res, next) {
  try {
    const { email, password, name, role, referencePhotoS3Key } = req.body
    const result = await authService.register({
      email,
      password,
      name,
      role: role || 'STUDENT',
      referencePhotoS3Key: referencePhotoS3Key || null
    })
    return sendAuthResponse(res, result, 201)
  } catch (err) {
    next(err)
  }
}

async function me(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: { message: 'Unauthorized' } })
    }
    const user = await authService.getUserById(req.user.id)
    if (!user) {
      return res.status(404).json({ error: { message: 'User not found' } })
    }
    return res.status(200).json({
      status: 'success',
      user,
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.name,
      role: user.role,
      institutionId: user.institutionId || user.usn || null
    })
  } catch (err) {
    next(err)
  }
}

async function onboarding(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: { message: 'Authentication required' } })
    }
    const result = await authService.submitOnboarding(req.user.id, req.body)
    return sendAuthResponse(res, result)
  } catch (err) {
    next(err)
  }
}

async function updateSettings(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: { message: 'Authentication required' } })
    }
    const updated = await authService.updateSettings(req.user.id, req.body)
    return res.status(200).json({ status: 'success', user: updated })
  } catch (err) {
    next(err)
  }
}

async function logout(req, res) {
  clearAuthCookie(res)
  return res.status(200).json({ status: 'success', message: 'Logged out successfully' })
}

module.exports = {
  login,
  adminLogin,
  facultyLogin,
  studentLogin,
  invigilatorLogin,
  register,
  me,
  onboarding,
  updateSettings,
  logout
}
