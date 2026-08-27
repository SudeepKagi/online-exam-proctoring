import { useState } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import * as xlsx from 'xlsx'
import {
  Upload, FileSpreadsheet, FileText, CheckCircle2, AlertTriangle,
  Download, Copy, RefreshCw, UserCheck, Shield, Trash2, Check, ArrowRight
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

export default function BulkCreateAccounts() {
  const [role, setRole] = useState('student') // 'student' or 'faculty'
  const [file, setFile] = useState(null)
  const [parsing, setParsing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [records, setRecords] = useState([])
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState(null)
  const [copied, setCopied] = useState(false)

  // Handle file drop / select
  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      setFile(selected)
      setError('')
    }
  }

  // Parse file via backend API
  const handleParse = async () => {
    if (!file) return
    setParsing(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('role', role)

      const res = await api.post('/admin/bulk-upload/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      if (res.data.success) {
        setRecords(res.data.records || [])
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to parse file.')
    } finally {
      setParsing(false)
    }
  }

  // Edit record field inline in preview
  const handleRecordChange = (index, field, value) => {
    const updated = [...records]
    updated[index][field] = value
    setRecords(updated)
  }

  // Remove row from preview
  const handleRemoveRecord = (index) => {
    setRecords(records.filter((_, idx) => idx !== index))
  }

  // Confirm and create accounts
  const handleConfirmCreate = async () => {
    if (records.length === 0) return
    setCreating(true)
    setError('')
    try {
      const res = await api.post('/admin/bulk-upload/confirm', {
        role,
        records,
      })

      if (res.data.success) {
        setCredentials(res.data.credentials || [])
        setRecords([])
        setFile(null)
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create accounts.')
    } finally {
      setCreating(false)
    }
  }

  // Export credentials as an Excel (.xlsx) file
  const handleDownloadExcel = () => {
    if (!credentials || credentials.length === 0) return

    const exportRows = credentials.map((c, i) => ({
      'Sl No': i + 1,
      'Full Name': c.name,
      'Role': c.role,
      [role === 'faculty' ? 'Employee ID' : 'USN']: c.identifier,
      'Email Address': c.email,
      'Phone Number': c.phone || 'N/A',
      'Department': c.department || 'N/A',
      'Temporary Password': c.tempPassword,
      'Login Portal': `${window.location.origin}/${role}/login`,
    }))

    const worksheet = xlsx.utils.json_to_sheet(exportRows)

    // Set column widths for clean presentation
    worksheet['!cols'] = [
      { wch: 6 },  // Sl No
      { wch: 22 }, // Name
      { wch: 10 }, // Role
      { wch: 16 }, // Identifier
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 16 }, // Dept
      { wch: 18 }, // Temp Password
      { wch: 32 }, // Portal URL
    ]

    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, worksheet, `${role.toUpperCase()} Credentials`)
    xlsx.writeFile(workbook, `ProctorNet_${role.toUpperCase()}_Credentials.xlsx`)
  }

  // Copy table rows as Excel-compatible TSV for direct paste into Excel / Sheets
  const handleCopyExcelData = () => {
    if (!credentials || credentials.length === 0) return

    const header = `Sl No\tFull Name\tRole\t${role === 'faculty' ? 'Employee ID' : 'USN'}\tEmail\tPhone\tDepartment\tTemporary Password\tLogin Portal\n`
    const rows = credentials.map((c, i) => 
      `${i + 1}\t${c.name}\t${c.role}\t${c.identifier}\t${c.email}\t${c.phone || 'N/A'}\t${c.department || 'N/A'}\t${c.tempPassword}\t${window.location.origin}/${role}/login`
    ).join('\n')

    navigator.clipboard.writeText(header + rows)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <DashboardLayout title="Admin Console">
      {/* Export Credentials Excel Modal */}
      {credentials && (
        <Dialog open={!!credentials} onOpenChange={() => setCredentials(null)}>
          <DialogContent className="max-w-4xl bg-card border-border rounded-2xl text-foreground font-sans">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-white" />
                  Created Accounts Credentials ({credentials.length})
                </DialogTitle>
                <Badge variant="default" className="font-mono text-[9px]">EXCEL FORMAT</Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Accounts created successfully. Download the official Excel spreadsheet (.xlsx) or copy data directly into Excel. Users will be forced to change password on first login.
              </DialogDescription>
            </DialogHeader>

            <div className="my-3 space-y-3">
              {/* Credentials Preview Table */}
              <div className="border border-border rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-card">
                      <TableHead className="text-xs text-muted-foreground font-mono">#</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs text-muted-foreground">{role === 'faculty' ? 'Employee ID' : 'USN'}</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Email</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-mono">Temp Password</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {credentials.map((c, i) => (
                      <TableRow key={i} className="border-b border-border/50">
                        <TableCell className="text-xs font-mono text-slate-500">{i + 1}</TableCell>
                        <TableCell className="text-xs font-semibold text-foreground">{c.name}</TableCell>
                        <TableCell className="text-xs font-mono text-foreground/90">{c.identifier}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{c.email}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-white bg-border/40 rounded px-2 py-0.5 inline-block my-1">
                          {c.tempPassword}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Download Excel Button Only */}
              <div className="flex items-center justify-end pt-3 border-t border-border">
                <Button size="sm" onClick={handleDownloadExcel} className="w-full sm:w-auto text-xs font-mono font-bold py-2 px-5">
                  <FileSpreadsheet size={15} className="mr-2" /> Download Excel (.xlsx) File
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex flex-col gap-5 py-2">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">Bulk Create Accounts</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Upload Excel (.xlsx/.xls) or PDF roster to parse, review, and generate credentials in Excel format.</p>
          </div>

          {/* Role Toggle Selector */}
          <div className="flex bg-card border border-border rounded-full p-1">
            <button
              onClick={() => { setRole('student'); setRecords([]) }}
              className={`px-4 py-1.5 text-xs font-mono font-bold rounded-full transition-colors ${
                role === 'student' ? 'bg-white text-black' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Student Accounts
            </button>
            <button
              onClick={() => { setRole('faculty'); setRecords([]) }}
              className={`px-4 py-1.5 text-xs font-mono font-bold rounded-full transition-colors ${
                role === 'faculty' ? 'bg-white text-black' : 'text-muted-foreground hover:text-white'
              }`}
            >
              Teacher Accounts
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-card border border-border text-xs font-mono text-white flex items-center gap-2">
            <AlertTriangle size={14} className="text-white shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Upload Card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-sm font-semibold text-foreground">1. Upload Roster File</CardTitle>
            <CardDescription className="text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Upload {role === 'student' ? 'Student' : 'Faculty'} roster in Excel (.xlsx/.xls) or PDF format containing Name, {role === 'faculty' ? 'Employee ID' : 'Roll No/USN'}, Department, Phone, & Email.
              </span>
              <a
                href={role === 'student' ? '/sample_students.xlsx' : '/sample_faculty.xlsx'}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono bg-background border border-border hover:bg-[#f8fafc] dark:bg-neutral-900 text-primary rounded-lg transition"
              >
                <Download size={13} />
                Download Sample {role === 'student' ? 'Student' : 'Faculty'} Excel
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="border-2 border-dashed border-border hover:border-border rounded-2xl p-6 text-center transition-colors bg-background">
              <div className="w-10 h-10 rounded-2xl bg-card text-white flex items-center justify-center mx-auto mb-3 border border-border">
                <Upload size={18} />
              </div>

              <input
                type="file"
                id="fileInput"
                accept=".xlsx,.xls,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <label htmlFor="fileInput" className="cursor-pointer">
                <span className="text-xs font-bold text-white hover:underline">Click to browse file</span>
                <span className="text-xs text-muted-foreground"> or drag and drop</span>
              </label>

              <p className="text-[11px] font-mono text-slate-500 mt-1">Supports Excel (.xlsx, .xls) and PDF rosters</p>

              {file && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-mono text-white">
                  <FileSpreadsheet size={14} />
                  <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleParse}
                disabled={!file || parsing}
                className="text-xs font-mono"
              >
                {parsing ? <RefreshCw size={13} className="animate-spin mr-1.5" /> : <FileText size={13} className="mr-1.5" />}
                {parsing ? 'Parsing File…' : 'Parse File Preview'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 2. Interactive Preview & Correction Table */}
        {records.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">2. Review & Edit Parsed Records ({records.length})</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Review parsed fields before final account creation. Edit inline if needed.</CardDescription>
              </div>

              <Button
                onClick={handleConfirmCreate}
                disabled={creating}
                className="text-xs font-mono font-bold"
              >
                {creating ? <RefreshCw size={13} className="animate-spin mr-1.5" /> : <UserCheck size={13} className="mr-1.5" />}
                {creating ? 'Creating Accounts…' : `Confirm & Create ${records.length} Accounts`}
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-background">
                    <TableHead className="text-xs text-muted-foreground w-12">#</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Full Name</TableHead>
                    <TableHead className="text-xs text-muted-foreground">{role === 'faculty' ? 'Employee ID' : 'USN'}</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Department</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Email</TableHead>
                    <TableHead className="text-xs text-right text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r, i) => (
                    <TableRow key={i} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                      <TableCell className="text-xs text-slate-500 font-mono">{i + 1}</TableCell>
                      <TableCell>
                        <Input
                          value={r.name || ''}
                          onChange={e => handleRecordChange(i, 'name', e.target.value)}
                          className="h-7 text-xs bg-background border-border"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={role === 'faculty' ? (r.employeeId || '') : (r.usn || '')}
                          onChange={e => handleRecordChange(i, role === 'faculty' ? 'employeeId' : 'usn', e.target.value)}
                          className="h-7 text-xs font-mono bg-background border-border"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.department || ''}
                          onChange={e => handleRecordChange(i, 'department', e.target.value)}
                          className="h-7 text-xs bg-background border-border"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.phone || ''}
                          onChange={e => handleRecordChange(i, 'phone', e.target.value)}
                          className="h-7 text-xs font-mono bg-background border-border"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={r.email || ''}
                          onChange={e => handleRecordChange(i, 'email', e.target.value)}
                          className="h-7 text-xs font-mono bg-background border-border"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveRecord(i)}
                          className="h-7 w-7 text-slate-500 hover:text-white"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
