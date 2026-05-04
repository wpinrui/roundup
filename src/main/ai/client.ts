import Anthropic from '@anthropic-ai/sdk'

/**
 * Returns an Anthropic client bound to the given API key.
 * Caller-provided key only — never read from process.env, never persisted
 * here. Persistence is the api-key module's responsibility.
 */
export function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey })
}
