---
name: add-scenario
description: Add a headless scenario plus its proof check for a new or changed requirement. Use whenever a ticket adds a feature (every new feature needs at least one headless scenario).
---

1. Write the expected behaviour as one sentence ("do A → see event B at tick N") in `docs/spec/phase-N-acceptance.md`.
2. In `scripts/proof.js` add `check(group, requirement, how, () => { const {lines} = cli('name', {night, scenario: sc({...}), frames, ticks, every}); ... })`.
   - `sc({...})` = scenario with nothing random (random_motes/shades/drifters false, empty lists); override only what the case needs.
   - Frames use contract inputs (`{tick, move:[x,z], dash, pulse, interact, jump, pause}`); buttons act on false→true edges, so release before pressing again.
   - Events are stamped `tick = step + 1`; `sim_tick` stops while paused. Compute expectations from the ticket's numbers, not from the output.
3. Add a unit test in `tests/sim.test.js` for the same rule when it has edge cases (boundaries, ties, cooldowns).
4. Run `npm test` then `npm run proof`. If the sim disagrees with your expectation, re-read the ticket before changing either side.
