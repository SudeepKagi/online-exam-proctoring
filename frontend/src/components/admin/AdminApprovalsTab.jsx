import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import ReviewUserDialog from './ReviewUserDialog'
import { CheckCircle2, ShieldCheck, Loader2, RefreshCw } from 'lucide-react'

export default function AdminApprovalsTab({ onStatusUpdate }) {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState('')

  const loadApprovals = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/users/admin/approvals')
      setApprovals(ensureArray(res.data?.users || res.data?.pendingUsers || res.data))
    } catch (err) {
      setError(errorMessage(err, 'Failed to fetch pending approvals'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApprovals()
  }, [])

  const handleReview = (user) => {
    setSelectedUser(user)
    setDialogOpen(true)
  }

  const handleSuccess = (msg) => {
    loadApprovals()
    onStatusUpdate?.(msg)
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Identity Verification Queue</h3>
          <p className="text-xs text-slate-500">Review submitted student reference face photos and institutional ID cards.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadApprovals}
          disabled={loading}
          className="text-xs gap-1.5 rounded-xl cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Queue
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-medium">
          {error}
        </div>
      )}

      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-200 bg-slate-50/70">
                <TableHead className="text-xs font-semibold text-slate-600">Candidate</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Roll No / ID</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Role</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Department</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Submitted</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                    Loading pending approval queue...
                  </TableCell>
                </TableRow>
              ) : approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-xs text-slate-500">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <span className="font-bold text-slate-800 block text-sm">All identity profiles verified!</span>
                    No pending student or faculty applications in queue.
                  </TableCell>
                </TableRow>
              ) : (
                approvals.map((u) => {
                  const meta = (u.profileMetadata && typeof u.profileMetadata === 'object') ? u.profileMetadata : {}
                  return (
                    <TableRow key={u.id} className="border-slate-100 hover:bg-slate-50/60">
                      <TableCell>
                        <div className="font-bold text-slate-900 text-xs">{u.fullName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-blue-600">
                        {u.institutionId || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={u.role === 'STUDENT' ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]' : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {meta.department || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleReview(u)}
                          className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Review & Verify
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ReviewUserDialog
        user={selectedUser}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
