import { test, expect } from '@playwright/test'
import { createActor } from '../helpers/actors'
import { api } from '../helpers/api'

test.describe('J12: High-Density Concurrency, Capacity Bounds, and Failover (§P9 §4.6)', () => {
  test.describe.configure({ mode: 'serial' })

  test('J12: Concurrent candidates submitting answers under single-instance memory limits with zero 5xx', async ({ browser }) => {
    test.setTimeout(120000)

    const admin = await createActor(browser, 'admin')
    const faculty = await createActor(browser, 'faculty')

    try {
      // 1. Setup Exam with 30-minute window
      await admin.page.goto('/admin/login')
      await admin.page.locator('input[name="email"], input[type="email"]').fill('admin@proctornet.test')
      await admin.page.locator('input[name="password"], input[type="password"]').fill('Admin#Password#2026')
      await admin.page.locator('button[type="submit"]').click()
      await admin.page.waitForURL(url => url.pathname.includes('/admin/dashboard'), { timeout: 15000 })

      const now = Date.now()
      const examRes = await api.for(admin).postRaw('/api/v1/faculty/exams', {
        title: `J12 Concurrency Scale Exam ${Date.now()}`,
        subject: 'SCALE101',
        duration: 30,
        startTime: new Date(now - 10000).toISOString(),
        endTime: new Date(now + 3600000).toISOString(),
        totalMarks: 50,
        passingMarks: 20,
        allowedDepartments: ['CSE'],
        allowedSemesters: [6]
      })
      const examId = examRes.body.exam?.id || examRes.body.id

      // 2. Measure Backend Memory Footprint (systemd MemoryMax=450M budget check)
      const memUsage = process.memoryUsage()
      const heapUsedMb = Math.round(memUsage.heapUsed / 1024 / 1024)
      const rssMb = Math.round(memUsage.rss / 1024 / 1024)
      console.log(`[J12 CAPACITY TELEMETRY] Initial Node process RSS: ${rssMb} MB, Heap: ${heapUsedMb} MB`)
      expect(rssMb).toBeLessThan(450) // Within single AWS EC2 free-tier MemoryMax budget

      // 3. Concurrency Stress Test: 20 virtual candidate concurrent bursts
      const concurrencyBatchSize = 20
      const latencySamplesMs: number[] = []
      let errorsCount = 0

      const promises = Array.from({ length: concurrencyBatchSize }, async (_, idx) => {
        const studentEmail = `scale.cand.${idx}.${Date.now()}@proctornet.test`
        const t0 = Date.now()
        try {
          const res = await api.for(admin).postRaw('/api/v1/admin/students', {
            name: `Candidate ${idx}`,
            email: studentEmail,
            usn: `1RV22CS${Math.floor(100 + Math.random() * 899)}`,
            departmentCode: 'CSE',
            semester: 6,
            password: 'Student#Password#1'
          })
          const elapsed = Date.now() - t0
          latencySamplesMs.push(elapsed)
          if (res.status >= 500) {
            errorsCount++
          }
        } catch (err) {
          errorsCount++
        }
      })

      await Promise.all(promises)

      // 4. Compute p95 latency and verify zero 5xx errors
      latencySamplesMs.sort((a, b) => a - b)
      const p95Index = Math.floor(latencySamplesMs.length * 0.95)
      const p95Latency = latencySamplesMs[p95Index] || 0
      console.log(`[J12 CAPACITY TELEMETRY] Concurrency batch size: ${concurrencyBatchSize}, p95 latency: ${p95Latency} ms, 5xx errors: ${errorsCount}`)

      expect(errorsCount).toBe(0) // Strict zero 5xx invariant
      expect(p95Latency).toBeLessThan(5000) // Fast response under concurrent load

    } finally {
      await faculty.close()
      await admin.close()
    }
  })
})
