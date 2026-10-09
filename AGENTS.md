# AGENTS.md — KOF / King of Fate

**Status:** Approved agent operating framework. Implementation progress lives in `PROJECT_STATUS.md`.

## Mission
Deliver the retro arcade-inspired office randomizer defined in [`PROJECT.md`](PROJECT.md), as seven independently runnable, tested phases. Maintain [`PROJECT_STATUS.md`](PROJECT_STATUS.md) as a truthful session-to-session handover. **Do not change game mechanics or product design without user approval.**

## Authority and precedence
1. Latest **explicitly approved user decisions**, as incorporated into `PROJECT.md`, control product requirements.
2. `PROJECT.md` defines what must work and what remains open.
3. `AGENTS.md` defines development process and restrictions.
4. `PROJECT_STATUS.md` describes what has been implemented and verified. It does **not** override design rules.
5. Inferred suggestions/open decisions (D1–D6) are not approved; flag them when a phase depends on them.

If documents conflict, **stop for clarification on the material conflict**. Do not choose whichever interpretation is easiest to code.

## Before every coding session
1. Read `PROJECT.md`, `AGENTS.md`, and `PROJECT_STATUS.md` completely.
2. Confirm current phase, accepted decisions, and unfinished tasks.
3. Identify open decisions that block your phase; ask before permanently implementing unapproved choices.
4. Make a minimal, testable plan limited to the current phase. Technical prerequisites may be added if needed and documented.
5. Do not claim prior work exists unless files/tests actually verify it.

## Core architecture principles
- React + TypeScript + Vite; deployable to a static Vercel public URL. No backend or login in MVP.
- **Pure TypeScript game engine** independent of React and animation code; explicit game-state transitions; typed immutable data/events where practical.
- Separate RNG, Fate pool, turn resolution, RPS scoring, persistence and presentation.
- Production random choices via unbiased `crypto.getRandomValues`-based bounded sampling; test RNG must support deterministic seed/input injection.
- **Determine and commit outcomes before animation;** rendering, visual shuffles and audio timing must never change probability or reroll results.
- Match state recovery must never reapply a committed elimination, shield change, score or victory. Use event IDs, persistence checkpoints and idempotent completion.
- Prefer small, well-typed modules over one large React component. No external licensed art, sound or fonts committed without proof of permitted use.
- Use robust browser audio start/unlock behavior and a graceful no-audio fallback. Avoid unnecessary large dependencies.

## Nonnegotiable game invariants
- `2 <= N <= 32`; `1 <= W <= 5`; `N >= W+1` at start.
- Each ordinary player spin samples uniformly among living players, independently of previous turns. Fate samples one of 20 equal-odds slots.
- Player, then Fate (then VS opponent) cursors, each a random 2.5–6.5 seconds; the Fate cursor may start midway through the player spin but always stops after the player is revealed (owner decisions 2026-10-09); they stop at already-sampled results.
- KO consumes Shield instead of killing; Shield cap = 1; duplicate Shield Fate is wasted.
- VS randomly selects another living participant, rethrows identical RPS until decisive; loser spends Shield or is eliminated; winner obtains Shield unless already protected, the supply is empty, or Sudden Death.
- Shields are a limited supply of `ceil(N/5)` per match; each Shield earned (Fate or VS win) uses one; when empty, Shield slots become KO (owner decision 2026-10-09).
- Sudden Death starts when the living count drops to **`round(N/3)`** (owner decision 2026-10-09, replaces the 3-turn streak). All Shields shatter; no fresh Shields; D1 approved odds apply.
- Finale starts immediately when living count becomes `W+1`, including a match starting at that count. Shields are removed. No normal Fate spins in finale.
- Finale is automated chant-driven RPS, first to 3; resolve draws and oversubscribed qualifiers according to `PROJECT.md`, subject to D2/D3 approval. Exactly W people win.
- Never add hidden rigging/control into MVP. Never disguise nonfair outcomes as fair.
- No Undo. Match results commit once before victory animation. Return to setup afterward.

## Phased delivery and scope discipline
- **Phase 1:** Project foundation + setup/attendance + local configuration.
- **Phase 2:** KO-only playable core + basic recovery/logs.
- **Phase 3:** KO/VS/Shield + Fate cursor + normal RPS + Sudden Death/probability verification.
- **Phase 4:** Mandatory Vietnamese RPS finale + winner ceremony = feature-complete gameplay MVP.
- **Phase 5:** Retro sprite/FX/audio/shortcut polish.
- **Phase 6:** Detailed match history, statistics and CSV/JSON export.
- **Phase 7:** Hardening, regression, accessibility/performance and Vercel deployment.

Keep each phase runnable and independently tested. Do not start unrelated future-phase work merely because it is interesting. Technical refactoring within the agreed architecture is allowed; new Fates, cheating features, mobile redesigns, server sync or gameplay alterations are not.

## Tests and verification
For every phase, run (when relevant):
- Typecheck and production build.
- Unit tests for pure state transitions and RPS, including edge cases.
- React/UI integration tests for current-phase flows.
- Playwright smoke/E2E for applicable browser features.
- Seeded probability simulations: uniform eligible-player selection, exact Fate-slot weights, parity of RPS outcomes. Define nonflaky statistical tolerances.
- Persistence/reload tests, especially **refresh during animation and before victory**.
- Manual review of layout, accessibility, keyboard-focus guards and audio fallback.

Never say tests passed unless they actually ran and passed. If tests cannot run, state exactly why and what is unverified. Resolve regressions before declaring a phase complete.

## Requirement changes and owner approvals
- **Allowed without approval:** internal naming, TypeScript types, utility abstractions, performance fixes preserving behavior, test harness details, implementation-library choices.
- **Approval required:** odds, scoring, winner/tie logic, Sudden Death changes, duration/pacing, UI behavior substantially different from spec, additional Fates, data-retention/security behavior, hidden controls, or substantive phase rescoping.
- Ask a focused question with the conflicting rules, recommended choice and its trade-off. Log the answer in `PROJECT.md` and `PROJECT_STATUS.md`.
- Open decisions in `PROJECT.md` are pending; unapproved sample values must be prominently marked provisional in tests, mockups and code if unavoidable for prototyping.

## Mandatory end-of-session protocol
**Every development session must update `PROJECT_STATUS.md` before the session ends**, even if blocked or no code changed. Record:
1. Date/time, phase, objective and status.
2. Files added/changed and functionality actually completed.
3. Commands/tests run and **observed** results; known unrun checks.
4. Decisions obtained, assumptions made (if any) and pending approvals.
5. Bugs, risks, technical debt and unresolved issues.
6. Exact next task/next command for the following session.
7. Confirm the code still builds/runs, or explain why not.

Update `PROJECT.md` only when an **approved** requirement changes. Keep records concise but verifiable. Do not fabricate commits, tests, deployments or screenshots.

## Definition of done
A task is Done only when acceptance criteria are met, relevant tests actually pass, docs/status are updated and no undisclosed behavioral change exists. A phase is Done only when it leaves a usable running build of all completed phases.
