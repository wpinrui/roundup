import type Anthropic from '@anthropic-ai/sdk'
import type { DimensionInput } from '@shared/ipc'
import { makeClient } from './client'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 16000

/**
 * Builds the rubric-generation prompt from the GDD § Rubric Design verbatim
 * (curve descriptors at 0 / 3–4 / 5–6 / 7–8 / 9–10), anchored to each
 * dimension's stated goals.
 */
function buildPrompt(dimensions: DimensionInput[]): string {
  const lines: string[] = []
  lines.push(
    "You are creating personalised daily-grading rubrics for a life-tracking app. The user has supplied a list of dimensions they want graded against each end-of-day. For each dimension, you produce a 0–10 rubric with descriptors anchored to *their own* stated goals (not generic ones)."
  )
  lines.push('')
  lines.push('Curve (use this exact shape — easy to pass, harder to excel):')
  lines.push('- 0: nothing / actively harmful')
  lines.push('- 3–4: any visible effort')
  lines.push('- 5–6: normal okay day')
  lines.push('- 7–8: clearly good day')
  lines.push('- 9–10: rare, standout')
  lines.push('')
  lines.push("Output format — a single markdown document. For each dimension:")
  lines.push('1. A `## <Dimension Name>` header')
  lines.push('2. A markdown table with two columns: Score | Descriptor')
  lines.push('3. Rows for 0, 3–4, 5–6, 7–8, 9–10 — each descriptor written in the user\'s terms (referencing their `success`, `constraints`, `anti-goals`, `additional`).')
  lines.push('')
  lines.push('Do not include any preamble, commentary, or trailing notes. Output only the markdown document.')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push("Here are the user's dimensions:")
  lines.push('')

  for (const d of dimensions) {
    lines.push(`### Dimension: ${d.name}`)
    lines.push(`- Weight: ${d.weight}/10`)
    lines.push(`- Success looks like: ${d.successText}`)
    lines.push(`- Constraints: ${d.constraintsText}`)
    lines.push(`- Anti-goals: ${d.antiGoalsText}`)
    if (d.additionalInfo && d.additionalInfo.trim().length > 0) {
      lines.push(`- Additional info: ${d.additionalInfo}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Calls Sonnet to generate rubrics for the given dimensions and returns the
 * markdown document. Streams under the hood — long outputs are routine here.
 *
 * No automatic retry on malformed output; the caller (wizard step 3) shows a
 * retry button per the brief.
 */
export async function generateRubrics(
  apiKey: string,
  dimensions: DimensionInput[]
): Promise<string> {
  if (dimensions.length === 0) {
    throw new Error('Cannot generate rubrics: no dimensions provided.')
  }

  // E2E hook — same guard as verify.ts. Returns a deterministic stub so E2E
  // tests can assert the wizard wired everything up, without hitting Sonnet.
  if (process.env['ROUNDUP_E2E_MOCK_ANTHROPIC'] === '1') {
    return dimensions
      .map(
        (d) =>
          `## ${d.name}\n\n| Score | Descriptor |\n|---|---|\n| 0 | nothing |\n| 5 | okay day |\n| 10 | rare standout |\n`
      )
      .join('\n')
  }

  const client = makeClient(apiKey)
  const prompt = buildPrompt(dimensions)

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const finalMessage = await stream.finalMessage()
  const text = extractText(finalMessage)
  if (text.trim().length === 0) {
    throw new Error('Sonnet returned an empty rubric document.')
  }
  return text
}

function extractText(message: Anthropic.Message): string {
  const parts: string[] = []
  for (const block of message.content) {
    if (block.type === 'text') parts.push(block.text)
  }
  return parts.join('\n')
}
