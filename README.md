# KOF — King of Fate

**Play:** https://king-of-fate.vercel.app/

Retro arcade-style office randomizer. Spec: [`PROJECT.md`](PROJECT.md) · process: [`AGENTS.md`](AGENTS.md) · progress: [`PROJECT_STATUS.md`](PROJECT_STATUS.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run typecheck` | `tsc -b` only |
| `npm run lint` | oxlint |
| `npm test` | Vitest unit + integration tests (jsdom) |
| `npm run e2e` | Playwright end-to-end tests against the production build (incl. accessibility scans, CSP, storage/audio failure) |

E2E uses the installed Microsoft Edge on Windows (`channel: 'msedge'`). Elsewhere, or to use bundled
Chromium, run `npx playwright install chromium` and set `PW_CHANNEL=chromium`.

## Layout

```
src/
  game/        pure TypeScript domain (no React)
    config/    limits, Fate presets, timing, fighter looks, stages
    history/   match summaries, luck board, rivalries, badges, CSV/JSON export
    rng/       crypto RNG (unbiased bounded sampling) + seeded/scripted test RNGs
    setup/     roster + start validation
    engine/    match state machine (createMatch / beginTurn / resolveTurn / shufflePositions),
               finale (beginFinale / startFinaleRound / resolveFinaleRound), Fate strip,
               rock-paper-scissors, event log text
  animation/   visual-only spin paths, turn + finale timelines (never decide outcomes)
  audio/       sound engine: original chiptune, synthesized SFX, AI-voice chant (browser TTS),
               settings + provider (safe no-op without Web Audio / speech)
  storage/     localStorage setup + IndexedDB current-match checkpoint and completed results
  hooks/       React glue (useSetupConfig, useMatch, useTurnAnimation, useFinaleShow)
  components/  UI (setup/, match/, history/, sprites/ + stage/ = original pixel art drawn in code)
  app/         App shell (injects repository, RNG and timing for tests)
  test/        test setup and statistics helpers
e2e/           Playwright specs
```

## Voice clips

The chant ("1", "2", "Juice!") and the announcer ("K.O.!", "Versus!", "Fight!") play recorded clips
when they exist, and fall back to the browser's voice otherwise (which starts late and cuts out at
fast finale tempos).

1. Put raw recordings in `voice-raw/` (git-ignored), named `one`, `two`, `juice`, `ko`, `versus`,
   `fight` with any of `.mp3 .wav .m4a .ogg .aac .flac .webm`.
2. Run `npm run voice` (needs `ffmpeg` on the PATH). It trims silence, evens loudness, fits each
   clip to its target length (speeding it up by at most 1.6×, then trimming), and writes
   `public/voice/<id>.mp3` plus `public/voice/manifest.json`.
3. Sound settings on the setup screen show which clips are loaded.

Only use recordings you made or whose licence allows public use.

## Deploying (Vercel, static)

The game is a static site: no server, no accounts, no database.

- `vercel.json` sets the build (`npm run build` → `dist/`) and the security headers (a strict
  Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, a locked-down
  `Permissions-Policy`) plus long caching for hashed assets.
- `vite preview` serves the same headers (read from `vercel.json`), so `npm run e2e` tests the
  production build under the production policy.
- Deploy either by importing the Git repository in the Vercel dashboard (framework: Vite, defaults
  are fine) or with the CLI: `npx vercel` (preview) then `npx vercel --prod`.

## Known limitations

- **Data lives in one browser.** Setup, history, looks and custom music are stored in that
  browser profile only (localStorage + IndexedDB). Another computer or browser starts empty;
  clearing site data deletes everything. Use *History → Export JSON* to keep a backup (there is no
  import yet).
- **One tab at a time.** Two open tabs share the same saved match; the game warns when a second
  tab is open, but does not lock.
- **Voices depend on the computer.** The chant and announcer use the browser's text-to-speech.
  Edge on Windows usually has Vietnamese and good English voices; elsewhere the chant falls back
  to phonetic English, and with no voices the game runs with sound effects only.
- **Audio starts after the first click/key** (browser autoplay rules); the INSERT COIN press does it.
- **Desktop first.** Designed for a laptop/projector screenshare (about 1000 px wide and up); it
  works on smaller screens but is not tuned for phones.
- **Abandoned matches are not recorded**; only finished matches reach History.
- **Statistics describe luck, not skill.** Every spin is uniformly random and committed before
  any animation.

Third-party assets and what is deliberately not bundled: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
