const { test, expect } = require('@playwright/test')
const { setupMediaPlaneFixture, cleanupMediaPlaneFixture, prisma } = require('./helpers/mediaFixture')

test.describe('BUG-A03 — Student ExamInterface Publishes LiveKit Stream', () => {
  let fixture
  let studentSession

  test.beforeAll(async () => {
    test.setTimeout(120000)
    fixture = await setupMediaPlaneFixture()
  })

  test.afterAll(async () => {
    if (studentSession) {
      try {
        await studentSession.page.evaluate(() => window.__publisher?.disconnect?.()).catch(() => {})
        await studentSession.ctx.close().catch(() => {})
      } catch (_) {}
    }
    await cleanupMediaPlaneFixture(fixture)
    await prisma.$disconnect().catch(() => {})
  })

  test('Student publisher initializes with media token and publishes camera stream to LiveKit SFU', async ({ browser, baseURL }) => {
    const student = fixture.students[0]
    expect(student).toBeDefined()
    expect(student.mediaToken).toBeTruthy()

    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    // Navigate to base app
    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Initialize ProctorPublisher via browser ESM module
    const connectionResult = await page.evaluate(async ({ token, wsUrl, examId, attemptId }) => {
      try {
        const { ProctorPublisher } = await import('/src/lib/proctorMedia.js')
        const pub = new ProctorPublisher({
          examId,
          attemptId,
          token,
          wsUrl,
          enableCamera: true
        })
        await pub.connect()
        window.__publisher = pub

        return {
          success: true,
          roomName: pub.room?.name,
          connectionState: pub.room?.state,
          hasLocalParticipant: Boolean(pub.room?.localParticipant)
        }
      } catch (err) {
        return {
          success: false,
          error: err.message
        }
      }
    }, {
      token: student.mediaToken,
      wsUrl: 'ws://127.0.0.1:7880',
      examId: fixture.examId,
      attemptId: student.attemptId
    })

    studentSession = { ctx, page }

    if (!connectionResult.success) {
      console.error('[Media SFU Failure Detail]:', connectionResult.error)
    }

    expect(connectionResult.error).toBeUndefined()
    expect(connectionResult.success).toBe(true)
    expect(connectionResult.connectionState).toBe('connected')
    expect(connectionResult.hasLocalParticipant).toBe(true)
  })
})

