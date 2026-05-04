import Anthropic from '@anthropic-ai/sdk'
import type { VerifyResult } from '@shared/ipc'
import { makeClient } from './client'

/**
 * Minimal live round-trip to confirm an API key works (decision K — Verify
 * button on wizard step 1). One-token prompt against the cheapest model.
 *
 * Maps SDK-typed errors to a user-facing reason string. AuthenticationError
 * (401) and PermissionDeniedError (403) are key-validity failures; everything
 * else (network, rate limit, server error) we surface as a generic failure
 * the user can retry.
 */
export async function verifyKey(apiKey: string): Promise<VerifyResult> {
  if (!apiKey || apiKey.trim().length === 0) {
    return { ok: false, error: 'API key is empty.' }
  }

  // E2E hook — when ROUNDUP_E2E_MOCK_ANTHROPIC=1 we short-circuit without
  // touching the network. Production never sets this env var.
  if (process.env['ROUNDUP_E2E_MOCK_ANTHROPIC'] === '1') {
    return apiKey.startsWith('sk-ant-bad') ? { ok: false, error: 'Invalid API key.' } : { ok: true }
  }

  const client = makeClient(apiKey)
  try {
    await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: 'Invalid API key.' }
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, error: 'This API key does not have permission to call the Anthropic API.' }
    }
    if (err instanceof Anthropic.RateLimitError) {
      return { ok: false, error: 'Rate limit exceeded. Please try again in a moment.' }
    }
    if (err instanceof Anthropic.APIError) {
      return { ok: false, error: `Anthropic API error (${err.status ?? 'unknown'}): ${err.message}` }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Network error.' }
  }
}
