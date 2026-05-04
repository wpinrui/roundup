import { safeStorage } from 'electron'
import log from 'electron-log/main'

/**
 * Encrypts a plaintext API key using the OS keychain (Keychain / DPAPI / libsecret).
 * Returns a Buffer suitable for storing on disk (never store the raw string).
 */
export function encryptApiKey(plaintext: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this system')
  }
  return safeStorage.encryptString(plaintext)
}

/**
 * Decrypts a Buffer previously produced by encryptApiKey.
 * Returns the original plaintext API key.
 */
export function decryptApiKey(encrypted: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage encryption is not available on this system')
  }
  return safeStorage.decryptString(encrypted)
}

/**
 * Loads the API key from the given encrypted bytes.
 * Returns null if the buffer is empty (key not yet set).
 */
export function loadApiKey(encrypted: Buffer | null): string | null {
  if (!encrypted || encrypted.length === 0) return null
  try {
    return decryptApiKey(encrypted)
  } catch (err) {
    log.error('Failed to decrypt API key', err)
    return null
  }
}
