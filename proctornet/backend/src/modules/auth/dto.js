function toUserDto(user, role) {
  if (!user) return null
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: role.toLowerCase(),
    departmentCode: user.departmentCode || null,
    semester: user.semester || null,
    usn: user.usn || null,
    employeeId: user.employeeId || null,
    createdAt: user.createdAt
  }
}

module.exports = {
  toUserDto
}
