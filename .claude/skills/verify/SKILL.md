---
name: verify
description: Run the game's verification and regenerate proof for the current phase. Use after changing gameplay, maps, the headless CLI or tuning, and before tagging a phase.
---

1. `npm test` — unit + CLI tests (all rules, all 3 nights, contract tuning match, full-night timing). Must be green.
2. `npm run proof` — writes every scenario to `scenarios/`, runs it through the real headless CLI, checks the expected outcome,
   checks determinism (3 nights) and full-night run time (<= 30 s), rewrites `docs/proof/phase-N/summary.md` + `.jsonl`.
   Exit 1 = a requirement is not met: fix the code (or the wrong expectation, with a reason in the notes). Never edit proof files by hand.
3. GUI (things only visible on screen): `npm start`; with the hidden browser pane use `window.__ddl`
   (`__ddl.begin(2)`, `__ddl.game.step({...})`, `__ddl.draw()`), then screenshot at scale 0.6 → `docs/proof/phase-N/gui-*.jpg`.
4. FPS at 1280x720: `resize_window 1280x720`, `show_pane preview`, then count `requestAnimationFrame` ticks for 2 s with W held.
   Do not trust `__ddl.benchmark()` (CPU submit time only) or numbers taken while the pane is hidden.
5. Report honestly: anything not met is "CHƯA ĐẠT" with the reason in `docs/notes/phase-N.md`.
