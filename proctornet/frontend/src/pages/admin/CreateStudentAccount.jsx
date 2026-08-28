import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import * as xlsx from 'xlsx'
import {
  GraduationCap, UserPlus, Upload, FileSpreadsheet, Download,
  CheckCircle2, AlertCircle, Copy, Check, Eye, EyeOff, RefreshCw,
  Trash2, ArrowRight, ShieldCheck, User
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function CreateStudentAccount() {
  const navigate = useNavigate()
  const [activeMode, setActiveMode] = useState('single') // 'single' | 'bulk'

  // Single student form state
  const [formData, setFormData] = useState({
    name: '',
    usn: '',
    email: '',
    department: 'Computer Science & Engineering',
    semester: 1,
    phone: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [singleSubmitting, setSingleSubmitting] = useState(false)
  const [singleError, setSingleError] = useState('')
  const [createdStudent, setCreatedStudent] = useState(null)
  const [copiedSingle, setCopiedSingle] = useState(false)

  // Bulk state
  const [bulkFile, setBulkFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [bulkCreating, setBulkCreating] = useState(false)
  const [records, setRecords] = useState([])
  const [bulkError, setBulkError] = useState('')
  const [createdBulkCredentials, setCreatedBulkCredentials] = useState(null)
  const [copiedBulk, setCopiedBulk] = useState(false)

  // Generate random password
  const generatePassword = () => {
    const rand = Math.floor(1000 + Math.random() * 9000)
    const newPass = `Student#${rand}`
    setFormData(prev => ({ ...prev, password: newPass }))
  }

  // Handle single form submit
  const handleSingleSubmit = async (e) => {
    e.preventDefault()
    setSingleError('')
    if (!formData.name || !formData.usn || !formData.email || !formData.password) {
      setSingleError('Please fill in all required fields (Name, USN, Email, Password).')
      return
    }

    setSingleSubmitting(true)
    try {
      const res = await api.post('/admin/students', formData)
      setCreatedStudent({
        ...res.data.student,
        rawPassword: formData.password
      })
      toast.success('Student account created successfully!')
      // Reset form
      setFormData({
        name: '',
        usn: '',
        email: '',
        department: 'Computer Science & Engineering',
        semester: 1,
        phone: '',
        password: ''
      })
    } catch (err) {
      setSingleError(err.response?.data?.error || err.response?.data?.message || 'Failed to create student account.')
    } finally {
      setSingleSubmitting(false)
    }
  }

  // Copy single credentials
  const copySingleCredentials = () => {
    if (!createdStudent) return
    const text = `ProctorNet Student Credentials:\nName: ${createdStudent.name}\nUSN: ${createdStudent.usn}\nEmail: ${createdStudent.email}\nPassword: ${createdStudent.rawPassword}\nLogin Portal: ${window.location.origin}/student/login`
    navigator.clipboard.writeText(text)
    setCopiedSingle(true)
    setTimeout(() => setCopiedSingle(false), 2500)
  }

  // Download Sample Excel Template
  const downloadSampleTemplate = () => {
    const sampleData = [
      { 'Full Name': 'Aarav Sharma', 'USN': '1MS21CS001', 'Email': 'aarav.sharma@college.edu', 'Department': 'CSE', 'Semester': 6, 'Phone': '9876543210' },
      { 'Full Name': 'Bhavna Patel', 'USN': '1MS21CS002', 'Email': 'bhavna.patel@college.edu', 'Department': 'CSE', 'Semester': 6, 'Phone': '9876543211' },
      { 'Full Name': 'Chetan Rao', 'USN': '1MS21IS015', 'Email': 'chetan.rao@college.edu', 'Department': 'ISE', 'Semester': 4, 'Phone': '9876543212' },
    ]
    const ws = xlsx.utils.json_to_sheet(sampleData)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Students_Template')
    xlsx.writeFile(wb, 'ProctorNet_Student_Import_Template.xlsx')
  }

  // Bulk File Change
  const handleBulkFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setBulkFile(file)
      setBulkError('')
      setRecords([])
    }
  }

  // Parse Bulk File
  const handleBulkParse = async () => {
    if (!bulkFile) return
    setParsing(true)
    setBulkError('')
    try {
      const form = new FormData()
      form.append('file', bulkFile)
      form.append('role', 'student')

      const res = await api.post('/admin/bulk-upload/parse', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (res.data.success) {
        setRecords(res.data.records || [])
      } else {
        setBulkError(res.data.message || 'Could not parse student records.')
      }
    } catch (err) {
      setBulkError(err.response?.data?.message || err.response?.data?.error || 'Failed to parse file.')
    } finally {
      setParsing(false)
    }
  }

  // Confirm Bulk Create
  const handleBulkConfirm = async () => {
    if (records.length === 0) return
    setBulkCreating(true)
    setBulkError('')
    try {
      const res = await api.post('/admin/bulk-upload/confirm', {
        role: 'student',
        records
      })
      if (res.data.success) {
        setCreatedBulkCredentials(res.data.createdCredentials || [])
        toast.success(`Successfully created ${res.data.createdCount} student accounts!`)
        setRecords([])
        setBulkFile(null)
      } else {
        setBulkError(res.data.message || 'Failed to create student accounts.')
      }
    } catch (err) {
      setBulkError(err.response?.data?.message || err.response?.data?.error || 'Failed to create accounts.')
    } finally {
      setBulkCreating(false)
    }
  }

  // Export created bulk credentials
  const downloadCreatedCredentials = () => {
    if (!createdBulkCredentials || createdBulkCredentials.length === 0) return
    const exportData = createdBulkCredentials.map(c => ({
      'Student Name': c.name,
      'USN': c.identifier,
      'Email': c.email,
      'Department': c.department || 'CSE',
      'Temporary Password': c.tempPassword,
      'Login URL': `${window.location.origin}/student/login`
    }))
    const ws = xlsx.utils.json_to_sheet(exportData)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, 'Student_Credentials')
    xlsx.writeFile(wb, 'ProctorNet_Student_Credentials.xlsx')
  }

  return (
    <DashboardLayout title="Student Account Creation">
      <div className="space-y-6 max-w-5xl font-sans">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#faf5ff] text-[#7c3aed] flex items-center justify-center border border-[#ede9fe]">
                <GraduationCap size={18} />
              </div>
              <h1 className="text-2xl font-bold text-[#0f172a] tracking-tight">Student Account Creation</h1>
            </div>
            <p className="text-xs text-[#64748b] mt-1 font-normal">
              Provision single or bulk candidate accounts for examinations with pre-approved credentials.
            </p>
          </div>

          {/* Mode Switcher Pill */}
          <div className="flex items-center bg-white border border-[#e2e8f0] p-1 rounded-xl shadow-2xs">
            <button
              onClick={() => setActiveMode('single')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMode === 'single'
                  ? 'bg-[#2f80ed] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <UserPlus size={14} />
              <span>Single Account</span>
            </button>
            <button
              onClick={() => setActiveMode('bulk')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeMode === 'bulk'
                  ? 'bg-[#2f80ed] text-white shadow-xs'
                  : 'text-[#64748b] hover:text-[#0f172a]'
              }`}
            >
              <Upload size={14} />
              <span>Bulk Upload (Excel / CSV)</span>
            </button>
          </div>
        </div>

        {/* MODE 1: SINGLE STUDENT CREATION */}
        {activeMode === 'single' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
            <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-2xl p-6 sm:p-8 shadow-2xs">
              <h2 className="text-sm font-bold text-[#0f172a] mb-1">Candidate Details</h2>
              <p className="text-xs text-[#64748b] mb-6">Enter candidate identity and academic credentials for admission.</p>

              {singleError && (
                <div className="mb-5 p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{singleError}</span>
                </div>
              )}

              <form onSubmit={handleSingleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Candidate Full Name <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aarav Sharma"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#0f172a] focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      University USN / Roll No <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 1MS21CS045"
                      value={formData.usn}
                      onChange={(e) => setFormData({ ...formData, usn: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs font-mono uppercase text-[#0f172a] focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Institutional Email Address <span className="text-[#ef4444]">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. student@university.edu"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#0f172a] focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Contact Phone (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#0f172a] focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Academic Department
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#0f172a] focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all cursor-pointer"
                    >
                      <option value="Computer Science & Engineering">Computer Science & Engineering (CSE)</option>
                      <option value="Information Science & Engineering">Information Science & Engineering (ISE)</option>
                      <option value="Artificial Intelligence & Machine Learning">AI & Machine Learning (AIML)</option>
                      <option value="Electronics & Communication">Electronics & Communication (ECE)</option>
                      <option value="Electrical & Electronics">Electrical & Electronics (EEE)</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#334155] mb-1.5">
                      Semester
                    </label>
                    <select
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs text-[#0f172a] focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#334155]">
                      Temporary Password <span className="text-[#ef4444]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-[11px] text-[#2563eb] hover:underline font-semibold cursor-pointer"
                    >
                      Auto-Generate Password
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="e.g. Student#1234"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl text-xs font-mono text-[#0f172a] focus:bg-white focus:border-[#2f80ed] focus:outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={singleSubmitting}
                    className="w-full bg-[#2f80ed] hover:bg-[#2563eb] active:bg-[#1c4d8e] disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {singleSubmitting ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    <span>{singleSubmitting ? 'Creating Student...' : 'Create Student Account'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Card: Single Credential Output / Policy */}
            <div className="space-y-5">
              {createdStudent ? (
                <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 text-[#15803d]">
                    <CheckCircle2 size={18} />
                    <span className="font-bold text-xs">Account Created Successfully</span>
                  </div>

                  <div className="bg-white rounded-xl p-3.5 border border-[#dcfce7] space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748b]">Candidate Name</span>
                      <p className="font-semibold text-[#0f172a]">{createdStudent.name}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748b]">USN</span>
                      <p className="font-mono font-semibold text-[#2563eb]">{createdStudent.usn}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748b]">Email</span>
                      <p className="text-[#475569]">{createdStudent.email}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#64748b]">Initial Password</span>
                      <p className="font-mono font-bold text-[#dc2626] bg-[#fef2f2] px-2 py-0.5 rounded border border-[#fecaca] inline-block">
                        {createdStudent.rawPassword}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={copySingleCredentials}
                    className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {copiedSingle ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedSingle ? 'Credentials Copied!' : 'Copy Credentials to Clipboard'}</span>
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-[#e2e8f0] rounded-2xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center gap-2 text-[#2563eb]">
                    <ShieldCheck size={18} />
                    <span className="font-bold text-xs">Student Provisioning Rules</span>
                  </div>
                  <ul className="text-xs text-[#64748b] space-y-2 leading-relaxed">
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#10b981] font-bold">✓</span>
                      <span>Accounts are automatically set to <strong>APPROVED</strong> status with exam access enabled.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#10b981] font-bold">✓</span>
                      <span>Students will perform biometric facial baseline registration during their first login or device check.</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="text-[#10b981] font-bold">✓</span>
                      <span>USN numbers must be unique across the institutional registry.</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODE 2: BULK STUDENT IMPORT */}
        {activeMode === 'bulk' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Upload Zone Card */}
            <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 sm:p-8 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-[#0f172a]">Batch Student Import</h2>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    Upload an Excel (.xlsx, .xls) file containing student rosters to generate student accounts in batch.
                  </p>
                </div>
                <button
                  onClick={downloadSampleTemplate}
                  className="bg-white border border-[#e2e8f0] hover:bg-[#f8fafc] text-[#334155] text-xs font-semibold py-2 px-3.5 rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Download size={14} className="text-[#64748b]" />
                  <span>Download Sample Template</span>
                </button>
              </div>

              {/* Drag & Drop File Zone */}
              <div className="border-2 border-dashed border-[#cbd5e1] hover:border-[#2f80ed] bg-[#f8fafc] rounded-2xl p-8 text-center transition-colors">
                <input
                  type="file"
                  id="student-bulk-file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleBulkFileChange}
                  className="hidden"
                />
                <label htmlFor="student-bulk-file" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#eff6ff] text-[#2563eb] flex items-center justify-center mb-3 border border-[#dbeafe]">
                    <FileSpreadsheet size={24} />
                  </div>
                  <span className="text-xs font-bold text-[#0f172a]">
                    {bulkFile ? bulkFile.name : 'Click to upload or drag & drop student file'}
                  </span>
                  <span className="text-[11px] text-[#64748b] mt-1">Supports .xlsx, .xls, and .csv formats (Max 10MB)</span>
                </label>

                {bulkFile && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={handleBulkParse}
                      disabled={parsing}
                      className="bg-[#2f80ed] hover:bg-[#2563eb] disabled:opacity-50 text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {parsing ? <RefreshCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                      <span>{parsing ? 'Parsing Roster...' : 'Parse & Preview Candidates'}</span>
                    </button>
                    <button
                      onClick={() => { setBulkFile(null); setRecords([]) }}
                      className="text-xs text-[#ef4444] hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {bulkError && (
                <div className="p-3 rounded-xl bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] text-xs flex items-center gap-2">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{bulkError}</span>
                </div>
              )}
            </div>

            {/* Parsed Preview Table */}
            {records.length > 0 && (
              <div className="bg-white border border-[#e2e8f0] rounded-2xl shadow-2xs overflow-hidden space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#0f172a]">Parsed Candidates Preview ({records.length} Found)</h3>
                    <p className="text-xs text-[#64748b]">Review records before confirming batch account creation.</p>
                  </div>
                  <button
                    onClick={handleBulkConfirm}
                    disabled={bulkCreating}
                    className="bg-[#16a34a] hover:bg-[#15803d] disabled:opacity-50 text-white text-xs font-semibold py-2.5 px-5 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  >
                    {bulkCreating ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    <span>{bulkCreating ? 'Creating Accounts...' : `Create All ${records.length} Student Accounts`}</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-[#f1f5f9] rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8fafc] text-[#64748b] font-semibold border-b border-[#f1f5f9]">
                      <tr>
                        <th className="px-4 py-2.5">#</th>
                        <th className="px-4 py-2.5">Name</th>
                        <th className="px-4 py-2.5">USN</th>
                        <th className="px-4 py-2.5">Email</th>
                        <th className="px-4 py-2.5">Department</th>
                        <th className="px-4 py-2.5">Sem</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f8fafc]">
                      {records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-[#f8fafc]/80">
                          <td className="px-4 py-2 text-[#94a3b8]">{idx + 1}</td>
                          <td className="px-4 py-2 font-semibold text-[#0f172a]">{r.name || '—'}</td>
                          <td className="px-4 py-2 font-mono text-[#2563eb]">{r.usn || '—'}</td>
                          <td className="px-4 py-2 text-[#64748b]">{r.email || '—'}</td>
                          <td className="px-4 py-2 text-[#64748b]">{r.department || 'CSE'}</td>
                          <td className="px-4 py-2 text-[#64748b]">{r.semester || 1}</td>
                          <td className="px-4 py-2 text-right">
                            <button
                              onClick={() => setRecords(records.filter((_, i) => i !== idx))}
                              className="text-[#ef4444] hover:text-[#b91c1c] p-1 cursor-pointer"
                              title="Remove from batch"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Created Bulk Credentials Result */}
            {createdBulkCredentials && (
              <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-[#15803d]">
                    <CheckCircle2 size={20} />
                    <div>
                      <h3 className="font-bold text-sm">Batch Account Creation Complete!</h3>
                      <p className="text-xs text-[#166534]">
                        {createdBulkCredentials.length} student accounts successfully provisioned in the database.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={downloadCreatedCredentials}
                    className="bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={14} />
                    <span>Download Credentials Excel</span>
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto bg-white rounded-xl border border-[#dcfce7] p-2">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[#64748b] font-semibold border-b border-[#f1f5f9]">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">USN</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Generated Password</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f8fafc]">
                      {createdBulkCredentials.map((c, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-semibold text-[#0f172a]">{c.name}</td>
                          <td className="px-3 py-2 font-mono text-[#2563eb]">{c.identifier}</td>
                          <td className="px-3 py-2 text-[#64748b]">{c.email}</td>
                          <td className="px-3 py-2 font-mono font-bold text-[#dc2626]">{c.tempPassword}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
