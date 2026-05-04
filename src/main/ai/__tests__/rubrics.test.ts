import { describe, it, expect, beforeEach, vi } from 'vitest'

const finalMessageMock = vi.fn()
const streamMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages = {
      stream: (params: unknown) => {
        streamMock(params)
        return { finalMessage: finalMessageMock }
      },
    }
  }
  return { default: Anthropic, Anthropic }
})

const { generateRubrics } = await import('../rubrics')

beforeEach(() => {
  finalMessageMock.mockReset()
  streamMock.mockReset()
})

const dim = {
  name: 'Work',
  weight: 8,
  successText: 'Ship features',
  constraintsText: 'Family evenings off-limits',
  antiGoalsText: 'Busywork',
  additionalInfo: null,
}

describe('generateRubrics', () => {
  it('throws when no dimensions provided', async () => {
    await expect(generateRubrics('sk-ant', [])).rejects.toThrow(/no dimensions/i)
  })

  it('returns the markdown when Sonnet returns a text block', async () => {
    finalMessageMock.mockResolvedValue({
      content: [{ type: 'text', text: '## Work\n\n| Score | Descriptor |' }],
    })
    const md = await generateRubrics('sk-ant', [dim])
    expect(md).toContain('## Work')
  })

  it('throws when Sonnet returns an empty text block', async () => {
    finalMessageMock.mockResolvedValue({ content: [{ type: 'text', text: '   ' }] })
    await expect(generateRubrics('sk-ant', [dim])).rejects.toThrow(/empty/i)
  })

  it('builds a prompt that mentions every dimension and the GDD curve anchors', async () => {
    finalMessageMock.mockResolvedValue({
      content: [{ type: 'text', text: '## A\n## B' }],
    })
    await generateRubrics('sk-ant', [
      { ...dim, name: 'Health' },
      { ...dim, name: 'Fitness' },
    ])

    const callArgs = streamMock.mock.calls[0][0] as {
      messages: { content: string }[]
      model: string
    }
    expect(callArgs.model).toBe('claude-sonnet-4-6')
    const prompt = callArgs.messages[0].content
    expect(prompt).toContain('Health')
    expect(prompt).toContain('Fitness')
    // GDD § Rubric Design curve anchors
    expect(prompt).toContain('0: nothing / actively harmful')
    expect(prompt).toContain('3–4: any visible effort')
    expect(prompt).toContain('5–6: normal okay day')
    expect(prompt).toContain('7–8: clearly good day')
    expect(prompt).toContain('9–10: rare, standout')
  })
})
