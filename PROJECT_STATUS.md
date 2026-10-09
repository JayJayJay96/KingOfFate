# PROJECT_STATUS.md — KOF / King of Fate

**As of:** 2026-10-09  
**Phase:** 1 — Foundation & Setup  
**Overall status:** Phase 1 implemented and verified locally (typecheck, lint, unit/integration, build, E2E). Not committed, not deployed. **Phase 1 awaits owner acceptance** (manual review) before Phase 2 starts.

## 1. Current snapshot

| Item | State |
|---|---|
| Baseline documents | **Accepted by owner 2026-10-09** |
| Technical stack | React 19 + TypeScript 6 + Vite 8; Vitest 5 + Testing Library; Playwright 1.64 (Edge channel); oxlint; Prettier |
| Storage | Setup config in `localStorage` key `kof.setup` (schemaVersion 1). IndexedDB not yet used (Phase 2 match state). |
| Normal Fate odds | Approved and encoded: Fast 90/10/0; Normal 75/20/5; Chaotic 60/25/15 |
| Sudden Death odds (D1) | **Approved 2026-10-09** and encoded: Fast 95/5/0; Normal 90/10/0; Chaotic 80/20/0 |
| Finale rules (D2, D3) | **Approved 2026-10-09** (not yet implemented; Phase 4) |
| Roster identity (D5) | **Approved 2026-10-09** and implemented |
| Pause/skip (D4) | OPEN — needed before Phase 5 |
| Source code | Phase 1 only |
| Git | Repo initialised on `main`; **no commits yet** |
| Deployment | Not attempted |

## 2. Phase tracker

| Phase | Status | Next acceptance goal |
|---|---|---|
| 1 — Foundation & Setup | **Implemented; automated checks pass; awaiting owner review** | Owner manually checks setup screen and accepts |
| 2 — KO-only playable loop | Not started | Fair eligible player selection; correct elimination/checkpointing |
| 3 — Full Fate System | Not started | KO/VS/Shield/Sudden Death and tests (D1 approved) |
| 4 — Vietnamese RPS Finale | Not started | W+1 trigger and exactly W winners (D2/D3 approved) |
| 5 — Retro Arcade Experience | Not started | Art/audio/shortcuts/visual polish; D4 resolved |
| 6 — History & Analytics | Not started | Accurate persistent statistics and exports |
| 7 — Hardening & Deployment | Not started | Regressions pass and Vercel URL works |

## 3. Requirements that are already approved

- Normal game: player and Fate animations run simultaneously; living player selected uniformly; Fate represented by 20 equal-chance slots; 4–5 second fixed spin; selected player may repeat; visual shuffle does not alter odds.
- KO, VS and Shield only for MVP; Shield cap one; duplicate Shield wasted; protected KO/VS loss consumes Shield and prevents elimination.
- VS: random distinct living opponent; automatic one decisive RPS throw with rethrows on draw. Winner earns Shield when permitted.
- 3 consecutive no-elimination turns activate Sudden Death; existing Shields remain, no new ones; D1 odds above.
- Finale begins immediately upon `aliveCount == winners + 1`. Example: from 4 players/2 winners, a VS kill leaves 3 and triggers finale; a Shield block leaves 4 and ordinary turns continue.
- Finale: automated full-screen Vietnamese chant, first to three points, simultaneous uniform RPS; D3 tiebreak among oversubscribed candidates only; D2 auto-qualify guard; clear Shields at finale start.
- 1–5 winners, validate `activeCount >= W+1`. Typical office count <=20, maximum 32. Keep 4–5s spin even if game exceeds target 3–5 minutes.
- D5: trim, drop blank lines, reject >20 characters and case-insensitive duplicates with inline warning, internal UUIDs.
- One default configuration; newline-paste roster; attendance toggles; auto-restore active match; no undo; basic logs early, detailed history/export Phase 6. Completed result stored before victory animation.
- Host uses mouse plus Space/Enter/Esc; normal rounds manually initiated, finale automatically cycles; return to setup after result.

## 4. Open decisions (owner follow-up)

| ID | Question | Recommendation | Blocks |
|---|---|---|---|
| D4 | What is Esc pause behavior during chant, and should animation-skip exist? | Safe pause/resume at beat/throw boundary; no outcome changes. | Phase 5 polish |
| D6 | Future Fate presets/odds must fit 20 slots and need approval. | Current presets fit. | Only if presets change |

## 5. Planned next steps

1. Owner reviews Phase 1 in the browser (`npm run dev`) and accepts, or lists fixes.
2. Owner decides whether to commit Phase 1 (suggested message: `feat: phase 1 setup, roster and local config`).
3. Then Phase 2: pure engine (state machine, crypto RNG with unbiased bounded sampling + seeded test RNG), KO-only turns, 4–5 s player cursor, event log, IndexedDB checkpoint/recovery, refresh-during-spin tests.

## 6. Session log

### 2026-10-09 — Phase 1: Foundation & Setup
- **Objective:** Get owner decisions, then implement Phase 1 only.
- **Decisions obtained (owner, in chat):** baseline accepted; Phase 1 authorized; D1 = 95/5/0, 90/10/0, 80/20/0; D2 and D3 approved as recommended; D5 approved (trim / drop blanks / reject >20 chars and case-insensitive duplicates). Logged in `PROJECT.md` §3, §4, §5, §10, §11.
- **Analysis noted:** D2 cannot actually trigger. W+1 finalists for W slots means unqualified players always exceed open slots by ≥1, also in D3 tiebreaks. It is kept as a defensive guard.
- **Files added:** `package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `playwright.config.ts`, `tsconfig*.json`, `.oxlintrc.json`, `.gitignore`, `README.md`, `.claude/launch.json`, `public/favicon.svg` (original), `src/main.tsx`, `src/app/App.tsx`, `src/app/App.test.tsx`, `src/game/config/{limits,presets}.ts`, `src/game/config/presets.test.ts`, `src/game/setup/{roster,setupConfig,validation}.ts` + tests, `src/storage/setupStorage.ts` + test, `src/hooks/useSetupConfig.ts`, `src/components/setup/{SetupScreen,RosterInput,RosterGrid,MatchOptions}.tsx`, `src/components/MatchPlaceholder.tsx`, `src/styles/global.css`, `src/test/setup.ts`, `e2e/setup.spec.ts`.
- **Files changed:** `PROJECT.md` (approved decisions), this file.
- **Functionality completed:** newline paste roster with D5 rules and inline rejection list (rejected names stay in the box); attendance toggles (IN/OUT, All in/All out); remove fighter; winners 1–5; Fate preset picker showing real normal + Sudden Death odds; start validation (2–32 active, N ≥ W+1, N = W rejected) with actionable messages and "opens in finale" note at N = W+1; versioned localStorage with corrupt-backup, partial repair, unavailable/write-failure banners; Start → clearly labelled Phase 1 placeholder listing active lineup → Back to setup.
- **Assumptions (minor, UX-internal):** internal whitespace runs collapse to one space; names NFC-normalised and length counted in code points; default winners = 1, preset = Normal; stored roster size is not capped (only active count is validated).
- **Commands run + observed results:**
  - `npm run typecheck` → pass (no errors).
  - `npm run lint` (oxlint) → 0 warnings after fixes.
  - `npm test` → **5 files, 54 tests passed**.
  - `npm run build` → pass (JS 231 kB / 72 kB gzip, CSS 5 kB).
  - `npm run e2e` (Edge, production build via `vite preview`) → **1 passed**. Two earlier runs failed on test-locator ambiguity (fixed with `exact: true`), not app bugs.
  - Manual: dev server in browser pane; pasted 12 names; layout, rejection feedback and roster grid render correctly at 800 px width.
- **Unrun checks:** Playwright bundled Chromium not installed (needs ~150 MB download; Edge used instead); no screen-reader pass; no check at 32 names or on a projector/screenshare.
- **Risks / notes:** 20-char limit rejects many full Vietnamese names (e.g. "Nguyễn Thị Phương Thảo Vy" = 25). Hosts must use short names, or the owner can revisit D5. A corrupt/repaired notice re-appears on each load until the first setup change re-saves clean data.
- **Build/run condition at handoff:** builds and runs (`npm run dev`); all automated checks green.
- **Next exact action:** owner review of Phase 1 → (optional) commit → start Phase 2 with `npm test` green as baseline.

---

### 2026-10-09 — Specification consolidation
- **Objective:** Reconcile all interview rounds and final owner approvals; prepare the three Markdown source-of-truth documents only.
- **Code changes:** None. **Tests:** none (no application). **Deployment:** none.
- **Risks:** W+1 finale may run long with repeated RPS ties. Browser-only data does not sync between devices.

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
