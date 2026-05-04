# Roundup

## Description
A local-first desktop app for end-of-day life tracking. Dump your day in plain text; an AI grades it across user-defined dimensions (work, health, fitness, etc.) using rubrics generated from your own goals. View progress over time and get suggestions for tomorrow.

## Stack
- Electron + React + TS + Tailwind
- Desktop-only
- Local-first storage (SQLite or similar)
- User-supplied Anthropic API key
- Haiku for daily grading; Sonnet (one-time) for rubric generation at setup

## First Launch Setup
The user is given a scaffolded form to enter the dimensions they want to track. For each dimension (max 8, named by user but with presets to choose from):

1. What success looks like
2. Constraints
3. Anti-goals
4. Weight (1–10 slider, independent per dimension)
5. Additional info (catch-all text)

On submit, Sonnet generates a rubric per dimension based on inputs. Rubrics stored as a single `rubrics.md` file with `## Dimension Name` headers and tables.

## Rubric Design
- Each rubric uses a 0–10 scale with descriptors anchored to user's stated goals
- Curve: easy to pass, harder to excel
  - 0: nothing / actively harmful
  - 3–4: any visible effort
  - 5–6: normal okay day
  - 7–8: clearly good day
  - 9–10: rare, standout
- Sonnet generation prompt instructs descriptors at each level in user's terms

## Main Loop — Daily Input
- Single end-of-day text dump field
- Free-form: what was done, when, for how long
- Optional self-assessment / context in the same field (treated as circumstance for grading)
- No AI follow-up questions
- If parsing is wrong: edit original text, regenerate

## Main Loop — AI Output (per day)
- Haiku graded against fixed rubrics
- Output bundle:
  - 2–3 sentence narrative
  - Per-dimension scores (0–10)
  - Weighted overall daily score (single headline number)
  - Pool of candidate suggestions for tomorrow per dimension

## Tomorrow Suggestions — Ranking
- Algorithmic (not AI) selection of top 1–3 from the candidate pool
- Priority function:
  ```
  priority(dim) = weight(dim) × recency_penalty(dim) × trend_factor(dim) × gap_from_goal(dim)
  ```
  - `recency_penalty`: grows with days since last decent score
  - `trend_factor`: punishes declining 7-day averages
  - `gap_from_goal`: distance from stated target
- Mode flip: when weighted 7-day average > threshold (e.g. 7), surface stretch suggestions instead of fix suggestions
- Tone: suggestive, not prescriptive ("consider…" not "you should…")

## Editing & History
Past days editable; re-trigger grading after edit.

## Dimension / Rubric Changes
- Rubrics editable any time
- Dimensions editable any time
- Changes apply going forward only
- Past grades are immutable historical record
- Small note in settings clarifying this
- No regrade, no migration, no discontinuity markers

## Views
- Today
- Past 7 days
- Past 30 days
- Custom range (date picker)
- "Compare to" toggle (this week vs. last week, this month vs. average month, etc.)

## Visualization Candidates
- GitHub-style per-dimension heatmap (intensity = score)
- Stacked area over time (hours per dimension per week)
- Weekly polar/radar (7-day vs. 30-day)
- Activity timeline ribbon (horizontal bars across days)
- Gap-vs-goal bar chart per dimension
- Soft streak counters ("X of last 7" rather than reset-on-miss streaks)
- Anomaly callouts (unusual spend, long gaps in a dimension)
- Heavier-weighted dimensions get visual prominence

## Settings
- Edit dimensions (goals, constraints, anti-goals, weight)
- Edit rubrics (manual `rubrics.md` editing)
- API key
- Model selection (default Haiku for grading)
- Toggle viz components on/off
