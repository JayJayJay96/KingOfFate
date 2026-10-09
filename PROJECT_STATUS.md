# PROJECT_STATUS.md — KOF / King of Fate

**As of:** 2026-10-10  
**Phase:** 7 — Hardening & Deployment  
**Overall status:** Phases 1–6 done (owner: "pretty perfect"). Owner approved three arcade enhancement packs (PROJECT.md §10). Arcade packs A–C done (owner: "tested, all good"). **Phase 7 hardening done and verified** (301 unit/integration tests, 21 E2E ×2 incl. WCAG 2.1 AA scans of every screen under the production CSP). **Not deployed yet: waiting for the owner's choice of deploy method/account.**

## 1. Current snapshot

| Item | State |
|---|---|
| Audience | **Malaysian office** (owner, 2026-10-09). "Một Hai Ba Yo" kept only as finale countdown flavor; UI English. |
| Technical stack | React 19 + TypeScript 6 + Vite 8; Vitest 5 + Testing Library + fake-indexeddb; Playwright 1.64 (Edge channel); oxlint; Prettier |
| Storage | Setup: `localStorage` `kof.setup` (schema 1); sound settings `kof.audio` (replaces `kof.sound`, migrated). Custom music: IndexedDB db `kof-assets` v1 store `files` key `custom-music` (raw bytes + name/type/size/savedAt; local only). IndexedDB db `kof` **v2**: store `current-match` key `current` (**match schema 4** since the Shield redesign; older saved matches discarded with a notice; corrupt ones moved to `corrupt-backup`) and store `completed-matches` (keyPath `matchId`, one record per won match, written in the same transaction as the victory checkpoint). |
| RNG | `crypto.getRandomValues` + rejection-sampled bounded ints (no modulo bias); seeded mulberry32 + scripted RNG for tests only |
| Normal / Sudden Death odds | Approved and **live** on the Fate strip (Phase 3) |
| Finale rules (D2, D3) | Approved and implemented (Phase 4). Both are provably unreachable with W + 1 finalists; kept as tested guards. |
| Pause/skip (D4) | **Approved and implemented (Phase 5)**: Esc pauses at the next finale round boundary; resume continues; no skip. |
| Audio | AI chant via browser text-to-speech; original chiptune loops + synthesized SFX (Web Audio); music/voice/SFX volumes; optional local custom music. See `THIRD_PARTY_NOTICES.md`. |
| Git | `main`; see `git log` (follow-up commit follows this update) |
| Deployment | Not attempted |

## 2. Phase tracker

| Phase | Status | Next acceptance goal |
|---|---|---|
| 1 — Foundation & Setup | **Done** (owner tested, committed `bf7dfdd`) | — |
| 2 — KO-only playable loop | **Done** (owner: "pretty solid"); sequential cursor + Shuffle added | — |
| 3 — Full Fate System | **Done** (owner: "tested, all good") | — |
| 4 — Vietnamese-chant RPS Finale | **Done** (owner: "tested, all good"; `44407f9`) | — |
| 5 — Retro Arcade Experience | **Done** (owner: "tested, all good"; follow-ups + Shield redesign accepted "tested very nice") | — |
| 6 — History & Analytics | **Done** (owner: "pretty perfect") | — |
| Pack A — Arcade show | **Done** (owner: "tested, all good") | — |
| Pack B — Looks (sprites, stages) | **Done** (owner: "tested, all good") | — |
| Pack C — Rivalries & badges | **Done** (owner: "tested, all good") | — |
| 7 — Hardening & Deployment | **Hardening done** (`daa8a8e`); deployment pending owner | Owner picks deploy method; live Vercel URL smoke-tested |

## 3. Requirements that are already approved

- Normal game: fighter cursor, then Fate cursor (then for VS: "VS!", opponent cursor, throws), one after another; living player selected uniformly; Fate represented by 20 equal-chance slots; each cursor a random 2.5–6.5 s sequential roulette (owner decisions); selected player may repeat; visual shuffle does not alter odds.
- Victory scene: fighters knocked out during the match lie scattered around the screen; finale losers lie beside the crowned winners.
- KO, VS and Shield only for MVP; Shield cap one; duplicate Shield wasted; protected KO/VS loss consumes Shield and prevents elimination.
- VS: random distinct living opponent; automatic one decisive RPS throw with rethrows on draw. Winner earns Shield when permitted.
- Shield supply `ceil(N/5)` per match (Fate or VS win uses one; empty → Shield slots become KO). Sudden Death at `round(N/3)` alive: all Shields shatter, no new ones; D1 odds Fast 95/5/0, Normal 90/10/0, Chaotic 80/20/0. If that count ≤ W+1 the finale comes first ("No Sudden Death"). (Owner decision 2026-10-09; replaced the 3-turn streak.)
- Finale begins immediately upon `aliveCount == winners + 1`; automated chant RPS, first to three; D3 tiebreak among oversubscribed candidates only; D2 guard; Shields cleared at finale start.
- 1–5 winners, `activeCount >= W+1`, max 32 active. D5 name rules (trim, drop blanks, ≤20 chars, case-insensitive duplicates rejected).
- One default configuration; attendance toggles; auto-restore active match; no undo; return to setup after result.

## 4. Open decisions (owner follow-up)

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| D6 | Future Fate presets must fit 20 slots and need approval. | Current presets fit. | Only if presets change |
| P4-c | Pacing: ~3.4 s per finale round; big finales (4–6 finalists, many draws) can take a few minutes. | Watch in play; tune if needed. | Optional |
| P4-d | No Abandon during the finale (it must finish); Esc pause exists (D4). | Keep. | — |
| P5-d | Turn length now: fighter (2.5–6.5 s) + Fate (2.5–6.5 s); VS adds ~1 s "VS!" + opponent (2.5–6.5 s) + duel (~2–4 s). Typical KO turn ≈ 8–10 s, typical VS turn ≈ 15–20 s. | Tune ranges if it drags. | Follow-up acceptance |
| P5-c | Custom *chant recording* upload with cue sync (spec §5) not built; AI voice chosen instead. | Optional later. | Optional |
| P5-e | Small matches: with 5 fighters there is 1 Shield in total and Sudden Death never happens (finale first). | Intended by the formula; revisit if Shields feel too rare. | Owner play-test |
| P6-a | Abandoned matches are not recorded (only completed ones). | Keep: an abandoned match has no result. | Optional |
| P6-b | JSON export is a backup only; there is no import. | Add import later if the office moves browsers. | Optional |
| D5 note | 20-char limit vs long Malaysian names ("Nurul Aisyah binti Ahmad" = 24). | Keep 20; hosts use short/nick names. Raise if it bites. | Optional |

## 5. Planned next steps

1. Owner chooses how to deploy (Vercel CLI login, or GitHub repo + Vercel import) and approves going public.
2. Deploy, smoke-test the live URL (title → match → finale → History), record the URL here.

## 6. Session log

### 2026-10-10 — Phase 7: hardening (deployment pending)
- **Owner input:** Pack C "tested, all good, proceed to phase 7".
- **Added:** `vercel.json` (Vite static build; strict CSP `default-src 'self'` with `style-src 'unsafe-inline'` for React style attributes and `media-src blob:` for local custom music; `X-Frame-Options DENY`, `nosniff`, `no-referrer`, `Permissions-Policy`; immutable caching for `/assets/`), `src/app/ErrorBoundary.tsx` (crash screen + Reload; saved data untouched), `src/hooks/useOtherTabWarning.ts` (BroadcastChannel; banner while a second tab is open), `e2e/hardening.spec.ts` (axe WCAG 2.1 AA on title, setup, look editor, match, pause menu, finale, victory, luck board, rivalries, match details, profile, with zero console/CSP errors; no IndexedDB; blocked localStorage; no Web Audio/speech; reduced motion; 32 fighters without sideways scroll + a turn; second-tab warning), `src/utils/ids.test.ts`, a history performance test (300 matches × 20 fighters < 1 s), devDependency `@axe-core/playwright` (MPL-2.0, dev only).
- **Changed:** `vite.config.ts` (preview serves the vercel.json headers so E2E runs under the production CSP; fonts never inlined as data: URLs), `ids.ts` (v4 UUID fallback when `crypto.randomUUID` is missing on plain-http LAN addresses), `main.tsx` (ErrorBoundary), `index.html` (description, theme-color, color-scheme, noscript), `App.tsx` (tab warning), `FinaleStage` (score pips `role="img"`), `VictoryScreen` (fallen field `role="group"`), `EventLog` + match-details log (keyboard-focusable scroll regions), `.button--danger` (#c4132f: 6.0:1 with white), README (deploy + known limitations), THIRD_PARTY_NOTICES (stages, announcer, dev-only tools), `tsconfig.json` formatting. Commit `daa8a8e`.
- **Found by the new checks:** (1) **the CSP blocked 3 tiny font subsets** that Vite had inlined as data: URLs (would have broken some glyphs in production) → fonts always ship as files; (2) accessibility: finale pips aria-label without a role, victory fallen field aria-label without a role, scrollable event logs not keyboard-focusable, danger-button contrast 3.4:1.
- **Tests:** `npm test` → **27 files, 301 passed**. `npm run e2e` → **21 passed**, run twice. Typecheck, oxlint, Prettier (`src`, `e2e`, root configs) clean; `npm run build` clean (JS ≈ 336 kB / ≈ 95 kB gzip; fonts as separate files).
- **Not done / unverified:** no deployment yet (no Vercel CLI login and no Git remote on this machine; going public needs owner approval). Real-device checks (projector, Firefox/Safari) not run: E2E covers Edge only. No manual screen-reader pass (automated axe only).
- **Next exact action:** owner chooses the deploy route → deploy → live smoke test → record the URL here.
- **Build/run state:** builds and runs; dev server on port 5173.

### 2026-10-10 — Arcade Pack C: rivalries, fighter profiles, badges
- **Owner input:** Pack B "tested, all good, proceed to pack C".
- **Added:** `src/game/history/awards.ts` (`rivalries`, `headToHead` from VS duels only; `BADGES`; `matchAwards`: First Blood, Magnet (2+ picks), Iron Wall (2+ blocks), Duelist (2+ VS wins), Flawless; `careerBadges`: counts of match awards + Back-to-back (best run, 2+), Survivor (3+ finales), Shield Hoarder (most Shields, ties share)), `components/history/{Badges,Rivalries,FighterProfile,MatchAwards}.tsx`, tests `awards.test.ts` (Flawless on real engine finales 3–0 vs 3–1, awards, rivalries, head-to-head, career badges) and Pack C UI tests in `HistoryScreen.test.tsx` (UI compared with the pure functions on engine-played Chaotic matches).
- **Changed:** `history.ts` (`MatchSummary.duels`; `FighterResult.flawless` and `look`), `useHistory` (rivalries, badges), `Leaderboard` (names open the profile; Badges column), `HistoryScreen` (Rivalries tab; profile view), `MatchHistory` (Awards in match details), `VictoryScreen` (this match's awards), CSS, `src/test/historyFixtures.ts` (`fakeSummary`).
- **Interpretations (owner may adjust):** *Flawless* = won their finale race without anyone else scoring before they qualified (= 3–0 in a 1v1; draws allowed; automatic D2 slots never count). *Back-to-back* = consecutive wins among the matches that person played (sitting out does not break a streak). Rivalries count VS duels only (approved).
- **Flaky tests fixed:** the final-blow App test had a 7 ms window at test speed → slower scale + longer waits; the E2E "hands off at W+1" failed once under parallel load and passed on rerun; its settle poll widened 5 s → 10 s (trace lost on rerun, so root cause not confirmed). Full E2E then passed twice (28/28).
- **Process note:** patch scripts that wrote a file twice left Vite serving a half-written module; restarting the dev server fixed it (twice this session). Not an app bug.
- **Tests:** `npm test` → **26 files, 297 passed**; `npm run e2e` → **14 passed** (×2). Typecheck, oxlint, Prettier, build clean.
- **Manual (pane):** luck board with Badges column and a profile (Flawless, Back-to-back ×2) shown from real older records. Rivalries tab not screenshotted (pane data has no VS duels); covered by UI tests.
- **Next exact action:** owner reviews Pack C → Phase 7 (hardening + Vercel).
- **Build/run state:** builds and runs; dev server on port 5173.

### 2026-10-10 — Arcade Pack B: looks and stages
- **Owner input:** Pack A "tested, all good, proceed to pack B".
- **Added:** `src/game/config/looks.ts` (10 hairstyles, 6 headwear incl. tudung/songkok, 5 face extras, 6 outfits incl. baju Melayu and shirt & tie; 6 skin, 8 hair, 12 outfit, 8 accent colours; `neutralLook` = stable random look from the name that **never** uses tudung/songkok; `isFighterLook`, `cleanLook`, `lookFor`), `src/game/config/stages.ts` (5 stages; `stageForMatch` = pinned, or picked from the match ID so a refresh keeps it), `src/components/stage/StageArt.tsx` (KL Night with twin towers, Mamak stall, Office pantry, Pasar malam, Rooftop sunset; original rect-drawn SVG; twinkle/drift/steam), `stageContext.ts`, `src/components/sprites/looksContext.ts`, `src/components/setup/LookEditor.tsx` (live preview, selects + swatches, Random, Use default, Cancel/Esc, Save), tests `stages.test.ts`, rewritten `fighterSprite.test.ts`.
- **Changed:** `fighterSprite.ts` (layered renderer: head, hair, headwear, face, outfit), `icons.tsx` (`FighterSprite` uses the custom look from context or a `look` prop), `roster.ts` (`look?`, `setParticipantLook`), `setupConfig.ts`/`setupStorage.ts` (`stage` choice, per-person `look`; schema 1 kept, both optional; damaged look/stage dropped → "repaired"), `matchTypes.ts`/`match.ts` (match players keep a cosmetic snapshot of their look; no schema bump: the field is optional), `App.tsx` (looks + stage providers, full-screen dimmed backdrop), `MatchOptions` (Stage select), `RosterGrid` (thumbnail + 🎨 "Change look for X"), `PreviewPanel` (stage behind the chosen fighter), `FinaleStage` (stage in the arena, darker spotlight), `TitleScreen` (KL Night), CSS, tests (App: tudung saved and carried into the match, Use default/Cancel/Esc, pinned + random stage incl. reload), `e2e/polish.spec.ts` (look + stage survive reload and show in the match).
- **Note:** everyone's default look changed once with the new generator (expected).
- **Found while testing:** wrapping the select in its label gave it a muddled accessible name in Edge ("HeadwearNoneCap…") → explicit `htmlFor` labels. Dev server needed a restart once (stale HMR module mid-patch; not an app bug).
- **Tests:** `npm test` → **25 files, 283 passed**; `npm run e2e` → **14 passed**. Typecheck, oxlint, Prettier clean.
- **Manual:** headless Edge captures at 1280 px of the look editor, all 5 stages behind a match, and the Pasar Malam finale arena; preview strip uses the middle of the scene.
- **Next exact action:** owner play-tests Pack B → Pack C.
- **Build/run state:** builds and runs; dev server on port 5173.

### 2026-10-10 — Arcade Pack A: title, intro, announcer, impacts, idle
- **Owner input:** asked for enhancement ideas, then approved: announcer + impact FX, character-select intro, stage backgrounds, idle/KO animations, INSERT COIN title, costume/colour variety, rivalries, badges. Decisions (logged in `PROJECT.md` §10): intro ~4 s, Space/click skips; title once per page load; random neutral looks + per-person picker incl. tudung/songkok; stage random per match, host can pin.
- **Added:** `src/components/TitleScreen.tsx` (INSERT COIN, any key/click, coin sfx, unlocks audio), `src/components/match/MatchIntro.tsx` + `src/animation/matchIntro.ts` (select-cursor sweep, ROUND 1, FIGHT!; constants for finale splash 2.6 s and final blow 1.4 s), `src/audio/announcer.ts` (lines, impact kinds), tests `matchIntro.test.ts`, `e2e/helpers.ts` (`insertCoin`, `skipIntro`).
- **Changed:** `voice.ts` (`pickAnnouncerVoice`, `announce`: English voice, deep pitch, silent if none), `soundEngine.ts` (`announce`, sfx `coin`/`fight`), `audioSettings.ts` (`announcer` on by default; checkbox in Sound settings; Voice slider now "Voices"), `MatchScreen.tsx` (intro gate; K.O./Blocked/Shield/Wasted stamp + sparks + flash + screen shake; announcer callouts incl. Versus/Sudden death; K.O. that reaches W+1 shown ~1.1 s before the finale; slow-motion "Finish!" before the ceremony; effects derived in render so a restored match never replays them), `FighterGrid` (knock-back fall), `FinaleStage` (FINAL ROUND splash + walk-in; final-blow zoom), `VictoryScreen` ("X wins!"), `FighterSprite` (idle bob, per-fighter offset), `App.tsx` (`titleScreen` prop, default on), CSS (all motion off under reduced-motion), App/History tests (`startMatch` waits out the intro; `titleScreen={false}`), all E2E specs (insert coin after load/reload).
- **Found while testing:** (1) first version set the K.O. hold in an effect → the finale screen flashed for one frame and swallowed the Start click → effects are now derived during render; (2) E2E turn loop clicked the disabled button during the K.O. hold → test waits for "button enabled or finale shown".
- **Tests:** `npm test` → **24 files, 271 passed** (intro timeline, announcer mapping, English voice pick, announcer setting, title → setup with unlock + coin, intro lists everyone and Space skips without a turn, ROUND 1/FIGHT!/K.O. callouts + stamp + falling fighter, final blow + "Aisyah wins!"). `npm run e2e` → **13 passed**. Typecheck, oxlint, Prettier clean.
- **Manual:** title screen in the pane; intro grid + ROUND 1 banner and K.O. stamp/sparks/knock-back captured headlessly (Edge, 1280 px). Announcer audio not heard by me (no speakers); covered by the engine spy.
- **Pacing (approved):** +~4 s at match start (skippable), +~1.1 s before the finale handover, +1.4 s before the ceremony.
- **Next exact action:** owner play-tests Pack A → Pack B.
- **Build/run state:** builds and runs; dev server on port 5173.

### 2026-10-09 — Phase 6: History & Analytics
- **Owner input:** "okay tested very nice so far, move to next phase" (Phase 5 + Shield redesign accepted).
- **Owner decisions (asked this session, logged in `PROJECT.md` §7):** stats add up per **roster entry** (internal ID; latest name shown); host may **delete one match** or **clear all** (both confirmed, suggest exporting first); leaderboard ranks by **luck vs expected** (expected = Σ W/N over matches played; luck = wins − expected).
- **Added:** `src/game/history/history.ts` (lenient record check incl. schema-3 records, `summarizeMatch`, `aggregateStats`, `historyLog` with legacy Sudden Death text), `exportData.ts` (versioned JSON backup; matches CSV; luck-board CSV; RFC 4180 + UTF-8 BOM; spreadsheet-formula guard), `format.ts`; `src/hooks/useHistory.ts`; `src/components/history/{HistoryScreen,Leaderboard,MatchHistory,ConfirmButton}.tsx`; `src/utils/download.ts`; `src/test/historyFixtures.ts` (real engine, seeded); tests `history.test.ts`, `exportData.test.ts`, `HistoryScreen.test.tsx`, `e2e/history.spec.ts`.
- **Changed:** `matchStorage.ts` (`deleteCompleted`, `clearCompleted`; memory repo can be seeded with records), `App.tsx` (History view; `download` injection), `SetupScreen.tsx` (History button), `VictoryScreen.tsx` ("Result saved to History."), CSS, `PROJECT.md` §7.
- **Found by tests:** negative luck values were written as text `'-0.600` by the formula guard → CSV numbers are now kept numeric.
- **Tests:** `npm test` → **23 files, 261 passed** (summaries agree with the engine for every preset × W=1..5 × 3 roster sizes; Shield/VS/finale-point totals; identity across renames; luck/expected maths and tie order; legacy record; CSV round-trip, BOM, quoting, formula guard; IndexedDB delete/clear survive reopen and leave the current match alone; UI: empty state, ranking, newest-first list, detail log, confirm/cancel delete, clear all, three exports, unreadable-record notice, finished match appears). `npm run e2e` → **13 passed** (new: real match → History → reload → JSON + CSV downloads parsed → delete → reload). Typecheck, oxlint, Prettier, `npm run build` clean.
- **Manual (browser pane):** luck board, matches list and detail with full finale log checked at 1280 px; History button clears the logo at 760 px and drops inline below 700 px. Older pane records (saved before the Shield redesign) load fine. Dev server had to be restarted once (stale HMR module after a mid-edit refactor; not an app bug).
- **Assumptions:** unreadable stored records are kept in storage but left out with a notice (they are removed by "Clear all"); JSON export contains only readable records.
- **Next exact action:** owner reviews History → Phase 7 (hardening + Vercel).
- **Build/run state:** builds and runs; dev server on port 5173.

### 2026-10-09 — Shield redesign: limited supply + Sudden Death at one-third left
- **Owner decision:** "Supply + half-way break", "1 per 5 fighters", "One-third left". Replaces the 3-consecutive-no-elimination streak. Logged in `PROJECT.md` §4/§10 and the `AGENTS.md` invariants.
- **Rules implemented:** supply `ceil(N/5)`; Shield Fate or VS win uses one; Shield Fate with empty supply is wasted, VS winner gets `NO_SUPPLY`; when the last Shield is earned the Shield slots become KO (`SHIELD_SUPPLY_EXHAUSTED`, logged). Sudden Death when alive ≤ `round(N/3)`: supply → 0, D1 odds, all owned Shields shatter (`SUDDEN_DEATH_STARTED` now carries `aliveCount`, `shatteredIds`). Finale check runs first. `noEliminationStreak` removed.
- **Changed:** `matchTypes.ts` (schema 4: `shieldSupply`, `suddenDeathAt`; new event), `match.ts` (`shieldSupplyFor`, `suddenDeathAtFor`), `describeEvent.ts` (log text), `matchStorage.ts` (validation; schema-3 saves discarded with the "older version" notice), `FateStrip.tsx` (header: "Shields left" pips, "Sudden Death at N left" or "No Sudden Death: finale at N left"; class `fate-strip__streak` → `fate-strip__meter`), `MatchScreen.tsx`, `global.css` (`.pip--shield`), `match.test.ts`, `App.test.tsx`.
- **Tests:** `npm test` → **20 files, 234 passed** (supply counts for several N, exhaustion converts slots, wasted Shield/NO_SUPPLY, exact one-third trigger, shattering, finale pre-empts Sudden Death, UI header + log text + 90/10 odds). `npm run e2e` → **12 passed**. Typecheck, lint, `npm run build` clean.
- **Manual (browser pane):** old saved match discarded with the notice; 6-fighter match shows "Shields left 2 of 2". Header text for the finale-first case covered by the App test, not screenshotted.
- **Assumption:** when `round(N/3) ≤ W+1` there is no Sudden Death (the finale starts first); shown in the header. Rounding is `Math.round` (e.g. 8 → 3, 10 → 3, 32 → 11).
- **Next exact action:** owner play-tests (≥ 9 fighters), then `Phase 6: History & Analytics`.
- **Build/run state:** builds and runs; dev server on port 5173.

### 2026-10-09 — Fate overlap, bigger hand signs; Shield redesign proposed
- **Owner input:** loves it; asked to start the Fate spin mid fighter spin to save time; hand signs near the head are hard to read → move below the avatar and enlarge; asked for a recommendation on redefining Shields and the streak (options: shields lose effect past a threshold; limited shield supply that turns into KO; shields stop working once a number are owned).
- **Changed:** `src/animation/turnTimeline.ts` (`FATE_START_FRACTION` 0.5, `FATE_LANDS_AFTER_FIGHTER_MS` 400, `playerRevealMs`), `src/hooks/useTurnAnimation.ts` ("Fate is choosing…" switches at the fighter reveal), `DuelPanel.tsx` (hand 60 px below fighter), `FinaleStage.tsx` (hand 52 px below fighter, crown above winners), `finaleTimeline.ts` (`stagePositions`: triangle pulled in; 4–6 finalists in two rows), CSS (arena `max(480px, 62vh)`; hands in a framed box under the sprite), tests; docs `PROJECT.md` §10, `AGENTS.md` invariant. Commit `16a3adc`.
- **Found while checking:** taller cards made the 6-finalist ring overlap on short screens → two-row layout (verified in the pane).
- **Tests:** `npm test` → **20 files, 229 passed** (Fate starts ≥ half the fighter's travel and stops ≥ 0.4 s after the fighter reveal; most turns overlap; two-row layout). `npm run e2e` → 11/12 first (expected: one assertion still required the old non-overlapping order) → assertion updated to "Fate stops after the fighter" → ×2 repeat **24/24**. Typecheck + lint clean.
- **Pending decision (owner):** Shield / Sudden Death redesign — proposal in chat (decided and implemented in the next entry).
- **Next exact action:** owner chooses the Shield design → implement with tests → Phase 6.

### 2026-10-09 — Phase 5 accepted; owner follow-ups: step-by-step reveal, VS opponent spin, fallen fighters
- **Owner input:** Phase 5 "tested, all good". Requests: (1) Fate should start only after the fighter is known, with shorter spins to compensate; (2) VS: show "VS" first, then spin for P2, then RPS and result; (3) victory screen: knocked-out fighters scattered lying dead, finale losers lying beside the winners.
- **Changed:** `src/game/config/timing.ts` (per-cursor: land 2.5–5 s, cap 6.5 s, braking ≤ 3.5 s), `src/animation/spinPlan.ts` (uses new limits), `src/animation/turnTimeline.ts` (sequential: fighter → Fate → VS announce 1 s → opponent cursor over the other living fighters, starting after the challenger → throws), `src/hooks/useTurnAnimation.ts` (stages player/fate/vs/opponent/duel, opponent cursor, cues), `MatchScreen.tsx`, `PreviewPanel.tsx` ("Choosing a fighter…" → "Fate is choosing…"), `DuelPanel.tsx` (announce/pick/fight modes, mystery opponent), `VictoryScreen.tsx` + new `src/animation/victoryLayout.ts` (+test; deterministic scatter in side bands), CSS, tests; docs `PROJECT.md` §1/§4/§9/§10, `AGENTS.md` invariant.
- **Bugs found + fixed:** (a) scatter used a poorly mixed hash bit, so all bodies landed on one side (caught by a unit test) → alternate sides; (b) the victory "keep content above confetti" CSS rule also hit the fallen layer and stacked every body at one spot (caught visually in the pane) → rule excludes fixed layers; ceremony kept in the centre column on wide screens.
- **Unchanged:** engine, sampling and storage. All outcomes (fighter, slot, VS opponent, throws) are still committed before any animation; only presentation order changed.
- **Tests:** `npm test` → **20 files, 229 passed** (Fate cursor starts only after the fighter's reveal; each cursor ≤ 6.5 s; VS: announce → opponent cursor over the others starting after the challenger → throws; deterministic replay; scatter bounds/both sides/deterministic; App: "Choosing a fighter…" → "Fate is choosing…" → "VS!" with "???" → opponent → result; victory shows 2 fallen + 1 finale loser). `npm run e2e` → **12 passed**, ×2 → **24/24** (incl. real-browser check that the first Fate move comes after the last fighter move). Typecheck + lint clean.
- **Manual (browser pane):** order fighter → Fate confirmed in DOM; VS pick stage detected live; victory scene at 1500×900 with 6 fallen fighters on both sides and the finale loser beside 3 crowned winners.
- **Next exact action:** owner review of the follow-ups → Phase 6.

### 2026-10-09 — Phase 5: Retro Arcade Experience
- **Owner input:** chant = "ai sound"; music = would download the KOF character-select song or accept something similar; sprites = "you do it". Explained the KOF song is copyrighted and cannot be bundled; built an original chiptune plus a local-only "my music file" option (recorded in `PROJECT.md` §5 and `THIRD_PARTY_NOTICES.md`).
- **Added:** `src/audio/{audioSettings,chiptune,voice,soundEngine,soundContext}.ts`, `SoundProvider.tsx` (+ tests for settings/chiptune/voice); `src/storage/assetStorage.ts` (+test); `src/components/sprites/{PixelArt.tsx,fighterSprite.ts,icons.tsx}` (+test); `src/components/setup/SoundSettings.tsx`; `src/components/match/PauseMenu.tsx`; `e2e/polish.spec.ts`; `THIRD_PARTY_NOTICES.md`; dependency `@fontsource/press-start-2p` (OFL-1.1).
- **Changed:** `App.tsx` (SoundProvider; injectable engine/asset store), `MatchScreen.tsx` (music per phase, cursor/outcome/duel SFX, shortcuts Space/Enter/S/M/Esc, pause menu with Abandon), `FinaleStage.tsx` (AI chant per beat, result SFX, D4 pause), `VictoryScreen.tsx`, `useTurnAnimation.ts` (sound cues), `useFinaleShow.ts` (D4 pause at round boundary without restarting a running round), grid/preview/Fate strip/duel (pixel sprites + icons), `SetupScreen.tsx` (Sound panel), `main.tsx` (font), CSS (pixel font for big labels, CRT scanlines, sprite/pause/sound styles). Removed `src/hooks/useSound.ts`, `src/audio/finaleAudio.ts`.
- **Bugs found + fixed during the session:** (1) voice list empty because `voiceschanged` fired before subscription → re-read after mount. (2) IndexedDB Blob storage failed under the test shim and is fragile in some browsers → custom music stored as raw ArrayBuffer + type (realm-safe check).
- **Tests:** `npm test` → **19 files, 226 passed** (settings migration/clamping; both chiptune loops exactly 64 steps with valid pitches; voice selection prefers natural Vietnamese then English, phonetic fallback; asset store round-trip/size limit; sprites stable per name and varied; App: spy engine hears select/finale music, ticks, KO, chant MOT/HAI/BA/YO, score and victory; D4 pause holds rounds and resumes to victory; S/M/Esc shortcuts; sound settings + custom file upload/remove). `npm run e2e` → **12 passed**, ×2 repeat → **24/24** (pixel portraits/icons present; real finale paused >5 s with no new round then resumed to victory; volume + custom WAV persist across reload in IndexedDB and can be removed; S/M/Esc). Typecheck + lint clean. Bundle: JS 288 kB, fonts load per script range.
- **Manual (browser pane):** setup with Sound panel, voices listed (pane has English voices only → phonetic chant), match with varied portraits and pixel Fate icons, triangle finale with pixel hands, victory with crowned portraits.
- **Unverified:** actual audibility/mix of music, SFX and voice (cannot be heard from here); the Vietnamese voice itself (not installed in the pane; Edge on Windows normally offers "HoaiMy/NamMinh Online (Natural)"); speech/beat sync on the owner's machine.
- **Next exact action:** owner review of Phase 5 with sound on → Phase 6.

### 2026-10-09 — Phase 4 accepted; D4 approved
- **Owner:** "ok tested, all good, D4 go with your suggestion". Asked to confirm 2 Rock + 1 Scissors → both Rock players +1: confirmed (rule in `winningGesture` / `resolveFinaleRound`; covered by the unit test "every player throwing the winning hand scores 1" with Rock, Rock, Scissors).
- **Docs only:** `PROJECT.md` §6 + §10 (D4 approved: pause at next round boundary, resume continues, no skip), this file. No code changed; last verified build/test state unchanged from the Phase 4 entry.
- **Next exact action:** owner go-ahead for Phase 5 + P5-inputs.

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
