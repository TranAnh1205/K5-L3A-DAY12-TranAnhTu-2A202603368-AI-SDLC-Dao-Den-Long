# Phase 3 Notes — TICKET-03 "Đèn Cạn Dầu"

## Assumptions
- Fuel stored as integer ticks (`fuelTicks = fuel × 60`) to avoid float drift; snapshots expose `fuel` in seconds (1 dp via `r1()`).
- "Within r" means `<= r` per CLAUDE.md angle/distance conventions.
- `dawn_survived` replaces `all_lit` entirely; no early-win path remains.
- `successfulLights` counts relights too (every call that sets `lit=true`).

## Design Decisions (ADR)

### ADR-01 Integer fuel ticks
**Why:** Floating-point decay at 1/60 per tick accumulates rounding error over 6000 ticks (~0.3 unit drift). Integer arithmetic is exact.  
**Trade-off:** Snapshot `fuel` field must be re-derived (`fuelTicks / TPS`), but that's a cheap division.

### ADR-02 Safe zone requires fuel ≥ threshold
**Why:** A nearly-dead lantern should not repel shades; this lets drain shades find their target despite the safe zone.  
**Change from Phase 2:** `hasZone()` now checks both `l.lit && l.fuelTicks >= FUEL_THRESHOLD_TICKS`.

### ADR-03 Fuel decay before interact in step() order
**Why:** Step order is frozen at TICKET-02/03 comment labels. Decay is stage 2, interact is stage 5.  
**Consequence:** A lantern starts at fuelMax but is 1 tick below after decay — it becomes a valid refuel target that same tick. Tests must account for this (use fuel=99 not 90 for "needs exactly 1 mote" scenarios).

### ADR-04 Drain shade transitions via lantern_out / interact / player approach
Three exit paths from `drain` state:
1. `lantern_out` processing sets `state='wander'` synchronously.
2. `interact()` refuel crossing threshold sets `state='wander'`.
3. `moveShades()` player within `safe_radius` sets `state='chase'`.
All three clear `drainTarget`.

## Changes vs Phase 2 (breaking)
| Item | Old | New |
|---|---|---|
| Night durations | 300/330/360 s | 240/270/300 s |
| Win condition | `all_lit` (immediate) | `dawn_survived` (ticksLeft=0, litCount≥ceil(0.6×n)) |
| Score per mote | 10 | 5 |
| Score time bonus | +1 per second left | removed |
| Safe zone rule | any lit lantern | lit lantern with fuel ≥ 30 |

## Tests changed / deleted with reasons
- `'tick 0 snapshot: ...'` — updated: added capacity/fuel/ever_lit/relit_count checks; duration assertions 300→240 etc.
- `'snapshot cadence ...'` — updated: time_left at tick 90: 298.5→238.5 (new duration).
- `'win: ...'` — replaced: `all_lit`→`dawn_survived`; score formula.
- `'no early win ...'` — replaced: removed all_lit assertion; added no-early-win + dawn-loss checks.
- `'interact: ... +5 per mote'` — name updated; score calc now ×5 not ×10.
- `'interact picks nearest ...'` — name updated; L1 moved to d=3 (outside interact radius) so fuel-decay edge case doesn't interfere.
