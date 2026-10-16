# KOF — King of Fate | Product & Technical Specification

**Version:** 1.1 · **Status:** Owner-accepted baseline (2026-10-09); D1–D5 approved · **Date:** 2026-10-09

> This file is the source of truth for product behavior. `AGENTS.md` governs development conduct; `PROJECT_STATUS.md` tracks actual progress. Do not implement an open decision by silently inventing rules.

## 1. Product goal

Build an entertaining, fast-to-operate **office randomizer** inspired by retro fighting-game character-select screens, not a conventional wheel. A host selects today's roster, picks 1–5 winners, then runs simultaneous animated selections of a living participant and a Fate. Fates alter survival until **exactly `winnerCount + 1` players remain**, triggering a mandatory, full-screen Vietnamese **“Một Hai Ba Yo / Hai Ba Yo”** rock-paper-scissors (RPS) finale. The finale chooses the requested winners, displays a victory ceremony and retains match records.

This is an original custom pixel-arcade visual identity; reference images communicate mood/layout only. Do not copy protected KOF artwork, UI graphics, characters, music, or voices.

### Audiences and constraints

- Primarily one host on a desktop browser, often screenshared to office colleagues; no multiuser or audience input.
- Typical group <=20; **supported range 2–32**, with **1–5 winners** and at least `winners + 1` active players.
- Target playtime **3–5 minutes**, **not guaranteed**, particularly with larger rosters, shields and repeated RPS draws. Each turn reveals the fighter, then the Fate (then, for VS, the opponent) one after another; each cursor takes a **random 2.5–6.5 s** (owner decisions 2026-10-09, superseding fixed 4–5 s and later 4–10 s simultaneous) regardless of roster size; do not accelerate secretly. **Turbo spins** (owner decision 2026-10-16) is an explicit setup toggle: each cursor 1.5–4 s, same odds.
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

| Fate       | Result                                                                                                               | Notes                                                                                                                                                                                                                                                                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KO**     | Selected player loses one Shield if present; otherwise eliminated                                                    | Shield block is logged and counts as **no elimination**.                                                                                                                                                                                                                                                                                      |
| **SHIELD** | Selected player gains one Shield if none and the match's Shield supply is not empty; otherwise nothing (wasted Fate) | **At most one** Shield per participant; wasted outcome is still logged. Each Shield earned uses one from the limited supply (see below).                                                                                                                                                                                                      |
| **VS**     | Randomly choose a distinct living opponent; fast RPS determines a winner and loser                                   | Each gesture independently uniformly sampled from Rock/Paper/Scissors; identical hands draw and auto-reroll. Loser is eliminated unless protected, in which case Shield is consumed and they survive. Winner gets one Shield if unshielded and the supply is not empty, unless Sudden Death prohibits awarding. Existing Shield never stacks. |

VS opponent selection is uniform among **other living players**. With `aliveCount > W+1 >= 2`, there is always an opponent. RPS outcome is fair for both fighters, independently of player/Fate selection. A normal VS uses a quick ~2–4 second **decisive exchange** presentation; draws may extend it. Log duel participants, hands/attempts as appropriate, winner, Shield changes and whether elimination actually occurred.

### Limited Shield supply and Sudden Death (owner decision 2026-10-09, replaces the 3-turn streak)

- **Shield supply:** each match has `ceil(N / 5)` Shields to earn (N = starting fighters). Every Shield gained — by Shield Fate or by winning a VS — uses one. A Shield Fate rolled while the supply is empty is wasted. A VS winner gets nothing when the supply is empty.
- **Supply exhausted:** when the last Shield is earned, the Shield slots in the Fate row turn into **KO** before the next draw (logged and visible). Shields already owned keep working.
- **Sudden Death** starts when the living count drops to `round(N / 3)` (one-third of the start), for the rest of the ordinary stage. **All Shields shatter** (logged by name), the supply is emptied, no new Shield may be awarded, and the Fate row switches to the D1 Sudden Death odds (zero Shield slots). Normal VS remains available; winner Shield rewards are suppressed.
- The finale check comes first: if `round(N / 3) <= W + 1` the finale starts before Sudden Death can, and the match shows "No Sudden Death".
- **Approved (D1, 2026-10-09):** distinct Sudden Death weights per preset, KO/VS only, 20 slots — **Fast 95/5/0 (19/1/0 slots), Normal 90/10/0 (18/2/0), Chaotic 80/20/0 (16/4/0)** (KO/VS/Shield). **Since 2026-10-16 one KO slot in every pool (normal and Sudden Death) is a Bomb:** Sudden Death is now Fast 18/1/0/1, Normal 17/2/0/1, Chaotic 15/4/0/1 (KO/VS/Shield/Bomb).
- Display the remaining Shield supply, the Sudden Death threshold, the current Sudden Death state and the **actual updated visible odds**; never silently change the probabilities behind a stale Fate row.
- Sudden Death raises the KO probability relative to each preset's normal KO chance, while retaining some VS possibility, unless the owner explicitly approves an exception.

### Normal Fate odds (confirmed)

| Fate   |           Fast |         Normal |        Chaotic |
| ------ | -------------: | -------------: | -------------: |
| KO     | 85% = 17 slots | 70% = 14 slots | 55% = 11 slots |
| VS     |  10% = 2 slots |  20% = 4 slots |  25% = 5 slots |
| SHIELD |   0% = 0 slots |    5% = 1 slot |  15% = 3 slots |
| BOMB   |    5% = 1 slot |    5% = 1 slot |    5% = 1 slot |

**Bomb (owner decision 2026-10-16):** one slot in every pool, taken from KO. The picked fighter takes a KO and the blast also hits one adjacent living fighter: the nearest living fighter to the left or right in grid order (wrapping), chosen 50/50 and committed with the turn before any animation. A Shield absorbs the blast for either fighter (spending it). If both would be eliminated and that would leave fewer than W + 1 alive, the neighbour is spared. Blast sequence (owner request 2026-10-16, after testing): when the Fate lands on Bomb, the picked fighter's border turns red, 0.7 s later the neighbour's, then at 1.5 s the first blast hits the picked fighter and at 2.3 s the second blast hits the neighbour, each with its own boom (a Shield clinks instead; a spared neighbour stays quiet); the result is applied at 3.2 s and the stamp reads "BOOM!".

Twenty **equally likely** Fate slots comprise the visible row (rendered responsively). Random draw chooses a slot uniformly; duplicate Fate labels reflect weight. Shuffle only permutes slot positions. When the Shield supply runs out or Sudden Death begins, visibly replace the slot composition before the next draw. Tests must compare empirical frequencies to configured distributions.

## 5. Mandatory finale: Vietnamese automated RPS

### Trigger and presentation

- Enter when and only when `aliveCount == W + 1`, either immediately from setup or after an ordinary round. At finale entry, **clear all Shields** (everyone equal). No normal Fates afterward.
- **1 winner:** 2 finalists in facing 1v1 layout. **2 winners:** 3 finalists in flagship **triangle**. **3–5 winners:** 4–6 finalists in readable responsive ring/stage layout.
- Full-screen stage takeover; eventual retro pixel-art characters or hands may be reusable generic sprites. Names and running scores must remain legible without unique avatar assets.
- Play opening chant **“Một Hai Ba Yo!”** as intro cue **without a throw**. Thereafter repeat **“Hai”** (fists bounce once), **“Ba”** (second bounce), **“Yo!”** (simultaneous reveal Rock/Paper/Scissors), quick score/result pause, next chant automatically. Dramatic background music behind the chant.
- Planned built-in chant with ability to upload custom recording. Temporary audio is allowed in earlier phases; final assets need licensed/original recordings and adjustable timestamp/cue synchronization. Configurable **music / voice / SFX** volumes; sensible muted fallback if unavailable. Browser autoplay restrictions must be handled through the host's initial click.
- **Owner decisions (2026-10-09, Phase 5):** the chant is an **AI voice** = the browser's text-to-speech, word by word on each beat (Vietnamese voice when installed, phonetic fallback otherwise; host can pick the voice). Music is an **original chiptune** (select-screen loop + tense finale loop); the KOF character-select song is copyrighted and is **not** bundled. Instead the host may choose **their own music file**, kept only in that browser (never in the repo/build). Pixel art is original, drawn in code. Uploading a custom _chant recording_ (with cue sync) remains a possible later addition; not built.

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
- **Phase 6 owner decisions (2026-10-09):** (a) a person's statistics add up across matches by their **roster entry** (internal ID): renaming keeps the stats; removing and re-adding a name starts a new record; the latest name is shown. (b) The host may **delete one match** or **clear all history**; both ask for confirmation and suggest exporting first. (c) The leaderboard ranks by **luck vs expected**: expected wins = sum of W/N over the matches a person played; luck = wins − expected; it also shows played, wins and win rate, and states that results are chance, not skill.
- Support recoverable invalid roster, insufficient active users, corrupted/stale storage, missing audio, accidental double-clicks, unavailable IndexedDB, and keyboard focus conflicts.

## 8. Testing and release acceptance

- Unit tests: state transitions, player eligibility, KO/Shield interaction, wasted Shield, VS ties and protected losses, limited Shield supply (exhaustion turns Shield slots into KO), Sudden Death activation at exactly one-third left with Shields shattered, and W+1 trigger.
- Finale tests for W=1..5, N=W+1 and larger, draw cases (same / all three gestures), multiple winning hands, oversubscription, repeated tiebreaks, exactly W winners and no double lock.
- Probability simulations with injected RNG: equal player selection, preset slot proportions and RPS gesture parity; seedable regression scenarios. Statistical tests need fixed tolerances to avoid flaky tests.
- Integration tests: committed state and log consistency, interrupted spin/VS/finale recovery, once-only match completion, attendance toggle and configuration restore.
- Playwright browser tests: setup/validation, turns, shield, finale, victory and return to setup, keyboard/mouse behavior, refresh and local persistence; smoke-check Vercel production build.
- Each phase must keep the app **running** and pass applicable TypeScript check, production build, automated tests and documented manual checks.

## 9. Approved seven-phase plan

| Phase                         | Deliverables                                                                                                                | Acceptance gate                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **1 — Foundation & Setup**    | Vite/React/TS app; roster paste, toggles, validations, winners, presets, initial storage                                    | Setup survives refresh; invalid matches blocked; tests/build pass                                        |
| **2 — KO-only playable loop** | Pure engine; fair player RNG; main cursor, randomized spin, KO, event log, checkpoint/recovery                              | Complete KO-only matches; double-spin and refresh don't corrupt results                                  |
| **3 — Complete Fate System**  | 20-slot Fate cursor (revealed after the fighter, see §10), KO/VS/Shield, RPS duel, shields, Sudden Death, probability tests | All Fate interactions and supported odds verified; open Sudden Death ratios approved before finalization |
| **4 — Vietnamese RPS Finale** | W+1 handoff, full-screen stage, auto chanting/cue animation with placeholder audio, scoring/tiebreak, victory               | Fully playable MVP with exact W winners for all supported counts                                         |
| **5 — Retro Presentation**    | Pixel-arcade polish, large preview, licensed/custom sprites, audio layering, actual/custom chant, shortcuts                 | Visual/audio acceptance; readable at 2–32 participants; normal randomized spins                          |
| **6 — History & Analytics**   | Completed match store, event log viewer, participant statistics, leaderboard interpretation, CSV/JSON exports               | Stored/exported data consistent and survives refresh                                                     |
| **7 — Hardening & Vercel**    | Comprehensive E2E/performance/accessibility/storage/audio fallback checks; Vercel deployment                                | Production deployment, regression suite green and limitations documented                                 |

> Phases 1–3 can use a placeholder finale gate while mechanics are built, but a _normal rules match_ cannot be announced completed without the specified finale once Phase 4 is implemented. Each phase requires tests relevant to its scope, not a deferral of all testing to Phase 7.

## 10. Open decisions / approval register

**Approved requirements above are binding.** Decisions marked OPEN are not yet approved; ask the owner when they become relevant. Do not silently treat a proposal as a final rule.

| ID                                 | Decision                                                                                       | Status / rule                                                                                                                                                                                 | Needed by |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| **D1 — Sudden Death odds**         | Exact, **different for each preset**, KO-increased, no Shield.                                 | **APPROVED 2026-10-09:** Fast **95/5/0**, Normal **90/10/0**, Chaotic **80/20/0** (KO/VS/Shield); 20 slots.                                                                                   | Phase 3   |
| **D2 — Final slots rule**          | When remaining unqualified contestants exactly equal empty winner slots, do they auto-qualify? | **APPROVED 2026-10-09:** yes (defensive guard; not reachable under W+1 start + D3).                                                                                                           | Phase 4   |
| **D3 — Oversubscription**          | If tied threshold candidates exceed free slots, are lower scorers eliminated from contention?  | **APPROVED 2026-10-09:** yes; new first-to-3 among tied candidates only.                                                                                                                      | Phase 4   |
| **D4 — Pause/skip**                | What exactly does Esc do during finale? Is skip permitted?                                     | **APPROVED 2026-10-09:** Esc pauses at the next round boundary (current committed reveal finishes and is scored first); Resume continues with the next round; no skip; outcomes never change. | Phase 5   |
| **D5 — Roster identity**           | Duplicate names / blank lines / name-length limit.                                             | **APPROVED 2026-10-09:** trim; drop blanks; reject >20 chars and case-insensitive duplicate labels with inline warning; internal UUIDs.                                                       | Phase 1   |
| **D6 — Fate probability rounding** | All active odds must fit exactly 20 slots; future Fate presets need approval.                  | Approved presets and D1 Sudden Death odds fit 20 slots. Future presets need approval.                                                                                                         | Phase 3   |

### Owners' latest clarifications (binding)

- **Audience is a Malaysian office (2026-10-09).** The Vietnamese "Một Hai Ba Yo" chant is kept purely as the finale countdown flavor; UI language stays English. Participant names will typically be Malaysian (Malay/Chinese/Indian).
- **Sequential roulette cursor (approved 2026-10-09):** the player cursor steps through living fighters **in grid order** (wrapping, skipping eliminated), starting after the previous turn's target, fast at first and decelerating to a crawl before stopping on the pre-committed target (4.5 s total). Purpose: participants can follow it and "pray it moves one more step". Outcome sampling is unchanged (uniform, committed before animation).
- **Unpredictable spin rhythm (approved 2026-10-09, revised same day):** each spin gets its own style seeded from the turn ID (refresh replays it identically). Cursor lands after 4–8 s; button-to-KO reveal **never exceeds 10 s**. Constant-speed cruise, then braking: ~40% **snap** (3–5 braking moves) or ~60% **crawl** (7–14 moves, each slower). ~1 in 4 spins lingers extra on the box before the target. After landing the cursor **dwells 1.0–1.8× the last move** before the KO, so a pause never reveals whether it has stopped or will move once more. Order rule and outcome sampling unchanged; purely visual.
- **Player Shuffle (approved 2026-10-09):** between turns the host may shuffle grid positions (crypto RNG, logged, persisted). Visual fairness only; odds unchanged. Fate-strip shuffle follows with the Fate strip in Phase 3.
- A typical real-life match is **at most ~20 participants**; still keep technical support through 32.
- **Step-by-step reveal (approved 2026-10-09, revised same day):** fighter first, then Fate, then (VS) "VS!" → opponent cursor → rock-paper-scissors → result. The Fate cursor **starts midway through the fighter spin** (at half the fighter cursor's travel) to save time, but **always stops at least 0.4 s after the fighter is revealed**. Each cursor lands after 2.5–5 s, never more than 6.5 s; snap/crawl/dwell rhythm unchanged. All outcomes still committed before any animation.
- **RPS hand signs (approved 2026-10-09):** shown below each fighter (not on the head) and larger, in VS duels and the finale. 4–6 finalists stand in two rows facing each other.
- **Shield redesign (approved 2026-10-09):** Shields are a limited supply (1 per 5 fighters, rounded up) that carries fighters through the early/mid game; Sudden Death at one-third left shatters them. Replaces the earlier "3 consecutive no-elimination turns" trigger and "existing Shields remain in Sudden Death". See §4.
- **Victory scene (approved 2026-10-09):** fighters knocked out during the match lie scattered (greyed, lying down) around the screen; finalists who lost lie knocked out beside the standing, crowned winners.
- **Arcade enhancement packs (approved 2026-10-10)** — presentation and history only; sampling, odds and rules unchanged:
  - **Pack A (show):** "INSERT COIN / PRESS START" title screen **once per page load** (the press also unlocks audio); **~4 s character-select intro + "ROUND 1… FIGHT!"** at match start, **host may skip with Space/click**; finale VS splash before Start; English **announcer** callouts on the voice volume; K.O. stamp, screen shake, hit sparks, flash, knock-back fall; **~1 s slow-motion final blow** in the finale; idle breathing animation; shake/flash disabled under reduced-motion.
  - **Pack B (looks):** larger sprite variety (hair, headwear, glasses, facial hair, outfits, colours), **random neutral look by default (no religious headwear)** plus a per-person **"Change look" picker** (incl. tudung/songkok) saved with the roster; original pixel **stage backgrounds** (KL night, mamak, office pantry, pasar malam, rooftop; finale night variant), **random per match, host can pin one** in setup.
  - **Pack C (history):** VS **rivalries** (head-to-head; VS duels only), **fighter profile**, and fun **badges** (First Blood, Magnet, Iron Wall, Duelist, Flawless, Back-to-back, Survivor, Shield Hoarder) — luck, not skill.
- **Owner requests (2026-10-10, after launch):** (a) **Animations: Follow this computer / Always on** setting (per browser, `kof.display`); "Always on" overrides the OS reduced-motion preference. (b) Announcer callouts play at the same time as effects again (the 450 ms delay was rolled back; the silent effects were an Edge issue). (c) **In-match VS count:** after the opponent is chosen, every throw is counted "Rock… Paper… Scissors!" (beat + word + announcer) and the hands are revealed on Scissors; a draw pauses 0.9 s and counts again; a decisive throw holds 1.8 s. (d) **Hand attacks** in the duel and finale: the winning hand flies at the nearest losing hand: rock crushes scissors, paper wraps rock, scissors cut paper. (e) Setup roster 2 per row; match fighters ~6 per row with 72 px sprites; long names wrap. (f) Event log beside the match on screens ≥ 1600 px wide, see-through (55 % panel) so the stage shows; below that it stays underneath.
- **Finale showdown (owner request 2026-10-10):** new original finale music (172 bpm, D minor, Dm–B♭–C–A, galloping bass, heroic lead, fills). **Rising pace:** every finale round in a row with no new winner slot shortens the chant beat by 50 ms (600 → … → floor 360 ms = 60 %); result hold, pause, hand attack and music tempo scale with it; a new winner or a tiebreak resets it. Presentation only; derived from saved rounds so a refresh replays it. The hand attack is 2.4 s at normal pace (≈ 1 s flight).
- **Chant change (owner decision 2026-10-10):** the finale chant is now **"1, 2, Juice!"** (replacing "Một Hai Ba Yo"): intro "1 · 2 · Juice!" with no throw, then every round "1" (fists bounce), "2" (bounce), "Juice!" (reveal). Spoken by the browser's English voice (host can still pick a voice); no Vietnamese voice needed. Earlier references to the Vietnamese chant in this document are superseded. **In-match VS count is a beat only** (no spoken Rock/Paper/Scissors); the on-screen words stay; the single "Versus!" callout remains.
- **Pacing pack (owner decisions 2026-10-16):** (a) **tempo curve**: the finale rising pace now closes 30 % of the gap to the 360 ms floor each round without a new winner (600 → 528 → 478 → 442 → 418 ms …) instead of a straight −50 ms, so it speeds up steeply then levels off. (b) **"Last point"**: when anyone still racing is one point from a slot, "2" darkens the stage with a "MATCH POINT" banner and the music drops out for a fixed 0.9 s held breath before "Juice!". (c) **Turbo spins**: setup toggle (saved with the setup, default off), cursors land after 1.5–3 s and never exceed 4 s; VS count and finale unchanged. All presentation only; no odds or results change. Host clicker support was not requested.
- **Character customisation (owner decision 2026-10-16):** look editor preview is light (checkerboard) by default with a Light / Dark toggle; 8 fun cosplay skins (goblin green, orc olive, smurf blue, alien purple, zombie grey-green, demon red, vampire pale, golden) plus an any-colour picker for skin (stored as #rrggbb); random default looks keep natural skin tones only. **Races (done):** Human, Dwarf (brows + big beard), Elf (pointed ears), Cat folk (cat ears + whiskers), Goblin (long ears + tooth), Orc (tusks), Demon (horns), Vampire (red eyes, fangs, high collar), Robot (antenna, visor, bolts), Alien (glowing antennae, big eyes); picking one suggests a matching skin; looks saved before races are Human. **Classes (done):** Warrior (helmet, pauldrons), Samurai (topknot, red band, katana hilt), Mage (wizard hat), Healer (white cap with red cross), Ninja (hood + mask), Archer (feathered cap + bow), Pirate (bandana + eye patch), Chef (chef hat). Title shown as e.g. "Goblin Mage" in the look editor, preview, finale, winner screen and share card. Flavour: the winning hand in duels and the finale glows in the class colour with an effect (⚔️ 🔥 ✨ 💨 🏹 ☠️ 🍳), and the victory pose follows the class (spin: mage/ninja; float: healer; power-up: warrior/samurai/pirate; jump: others). Looks and flavour only; never gameplay perks, odds stay equal.
- **Custom Fate odds (owner decision 2026-10-16, follow-up):** a 4th preset card "Custom" next to Fast / Normal / Chaotic. The host sets VS, Shield and Bomb for normal play and VS and Bomb for Sudden Death with −/+ buttons in 5 % (one-slot) steps; KO takes whatever is left, so each pool always fills the 20 equally likely slots. Rules: Sudden Death has no Shield and never more VS than normal play (slots only flip to KO); Shield can never fill all 20 normal slots. Starts from the Normal preset, saved with the setup; the odds are stored with each Custom match (so a reload or History shows what was played). Built-in presets are unchanged.
- **Match point once (owner feedback 2026-10-16):** the dark pause, music drop and camera push-in now play only on the round right after someone REACHES match point (once per person per race), not again on every draw while they stay there.
- **Victory poses (owner request 2026-10-16):** on the winner screen each winner jumps happily on the beat of the stage's fanfare (one jump per two beats, squash and stretch, shadow; with several winners every other one lands on the off-beat). Off under reduced motion unless Animations: Always on. Photo avatars, catchphrases and outfit-specific attacks were not requested.
- **Office pack (owner request 2026-10-16):** **prize / title line** (optional setup text, max 60 characters, e.g. "Who buys kopi today?"; shown on the intro, the finale header and the winner screen, saved with the match in History and its CSV `title` column); **victory share card** (winner screen "Save picture" downloads a 1200×630 PNG drawn locally with the winner(s), crown, prize line, date, fighter count, finale rounds and the fallen; "Copy picture" puts it on the clipboard where the browser allows; nothing is uploaded); **champion's crown** (the winner(s) of the most recent completed match, matched by name, wear a crown in the next match's intro, grid, preview and finale; stored with the match at start; cosmetic only). Monthly seasons were not requested.
- **Bomb Fate (owner decision 2026-10-16):** see §4; the only new Fate requested (Swap / Revive / Bounty were not).
- **Visual pack (owner request 2026-10-16):** **draw counter** ("Draw!" / "Draw ×n!", "Clash!" when everyone shows the same hand; grows 20 % per draw in a row, max 1.8×; in VS duels and the finale); **finale camera** (pushes in on the fighter(s) one point from a slot during the last-point pause, snaps back on "Juice!"; the stage punches in on a scoring reveal); **big moments** (hit-stop freeze frame before the K.O. shake, speed lines while the fighter cursor cruises, white flash on "Juice!"); **reacting crowd** (original pixel spectators along the bottom of the preview, the finale stage and under the victory podium: idle, cheer on a K.O. / scored point, jump for the winner). Presentation only. Projector mode and narrow-screen drawer were not requested.
- **Sound pack (owner request 2026-10-10):** recorded voice clips for "1", "2", "Juice!", "K.O.!", "Versus!", "Fight!" (owner supplies the recordings; `npm run voice` trims/levels/fits them), falling back to the browser voice per clip. **Finale music that builds:** layer 0 drums + bass (no points yet), 1 + lead (someone scored), 2 + arpeggio and extra hats (someone on match point), 3 key up a semitone (two or more on match point, or a tiebreak). **Victory fanfare per stage** (original, < 5 s each).
- Full-length spins are **higher priority** than strict 3–5-minute match completion.
- In the 4-player/2-winner VS example, only an **actual elimination** changes the living count from 4 to 3. Shield absorption does **not** start finale.
- The visible Fate composition always represents the real active probabilities and is updated for Sudden Death.
- Winner-count shortage is uncommon, but the previously approved validation rule `N >= W+1` remains.

## 11. Change control

- Baseline **explicitly accepted by owner on 2026-10-09**; Phase 1 implementation authorized.
- Technical agents may independently decide internal library organization and implementation details consistent with this spec. **Any material game rule, odds, fairness, finale behavior, or UX changes require owner approval and a recorded decision.**
- At the end of **every development session**, update `PROJECT_STATUS.md` with work completed, tests executed/results, blockers, files changed, next steps and any decisions requested. Keep `PROJECT.md` synchronized for approved requirement changes; follow `AGENTS.md`.
