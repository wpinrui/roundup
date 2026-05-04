import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync } from 'fs'
import path from 'path'
import os from 'os'

// safeStorage mock — identity round-trip is enough; secrets.test covers the
// real encrypt/decrypt branches.
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(`enc::${s}`, 'utf8'),
    decryptString: (b: Buffer) => b.toString('utf8').replace('enc::', ''),
  },
}))
vi.mock('electron-log/main', () => ({ default: { error: vi.fn(), info: vi.fn() } }))

const { saveApiKey, getStoredApiKey } = await import('../api-key')

describe('api-key persistence', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'roundup-apikey-'))
  })

  it('returns null when no key has been stored', () => {
    expect(getStoredApiKey(dir)).toBeNull()
  })

  it('round-trips a saved key', () => {
    saveApiKey(dir, 'sk-ant-test-key-abc123')
    expect(getStoredApiKey(dir)).toBe('sk-ant-test-key-abc123')
  })

  it('overwrites a previously saved key', () => {
    saveApiKey(dir, 'first')
    saveApiKey(dir, 'second')
    expect(getStoredApiKey(dir)).toBe('second')
  })
})
