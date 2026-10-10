import fs from 'fs'
import path from 'path'

export interface AiFinding {
  severity: 'CRITICAL' | 'MAJOR' | 'MODERATE' | 'LOW' | 'INFO'
  page: string
  persona: string
  finding: string
  evidenceStep: string
  suggestedAction?: string
}

export interface AiRunMetrics {
  timestamp: string
  runId: string
  targetUrl: string
  stepsExecuted: number
  estimatedTokens: number
  estimatedCostUsd: number
  capExceeded: boolean
  findings: AiFinding[]
}

const ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'staging.proctornet.local']
const HARD_PER_RUN_COST_CAP_USD = parseFloat(process.env.AI_E2E_PER_RUN_CAP_USD || '1.50')
const MONTHLY_BUDGET_CAP_USD = parseFloat(process.env.AI_E2E_MONTHLY_CAP_USD || '50.00')

/**
 * Validates target host to strictly prevent exploratory agent from touching production
 */
export function validateAiTargetEnvironment(url: string): void {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    const isAllowed = ALLOWED_HOSTS.some(allowed => hostname === allowed || hostname.endsWith(`.${allowed}`))
    if (!isAllowed) {
      throw new Error(`[AI GUARDRAIL VIOLATION] Target host "${hostname}" is NOT in the allow-list (${ALLOWED_HOSTS.join(', ')}). AI explorer is strictly barred from touching non-staging/production infrastructure!`)
    }
  } catch (err: any) {
    if (err.message.includes('[AI GUARDRAIL VIOLATION]')) throw err
    throw new Error(`[AI GUARDRAIL VIOLATION] Invalid URL format: "${url}"`)
  }
}

/**
 * Cost and Step tracker with hard stops to prevent runaways
 */
export class AiCostGuard {
  private steps = 0
  private tokens = 0
  private findings: AiFinding[] = []
  private readonly runId = `ai-run-${Date.now()}`
  private readonly targetUrl: string

  constructor(targetUrl: string) {
    validateAiTargetEnvironment(targetUrl)
    this.targetUrl = targetUrl
  }

  recordStep(tokensUsed: number = 800): void {
    this.steps += 1
    this.tokens += tokensUsed

    const currentCost = (this.tokens / 1_000_000) * 5.0 // Conservative estimate for multimodal VLM
    if (currentCost > HARD_PER_RUN_COST_CAP_USD) {
      throw new Error(`[AI GUARDRAIL HARD STOP] Per-run cost cap ($${HARD_PER_RUN_COST_CAP_USD.toFixed(2)}) reached. Halting AI explorer to protect budget.`)
    }
  }

  addFinding(finding: AiFinding): void {
    this.findings.push(finding)
  }

  persistReport(): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const outDir = path.join(process.cwd(), 'reports', 'ai-tester', dateStr)
    fs.mkdirSync(outDir, { recursive: true })

    const cost = (this.tokens / 1_000_000) * 5.0
    const report: AiRunMetrics = {
      timestamp: new Date().toISOString(),
      runId: this.runId,
      targetUrl: this.targetUrl,
      stepsExecuted: this.steps,
      estimatedTokens: this.tokens,
      estimatedCostUsd: Number(cost.toFixed(4)),
      capExceeded: false,
      findings: this.findings
    }

    const reportPath = path.join(outDir, 'findings.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')

    // Also write a human-readable markdown summary
    const mdPath = path.join(outDir, 'SUMMARY.md')
    const mdLines = [
      `# ProctorNet AI Explorer Run Summary`,
      `- **Run ID:** \`${this.runId}\``,
      `- **Target Host:** \`${this.targetUrl}\``,
      `- **Steps Executed:** ${this.steps}`,
      `- **Estimated Tokens:** ${this.tokens.toLocaleString()}`,
      `- **Estimated Cost:** $${cost.toFixed(4)} (Cap: $${HARD_PER_RUN_COST_CAP_USD.toFixed(2)})`,
      `- **Total Findings:** ${this.findings.length}`,
      ``,
      `## UX & Exploratory Findings`,
      `| Severity | Persona | Page | Finding | Suggested Action |`,
      `| :--- | :--- | :--- | :--- | :--- |`
    ]

    for (const f of this.findings) {
      mdLines.push(`| **${f.severity}** | ${f.persona} | \`${f.page}\` | ${f.finding} | ${f.suggestedAction || 'Review flow'} |`)
    }

    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8')
    return reportPath
  }
}
