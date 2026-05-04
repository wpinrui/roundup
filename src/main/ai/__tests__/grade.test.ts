import { describe, it, expect, beforeEach, vi } from 'vitest'

const messagesCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages = { create: messagesCreate }
  }
  return { default: Anthropic, Anthropic }
})

const { gradeDay } = await import('../grade')
const { default: AnthropicMod } = await import('@anthropic-ai/sdk')
void AnthropicMod // ensure mock is registered before grade.ts touches it

const baseDim = {
  successText: 'ship features',
  constraintsText: 'no overtime',
  antiGoalsText: 'busywork',
  additionalInfo: null,
  createdAt: '2026-05-01T00:00:00Z',
}

const dims = [
  { ...baseDim, id: 1, name: 'Work', weight: 8 },
  { ...baseDim, id: 2, name: 'Health', weight: 5 },
]

beforeEach(() => {
  messagesCreate.mockReset()
  delete process.env['ROUNDUP_E2E_MOCK_ANTHROPIC']
})

function reply(json: object | string) {
  const text = typeof json === 'string' ? json : JSON.stringify(json)
  messagesCreate.mockResolvedValue({ content: [{ type: 'text', text }] })
}

describe('gradeDay — input guards', () => {
  it('throws on empty api key', async () => {
    await expect(
      gradeDay({ apiKey: '', dimensions: dims, rubrics: 'r', dayText: 'd' })
    ).rejects.toThrow(/no api key/i)
  })

  it('throws on no dimensions', async () => {
    await expect(
      gradeDay({ apiKey: 'k', dimensions: [], rubrics: 'r', dayText: 'd' })
    ).rejects.toThrow(/no dimensions/i)
  })

  it('throws on empty day text', async () => {
    await expect(
      gradeDay({ apiKey: 'k', dimensions: dims, rubrics: 'r', dayText: '   ' })
    ).rejects.toThrow(/day text is empty/i)
  })
})

describe('gradeDay — happy path', () => {
  it('parses JSON output, computes weighted overall, returns scores in dimension order', async () => {
    reply({
      narrative: 'Today was decent.',
      scores: [
        { dimensionId: 2, score: 6, hoursEstimated: 1 },
        { dimensionId: 1, score: 8, hoursEstimated: 4 },
      ],
      candidateSuggestions: [
        { dimensionId: 1, text: 'Consider starting earlier.' },
        { dimensionId: 2, text: 'Try a walk.' },
      ],
    })
    const r = await gradeDay({
      apiKey: 'sk-ant-test',
      dimensions: dims,
      rubrics: '## Work\n## Health',
      dayText: 'I worked and walked.',
    })
    expect(r.narrative).toBe('Today was decent.')
    // Order matches dims input (Work first, then Health)
    expect(r.scores.map((s) => s.dimensionId)).toEqual([1, 2])
    expect(r.scores.map((s) => s.score)).toEqual([8, 6])
    // Σ(score×weight)/Σ(weight) = (8*8 + 6*5)/(8+5) = 94/13 ≈ 7.23
    expect(r.weightedOverallScore).toBeCloseTo(94 / 13)
    expect(r.candidateSuggestions).toHaveLength(2)
  })

  it('strips ```json fences when the model wraps output', async () => {
    reply(
      '```json\n' +
        JSON.stringify({
          narrative: 'ok',
          scores: [
            { dimensionId: 1, score: 5, hoursEstimated: null },
            { dimensionId: 2, score: 5, hoursEstimated: null },
          ],
          candidateSuggestions: [],
        }) +
        '\n```'
    )
    const r = await gradeDay({
      apiKey: 'k',
      dimensions: dims,
      rubrics: 'r',
      dayText: 'd',
    })
    expect(r.narrative).toBe('ok')
  })

  it('drops candidate suggestions referencing unknown dimension ids', async () => {
    reply({
      narrative: 'n',
      scores: [
        { dimensionId: 1, score: 5, hoursEstimated: null },
        { dimensionId: 2, score: 5, hoursEstimated: null },
      ],
      candidateSuggestions: [
        { dimensionId: 1, text: 'good' },
        { dimensionId: 99, text: 'phantom' },
      ],
    })
    const r = await gradeDay({ apiKey: 'k', dimensions: dims, rubrics: 'r', dayText: 'd' })
    expect(r.candidateSuggestions).toHaveLength(1)
    expect(r.candidateSuggestions[0].text).toBe('good')
  })
})

describe('gradeDay — malformed output', () => {
  it('throws on non-JSON output', async () => {
    reply('not json at all')
    await expect(
      gradeDay({ apiKey: 'k', dimensions: dims, rubrics: 'r', dayText: 'd' })
    ).rejects.toThrow(/JSON object/i)
  })

  it('throws when JSON is missing the scores field', async () => {
    reply({ narrative: 'n', candidateSuggestions: [] })
    await expect(
      gradeDay({ apiKey: 'k', dimensions: dims, rubrics: 'r', dayText: 'd' })
    ).rejects.toThrow(/schema/i)
  })

  it('throws when a dimension is missing from scores', async () => {
    reply({
      narrative: 'n',
      scores: [{ dimensionId: 1, score: 7, hoursEstimated: null }],
      candidateSuggestions: [],
    })
    await expect(
      gradeDay({ apiKey: 'k', dimensions: dims, rubrics: 'r', dayText: 'd' })
    ).rejects.toThrow(/missed scores/i)
  })

  it('throws when a score is out of 0–10 range', async () => {
    reply({
      narrative: 'n',
      scores: [
        { dimensionId: 1, score: 11, hoursEstimated: null },
        { dimensionId: 2, score: 5, hoursEstimated: null },
      ],
      candidateSuggestions: [],
    })
    await expect(
      gradeDay({ apiKey: 'k', dimensions: dims, rubrics: 'r', dayText: 'd' })
    ).rejects.toThrow(/0–10/i)
  })

  it('throws when JSON is malformed', async () => {
    // Unquoted key — JSON.parse rejects but we have outer braces so we reach the parse step.
    reply('{ "narrative": "x", scores: [] }')
    await expect(
      gradeDay({ apiKey: 'k', dimensions: dims, rubrics: 'r', dayText: 'd' })
    ).rejects.toThrow(/valid JSON/i)
  })
})

describe('gradeDay — E2E mock hook', () => {
  it('returns deterministic stub when ROUNDUP_E2E_MOCK_ANTHROPIC=1, without calling SDK', async () => {
    process.env['ROUNDUP_E2E_MOCK_ANTHROPIC'] = '1'
    const r = await gradeDay({
      apiKey: 'sk-ant-anything',
      dimensions: dims,
      rubrics: 'r',
      dayText: 'I existed today.',
    })
    expect(messagesCreate).not.toHaveBeenCalled()
    expect(r.scores).toHaveLength(2)
    expect(r.candidateSuggestions.length).toBeGreaterThan(0)
    expect(r.narrative).toMatch(/mock/i)
  })
})

describe('gradeDay — prompt construction', () => {
  it('mentions every dimension by name and includes the day text + rubrics', async () => {
    reply({
      narrative: 'n',
      scores: [
        { dimensionId: 1, score: 5, hoursEstimated: null },
        { dimensionId: 2, score: 5, hoursEstimated: null },
      ],
      candidateSuggestions: [],
    })
    await gradeDay({
      apiKey: 'k',
      dimensions: dims,
      rubrics: 'RUBRICS_DOC',
      dayText: 'DAY_TEXT_HERE',
    })
    const callArgs = messagesCreate.mock.calls[0][0] as {
      messages: { content: string }[]
      model: string
    }
    expect(callArgs.model).toBe('claude-haiku-4-5')
    const prompt = callArgs.messages[0].content
    expect(prompt).toContain('Work')
    expect(prompt).toContain('Health')
    expect(prompt).toContain('id=1')
    expect(prompt).toContain('id=2')
    expect(prompt).toContain('RUBRICS_DOC')
    expect(prompt).toContain('DAY_TEXT_HERE')
  })
})
