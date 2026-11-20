# Đảo Đèn Lồng — agent guide

Node >= 22, no build step. ES modules.

## Commands
- Install: `npm install` (only dependency: three)
- Tests: `npm test` (node:test, must be green before finishing — a Stop hook enforces it)
- Proof: `npm run proof` → regenerates `docs/proof/phase-N/` (see skill `verify`)
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- GUI: `npm start` → http://localhost:8080

## Layout
- `src/sim.js` all gameplay logic, deterministic, no DOM. `src/tuning.js` all numbers.
- `src/headless.js` Test Contract CLI. `src/client.js` Three.js view only.
- `game.contract.json` tuning MUST equal `src/tuning.js` (tested).

## Rules
- Contract output format is exact: read the phase doc in `docs/requirements/` before changing `headless.js`/`snapshot()`.
- All randomness via the seeded `this.rng`; never `Math.random`/`Date` in sim.js.
- Gameplay distance = XZ plane, "within r" = `<= r`.
- Visual-only extras go in client.js and must not change headless output.
- Never hand-edit files in `docs/proof/`; regenerate them.
- When a new ticket replaces a rule: update/remove the old test with a one-line reason in `docs/notes/phase-N.md`.
