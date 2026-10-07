/**
 * llm.js
 * R4 — LLM Provider Driver Abstraction (LLM_PROVIDER=none|openai|google|anthropic)
 */

'use strict'

const config = require('../../shared/config')
const { llmService } = require('../../modules/faculty/llmService')

function getLlmDriver(providerName = null) {
  const chosen = (providerName || config.llmProvider || 'none').toLowerCase().trim()
  return {
    provider: chosen,
    isEnabled: chosen !== 'none',
    generateQuestionsPreview: (params) => llmService.generateQuestionsPreview({ ...params, providerOverride: chosen })
  }
}

module.exports = {
  getLlmDriver
}
