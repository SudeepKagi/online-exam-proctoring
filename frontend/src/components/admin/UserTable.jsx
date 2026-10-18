import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck } from 'lucide-react'

export default function UserTable({ users, loading, onToggle, onVerify }) {
  return (
    <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-xl overflow-hidden font-sans">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-[#e9eaf2] bg-[#fbfbff]">
              <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Full Name</TableHead>
              <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Email Address</TableHead>
              <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">USN / Employee ID</TableHead>
              <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b]">Status</TableHead>
              <TableHead className="text-[11px] font-[500] uppercase tracking-wider text-[#554e7b] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-[#70707d]">Loading accounts...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-[#70707d]">No accounts in this category.</TableCell></TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className="border-[#e9eaf2] hover:bg-[#fbfcfd]">
                  <TableCell className="font-[480] text-[#28253b] text-xs">{u.fullName}</TableCell>
                  <TableCell className="text-[#554e7b] text-xs font-mono">{u.email}</TableCell>
                  <TableCell className="text-[#5266eb] text-xs font-mono font-[480]">{u.institutionId || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] rounded-full' :
                      u.status === 'PENDING_APPROVAL' ? 'bg-[#edecfb] text-[#5266eb] border-[#9cb4e8]/30 text-[10px] rounded-full' :
                      u.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200 text-[10px] rounded-full' :
                      'bg-slate-50 text-slate-700 border-slate-200 text-[10px] rounded-full'
                    }>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onVerify?.(u)}
                        className="h-7 px-3 text-xs font-[420] rounded-full text-[#5266eb] hover:bg-[#5266eb] hover:text-white border-[#9cb4e8]/40 bg-[#edecfb]/40 gap-1 cursor-pointer transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Verify ID & Photos
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggle(u)}
                        className={`h-7 px-2.5 text-xs font-[420] rounded-full cursor-pointer ${u.status === 'ACTIVE' ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                      >
                        {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
