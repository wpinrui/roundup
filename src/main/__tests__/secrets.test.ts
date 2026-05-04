import { vi, describe, it, expect } from 'vitest'

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: vi.fn().mockReturnValue(true),
    encryptString: vi.fn().mockImplementation((str: string) =>
      Buffer.from(`enc::${str}`, 'utf8')
    ),
    decryptString: vi.fn().mockImplementation((buf: Buffer) =>
      buf.toString('utf8').replace('enc::', '')
    ),
  },
}))

vi.mock('electron-log/main', () => ({
  default: { error: vi.fn(), info: vi.fn() },
}))

const { encryptApiKey, decryptApiKey, loadApiKey } = await import('../secrets')

describe('secrets', () => {
  it('round-trips an API key through encrypt/decrypt', () => {
    const key = 'sk-ant-api03-test-key-abc123'
    const encrypted = encryptApiKey(key)
    expect(encrypted).toBeInstanceOf(Buffer)
    const decrypted = decryptApiKey(encrypted)
    expect(decrypted).toBe(key)
  })

  it('loadApiKey returns null for empty buffer', () => {
    expect(loadApiKey(null)).toBeNull()
    expect(loadApiKey(Buffer.alloc(0))).toBeNull()
  })

  it('loadApiKey decrypts a valid buffer', () => {
    const key = 'sk-ant-api03-another-key'
    const encrypted = encryptApiKey(key)
    expect(loadApiKey(encrypted)).toBe(key)
  })
})
