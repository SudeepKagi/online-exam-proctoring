import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck, Users } from 'lucide-react'
import TableSkeleton from '@/components/common/TableSkeleton'
import EmptyState from '@/components/common/EmptyState'

export default function UserTable({ users, loading, onToggle, onVerify }) {
  return (
    <Card className="border-[#e9eaf2] bg-white shadow-[0_1px_3px_rgba(40,37,59,0.04)] rounded-xl overflow-hidden font-sans">
      <CardContent className="p-0">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
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
                <TableSkeleton rows={4} cols={5} />
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      icon={Users}
                      title="No accounts found"
                      description="No registered accounts found in this category."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} className="border-[#e9eaf2] hover:bg-[#fbfcfd]">
                    <TableCell className="font-[480] text-[#28253b] text-xs">{u.fullName}</TableCell>
                    <TableCell className="text-[#554e7b] text-xs font-mono">{u.email}</TableCell>
                    <TableCell className="text-[#5266eb] text-xs font-mono font-[480]">{u.institutionId || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-0 text-[10px] rounded-full ${
                        u.status === 'ACTIVE' ? 'bg-[#edecfb] text-[#5266eb]' :
                        u.status === 'PENDING_APPROVAL' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b]' :
                        u.status === 'REJECTED' ? 'bg-[#edecfb] text-[#554e7b]' :
                        'bg-[#fbfbff] text-[#70707d]'
                      }`}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onVerify?.(u)}
                          className="h-8 px-3 text-xs gap-1 cursor-pointer transition"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Verify ID & Photos
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggle(u)}
                          className="h-8 px-2.5 text-xs rounded-full cursor-pointer"
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
        </div>

        {/* Mobile Stacked Cards (md:hidden) */}
        <div className="block md:hidden divide-y divide-[#c3c3cc]/20">
          {loading ? (
            <div className="p-4 space-y-3">
              <div className="h-4 bg-[#edecfb] rounded-full w-3/4 animate-pulse" />
              <div className="h-3 bg-[#fbfbff] rounded-full w-1/2 animate-pulse" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No accounts found"
              description="No registered accounts found in this category."
            />
          ) : (
            users.map((u) => (
              <div key={u.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-[480] text-[#28253b]">{u.fullName}</h4>
                    <span className="text-[11px] font-mono text-[#554e7b]">{u.email}</span>
                  </div>
                  <Badge variant="outline" className={`border-0 text-[10px] rounded-full ${
                    u.status === 'ACTIVE' ? 'bg-[#edecfb] text-[#5266eb]' :
                    u.status === 'PENDING_APPROVAL' ? 'bg-[rgba(82,102,235,0.08)] text-[#28253b]' :
                    u.status === 'REJECTED' ? 'bg-[#edecfb] text-[#554e7b]' :
                    'bg-[#fbfbff] text-[#70707d]'
                  }`}>
                    {u.status}
                  </Badge>
                </div>
                {u.institutionId && (
                  <p className="text-xs text-[#5266eb] font-mono">ID: {u.institutionId}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onVerify?.(u)}
                    className="flex-1 h-9 text-xs gap-1 cursor-pointer justify-center"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#5266eb]" /> Verify ID
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggle(u)}
                    className="h-9 px-3 text-xs rounded-full cursor-pointer"
                  >
                    {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
