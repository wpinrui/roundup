import { describe, it, expect } from 'vitest'
import { rankSuggestions, type HistoricalDay } from '../suggestions'
import type { GradeResult } from '../ai/grade'
import type { DimensionRow } from '@shared/ipc'

const baseDim = {
  successText: '',
  constraintsText: '',
  antiGoalsText: '',
  additionalInfo: null,
  createdAt: '2026-04-01T00:00:00Z',
}

const dimensions: DimensionRow[] = [
  { ...baseDim, id: 1, name: 'Work', weight: 9 },
  { ...baseDim, id: 2, name: 'Health', weight: 7 },
  { ...baseDim, id: 3, name: 'Sleep', weight: 5 },
]

function gradeResult(opts: {
  scores: Record<number, number>
  weightedOverallScore: number
  candidatesPerDim?: number
}): GradeResult {
  const { scores, weightedOverallScore, candidatesPerDim = 2 } = opts
  return {
    narrative: 'n',
    scores: Object.entries(scores).map(([id, score]) => ({
      dimensionId: Number(id),
      score,
      hoursEstimated: null,
    })),
    weightedOverallScore,
    candidateSuggestions: Object.keys(scores).flatMap((id) =>
      Array.from({ length: candidatesPerDim }, (_, i) => ({
        dimensionId: Number(id),
        text: `dim${id}-suggestion-${i + 1}`,
      }))
    ),
  }
}

function buildHistory(days: number, scoresByDay: (i: number) => Record<number, number>): HistoricalDay[] {
  // Most-recent-last.
  const out: HistoricalDay[] = []
  for (let i = 0; i < days; i++) {
    const dayNum = i + 1
    const date = `2026-04-${String(dayNum).padStart(2, '0')}`
    const scores = scoresByDay(i)
    const weightedOverallScore =
      Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length
    out.push({
      date,
      weightedOverallScore,
      scores: Object.entries(scores).map(([id, score]) => ({
        dimensionId: Number(id),
        score,
      })),
    })
  }
  return out
}

describe('rankSuggestions — mode flip', () => {
  it("returns 'fix' when fewer than 7 graded days total", () => {
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 9, 2: 9, 3: 9 }, weightedOverallScore: 9 }),
      todayDate: '2026-05-04',
      dimensions,
      history: [], // 0 prior + today = 1 graded; < 7 → fix
    })
    expect(r.mode).toBe('fix')
  })

  it("returns 'fix' when ≥ 7 days but weighted 7-day average is ≤ 7", () => {
    const history = buildHistory(6, () => ({ 1: 6, 2: 6, 3: 6 })) // avg 6
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 6, 2: 6, 3: 6 }, weightedOverallScore: 6 }),
      todayDate: '2026-05-04',
      dimensions,
      history,
    })
    expect(r.mode).toBe('fix')
  })

  it("returns 'stretch' when ≥ 7 graded days AND weighted 7-day average > 7", () => {
    const history = buildHistory(6, () => ({ 1: 8, 2: 8, 3: 8 }))
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 8, 2: 8, 3: 8 }, weightedOverallScore: 8 }),
      todayDate: '2026-05-04',
      dimensions,
      history,
    })
    expect(r.mode).toBe('stretch')
  })

  it("uses only the trailing 7 days for the average, not full history", () => {
    // 20 historical days at 9 (very high), but the most recent 6 are bad (4) plus today bad (4).
    const tail = 6
    const head = 14
    const history: HistoricalDay[] = [
      ...buildHistory(head, () => ({ 1: 9, 2: 9, 3: 9 })).map((d) => d),
      ...buildHistory(tail, () => ({ 1: 4, 2: 4, 3: 4 })).map((d) => ({
        ...d,
        date: d.date.replace('2026-04', '2026-05'),
      })),
    ]
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 4, 2: 4, 3: 4 }, weightedOverallScore: 4 }),
      todayDate: '2026-05-21',
      dimensions,
      history,
    })
    expect(r.mode).toBe('fix')
  })
})

describe('rankSuggestions — picking top dims', () => {
  it('returns at most 3 suggestions, ranked 1..N', () => {
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 5, 2: 5, 3: 5 }, weightedOverallScore: 5 }),
      todayDate: '2026-05-04',
      dimensions,
      history: [],
    })
    expect(r.suggestions).toHaveLength(3)
    expect(r.suggestions.map((s) => s.rank)).toEqual([1, 2, 3])
  })

  it('returns only as many as there are dims with candidates', () => {
    const onlyOne: DimensionRow[] = [dimensions[0]]
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 5 }, weightedOverallScore: 5 }),
      todayDate: '2026-05-04',
      dimensions: onlyOne,
      history: [],
    })
    expect(r.suggestions).toHaveLength(1)
  })

  it('skips dims with no candidate suggestions', () => {
    const grade: GradeResult = {
      narrative: 'n',
      scores: [
        { dimensionId: 1, score: 4, hoursEstimated: null },
        { dimensionId: 2, score: 4, hoursEstimated: null },
      ],
      weightedOverallScore: 4,
      candidateSuggestions: [{ dimensionId: 1, text: 'just-this-one' }],
    }
    const r = rankSuggestions({
      graded: grade,
      todayDate: '2026-05-04',
      dimensions: dimensions.slice(0, 2),
      history: [],
    })
    expect(r.suggestions).toHaveLength(1)
    expect(r.suggestions[0].dimensionId).toBe(1)
  })

  it('ranks higher-weight dim above lower-weight when other factors equal', () => {
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 5, 2: 5, 3: 5 }, weightedOverallScore: 5 }),
      todayDate: '2026-05-04',
      dimensions,
      history: [],
    })
    expect(r.suggestions[0].dimensionId).toBe(1) // weight 9
    expect(r.suggestions[1].dimensionId).toBe(2) // weight 7
    expect(r.suggestions[2].dimensionId).toBe(3) // weight 5
  })

  it('promotes a low-scoring dim above a strong one (gap_from_goal effect)', () => {
    // Equal weight, equal recency/trend; only difference is today's score.
    const equalWeights: DimensionRow[] = [
      { ...baseDim, id: 1, name: 'A', weight: 5 },
      { ...baseDim, id: 2, name: 'B', weight: 5 },
    ]
    const grade: GradeResult = {
      narrative: 'n',
      scores: [
        { dimensionId: 1, score: 9, hoursEstimated: null },
        { dimensionId: 2, score: 2, hoursEstimated: null },
      ],
      weightedOverallScore: 5.5,
      candidateSuggestions: [
        { dimensionId: 1, text: 'a' },
        { dimensionId: 2, text: 'b' },
      ],
    }
    const r = rankSuggestions({ graded: grade, todayDate: '2026-05-04', dimensions: equalWeights, history: [] })
    expect(r.suggestions[0].dimensionId).toBe(2)
  })

  it('labels every surfaced suggestion with the chosen mode', () => {
    const history = buildHistory(6, () => ({ 1: 8, 2: 8, 3: 8 }))
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 8, 2: 8, 3: 8 }, weightedOverallScore: 8 }),
      todayDate: '2026-05-04',
      dimensions,
      history,
    })
    expect(r.mode).toBe('stretch')
    for (const s of r.suggestions) expect(s.mode).toBe('stretch')
  })

  it('picks the first candidate text when a dim has multiple', () => {
    const r = rankSuggestions({
      graded: gradeResult({ scores: { 1: 5, 2: 5, 3: 5 }, weightedOverallScore: 5, candidatesPerDim: 3 }),
      todayDate: '2026-05-04',
      dimensions,
      history: [],
    })
    expect(r.suggestions[0].text).toBe('dim1-suggestion-1')
  })
})

describe('rankSuggestions — recency penalty', () => {
  it('promotes a dim that has not had a decent score recently', () => {
    // 10 historical days; dim 1 has been bad, dim 2 has been good.
    const history = buildHistory(10, () => ({ 1: 3, 2: 9 }))
    const equalWeights: DimensionRow[] = [
      { ...baseDim, id: 1, name: 'A', weight: 5 },
      { ...baseDim, id: 2, name: 'B', weight: 5 },
    ]
    const grade: GradeResult = {
      narrative: 'n',
      scores: [
        { dimensionId: 1, score: 5, hoursEstimated: null },
        { dimensionId: 2, score: 5, hoursEstimated: null },
      ],
      weightedOverallScore: 5,
      candidateSuggestions: [
        { dimensionId: 1, text: 'A' },
        { dimensionId: 2, text: 'B' },
      ],
    }
    const r = rankSuggestions({ graded: grade, todayDate: '2026-04-15', dimensions: equalWeights, history })
    expect(r.suggestions[0].dimensionId).toBe(1)
  })
})
