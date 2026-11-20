---
name: verify
description: Run the game's verification and regenerate proof for the current phase. Use after changing gameplay, the headless CLI, or tuning, and before tagging a phase.
---

1. `npm test` — unit + CLI tests. All must pass.
2. `npm run proof` — runs each scenario in `scenarios/` through the real headless CLI,
   checks expected outcomes and determinism, rewrites `docs/proof/phase-N/summary.md` + `.jsonl` outputs.
   Exit 1 means a requirement is not met: fix code, never edit the proof files by hand.
3. GUI check (things only visible on screen): `npm start`, open the page; if the browser tab is hidden,
   drive it with `window.__ddl` (`__ddl.game.step(input)`, `__ddl.draw()`) and screenshot.
   Save screenshots as `docs/proof/phase-N/gui-*.jpg` and say in `summary`/notes which requirement each shows.
4. For a new requirement: add a scenario (`scenarios/<name>.scenario.json` + `.inputs.json`) and a `check(...)` in `scripts/proof.js`.
5. Report honestly: anything not met is written as "CHƯA ĐẠT" with the reason in `docs/notes/phase-N.md`.
