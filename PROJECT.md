# KOF — King of Fate | Product & Technical Specification

**Version:** 1.1 · **Status:** Owner-accepted baseline (2026-10-09); D1–D5 approved · **Date:** 2026-10-09

> This file is the source of truth for product behavior. `AGENTS.md` governs development conduct; `PROJECT_STATUS.md` tracks actual progress. Do not implement an open decision by silently inventing rules.

## 1. Product goal

Build an entertaining, fast-to-operate **office randomizer** inspired by retro fighting-game character-select screens, not a conventional wheel. A host selects today's roster, picks 1–5 winners, then runs simultaneous animated selections of a living participant and a Fate. Fates alter survival until **exactly `winnerCount + 1` players remain**, triggering a mandatory, full-screen Vietnamese **“Một Hai Ba Yo / Hai Ba Yo”** rock-paper-scissors (RPS) finale. The finale chooses the requested winners, displays a victory ceremony and retains match records.

This is an original custom pixel-arcade visual identity; reference images communicate mood/layout only. Do not copy protected KOF artwork, UI graphics, characters, music, or voices.

### Audiences and constraints
- Primarily one host on a desktop browser, often screenshared to office colleagues; no multiuser or audience input.
- Typical group <=20; **supported range 2–32**, with **1–5 winners** and at least `winners + 1` active players.
- Target playtime **3–5 minutes**, **not guaranteed**, particularly with larger rosters, shields and repeated RPS draws. Each turn reveals the fighter, then the Fate (then, for VS, the opponent) one after another; each cursor takes a **random 2.5–6.5 s** (owner decisions 2026-10-09, superseding fixed 4–5 s and later 4–10 s simultaneous) regardless of roster size; do not accelerate secretly.
- Fun and chaotic presentation; unbiased default outcomes. **Hidden/director control is deferred beyond MVP**, and future manipulated games must never be represented as fair.
- Mouse and keyboard; host manually initiates each ordinary turn. The finale automatically repeats RPS cycles to completion.

## 2. Scope and milestones

### First complete playable MVP (end of Phase 4)
- Text-only roster slots, large selected-player preview (generic placeholder silhouette/nameplate permitted), living-player cursor highlight, and simultaneous Fate-slot cursor; original retro/pixel-arcade presentation can start minimal.
- Paste newline-separated participant names, toggle active/inactive for attendance, choose 1–5 winners and a Fate preset; one persisted default configuration.
- KO, VS, Shield Fates with their confirmed behavior; fair independent sampling, logs, crash-safe state, Sudden Death.
- Mandatory full-screen finale at `W + 1`, automated RPS scoring and tiebreaks, result and winner celebration (placeholder sound/art acceptable).
- Basic current-match event logs and result record; full historical statistics/export deferred to Phase 6.

### Out of initial MVP
Custom participant avatars/photos; elaborate fighter animations; additional Fates such as Ghost/C4/Thief/Hunter; concealed host manipulation; cloud sync/backend/authentication; mobile-first controls; multiple saved named presets; manual editing of Fate percentages; undo; manual finale rounds. All are ideas, **not commitments**.

## 3. Setup, roster and validation

1. Setup presents a multiline paste field (one participant name per line), an attendance toggle beside each stored participant, winner count 1–5, Fate preset `Fast / Normal / Chaotic`, sound settings when implemented, and Start.
2. Persist the one default roster/settings in browser storage. Inactive users remain in roster but are excluded from the match and all selections.
3. Enable Start only when `2 <= activePlayerCount <= 32`, `1 <= winnerCount <= 5`, and **`activePlayerCount >= winnerCount + 1`**. Show actionable validation if invalid. Specifically, `N = W` is rejected, not auto-awarded.
4. Names are display labels, not IDs. Assign immutable internal player IDs. **Approved (D5, 2026-10-09):** trim surrounding whitespace; silently drop blank lines; reject names longer than **20 characters** and exact case-insensitive duplicate labels (within the paste or against the stored roster) with an inline warning; never conflate duplicate names as one person.
5. On completed game, return to Setup (after victory/results are shown), retaining roster, attendance choices and settings. No Undo.
6. Starting with exactly `W + 1` active players enters the finale immediately; no normal Fate rounds.

## 4. Core lifecycle & authoritative rules

### State machine (conceptual)
`SETUP -> READY -> SPINNING -> RESOLVING -> ROUND_COMPLETE -> READY` for ordinary turns. Before **each next ordinary turn**, evaluate survival. At `aliveCount == W+1`: `FINALE_INTRO -> FINALE_CHANT -> FINALE_REVEAL -> FINALE_SCORE -> [next chant / tiebreak / VICTORY]`. Victory writes a **single** committed completion record **before** the victory animation, then presents results, then host returns to Setup.

- Only living, enabled match participants are eligible for main player selection. **Equal probability among eligible living players**, independent each turn. Repeat selection of the same person is permitted.
- Player and Fate outcomes are **sampled independently and committed before animation**, using equal-probability indexed Fate slots. The cursors run **one after another** (owner decision 2026-10-09, superseding "simultaneously"): the fighter cursor lands first, then the Fate cursor; on VS a "VS!" announce is followed by an opponent cursor over the other living fighters, then the throws. Each cursor takes a random 2.5–6.5 s (see §10), slows down into its preselected target and accurately shows that outcome. UI position shuffle is **visual only**: it changes no weights, participants or odds.
- After each committed Fate resolution, re-evaluate remaining players. **Do not spin another ordinary round if `aliveCount == W+1`.** No single normal event can eliminate more than one participant in MVP.
- Concrete example requested by owner: with **4 living and 2 winners**, if a normal VS between players 3 and 4 eliminates its loser, **3 survive** and the finale begins. If the losing player spends a Shield and survives, **4 still live** and normal turns continue until 3 live.
- Pauses, skipping animations, refreshing and browser recovery must never reroll or duplicate committed outcomes. Ordinary next turn is host-triggered, not autoplay.

### Fate resolution

| Fate | Result | Notes |
|---|---|---|
| **KO** | Selected player loses one Shield if present; otherwise eliminated | Shield block is logged and counts as **no elimination**. |
| **SHIELD** | Selected player gains one Shield if none; otherwise nothing (wasted Fate) | **At most one** Shield per participant; wasted outcome is still logged. |
| **VS** | Randomly choose a distinct living opponent; fast RPS determines a winner and loser | Each gesture independently uniformly sampled from Rock/Paper/Scissors; identical hands draw and auto-reroll. Loser is eliminated unless protected, in which case Shield is consumed and they survive. Winner gets one Shield if unshielded, unless Sudden Death prohibits awarding. Existing Shield never stacks. |

VS opponent selection is uniform among **other living players**. With `aliveCount > W+1 >= 2`, there is always an opponent. RPS outcome is fair for both fighters, independently of player/Fate selection. A normal VS uses a quick ~2–4 second **decisive exchange** presentation; draws may extend it. Log duel participants, hands/attempts as appropriate, winner, Shield changes and whether elimination actually occurred.

### Three consecutive no-elimination turns → Sudden Death
- Increment `noEliminationStreak` for every **completed ordinary turn that eliminated nobody**, including protected KO/VS, wasted Shield and Shield grant. Reset to 0 only on an **actual elimination**.
- Once streak reaches **3**, enter Sudden Death for the rest of the ordinary elimination stage. It does not automatically end after the next elimination; transition ends it when finale begins.
- Existing Shields remain until consumed. **No new Shield may be awarded** through Fate or VS while Sudden Death is active. Therefore the active Fate pool contains **zero Shield slots**. Normal VS remains available, and winner Shield rewards are suppressed.
- **Approved (D1, 2026-10-09):** distinct Sudden Death weights per preset, KO/VS only, 20 slots — **Fast 95/5/0 (19/1/0 slots), Normal 90/10/0 (18/2/0), Chaotic 80/20/0 (16/4/0)** (KO/VS/Shield).
- Display the current Sudden Death state and **actual updated visible odds**; never silently change the probabilities behind a stale Fate row.
- Sudden Death raises the KO probability relative to each preset's normal KO chance, while retaining some VS possibility, unless the owner explicitly approves an exception.

### Normal Fate odds (confirmed)

| Fate | Fast | Normal | Chaotic |
|---|---:|---:|---:|
| KO | 90% = 18 slots | 75% = 15 slots | 60% = 12 slots |
| VS | 10% = 2 slots | 20% = 4 slots | 25% = 5 slots |
| SHIELD | 0% = 0 slots | 5% = 1 slot | 15% = 3 slots |

Twenty **equally likely** Fate slots comprise the visible row (rendered responsively). Random draw chooses a slot uniformly; duplicate Fate labels reflect weight. Shuffle only permutes slot positions. When Sudden Death begins, visibly replace the slot composition before the next draw. Tests must compare empirical frequencies to configured distributions.

## 5. Mandatory finale: Vietnamese automated RPS

### Trigger and presentation
- Enter when and only when `aliveCount == W + 1`, either immediately from setup or after an ordinary round. At finale entry, **clear all Shields** (everyone equal). No normal Fates afterward.
- **1 winner:** 2 finalists in facing 1v1 layout. **2 winners:** 3 finalists in flagship **triangle**. **3–5 winners:** 4–6 finalists in readable responsive ring/stage layout.
- Full-screen stage takeover; eventual retro pixel-art characters or hands may be reusable generic sprites. Names and running scores must remain legible without unique avatar assets.
- Play opening chant **“Một Hai Ba Yo!”** as intro cue **without a throw**. Thereafter repeat **“Hai”** (fists bounce once), **“Ba”** (second bounce), **“Yo!”** (simultaneous reveal Rock/Paper/Scissors), quick score/result pause, next chant automatically. Dramatic background music behind the chant.
- Planned built-in chant with ability to upload custom recording. Temporary audio is allowed in earlier phases; final assets need licensed/original recordings and adjustable timestamp/cue synchronization. Configurable **music / voice / SFX** volumes; sensible muted fallback if unavailable. Browser autoplay restrictions must be handled through the host's initial click.
- **Owner decisions (2026-10-09, Phase 5):** the chant is an **AI voice** = the browser's text-to-speech, word by word on each beat (Vietnamese voice when installed, phonetic fallback otherwise; host can pick the voice). Music is an **original chiptune** (select-screen loop + tense finale loop); the KOF character-select song is copyrighted and is **not** bundled. Instead the host may choose **their own music file**, kept only in that browser (never in the repo/build). Pixel art is original, drawn in code. Uploading a custom *chant recording* (with cue sync) remains a possible later addition; not built.

### RPS scoring, qualifications and ties
- Every currently competing finalist independently generates uniformly random Rock/Paper/Scissors on every throw, **with no bias toward a desired winner**.
- If all choices are the same, or all three gestures appear among the contestants, round is a **draw**, with **no score**. Otherwise, with exactly two gesture types, the winning gesture beats the losing gesture and **every player throwing the winning gesture earns 1 point**. For two finalists, a matching pair is a draw.
- **First to 3 points qualifies for a winner slot**. A qualified winner is removed from subsequent competition and shown as locked/celebrating. When `winnerSlotsRemaining` equals the number of all remaining unqualified players, those players qualify automatically: **do not keep rolling unnecessarily**. [D2 approved 2026-10-09. Note: under the W+1 start and the D3 rule, unqualified contestants always exceed open slots by ≥1, so this acts as a defensive guard rather than a reachable path.]
- If the number of new players reaching 3 in the same reveal fits available slots, lock them all. If it **exceeds** remaining slots, **only these oversubscribed tied candidates** enter a **fresh first-to-3 tiebreaker** for the remaining places. Their tiebreak scores reset to zero. Non-tied, lower-scoring finalists can no longer earn those contested slots once oversubscription occurs. Previously locked winners remain locked.
- Tiebreaker applies exactly the same uniform RPS and qualification algorithm recursively; multiple draws/ties can occur, and are never secretly overridden. Every state transition must be well-defined and terminate once exactly W winners have been locked (almost-sure completion, not bounded maximum time).
- **Important example:** 3 finalists, 2 slots, HAN=2, BEN=2, JAY=1; HAN and BEN both win next throw, reach 3, occupy both slots, game ends; no tiebreak.
- **Oversubscription example:** 4 finalists, 2 slots; 3 candidates simultaneously hit 3; those three alone play a new first-to-3 race for the 2 slots; the fourth candidate is excluded. If 2 qualify in the next race, lock both.
- [D3 approved 2026-10-09: on oversubscription, lower scorers are excluded and only the tied candidates replay a fresh first-to-3.] Implementation note (Phase 4): a reveal only scores with exactly two gesture types, so at least one contender never scores; with W + 1 finalists contenders always exceed open slots by exactly 1, so oversubscription cannot occur in real play. The rule is implemented and unit-tested on constructed states as a defensive guard; seeded simulations confirm no real finale ever triggers it.
- Store the full series of throws and score transitions for replayable audit/history. At exactly W qualified winners, commit final result **once** before victory animation.

## 6. Interface and interaction

### Primary desktop composition
1. **Top** cinematic/preview zone: large participant nameplate with generic fighter/silhouette for MVP; future avatar replacement optional. Used for main selection, KO, Shield and quick VS reveal.
2. **Below** 20-slot Fate strip with independently animated cursor and Fate label/tooltip.
3. **Below** adaptive living/dead participant grid, with central `?` Random and visual Shuffle control. Support 2–32 names; eliminated players remain visible **greyed out and X-marked**, not deleted. Show Shield icons and selected status.
4. **Bottom** chronological event log and help/tooltip descriptions, readable while screensharing.
5. Full-screen **finale takeover** and victory/result ceremony. Clear exit to setup; optionally inspect current result/log before returning.

### Controls
- Host clicks `?` or presses **Space/Enter** when it is safe to start the next ordinary turn. Do not activate shortcuts when focused in text fields or when a modal captures keys.
- **Esc** pauses/opens in-game menu. **Approved (D4, 2026-10-09):** in the automated finale, Esc requests a pause that takes effect at the next safe boundary (between rounds, after the current reveal is scored); the clock and audio hold; Resume continues with the next round. A round already committed is never re-rolled, skipped or changed. **No skip-animation control.** No committed game result can be changed by pausing.
- Main action can be context-sensitive (`RANDOM`, `RESOLVE`, `NEXT`, `FINISH`) but host should not need to click intermediate animations. Finale round progression is automatic.
- No Undo; no hidden controls in MVP. Click targets should be usable in a desktop screenshare. Provide sound mute and settings.

## 7. Persistence, fairness and error handling

- Browser-only application, deployed as a Vercel static site; **no server, account, database service, or cloud sync**.
- Keep small config/roster in `localStorage`; persistent current-game and completed-match records in `IndexedDB` (exact libraries and schema to be designed by implementation agent with versioned migration).
- Persist results/state transitions **atomically** where feasible and use unique event/match IDs; prevent a single outcome from being applied twice. On refresh mid-animation, restore a coherent committed reveal or last safe checkpoint, **never resample a committed spin**. Storage failure should be surfaced without pretending data was saved.
- `crypto.getRandomValues` with unbiased bounded integer selection for real matches; inject seeded RNG for repeatable deterministic tests. Do not map animation cursor steps to actual selection probabilities.
- Analytics should describe **selection outcomes**, not personal skill, and distinguish participation counts from win counts. Browser history is device/profile-specific and can be lost on cleared data. CSV and JSON export in Phase 6.
- Support recoverable invalid roster, insufficient active users, corrupted/stale storage, missing audio, accidental double-clicks, unavailable IndexedDB, and keyboard focus conflicts.

## 8. Testing and release acceptance

- Unit tests: state transitions, player eligibility, KO/Shield interaction, wasted Shield, VS ties and protected losses, Sudden Death activation after exactly 3 *consecutive* non-eliminations, and W+1 trigger.
- Finale tests for W=1..5, N=W+1 and larger, draw cases (same / all three gestures), multiple winning hands, oversubscription, repeated tiebreaks, exactly W winners and no double lock.
- Probability simulations with injected RNG: equal player selection, preset slot proportions and RPS gesture parity; seedable regression scenarios. Statistical tests need fixed tolerances to avoid flaky tests.
- Integration tests: committed state and log consistency, interrupted spin/VS/finale recovery, once-only match completion, attendance toggle and configuration restore.
- Playwright browser tests: setup/validation, turns, shield, finale, victory and return to setup, keyboard/mouse behavior, refresh and local persistence; smoke-check Vercel production build.
- Each phase must keep the app **running** and pass applicable TypeScript check, production build, automated tests and documented manual checks.

## 9. Approved seven-phase plan

| Phase | Deliverables | Acceptance gate |
|---|---|---|
| **1 — Foundation & Setup** | Vite/React/TS app; roster paste, toggles, validations, winners, presets, initial storage | Setup survives refresh; invalid matches blocked; tests/build pass |
| **2 — KO-only playable loop** | Pure engine; fair player RNG; main cursor, randomized spin, KO, event log, checkpoint/recovery | Complete KO-only matches; double-spin and refresh don't corrupt results |
| **3 — Complete Fate System** | 20-slot Fate cursor (revealed after the fighter, see §10), KO/VS/Shield, RPS duel, shields, Sudden Death, probability tests | All Fate interactions and supported odds verified; open Sudden Death ratios approved before finalization |
| **4 — Vietnamese RPS Finale** | W+1 handoff, full-screen stage, auto chanting/cue animation with placeholder audio, scoring/tiebreak, victory | Fully playable MVP with exact W winners for all supported counts |
| **5 — Retro Presentation** | Pixel-arcade polish, large preview, licensed/custom sprites, audio layering, actual/custom chant, shortcuts | Visual/audio acceptance; readable at 2–32 participants; normal randomized spins |
| **6 — History & Analytics** | Completed match store, event log viewer, participant statistics, leaderboard interpretation, CSV/JSON exports | Stored/exported data consistent and survives refresh |
| **7 — Hardening & Vercel** | Comprehensive E2E/performance/accessibility/storage/audio fallback checks; Vercel deployment | Production deployment, regression suite green and limitations documented |

> Phases 1–3 can use a placeholder finale gate while mechanics are built, but a *normal rules match* cannot be announced completed without the specified finale once Phase 4 is implemented. Each phase requires tests relevant to its scope, not a deferral of all testing to Phase 7.

## 10. Open decisions / approval register

**Approved requirements above are binding.** Decisions marked OPEN are not yet approved; ask the owner when they become relevant. Do not silently treat a proposal as a final rule.

| ID | Decision | Status / rule | Needed by |
|---|---|---|---|
| **D1 — Sudden Death odds** | Exact, **different for each preset**, KO-increased, no Shield. | **APPROVED 2026-10-09:** Fast **95/5/0**, Normal **90/10/0**, Chaotic **80/20/0** (KO/VS/Shield); 20 slots. | Phase 3 |
| **D2 — Final slots rule** | When remaining unqualified contestants exactly equal empty winner slots, do they auto-qualify? | **APPROVED 2026-10-09:** yes (defensive guard; not reachable under W+1 start + D3). | Phase 4 |
| **D3 — Oversubscription** | If tied threshold candidates exceed free slots, are lower scorers eliminated from contention? | **APPROVED 2026-10-09:** yes; new first-to-3 among tied candidates only. | Phase 4 |
| **D4 — Pause/skip** | What exactly does Esc do during finale? Is skip permitted? | **APPROVED 2026-10-09:** Esc pauses at the next round boundary (current committed reveal finishes and is scored first); Resume continues with the next round; no skip; outcomes never change. | Phase 5 |
| **D5 — Roster identity** | Duplicate names / blank lines / name-length limit. | **APPROVED 2026-10-09:** trim; drop blanks; reject >20 chars and case-insensitive duplicate labels with inline warning; internal UUIDs. | Phase 1 |
| **D6 — Fate probability rounding** | All active odds must fit exactly 20 slots; future Fate presets need approval. | Approved presets and D1 Sudden Death odds fit 20 slots. Future presets need approval. | Phase 3 |

### Owners' latest clarifications (binding)
- **Audience is a Malaysian office (2026-10-09).** The Vietnamese "Một Hai Ba Yo" chant is kept purely as the finale countdown flavor; UI language stays English. Participant names will typically be Malaysian (Malay/Chinese/Indian).
- **Sequential roulette cursor (approved 2026-10-09):** the player cursor steps through living fighters **in grid order** (wrapping, skipping eliminated), starting after the previous turn's target, fast at first and decelerating to a crawl before stopping on the pre-committed target (4.5 s total). Purpose: participants can follow it and "pray it moves one more step". Outcome sampling is unchanged (uniform, committed before animation).
- **Unpredictable spin rhythm (approved 2026-10-09, revised same day):** each spin gets its own style seeded from the turn ID (refresh replays it identically). Cursor lands after 4–8 s; button-to-KO reveal **never exceeds 10 s**. Constant-speed cruise, then braking: ~40% **snap** (3–5 braking moves) or ~60% **crawl** (7–14 moves, each slower). ~1 in 4 spins lingers extra on the box before the target. After landing the cursor **dwells 1.0–1.8× the last move** before the KO, so a pause never reveals whether it has stopped or will move once more. Order rule and outcome sampling unchanged; purely visual.
- **Player Shuffle (approved 2026-10-09):** between turns the host may shuffle grid positions (crypto RNG, logged, persisted). Visual fairness only; odds unchanged. Fate-strip shuffle follows with the Fate strip in Phase 3.
- A typical real-life match is **at most ~20 participants**; still keep technical support through 32.
- **Step-by-step reveal (approved 2026-10-09):** fighter first, then Fate, then (VS) "VS!" → opponent cursor → rock-paper-scissors → result. To compensate for the longer turn each cursor is shorter: lands after 2.5–5 s, never more than 6.5 s; snap/crawl/dwell rhythm unchanged. All outcomes still committed before any animation.
- **Victory scene (approved 2026-10-09):** fighters knocked out during the match lie scattered (greyed, lying down) around the screen; finalists who lost lie knocked out beside the standing, crowned winners.
- Full-length spins are **higher priority** than strict 3–5-minute match completion.
- In the 4-player/2-winner VS example, only an **actual elimination** changes the living count from 4 to 3. Shield absorption does **not** start finale.
- The visible Fate composition always represents the real active probabilities and is updated for Sudden Death.
- Winner-count shortage is uncommon, but the previously approved validation rule `N >= W+1` remains.

## 11. Change control

- Baseline **explicitly accepted by owner on 2026-10-09**; Phase 1 implementation authorized.
- Technical agents may independently decide internal library organization and implementation details consistent with this spec. **Any material game rule, odds, fairness, finale behavior, or UX changes require owner approval and a recorded decision.**
- At the end of **every development session**, update `PROJECT_STATUS.md` with work completed, tests executed/results, blockers, files changed, next steps and any decisions requested. Keep `PROJECT.md` synchronized for approved requirement changes; follow `AGENTS.md`.
