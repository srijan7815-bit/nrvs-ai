// API key hashing utilities for secure storage.
// NRVS API keys are stored as SHA-256 hashes so the raw key is never in the DB.
// The key is shown once at creation and verified by hashing the presented key.

import { createHash } from 'crypto'

/**
 * Hash an API key with SHA-256 + a salt for storage.
 * Returns the hash string.
 */
export function hashApiKey(key) {
  if (!key) return ''
  // Include a fixed salt prefix for additional protection against rainbow tables.
  // The hash is per-row unique via the key itself being a high-entropy random value.
  return createHash('sha256').update(`nrvs-key-v1:${key}`).digest('hex')
}

/**
 * Verify a presented API key against a stored hash.
 */
export function verifyApiKey(presentedKey, storedHash) {
  if (!presentedKey || !storedHash) return false
  return hashApiKey(presentedKey) === storedHash
}
