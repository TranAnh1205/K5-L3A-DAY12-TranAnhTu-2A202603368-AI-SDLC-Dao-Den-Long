# Đảo Đèn Lồng — agent guide (updated for Phase 2, contract v1.1)

Node >= 22, no build step. ES modules.

## Commands
- Install: `npm install` (only dependency: three)
- Tests: `npm test` (node:test; must be green before finishing — a Stop hook enforces it)
- Proof: `npm run proof` → rewrites `scenarios/` + `docs/proof/phase-N/` through the real CLI (skills `verify`, `add-scenario`)
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out/x.jsonl [--scenario f] [--inputs f] [--snapshot-every n]`
- GUI: `npm start` → http://localhost:8080 (preview via `.claude/launch.json`)

## Layout
- `src/sim.js` ALL gameplay, deterministic, no DOM. Per-tick stage order follows the ticket (comments `1.`–`11.` in `step()`); do not reorder.
- `src/tuning.js` standard numbers (`TUNING` = contract block, `RULES` = other ticket constants). `src/maps.js` the 3 maps.
- `src/headless.js` contract CLI + input/scenario validation (bad file → exit 2).
- `src/client.js` UI/flow, `src/scene.js` world meshes, `src/audio.js` WebAudio. These never change headless output.
- `game.contract.json` tuning MUST equal `TUNING` (tested).

## Rules
- Phase docs live in `docs/requirements/`; acceptance criteria in `docs/spec/`. Read the ticket text before changing numbers or formats.
- The ticket's numbers are a standard: never "tune" a value in tuning.js/RULES/maps.js to make a test pass.
- All randomness via the seeded `this.rng`; never `Math.random`/`Date` in sim.js, maps.js, headless.js.
- Angles: x = r·cosθ, z = r·sinθ (θ from +X). Gameplay distances are XZ unless the ticket says 3D; "within r" is `<= r`.
- Check the stage order and tick numbering with a test before trusting a new rule (`tick` counts steps, `sim_tick` excludes paused ones).
- Visual extras go in client/scene/audio only (and must be off in headless).
- Never hand-edit `docs/proof/`; regenerate. New feature = one scenario + one `check()` in `scripts/proof.js` + a test.
- When a ticket replaces a rule: change the old test, and record the one-line reason in `docs/notes/phase-N.md`.
- Windows: write files with the Edit/Write tools, not python/sed with `\n` escapes (a CRLF/escape bug already broke a test file once).
- GUI check when the browser pane is hidden: rAF is paused. Show the pane (`show_pane preview`) before measuring FPS; otherwise drive `window.__ddl` (`begin(n)`, `game.step`, `draw`).
