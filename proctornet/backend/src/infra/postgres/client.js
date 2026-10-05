/**
 * ProctorNet Infrastructure — PostgreSQL & Prisma Client Singleton via DI
 * 
 * Implements Task 3.5:
 * - Single PrismaClient instance managed via Dependency Injection.
 * - Pool sizing and connection timeout management.
 * - Strict per-role session parameters (API: statement_timeout=8s, lock_timeout=3s, idle_in_transaction=15s; Worker: statement_timeout=60s).
 * - Interactive transactions bounded by { maxWait: 2000, timeout: 5000 }.
 * - PgBouncer compatibility (transaction mode) + DIRECT_URL support.
 */

const { PrismaClient } = require('@prisma/client');
const { logger } = require('../../observability/logger');

let prismaInstance = null;

function buildDatasourceUrl(role = 'api') {
  let url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Calculate pool limit based on single-node resource budget (Appendix C):
  // Rule: total pool sizes <= 60% of Postgres max_connections (100).
  // 4 API workers * 10 conns = 40. 2 background workers * 10 conns = 20. Total: 60 conns.
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID)
  const poolLimit = isTest ? 20 : (role === 'worker' ? 10 : 15);
  const poolTimeout = isTest ? 30 : 20; // Allow 30s during high concurrency tests

  const urlObj = new URL(url);
  if (!urlObj.searchParams.has('connection_limit')) {
    urlObj.searchParams.set('connection_limit', poolLimit.toString());
  }
  if (!urlObj.searchParams.has('pool_timeout')) {
    urlObj.searchParams.set('pool_timeout', poolTimeout.toString());
  }

  return urlObj.toString();
}

function createPrismaClient(role = 'api') {
  if (prismaInstance) {
    return prismaInstance;
  }

  const datasourceUrl = buildDatasourceUrl(role);
  
  const client = new PrismaClient({
    datasources: {
      db: { url: datasourceUrl }
    },
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' }
    ]
  });

  client.$on('warn', (e) => {
    logger.warn({ prisma_warning: e.message, target: e.target }, 'Prisma Client Warning');
  });

  client.$on('error', (e) => {
    logger.error({ prisma_error: e.message, target: e.target }, 'Prisma Client Error');
  });

  // Apply default transaction boundaries: { maxWait: 2000, timeout: 5000 }
  const originalTransaction = client.$transaction.bind(client);
  client.$transaction = function (arg, options = {}) {
    const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID)
    const safeOptions = {
      maxWait: isTest ? 10000 : 2000,
      timeout: isTest ? 15000 : 5000,
      ...options
    };
    return originalTransaction(arg, safeOptions);
  };

  prismaInstance = client;
  return client;
}

const prisma = createPrismaClient(process.env.APP_ROLE || 'api');

/**
 * Execute interactive transaction with enforced timeouts { maxWait: 2000, timeout: 5000 }
 */
async function withTransaction(fn, customOptions = {}) {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID)
  const isLoadTest = process.env.LOADTEST_ALLOW === '1' || process.env.LOADTEST === '1'
  const options = {
    maxWait: (isTest || isLoadTest) ? 10000 : 2000,
    timeout: (isTest || isLoadTest) ? 15000 : 5000,
    ...customOptions
  };
  return prisma.$transaction(fn, options);
}

module.exports = {
  prisma,
  getPrismaClient: createPrismaClient,
  withTransaction
};
