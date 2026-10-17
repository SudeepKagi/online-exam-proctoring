const { AsyncLocalStorage } = require('async_hooks')

const asyncLocalStorage = new AsyncLocalStorage()

function getRequestId() {
  const store = asyncLocalStorage.getStore()
  return store?.requestId || null
}

function getContext() {
  return asyncLocalStorage.getStore() || {}
}

function runWithContext(store, fn) {
  return asyncLocalStorage.run(store, fn)
}

module.exports = {
  asyncLocalStorage,
  getRequestId,
  getContext,
  runWithContext,
}
