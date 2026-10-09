# KOF — King of Fate

Retro arcade-style office randomizer. Spec: [`PROJECT.md`](PROJECT.md) · process: [`AGENTS.md`](AGENTS.md) · progress: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit + integration tests (jsdom) |
| `npm run e2e` | Playwright smoke test against the production build |

E2E uses the installed Microsoft Edge on Windows (`channel: 'msedge'`). Elsewhere, or to use bundled
Chromium, run `npx playwright install chromium` and set `PW_CHANNEL=chromium`.

## Layout

```
src/
  game/        pure TypeScript domain (no React)
    config/    limits, Fate presets, timing
    rng/       crypto RNG (unbiased bounded sampling) + seeded/scripted test RNGs
    setup/     roster + start validation
    engine/    match state machine (createMatch / beginTurn / resolveTurn / shufflePositions),
               Fate strip (fateSlots), rock-paper-scissors (rps), event log text
  animation/   visual-only spin paths + turn timeline (never decide outcomes)
  storage/     localStorage setup + IndexedDB current-match checkpoint
  hooks/       React glue (useSetupConfig, useMatch, useTurnAnimation)
  components/  UI (setup/, match/)
  app/         App shell (injects repository, RNG and timing for tests)
  test/        test setup and statistics helpers
e2e/           Playwright specs
```
