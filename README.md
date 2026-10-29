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

The game is a static site: no accounts. Personal mode needs no server at all; the optional Office
mode talks to a Supabase database (below).

- `vercel.json` sets the build (`npm run build` → `dist/`) and the security headers (a strict
  Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, a locked-down
  `Permissions-Policy`) plus long caching for hashed assets.
- `vite preview` serves the same headers (read from `vercel.json`), so `npm run e2e` tests the
  production build under the production policy.
- Deploy either by importing the Git repository in the Vercel dashboard (framework: Vite, defaults
  are fine) or with the CLI: `npx vercel` (preview) then `npx vercel --prod`.

## Office mode (Supabase)

Office mode shares the roster (with looks and IDs), setup options, custom odds, prize line,
history and fair sit-outs between every PC that uses the office code. Sound settings and custom
music stay on each PC. Each PC chooses Personal or Office in the setup menu (*Saved where*).

One-time setup:

1. In Supabase create a project (any name; region Singapore is closest).
2. *SQL Editor → New query*: paste all of [`supabase/office.sql`](supabase/office.sql) and *Run*.
   It creates three tables (Row Level Security on, no policies, no table rights for the browser
   roles) and six functions that check the office code on the server. Default code: `116059`.
3. *Project Settings → Data API*: copy the Project URL. *Project Settings → API Keys*: copy the
   **publishable** key (`sb_publishable_…`, or the legacy `anon` key). Never use the secret /
   `service_role` key.
4. Vercel → project → *Settings → Environment Variables*: add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (Production and Preview), then *Deployments → … → Redeploy*. They are
   build-time values: a change needs a redeploy.
5. In the game: *Saved where → Office code → Switch to Office*; then change the code
   (*New office code*, 6–64 characters) and tell the hosts.

Behaviour:

- **Server unreachable:** each call is tried 3 times, then the game says so and uses this PC's
  copy. A match won offline is saved on the PC and uploaded automatically when the server answers
  again (keyed by match ID, so it is never lost or doubled). Setup changes made offline stay on the
  PC; when the server is back the host picks *Upload my setup* or *Use office setup*.
- **Two hosts at once:** each runs their own match on their own PC; both results are kept. Setup
  saves are versioned: the first save wins, and the other host is asked whether to keep the office
  setup or upload theirs. Nothing is overwritten silently.
- **Security limits (honest version):** the publishable key and site are public, but the key alone
  can read or write nothing; every function needs the office code, which the server checks against
  a bcrypt hash. The code is not in the JS bundle. After 30 wrong codes in 15 minutes every call is
  refused for up to 15 minutes, which slows guessing but means someone guessing can also lock the
  office out for a while. A 6-digit code is short: use a longer code if the data matters. Anyone
  with the code can change or clear the shared roster and history (no per-person accounts).

## Known limitations

- **Personal mode data lives in one browser.** Setup, history, looks and custom music are stored in
  that browser profile only (localStorage + IndexedDB). Clearing site data deletes everything. Use
  *History → Export JSON* to keep a backup and *Merge from file* / *Import* to bring it back.
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
