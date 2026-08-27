import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/common/DashboardLayout'
import api from '@/utils/api'
import { Search, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function FacultyStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    api.get('/faculty/students')
      .then(r => setStudents(r.data.students || r.data || []))
      .catch(() => {
        // Fallback sample data for preview
        setStudents([
          { id: '1', name: 'Sudeep S Kagi', usn: '1NT23EC158', email: 'sudeep@mit.ac.in', department: 'ECE', verified: true },
          { id: '2', name: 'Ananya Sharma', usn: '1NT23CS012', email: 'ananya@mit.ac.in', department: 'CSE', verified: true },
          { id: '3', name: 'Rohan Verma', usn: '1NT23IS045', email: 'rohan@mit.ac.in', department: 'ISE', verified: false },
          { id: '4', name: 'Priya Nair', usn: '1NT23EC089', email: 'priya@mit.ac.in', department: 'ECE', verified: true },
        ])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = students.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.usn?.toLowerCase().includes(search.toLowerCase()) ||
    s.department?.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(filtered.length / pageSize) || 1
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <DashboardLayout title="Faculty Console">
      <div className="flex flex-col gap-5 py-2">
        <div className="px-4 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground font-sans">Student Registry</h1>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">Enrolled students and registered biometric status.</p>
          </div>

          <div className="relative w-64">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
              placeholder="Search name, USN, or department..."
              className="pl-8 h-8 text-xs bg-card border-border"
            />
          </div>
        </div>

        <div className="px-4 lg:px-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-semibold text-foreground">Enrolled Students</CardTitle>
              <CardDescription className="text-xs text-muted-foreground font-mono">Total {filtered.length} students matched.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500">Loading student registry…</div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500">No students found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border bg-background">
                      <TableHead className="text-xs text-muted-foreground">Student</TableHead>
                      <TableHead className="text-xs text-muted-foreground">USN</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Department</TableHead>
                      <TableHead className="text-xs text-muted-foreground">Face Verification</TableHead>
                      <TableHead className="text-xs text-right text-muted-foreground">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((student) => (
                      <TableRow key={student.id || student._id} className="border-b border-border/60 hover:bg-neutral-50 dark:bg-neutral-800">
                        <TableCell className="text-xs font-semibold text-foreground">
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-7 w-7 border border-border">
                              <AvatarFallback className="font-mono text-[10px] bg-border text-white">
                                {student.name?.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-semibold text-foreground">{student.name}</p>
                              <p className="text-[10px] font-mono text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-foreground/90 font-mono">{student.usn}</TableCell>
                        <TableCell className="text-xs text-foreground/90 font-mono">{student.department || 'ECE'}</TableCell>
                        <TableCell>
                          <Badge variant={student.verified ? 'default' : 'secondary'} className="font-mono text-[10px]">
                            {student.verified ? 'VERIFIED' : 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="h-7 text-[11px]">
                            View Profile
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs font-mono text-muted-foreground bg-background">
                  <span>Page {currentPage} of {totalPages}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="h-7 px-2"
                    >
                      <ChevronLeft size={13} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="h-7 px-2"
                    >
                      <ChevronRight size={13} />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
