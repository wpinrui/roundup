import { describe, it, expect, beforeEach, vi } from 'vitest'

// Hoisted mock state — anthropic instances created via `new Anthropic({apiKey})`
// pull `messages.create` from this shared spy.
const messagesCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  // The SDK exposes typed error classes on the default export. We reproduce
  // the minimum surface the verify module uses (instanceof checks).
  class APIError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class RateLimitError extends APIError {}

  class Anthropic {
    messages = { create: messagesCreate }
    static APIError = APIError
    static AuthenticationError = AuthenticationError
    static PermissionDeniedError = PermissionDeniedError
    static RateLimitError = RateLimitError
  }
  return { default: Anthropic, Anthropic }
})

const { verifyKey } = await import('../verify')
// Re-import the mocked module to get the same error classes the verify module sees.
const Anthropic = (await import('@anthropic-ai/sdk')).default

beforeEach(() => {
  messagesCreate.mockReset()
})

describe('verifyKey', () => {
  it('returns ok:false on empty key without calling Anthropic', async () => {
    const r = await verifyKey('')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/empty/i)
    expect(messagesCreate).not.toHaveBeenCalled()
  })

  it('returns ok:true on a successful round-trip', async () => {
    messagesCreate.mockResolvedValue({ id: 'msg_1', content: [] })
    const r = await verifyKey('sk-ant-good')
    expect(r.ok).toBe(true)
    expect(r.error).toBeUndefined()
    expect(messagesCreate).toHaveBeenCalledOnce()
  })

  it('returns ok:false with "Invalid API key" on AuthenticationError', async () => {
    // @ts-expect-error using the mocked class
    messagesCreate.mockRejectedValue(new Anthropic.AuthenticationError('401', 401))
    const r = await verifyKey('sk-ant-bad')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/invalid/i)
  })

  it('returns ok:false with "permission" on PermissionDeniedError', async () => {
    // @ts-expect-error using the mocked class
    messagesCreate.mockRejectedValue(new Anthropic.PermissionDeniedError('403', 403))
    const r = await verifyKey('sk-ant-noperm')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/permission/i)
  })

  it('returns ok:false with "rate limit" on RateLimitError', async () => {
    // @ts-expect-error using the mocked class
    messagesCreate.mockRejectedValue(new Anthropic.RateLimitError('429', 429))
    const r = await verifyKey('sk-ant-rl')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/rate limit/i)
  })

  it('returns ok:false with the message text on a plain network error', async () => {
    messagesCreate.mockRejectedValue(new Error('ECONNRESET'))
    const r = await verifyKey('sk-ant-net')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('ECONNRESET')
  })
})
