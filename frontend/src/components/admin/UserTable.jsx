import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function UserTable({ users, loading, onToggle }) {
  return (
    <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 bg-slate-50/70">
              <TableHead className="text-xs font-semibold text-slate-600">Full Name</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Email Address</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Institutional ID</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
              <TableHead className="text-xs font-semibold text-slate-600 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">Loading accounts...</TableCell></TableRow>
            ) : users.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-xs text-slate-500">No accounts in this category.</TableCell></TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className="border-slate-100 hover:bg-slate-50/60">
                  <TableCell className="font-bold text-slate-900 text-xs">{u.fullName}</TableCell>
                  <TableCell className="text-slate-600 text-xs font-mono">{u.email}</TableCell>
                  <TableCell className="text-slate-700 text-xs font-mono">{u.institutionId || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]' :
                      u.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]' :
                      u.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200 text-[10px]' :
                      'bg-slate-50 text-slate-700 border-slate-200 text-[10px]'
                    }>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggle(u)}
                      className={`h-7 px-2.5 text-xs font-semibold rounded-lg ${u.status === 'ACTIVE' ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'}`}
                    >
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </Button>
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
