import { vi, describe, it, expect, beforeEach } from 'vitest'

const isEncryptionAvailable = vi.fn().mockReturnValue(true)
const encryptString = vi
  .fn()
  .mockImplementation((str: string) => Buffer.from(`enc::${str}`, 'utf8'))
const decryptString = vi
  .fn()
  .mockImplementation((buf: Buffer) => buf.toString('utf8').replace('enc::', ''))
const logError = vi.fn()

vi.mock('electron', () => ({
  safeStorage: { isEncryptionAvailable, encryptString, decryptString },
}))
vi.mock('electron-log/main', () => ({
  default: { error: logError, info: vi.fn() },
}))

const { encryptApiKey, decryptApiKey, loadApiKey } = await import('../secrets')

beforeEach(() => {
  isEncryptionAvailable.mockReturnValue(true)
  decryptString.mockImplementation((buf: Buffer) =>
    buf.toString('utf8').replace('enc::', '')
  )
  logError.mockReset()
})

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

  it('loadApiKey returns null and logs when decryptString throws', () => {
    decryptString.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(loadApiKey(Buffer.from('whatever'))).toBeNull()
    expect(logError).toHaveBeenCalledOnce()
  })

  it('encryptApiKey throws when safeStorage is unavailable', () => {
    isEncryptionAvailable.mockReturnValue(false)
    expect(() => encryptApiKey('k')).toThrow(
      'safeStorage encryption is not available on this system'
    )
  })

  it('decryptApiKey throws when safeStorage is unavailable', () => {
    isEncryptionAvailable.mockReturnValue(false)
    expect(() => decryptApiKey(Buffer.from('x'))).toThrow(
      'safeStorage encryption is not available on this system'
    )
  })
})
