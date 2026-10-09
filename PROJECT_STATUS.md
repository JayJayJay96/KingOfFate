# PROJECT_STATUS.md — KOF / King of Fate

**As of:** 2026-10-09  
**Phase:** 4 — Vietnamese-chant RPS Finale  
**Overall status:** Phases 1–3 done (owner tested). **Phase 4 implemented and verified locally**: feature-complete gameplay MVP (200 unit/integration tests, 8 E2E ×3 runs green); awaiting owner review. Not deployed.

## 1. Current snapshot

| Item | State |
|---|---|
| Audience | **Malaysian office** (owner, 2026-10-09). "Một Hai Ba Yo" kept only as finale countdown flavor; UI English. |
| Technical stack | React 19 + TypeScript 6 + Vite 8; Vitest 5 + Testing Library + fake-indexeddb; Playwright 1.64 (Edge channel); oxlint; Prettier |
| Storage | Setup: `localStorage` `kof.setup` (schema 1); sound preference `kof.sound`. IndexedDB db `kof` **v2**: store `current-match` key `current` (**match schema 3** since Phase 4; older saved matches discarded with a notice; corrupt ones moved to `corrupt-backup`) and store `completed-matches` (keyPath `matchId`, one record per won match, written in the same transaction as the victory checkpoint). |
| RNG | `crypto.getRandomValues` + rejection-sampled bounded ints (no modulo bias); seeded mulberry32 + scripted RNG for tests only |
| Normal / Sudden Death odds | Approved and **live** on the Fate strip (Phase 3) |
| Finale rules (D2, D3) | Approved and implemented (Phase 4). Both are provably unreachable with W + 1 finalists; kept as tested guards. |
| Pause/skip (D4) | OPEN — before Phase 5 |
| Git | `main`; see `git log` (Phase 4 commit follows this update) |
| Deployment | Not attempted |

## 2. Phase tracker

| Phase | Status | Next acceptance goal |
|---|---|---|
| 1 — Foundation & Setup | **Done** (owner tested, committed `bf7dfdd`) | — |
| 2 — KO-only playable loop | **Done** (owner: "pretty solid"); sequential cursor + Shuffle added | — |
| 3 — Full Fate System | **Done** (owner: "tested, all good") | — |
| 4 — Vietnamese-chant RPS Finale | **Implemented; automated checks pass; awaiting owner review** | Owner plays finales for 1, 2 and 3+ winners; confirms P4 notes below |
| 5 — Retro Arcade Experience | Not started | Art/audio/shortcuts/visual polish; D4 resolved |
| 6 — History & Analytics | Not started | Accurate persistent statistics and exports |
| 7 — Hardening & Deployment | Not started | Regressions pass and Vercel URL works |

## 3. Requirements that are already approved

- Normal game: player and Fate animations run simultaneously; living player selected uniformly; Fate represented by 20 equal-chance slots; random 4–10 s sequential-roulette spins (owner decision); selected player may repeat; visual shuffle does not alter odds.
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
| P3-d | Placeholder icons are emoji (💥 ⚔️ 🛡️ ✊ ✋ ✌️ 👑) until Phase 5 art. | Keep. | Phase 5 |
| P4-a | Finale waits for **one host click** ("Start the finale" / Space / Enter) before the automatic rounds, so the browser allows sound. | Keep. | Phase 4 acceptance |
| P4-b | Placeholder audio is synthesized (drum beats on Một/Hai/Ba/Yo, low drone, victory jingle) with a Sound on/off toggle; no voice. Real chant recording + music + volume sliders in Phase 5. | Keep for MVP. | Phase 5 |
| P4-c | Pacing: intro Một-Hai-Ba-Yo 0.6 s per beat; each round "Hai · Ba · Yo!" then 1.5 s result hold + 0.7 s pause (~3.4 s/round). With 4–6 finalists many reveals are draws (all three hands), so big finales can take a few minutes. | Watch in play; tune later if needed. | Phase 5 |
| P4-d | No Abandon during the finale (it must finish). Esc/pause is D4. | Keep until D4. | Phase 5 |
| D5 note | 20-char limit vs long Malaysian names ("Nurul Aisyah binti Ahmad" = 24). | Keep 20; hosts use short/nick names. Raise if it bites. | Optional |

## 5. Planned next steps

1. Owner plays complete matches (`npm run dev`) with 1, 2 and 3–5 winners; tries a refresh mid-finale and on the victory screen; confirms P4-a…P4-d.
2. Decide D4 (Esc pause / skip during the finale) before Phase 5.
3. Phase 5: retro presentation polish (art, real chant audio + music, volume controls, shortcuts).

## 6. Session log

### 2026-10-09 — Phase 4: Vietnamese-chant RPS finale + winner ceremony
- **Owner input:** "ok tested, all good, proceed to phase 4" (Phase 3 accepted).
- **Added:** `src/game/engine/finale.ts` (+test), `errors.ts`, `matchEvents.ts`; `src/animation/finaleTimeline.ts` (+test); `src/audio/finaleAudio.ts` (placeholder Web Audio); `src/hooks/useFinaleShow.ts`, `useSound.ts`; `src/components/match/FinaleStage.tsx`, `VictoryScreen.tsx`; `e2e/finale.spec.ts`.
- **Changed:** `matchTypes.ts` (schema 3: `FINALE`/`VICTORY` phases, `FinaleState`, rounds audit, finale events, `completedAt`), `match.ts` (W+1 → finale state; Shields cleared), `describeEvent.ts`, `matchStorage.ts` (DB v2 + `completed-matches`, VICTORY save writes the record in the same transaction, v3 validation, `listCompleted`), `useMatch.ts` (begin/next/complete finale round), `MatchScreen`, `App`, CSS, tests; removed `FinaleGate.tsx`. Docs: `PROJECT.md` §5 D3 note.
- **Rules implemented (PROJECT.md §5):** finale at W+1 with Shields cleared; host Start (P4-a), intro "Một Hai Ba Yo!" without a throw, then automatic "Hai · Ba · Yo!" reveals; every contender throws uniformly and the reveal is checkpointed before its chant; all-same or all-three = draw; otherwise every winning hand +1; first to 3 locks a slot and leaves; D3 tiebreak + D2 guard implemented; exactly W winners; MATCH_COMPLETED + completion record committed once before the ceremony; full throw/score history kept.
- **Finding:** D3 oversubscription cannot happen with W + 1 finalists (some contender always fails to score, and contenders = open slots + 1). Verified by 1,500 seeded finales (none triggered a tiebreak); the rule itself is unit-tested on constructed states.
- **Bug found + fixed (Phase 1 code):** rapid roster toggles could overwrite each other because updates used the last-rendered roster. Roster changes are now functional (`toggleParticipant`, updater callbacks). Found while scripting the browser pane.
- **Tests:** `npm test` → **14 files, 200 passed** (scoring/draw/multi-scorer cases, owner HAN/BEN/JAY example, D3/D2 on constructed states, exactly W distinct winners for W=1..5 ×300 finales each, each finalist equally likely to miss out (seeded chi-square p=0.001), idempotent resolve, mid-finale resume without re-rolling, victory reload records nothing new, completion record once). `npm run e2e` → **8 passed**; ×2 repeat → **16/16**: real finale to victory with reload on the ceremony and exactly 1 IndexedDB record; refresh mid-finale keeps round numbering 1..n with no gaps/repeats. Typecheck + lint clean.
- **Manual (browser pane):** triangle finale (3 finalists, 2 winners) start screen, a live "Yo!" reveal (Rock/Rock/Paper), victory screen with crowns and correct score trail. Fixed: confetti drawn over the log, and 2-digit log numbers clipped.
- **Unverified:** audio actually audible (headless/pane checks can't hear it; code paths are no-ops without Web Audio); 4–6-finalist ring on a projector; very long finales with many draws.
- **Next exact action:** owner review of Phase 4 (P4-a…d) → D4 decision → Phase 5.

### 2026-10-09 — Phase 3: Complete Fate System
- **Owner input:** "feels good now, proceed to phase 3"; shuffle should not appear in the event log (done first: `5b5b1f9`; event kept in state for audit).
- **Added:** `src/game/engine/fateSlots.ts` (even spread layout, in-place Sudden Death conversion, counts), `rps.ts` (gestures, uniform throws, rethrow draws until decisive), `src/animation/turnTimeline.ts` (player + Fate cursors together with separate seeded styles; VS duel beats), `src/hooks/useTurnAnimation.ts` (replaces `useSpinCursor`), `src/components/match/{FateStrip,DuelPanel}.tsx`, tests `fateSlots.test.ts`, `rps.test.ts`, `turnTimeline.test.ts`.
- **Changed:** `matchTypes.ts` (schema 2: player `shield`, `fateSlots`, `suddenDeath`, committed turn incl. slot, Fate, VS opponent + all throws; `TURN_RESOLVED` with structured outcome; `SUDDEN_DEATH_STARTED`, `SHIELDS_CLEARED`, `POSITIONS_SHUFFLED`), `match.ts` (KO/Shield/VS rules, streak, Sudden Death, finale clears Shields, `shufflePositions`), `describeEvent.ts`, `matchStorage.ts` (v2 validation incl. duel consistency; `outdated` status), `useMatch.ts`, `MatchScreen`, `FighterGrid` (Shield icon, VS opponent highlight), `PreviewPanel` (outcome captions), CSS, `src/test/stats.ts` (weighted chi-square + p=0.001 critical values), App/E2E tests.
- **Rules implemented exactly per PROJECT.md §4:** all randomness (player, slot, VS opponent, every throw) sampled and checkpointed before animation; KO consumes Shield else eliminates; Shield cap 1 / wasted; VS loser spends Shield or is eliminated, winner gains Shield unless already protected or Sudden Death; streak counts every completed non-eliminating turn, resets only on elimination; at 3 → Sudden Death (D1 odds, no Shield slots, existing Shields kept, persists until finale); finale gate at W+1 clears all Shields; never more than one elimination per turn.
- **Tests:** `npm test` → **12 files, 159 passed**, incl. seeded chi-square at p=0.001: player uniformity; Fate frequencies vs weights for all 3 presets × normal/Sudden Death; VS opponent uniformity; RPS gesture parity, challenger win rate 0.5±0.01, draw rate 1/3±0.01; full seeded matches for every preset × W=1..5 × several N; owner 4-alive/2-winner example. `npm run e2e` → **6 passed**, repeated ×3 → **18/18** (real random Fates; refresh mid-turn snapshot identical after second reload; both cursors walk in order and the Fate cursor lands on the Fate the log reports). Typecheck + lint clean.
- **Manual (browser pane):** Fate strip, live odds, streak pips, simultaneous cursors, KO/VS results, Shield icon, Chaotic odds checked. The duel panel was confirmed present via DOM during a real VS but not captured in a screenshot (it ended before the capture); its content is covered by the App test.
- **Known/unverified:** 11 KOs in a row happened in manual play (≈4% chance at 75%); slot indices were checked and vary normally, and the seeded frequency tests pass. Phase 2 saved matches are discarded (schema change). Emoji rendering depends on system fonts.
- **Next exact action:** owner plays Phase 3 (try Chaotic for VS/Shields; watch for Sudden Death) and confirms P3-a…P3-d → Phase 4 (Một Hai Ba Yo RPS finale + winners).

### 2026-10-09 — Phase 2 follow-up: 4–10 s spins, snap/crawl braking, honest dwell
- **Owner feedback:** still too samey; "the last one that feels slow confirms it will move 1 more block". Asked for max 10 s and a longer, random deceleration: sometimes an immediate stop after a brief slow, sometimes slower and slower with doubt whether it stops or moves once more.
- **Root cause found:** (1) the previous "fake-out" stretched the wait on the box *before* the target, so a long pause always meant one more move; (2) after landing, the KO came after a fixed 0.4 s, shorter than the preceding slow gaps, so a short pause meant "stopped".
- **Changed:** `src/animation/spinPlan.ts` rewritten (cruise → geometric braking; styles: snap 40% with 3–5 braking moves / crawl 60% with 7–14; final gap 300–1100 ms; ~25% tease on the pre-target box; whole laps chosen to land 4–8 s; **dwell on target = 1.0–1.8× last move**; reveal ≤ 10 s). `src/game/config/timing.ts` (`MIN_LAND_MS`, `MAX_SPIN_MS`, `MIN_DWELL_MS`; removed fixed hold). `useSpinCursor` + `MatchScreen` + `App` now take a single `timeScale` (tests 0.005). `playwright.config.ts` test timeout 60 s. Docs: `PROJECT.md` §1, §4, §9, §10 and `AGENTS.md` invariant now say random 4–10 s (owner decision, supersedes 4–5 s).
- **Tests:** `npm test` → **9 files, 120 passed** (300 sampled styles × 5 roster sizes: never speeds up, reveal ≤ 10 s; dwell never shorter than final move; snap and crawl both frequent; lands on every target from every start). `npm run e2e` → **6 passed**; cursor-order E2E repeated 6× → 6 passed. One E2E failed first on an outdated "≥20 moves" assumption (snap spins make fewer); threshold lowered to 10.
- **Impact:** average turn now ~6–9 s; a 20-player match spends roughly 2–3 min in spins (3–5 min target remains "not guaranteed").
- **Next exact action:** owner feel-test; then Phase 3 (Fate cursor reuses this spin model with its own seed).

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
