# Roundup

Local-first end-of-day life tracking desktop app. Dump your day in plain text; an AI grades it across user-defined dimensions and tracks progress over time.

## Stack

- **Electron** + **React** + **TypeScript** + **Tailwind CSS**
- **shadcn/ui** components
- **better-sqlite3** + **Drizzle ORM** (local SQLite, WAL mode)
- **Electron safeStorage** for API key encryption
- **@anthropic-ai/sdk** (main process only)
- **Recharts** for data visualisation
- **Vitest** (unit) + **Playwright** (E2E)

## Development

```bash
npm install
npm run dev        # Start Electron app with HMR
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode with HMR |
| `npm run build` | Build and package for the current platform |
| `npm run build:unpack` | Build without packaging (output in `out/`) |
| `npm run typecheck` | Type-check main/preload and renderer separately |
| `npm run lint` | ESLint across all TypeScript files |
| `npm run format` | Prettier formatting |
| `npm run test` | Vitest unit tests |
| `npm run e2e` | Build + run Playwright E2E smoke tests |
| `npm run drizzle:generate` | Generate a new SQL migration after editing `src/main/db/schema.ts` |

## Testing

Unit tests run against a Node.js in-memory SQLite instance — no Electron required:

```bash
npm run test
```

E2E tests launch the built Electron app — build first, then test:

```bash
npm run e2e
# or separately:
npm run build:unpack
npx playwright test
```

## Architecture

```
src/
  main/         Main process — DB, secrets, IPC handlers, electron-log
  preload/      contextBridge API surface (typed RPC)
  renderer/     React app (no Node.js APIs — use window.api)
  shared/       Type-only files shared across all processes
e2e/            Playwright Electron smoke tests
```

### Key constraints

- DB and AI SDK calls are **main process only**. The renderer never imports them directly — enforced by ESLint `no-restricted-imports`.
- Renderer ↔ main communication goes over the **typed `window.api` RPC layer** (see `src/shared/ipc.ts`).
- The Anthropic API key is stored exclusively via `safeStorage` (OS keychain), never in plain text.
- Rubrics are stored as a single `rubrics.md` file in the user data directory, not in the database.

## Database schema

| Table | Purpose |
|---|---|
| `days` | One row per day — raw entry, timestamps, AI narrative, overall score |
| `dimensions` | User-defined tracking dimensions with weights and rubric inputs |
| `scores` | Per-day per-dimension AI grades and hours-estimated |
| `suggestions` | AI-generated candidate suggestions for tomorrow (`fix` or `stretch` mode) |

`src/main/db/schema.ts` is the single source of truth. Edit it, then run `npm run drizzle:generate` to produce a new SQL migration in `drizzle/`. Generated files are committed to git and bundled into the packaged app via `electron-builder.yml` `extraResources`. Migrations run automatically on app start.

CHECK constraints (weight `1–10`, score `0–10`, suggestion rank `> 0`, mode in `('fix','stretch')`) are enforced at the database layer — the application does not re-validate.
