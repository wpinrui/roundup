import type Anthropic from '@anthropic-ai/sdk'
import type { DimensionRow } from '@shared/ipc'
import { makeClient } from './client'

const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 4000

export interface GradeInput {
  apiKey: string
  /** Full dimension records — id is what scores/suggestions reference. */
  dimensions: DimensionRow[]
  /** Contents of rubrics.md (full markdown). */
  rubrics: string
  /** The user's free-form day-text dump. */
  dayText: string
}

export interface GradeScore {
  dimensionId: number
  score: number
  hoursEstimated: number | null
}

export interface GradeCandidateSuggestion {
  dimensionId: number
  text: string
}

export interface GradeResult {
  narrative: string
  scores: GradeScore[]
  /** Σ(score × weight) / Σ(weight). Computed in code, not by the model. */
  weightedOverallScore: number
  /** Pool of suggestions per dimension; the ranker picks the top 1–3. */
  candidateSuggestions: GradeCandidateSuggestion[]
}

/**
 * Grades a day across the given dimensions using their rubrics.
 *
 * Flow: build a prompt that hands Haiku the dimension goals, the rubrics
 * document, and the day's raw text → ask for structured JSON → parse and
 * validate that every dimension id appears in the scores array →
 * compute the weighted overall in code so it's deterministic.
 */
export async function gradeDay(input: GradeInput): Promise<GradeResult> {
  const { apiKey, dimensions, rubrics, dayText } = input

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('No API key provided.')
  }
  if (dimensions.length === 0) {
    throw new Error('Cannot grade: no dimensions configured.')
  }
  if (!dayText || dayText.trim().length === 0) {
    throw new Error('Cannot grade: day text is empty.')
  }

  if (process.env['ROUNDUP_E2E_MOCK_ANTHROPIC'] === '1') {
    return mockResult(dimensions)
  }

  const client = makeClient(apiKey)
  const prompt = buildPrompt(dimensions, rubrics, dayText)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractText(message)
  const parsed = parseGraderJson(text)
  return assemble(parsed, dimensions)
}

interface ParsedGraderJson {
  narrative: string
  scores: Array<{ dimensionId: number; score: number; hoursEstimated: number | null }>
  candidateSuggestions: Array<{ dimensionId: number; text: string }>
}

function buildPrompt(dimensions: DimensionRow[], rubrics: string, dayText: string): string {
  const dimensionDescriptors = dimensions
    .map((d) => {
      const lines = [
        `### Dimension id=${d.id} — ${d.name}`,
        `- Weight: ${d.weight}/10`,
        `- Success looks like: ${d.successText}`,
        `- Constraints: ${d.constraintsText}`,
        `- Anti-goals: ${d.antiGoalsText}`,
      ]
      if (d.additionalInfo && d.additionalInfo.trim()) {
        lines.push(`- Additional info: ${d.additionalInfo}`)
      }
      return lines.join('\n')
    })
    .join('\n\n')

  const dimensionIdList = dimensions.map((d) => d.id).join(', ')

  return [
    "You are grading a single end-of-day journal entry for a life-tracking app. The user has supplied dimensions they want graded; rubrics tell you what each score (0–10) means in their own terms.",
    '',
    'Read the dimensions, then the rubrics, then the day text. Produce one score per dimension on a 0–10 scale (allow halves: 0, 0.5, 1, 1.5, … 10). Estimate the hours the user appears to have spent on each dimension based on what they wrote.',
    '',
    'Then propose a small pool of candidate suggestions for tomorrow — between one and three suggestions per dimension, written in a "consider…" tone (suggestive, not prescriptive). The pool is wider than what will be shown to the user; an algorithmic ranker chooses the final 1–3.',
    '',
    'Finally, write a 2–3 sentence narrative summarising the day overall (not per dimension).',
    '',
    '─── Dimensions ───',
    '',
    dimensionDescriptors,
    '',
    '─── Rubrics ───',
    '',
    rubrics.trim(),
    '',
    "─── Today's entry ───",
    '',
    dayText.trim(),
    '',
    '─── Output format ───',
    '',
    'Reply with a single JSON object — no preamble, no commentary, no markdown fences. Schema:',
    '',
    '```',
    '{',
    '  "narrative": "<2-3 sentences>",',
    '  "scores": [',
    `    { "dimensionId": <one of: ${dimensionIdList}>, "score": <0-10>, "hoursEstimated": <number or null> }`,
    '  ],',
    '  "candidateSuggestions": [',
    '    { "dimensionId": <int>, "text": "Consider …" }',
    '  ]',
    '}',
    '```',
    '',
    'Constraints:',
    `- Provide exactly one score entry per dimensionId in this set: ${dimensionIdList}.`,
    '- hoursEstimated is null when the entry gives no signal; otherwise a positive number.',
    '- Suggestion text starts with a soft verb ("Consider", "Try", "Maybe", "Perhaps") — never imperative.',
    '- Output only the JSON object, nothing else.',
  ].join('\n')
}

/**
 * Extract the JSON object from the model output. The prompt asks for raw JSON,
 * but Haiku occasionally wraps it in ```json ... ``` fences — strip them, then
 * locate the outermost { … } and parse.
 */
function parseGraderJson(text: string): ParsedGraderJson {
  let trimmed = text.trim()
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  }
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('Grader output did not contain a JSON object.')
  }
  const slice = trimmed.slice(firstBrace, lastBrace + 1)

  let raw: unknown
  try {
    raw = JSON.parse(slice)
  } catch (err) {
    throw new Error(
      `Grader output was not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  if (!isParsedGraderJson(raw)) {
    throw new Error('Grader output JSON did not match the expected schema.')
  }
  return raw
}

function isParsedGraderJson(value: unknown): value is ParsedGraderJson {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v['narrative'] !== 'string') return false
  if (!Array.isArray(v['scores'])) return false
  if (!Array.isArray(v['candidateSuggestions'])) return false
  for (const s of v['scores']) {
    if (!s || typeof s !== 'object') return false
    const sObj = s as Record<string, unknown>
    if (typeof sObj['dimensionId'] !== 'number') return false
    if (typeof sObj['score'] !== 'number') return false
    if (sObj['hoursEstimated'] !== null && typeof sObj['hoursEstimated'] !== 'number') {
      return false
    }
  }
  for (const c of v['candidateSuggestions']) {
    if (!c || typeof c !== 'object') return false
    const cObj = c as Record<string, unknown>
    if (typeof cObj['dimensionId'] !== 'number') return false
    if (typeof cObj['text'] !== 'string') return false
  }
  return true
}

function assemble(parsed: ParsedGraderJson, dimensions: DimensionRow[]): GradeResult {
  const validIds = new Set(dimensions.map((d) => d.id))
  const scoresById = new Map<number, GradeScore>()
  for (const s of parsed.scores) {
    if (!validIds.has(s.dimensionId)) continue
    if (s.score < 0 || s.score > 10) {
      throw new Error(
        `Grader returned score ${s.score} for dimensionId=${s.dimensionId}; expected 0–10.`
      )
    }
    scoresById.set(s.dimensionId, {
      dimensionId: s.dimensionId,
      score: s.score,
      hoursEstimated: s.hoursEstimated,
    })
  }
  const missing = dimensions.filter((d) => !scoresById.has(d.id))
  if (missing.length > 0) {
    throw new Error(
      `Grader missed scores for dimensions: ${missing.map((d) => `${d.name}(id=${d.id})`).join(', ')}.`
    )
  }
  const orderedScores = dimensions.map((d) => scoresById.get(d.id) as GradeScore)

  let totalWeight = 0
  let weightedSum = 0
  for (const d of dimensions) {
    const s = scoresById.get(d.id) as GradeScore
    weightedSum += s.score * d.weight
    totalWeight += d.weight
  }
  const weightedOverallScore = totalWeight > 0 ? weightedSum / totalWeight : 0

  const candidateSuggestions = parsed.candidateSuggestions.filter((c) => validIds.has(c.dimensionId))

  return {
    narrative: parsed.narrative.trim(),
    scores: orderedScores,
    weightedOverallScore,
    candidateSuggestions,
  }
}

function extractText(message: Anthropic.Message): string {
  const parts: string[] = []
  for (const block of message.content) {
    if (block.type === 'text') parts.push(block.text)
  }
  return parts.join('\n')
}

/**
 * Deterministic mock for E2E. Score = clamp(weight - 2, 0, 10). Hours = 1.
 * Two suggestions per dimension. The narrative is a fixed string with the
 * word "mock" so tests can assert the mock path was taken.
 */
function mockResult(dimensions: DimensionRow[]): GradeResult {
  const scores: GradeScore[] = dimensions.map((d) => ({
    dimensionId: d.id,
    score: Math.max(0, Math.min(10, d.weight - 2)),
    hoursEstimated: 1,
  }))
  const candidateSuggestions: GradeCandidateSuggestion[] = dimensions.flatMap((d) => [
    { dimensionId: d.id, text: `Consider doing more of ${d.name} tomorrow.` },
    { dimensionId: d.id, text: `Try a focused 30-minute block on ${d.name}.` },
  ])
  let totalWeight = 0
  let weightedSum = 0
  for (let i = 0; i < dimensions.length; i++) {
    weightedSum += scores[i].score * dimensions[i].weight
    totalWeight += dimensions[i].weight
  }
  const weightedOverallScore = totalWeight > 0 ? weightedSum / totalWeight : 0
  return {
    narrative: 'A mocked grading narrative for end-to-end tests. Today happened.',
    scores,
    weightedOverallScore,
    candidateSuggestions,
  }
}
