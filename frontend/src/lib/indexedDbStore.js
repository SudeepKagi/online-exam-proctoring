/**
 * indexedDbStore.js
 * High-durability IndexedDB-backed encrypted storage for exam attempt answers.
 * Preserves candidate answers across hard reloads, browser crashes, network dropouts,
 * and memory evictions (Notion 13.6/13.7 & Audit Phase 3 / Item 17).
 */

const DB_NAME = 'proctornet_offline_v1'
const DB_VERSION = 1
const STORE_PENDING = 'pending_answers'
const STORE_SNAPSHOTS = 'attempt_snapshots'

let _dbPromise = null

function getDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null)
  }

  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION)

      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(STORE_PENDING)) {
          const pendingStore = db.createObjectStore(STORE_PENDING, { keyPath: 'attemptQuestionId' })
          pendingStore.createIndex('attemptId', 'attemptId', { unique: false })
        }
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'attemptId' })
        }
      }

      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        // Fall back gracefully if IndexedDB is blocked in private mode
        resolve(null)
      }
    })
  }

  return _dbPromise
}

// ── AES-GCM Lightweight Client-Side Cipher for Local Storage Privacy ──

async function getEncryptionKey(attemptId) {
  if (!window.crypto || !window.crypto.subtle) return null
  try {
    const rawSeed = new TextEncoder().encode(`proctornet-secure-offline-v1-${attemptId || 'global'}`)
    const hash = await window.crypto.subtle.digest('SHA-256', rawSeed)
    return await window.crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    )
  } catch {
    return null
  }
}

async function encryptData(data, attemptId) {
  const jsonStr = JSON.stringify(data)
  try {
    const key = await getEncryptionKey(attemptId)
    if (!key) return { raw: jsonStr }

    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encoded = new TextEncoder().encode(jsonStr)
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    )

    return {
      iv: Array.from(iv),
      cipher: Array.from(new Uint8Array(cipherBuffer)),
      isEncrypted: true
    }
  } catch {
    return { raw: jsonStr }
  }
}

async function decryptData(payload, attemptId) {
  if (!payload) return null
  if (payload.raw) {
    try { return JSON.parse(payload.raw) } catch { return null }
  }

  if (payload.isEncrypted && payload.cipher && payload.iv) {
    try {
      const key = await getEncryptionKey(attemptId)
      if (!key) return null
      const iv = new Uint8Array(payload.iv)
      const cipher = new Uint8Array(payload.cipher)
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipher
      )
      const decodedStr = new TextDecoder().decode(decryptedBuffer)
      return JSON.parse(decodedStr)
    } catch {
      return null
    }
  }

  return null
}

// ── Public Store API ──

export const offlineAnswerStore = {
  /**
   * Persist a dirty pending answer into IndexedDB
   */
  async savePendingAnswer(attemptId, item) {
    const db = await getDb()
    if (!db || !item || !item.attemptQuestionId) return

    try {
      const enc = await encryptData(item, attemptId)
      const record = {
        attemptQuestionId: item.attemptQuestionId,
        attemptId,
        payload: enc,
        updatedAt: Date.now()
      }

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_PENDING, 'readwrite')
        tx.objectStore(STORE_PENDING).put(record)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
      })
    } catch {
      return false
    }
  },

  /**
   * Remove a dirty pending answer once successfully flushed to server
   */
  async removePendingAnswer(attemptQuestionId) {
    const db = await getDb()
    if (!db || !attemptQuestionId) return

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite')
      tx.objectStore(STORE_PENDING).delete(attemptQuestionId)
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  },

  /**
   * Retrieve all dirty pending answers for an attempt
   */
  async getPendingAnswers(attemptId) {
    const db = await getDb()
    if (!db || !attemptId) return []

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PENDING, 'readonly')
      const index = tx.objectStore(STORE_PENDING).index('attemptId')
      const req = index.getAll(attemptId)

      req.onsuccess = async () => {
        const records = req.result || []
        const decryptedList = []
        for (const r of records) {
          const item = await decryptData(r.payload, attemptId)
          if (item) decryptedList.push(item)
        }
        resolve(decryptedList)
      }
      req.onerror = () => resolve([])
    })
  },

  /**
   * Clear all pending answers for an attempt (e.g. on final submission)
   */
  async clearPendingAnswers(attemptId) {
    const db = await getDb()
    if (!db || !attemptId) return

    const pending = await this.getPendingAnswers(attemptId)
    if (!pending || pending.length === 0) return

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite')
      const store = tx.objectStore(STORE_PENDING)
      for (const p of pending) {
        store.delete(p.attemptQuestionId)
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  },

  /**
   * Save a full snapshot of selected answers for offline tab-crash restoration
   */
  async saveAttemptSnapshot(attemptId, data) {
    const db = await getDb()
    if (!db || !attemptId) return

    try {
      const enc = await encryptData(data, attemptId)
      const record = {
        attemptId,
        payload: enc,
        updatedAt: Date.now()
      }

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite')
        tx.objectStore(STORE_SNAPSHOTS).put(record)
        tx.oncomplete = () => resolve(true)
        tx.onerror = () => resolve(false)
      })
    } catch {
      return false
    }
  },

  /**
   * Restore a full snapshot of selected answers
   */
  async getAttemptSnapshot(attemptId) {
    const db = await getDb()
    if (!db || !attemptId) return null

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly')
      const req = tx.objectStore(STORE_SNAPSHOTS).get(attemptId)

      req.onsuccess = async () => {
        if (!req.result) return resolve(null)
        const data = await decryptData(req.result.payload, attemptId)
        resolve(data)
      }
      req.onerror = () => resolve(null)
    })
  }
}
