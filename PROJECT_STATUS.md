# PROJECT_STATUS.md — KOF / King of Fate

**As of:** 2026-10-09  
**Phase:** 2 — KO-only playable loop  
**Overall status:** Phase 1 done (`bf7dfdd`). Phase 2 done (`876158a`) plus owner-requested sequential cursor + player Shuffle (121 unit/integration tests, 6 E2E green). Next: Phase 3. Not deployed.

## 1. Current snapshot

| Item | State |
|---|---|
| Audience | **Malaysian office** (owner, 2026-10-09). "Một Hai Ba Yo" kept only as finale countdown flavor; UI English. |
| Technical stack | React 19 + TypeScript 6 + Vite 8; Vitest 5 + Testing Library + fake-indexeddb; Playwright 1.64 (Edge channel); oxlint; Prettier |
| Storage | Setup: `localStorage` `kof.setup` (schema 1). Current match: IndexedDB db `kof` v1, store `current-match`, key `current` (schema 1); corrupt checkpoints moved to key `corrupt-backup`. |
| RNG | `crypto.getRandomValues` + rejection-sampled bounded ints (no modulo bias); seeded mulberry32 + scripted RNG for tests only |
| Normal / Sudden Death odds | Approved and encoded (Phase 3 uses them) |
| Finale rules (D2, D3) | Approved; Phase 4 |
| Pause/skip (D4) | OPEN — before Phase 5 |
| Git | `main`: `bf7dfdd` Phase 1. Phase 2 commit follows this update. |
| Deployment | Not attempted |

## 2. Phase tracker

| Phase | Status | Next acceptance goal |
|---|---|---|
| 1 — Foundation & Setup | **Done** (owner tested, committed `bf7dfdd`) | — |
| 2 — KO-only playable loop | **Done** (owner: "pretty solid"); sequential cursor + Shuffle added | — |
| 3 — Full Fate System | Not started | KO/VS/Shield, Fate strip, RPS duel, Sudden Death, probability tests |
| 4 — Vietnamese-chant RPS Finale | Not started | W+1 handoff (gate exists), exactly W winners |
| 5 — Retro Arcade Experience | Not started | Art/audio/shortcuts/visual polish; D4 resolved |
| 6 — History & Analytics | Not started | Accurate persistent statistics and exports |
| 7 — Hardening & Deployment | Not started | Regressions pass and Vercel URL works |

## 3. Requirements that are already approved

- Normal game: player and Fate animations run simultaneously; living player selected uniformly; Fate represented by 20 equal-chance slots; 4–5 second fixed spin; selected player may repeat; visual shuffle does not alter odds.
- KO, VS and Shield only for MVP; Shield cap one; duplicate Shield wasted; protected KO/VS loss consumes Shield and prevents elimination.
- VS: random distinct living opponent; automatic one decisive RPS throw with rethrows on draw. Winner earns Shield when permitted.
- 3 consecutive no-elimination turns activate Sudden Death; existing Shields remain, no new ones; D1 odds Fast 95/5/0, Normal 90/10/0, Chaotic 80/20/0.
- Finale begins immediately upon `aliveCount == winners + 1`; automated chant RPS, first to three; D3 tiebreak among oversubscribed candidates only; D2 guard; Shields cleared at finale start.
- 1–5 winners, `activeCount >= W+1`, max 32 active. D5 name rules (trim, drop blanks, ≤20 chars, case-insensitive duplicates rejected).
- One default configuration; attendance toggles; auto-restore active match; no undo; return to setup after result.

## 4. Open decisions (owner follow-up)

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| D4 | Esc pause behavior during finale chant; animation skip? | Safe pause/resume at beat/throw boundary; no outcome changes. | Phase 5 |
| D6 | Future Fate presets must fit 20 slots and need approval. | Current presets fit. | Only if presets change |
| P2-a | Keep **Abandon match** (confirm, not recorded) as the way to exit a match early? | Yes; otherwise an auto-restored match cannot be left until the finale. | Phase 2 acceptance |
| P2-b | Refresh mid-spin **replays the spin to the same committed target** (instead of showing the result instantly). OK? | Yes; keeps drama, outcome cannot change. | Phase 2 acceptance |
| D5 note | 20-char limit vs long Malaysian names ("Nurul Aisyah binti Ahmad" = 24). | Keep 20; hosts use short/nick names. Raise if it bites. | Optional |

## 5. Planned next steps

1. Owner plays Phase 2 (`npm run dev`): start, spin with `?`/Space, refresh during a spin, abandon, reach the finale gate. Confirm P2-a / P2-b.
2. Phase 3: 20-slot Fate strip with simultaneous cursor; KO/VS/Shield; normal VS RPS duel (rethrow on draw); Shield cap/waste; 3-turn no-elimination streak → Sudden Death with visible odds swap; seeded probability tests for slot weights and RPS parity.

## 6. Session log

### 2026-10-09 — Phase 2 follow-up: unpredictable spin rhythm
- **Owner request:** sequential cursor became predictable after a few rounds; add randomness.
- **Cause:** every spin used identical timing (4.5 s, same curve, same min steps), so "how slow = how many steps left" was learnable.
- **Changed:** `src/animation/spinPlan.ts` (`SpinStyle`, `spinStyleFor(turnId)` seeded via FNV-1a hash → mulberry32: duration 4000–5000 ms, minSteps 20–36, easePower 1.5–2.4, ~35% fake-out 1.4–2.0× on final move capped at 30% of spin), `src/hooks/useSpinCursor.ts`, `src/game/config/timing.ts` (`SPIN_DURATION_RANGE_MS`), `src/app/App.tsx`, `MatchScreen.tsx`, tests, `PROJECT.md` §10.
- **Tests:** `npm test` → **9 files, 119 passed** (every start×target×40 sampled styles lands correctly; 200 sampled styles all decelerate, final move ≤30%, durations within 4–5 s, styles vary; deterministic per turn ID). `npm run e2e` → **6 passed**; cursor-order E2E repeated 5× → 5 passed. Typecheck + lint clean.
- **Still true:** outcome sampled by crypto RNG and checkpointed before animation; cosmetic seed cannot affect it.
- **Next exact action:** Phase 3.

### 2026-10-09 — Phase 2 follow-up: sequential cursor + player Shuffle
- **Owner request:** cursor should walk boxes in order (1 2 3 … wrap … slow 3 … 4) instead of random jumps, for "one more step" tension; Shuffle button for visually fair positions. Owner said Phase 2 "seemed pretty solid" (P2-a Abandon and P2-b replay-on-restore treated as accepted; revisit if not).
- **Changed:** `src/animation/spinPlan.ts` (deterministic sequential path: ≥24 moves, whole laps + distance to target, quadratic ease-out ≈80–110 ms first gaps → ≈0.8–1 s final gap; `spinStartId` = next living fighter after previous target), `src/hooks/useSpinCursor.ts`, `src/game/engine/{match,matchTypes,describeEvent}.ts` (`shufflePlayers`, `PLAYERS_SHUFFLED` event; identity draws redrawn), `src/hooks/useMatch.ts` (`shuffle`), `src/components/match/MatchScreen.tsx` (Shuffle button, start position), `src/app/App.tsx`, CSS, tests, `PROJECT.md` §10 (approved decisions).
- **Tests:** `npm test` → **9 files, 121 passed** (sequential path from every start/target, deceleration, laps on tiny rosters, 32-grid; shuffle permutation/logging/identity redraw/READY-only; seeded chi-square proves odds unchanged with shuffles). `npm run e2e` → **6 passed** incl. DOM-recorded cursor moves are consecutive in grid order with last gap >4× first, and shuffle order survives reload. Typecheck + lint clean. Manual: Shuffle button layout and log entry checked in browser pane.
- **Note:** the replay after a mid-spin refresh is identical (path is deterministic from saved state).
- **Next exact action:** Phase 3 (Fate strip with its own sequential cursor + Fate shuffle, KO/VS/Shield, RPS duel, Sudden Death).

### 2026-10-09 — Phase 2: KO-only playable loop
- **Objective:** Commit Phase 1 (owner tested + approved), then implement Phase 2 only.
- **Owner input:** "tested phase 1, its good … can commit and proceed"; audience is Malaysian, Vietnamese chant only liked as countdown (recorded in `PROJECT.md` §10).
- **Commits:** `bf7dfdd feat: phase 1 setup, roster and local config`. Phase 2 commit made right after this file update.
- **Files added:** `.gitattributes` (LF normalisation); `src/game/rng/rng.ts` + test; `src/game/config/timing.ts`; `src/game/engine/{matchTypes,match,describeEvent}.ts` + `match.test.ts`; `src/animation/spinPlan.ts` + test; `src/storage/matchStorage.ts` + test; `src/hooks/{useMatch,useSpinCursor}.ts`; `src/components/match/{MatchScreen,FighterGrid,PreviewPanel,EventLog,FinaleGate}.tsx`; `src/test/stats.ts`; `e2e/match.spec.ts`.
- **Files changed:** `src/app/App.tsx` (loading, DI for repo/RNG/timing, match routing), `src/app/App.test.tsx` (Malaysian names, match flows), `src/components/setup/SetupScreen.tsx` (match notice banner), `src/test/setup.ts` (fresh fake IndexedDB per test), `src/styles/global.css`, `e2e/setup.spec.ts`, `tsconfig.node.json` (DOM lib for e2e), `package.json` (+fake-indexeddb), `PROJECT.md`, `README.md`, `AGENTS.md` (status line, earlier).
- **Files removed:** `src/components/MatchPlaceholder.tsx` (replaced by real match screen).
- **Functionality completed:**
  - Pure engine: `createMatch` → `READY`; `beginTurn` samples uniformly among living players with injected RNG and commits `SPINNING` + pending turn; `resolveTurn` applies KO once (idempotent by turnId; stale/duplicate calls are no-ops); stops at exactly W+1 alive → `FINALE_GATE`; N = W+1 at start goes straight to the gate. Deterministic event IDs `matchId#seq`.
  - Commit-before-animation: each transition is written to IndexedDB (one atomic put, awaited) before it is rendered; spin starts only after the checkpoint.
  - Recovery: reload auto-restores the match; a mid-spin reload replays the cursor to the same committed target and applies it once. Corrupt checkpoints are discarded with a notice; IndexedDB failure shows a banner and play continues unsaved (never claims it saved).
  - UI: preview nameplate with placeholder silhouette, 4.5 s decelerating cursor + 0.4 s hold, fighter grid (eliminated greyed, struck through, faint ✕), central `?` button + Space/Enter (ignored when a control has focus; repeats ignored; transitions serialised), screen-reader announcement of results only, chronological auto-scrolling event log that never spoils an unrevealed turn, Abandon match with confirm, Phase 2 finale gate placeholder listing finalists.
- **Assumptions (flagged as P2-a, P2-b above):** Abandon match control; replay-on-restore. Turn label shows the upcoming/current turn number. Cosmetic cursor path uses `Math.random` (visual only, cannot affect outcomes).
- **Commands run + observed results:**
  - `npm run typecheck` → pass.
  - `npm run lint` → 0 warnings.
  - `npm test` → **9 files, 109 tests passed** (incl. seeded chi-square uniformity: 7 buckets/70k draws and 8 players/80k turns; full KO-only playouts for every W=1..5 and N=W+1..32; IndexedDB reload/idempotency tests).
  - `npm run e2e` (fresh build, Edge) → **4 passed**: setup persistence → finale gate; real spin ≥4 s → W+1 handoff; reload 1 s into spin → exactly one elimination, stable across second reload; 5× Space → one turn.
  - One unit failure mid-session was a test query matching the new header "Turn 2" (fixed by scoping to the event log). Not an app bug.
  - Manual (browser pane): played turns; checked spin highlight, KO reveal, X-mark readability (fixed: name was hidden under ✕), header turn label (fixed).
- **Unrun checks:** bundled Chromium E2E; screen-reader pass; 32-player layout on projector; IndexedDB-blocked browser (covered only by unit test with null factory); multi-tab use (two tabs on one match is unsupported/untested).
- **Risks / tech debt:** Multi-tab play could race on the single checkpoint (last write wins; idempotent resolve limits damage). `useSpinCursor` schedules ~33 timeouts per spin (fine at 32 players). Bundle 243 kB raw / ~75 kB gzip.
- **Build/run condition at handoff:** builds and runs; all automated checks green.
- **Next exact action:** owner review of Phase 2 → answer P2-a/P2-b → start Phase 3 (Fate strip + KO/VS/Shield).

### 2026-10-09 — Phase 1: Foundation & Setup
- Decisions: baseline accepted; D1, D2, D3, D5 approved. Implemented roster paste (D5), attendance, winners, presets with real odds, start validation, versioned localStorage. Verified: typecheck, lint, 54 tests, build, 1 E2E. Owner tested and approved; committed `bf7dfdd`.

### 2026-10-09 — Specification consolidation
- Documentation only; no code, tests or deployment.

---

### Template for future development sessions
- **When / Phase / objective:**
- **What changed (file paths):**
- **Completed functionality and acceptance evidence:**
- **Commands/tests executed + observed outcomes:**
- **Unrun checks / blockers:**
- **New decisions and approvals:**
- **Open bugs/risks:**
- **Build/run condition at handoff:**
- **Next exact action:**
