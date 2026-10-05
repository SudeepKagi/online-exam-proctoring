/**
 * Admin DTO Mappers
 */

function toFacultyAdminDTO(f) {
  if (!f) return null
  return {
    id: f.id,
    name: f.name,
    email: f.email,
    departmentCode: f.departmentCode,
    department: f.department?.name || f.departmentCode,
    employeeId: f.employeeId,
    phone: f.phone || null,
    isApproved: f.isApproved,
    isSuspended: f.isSuspended,
    approvedBy: f.approvedBy,
    approvedAt: f.approvedAt,
    idCardPhotoKey: f.idCardPhotoKey,
    profilePhotoKey: f.profilePhotoKey,
    createdAt: f.createdAt
  }
}

function toStudentAdminDTO(s) {
  if (!s) return null
  return {
    id: s.id,
    name: s.name,
    usn: s.usn,
    email: s.email,
    departmentCode: s.departmentCode,
    department: s.department?.name || s.departmentCode,
    semester: s.semester,
    phone: s.phone || null,
    facePhotoKey: s.facePhotoKey,
    idCardPhotoKey: s.idCardPhotoKey,
    faceMatchScore: s.faceMatchScore,
    approvalStatus: s.approvalStatus,
    profileStatus: s.profileStatus,
    isSuspended: s.isSuspended,
    approvedBy: s.approvedBy,
    approvedAt: s.approvedAt,
    rejectionReason: s.rejectionReason,
    createdAt: s.createdAt
  }
}

function toPlatformSettingDTO(setting) {
  if (!setting) return null
  return {
    id: setting.id,
    key: setting.key,
    value: setting.value,
    updatedBy: setting.updatedBy,
    updatedAt: setting.updatedAt
  }
}

function toAnnouncementDTO(a) {
  if (!a) return null
  return {
    id: a.id,
    title: a.title,
    message: a.message,
    postedBy: a.postedBy,
    target: a.target,
    targetDepartment: a.targetDepartment,
    priority: a.priority,
    createdAt: a.createdAt,
    readBy: a.readBy || []
  }
}

module.exports = {
  toFacultyAdminDTO,
  toStudentAdminDTO,
  toPlatformSettingDTO,
  toAnnouncementDTO
}
