import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, ensureArray, errorMessage } from '@/lib/apiClient'
import UserVerificationModal from './UserVerificationModal'
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
          <h3 className="text-sm font-[480] text-[#28253b]">Identity Verification Queue</h3>
          <p className="text-xs text-[#554e7b] font-[360]">Review submitted student reference face photos and institutional ID cards.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadApprovals}
          disabled={loading}
          className="text-xs font-[420] gap-1.5 rounded-full border-[#e9eaf2] text-[#28253b] cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Queue
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl font-[420]">
          {error}
        </div>
      )}

      <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-[#e9eaf2] bg-[#fbfbff]">
                <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Candidate</TableHead>
                <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Roll No / ID</TableHead>
                <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Role</TableHead>
                <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Department</TableHead>
                <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Submitted</TableHead>
                <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b] text-right">Verification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-xs text-[#70707d]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#5266eb]" />
                    Loading pending approval queue...
                  </TableCell>
                </TableRow>
              ) : approvals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-xs text-[#70707d]">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <span className="font-[480] text-[#28253b] block text-sm">All identity profiles verified!</span>
                    No pending student or faculty applications in queue.
                  </TableCell>
                </TableRow>
              ) : (
                approvals.map((u) => {
                  const meta = (u.profileMetadata && typeof u.profileMetadata === 'object') ? u.profileMetadata : {}
                  return (
                    <TableRow key={u.id} className="border-[#e9eaf2] hover:bg-[#fbfcfd]">
                      <TableCell>
                        <div className="font-[480] text-[#28253b] text-xs">{u.fullName}</div>
                        <div className="text-[11px] font-mono text-[#554e7b]">{u.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-[480] text-[#5266eb]">
                        {u.institutionId || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={u.role === 'STUDENT' ? 'bg-[#edecfb] text-[#5266eb] border-[#9cb4e8]/30 text-[10px] rounded-full' : 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] rounded-full'}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#554e7b]">
                        {meta.department || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-[#70707d]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleReview(u)}
                          className="h-8 px-4 text-xs bg-[#5266eb] hover:bg-[#4354d0] text-white font-[420] rounded-[32px] shadow-xs flex items-center gap-1.5 ml-auto cursor-pointer"
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

      <UserVerificationModal
        user={selectedUser}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
