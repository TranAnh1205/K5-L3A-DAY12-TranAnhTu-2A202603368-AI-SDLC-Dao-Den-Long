# Changelog

All notable changes are documented here. Format loosely follows Keep a Changelog.

---

## [Unreleased] — Phase 3 (TICKET-03 "Đèn Cạn Dầu")

### Breaking Changes
- **Win condition**: `all_lit` removed. Win only at dawn (`ticksLeft=0`) with ≥ ceil(0.6 × total) lanterns lit → reason `dawn_survived`.
- **Night durations**: 300/330/360 s → **240/270/300 s** (nights 1/2/3).
- **Score per mote**: 10 → **5** (applies to all deposits including refuel).
- **Time bonus removed**: `per_second_left` score deleted; replaced by dawn bonus.
- **Contract version**: 1.1 → **1.2**.

### New Features
- **Fuel system**: each lit lantern has fuel 0–100, decaying 1/s. Stored as integer ticks to avoid float drift.
- **Refuel**: press E at a lit (not full) lantern to top it up with carried motes.
- **Relight cost**: relighting an ever-lit lantern costs 5 motes (first light still costs 10).
- **Shade drain state**: wander shades target low-fuel lanterns (fuel < 30); drain 5/s when within 2 m.
- **Safe zone rule**: only lanterns with fuel ≥ 30 (threshold) block shades.
- **Dynamic carry capacity**: `min(capacity_max=20, 10 + 2 × successfulLights)`.
- **Dawn bonus scoring**: per lit lantern at dawn = `per_lantern_dawn_base(50) + floor(fuel)` + `per_flame_left(50)` per remaining flame.
- **New score fields**: `per_relight=40`, `per_drain_stun_bonus=15`, `per_lantern_dawn_base=50`.
- **New events**: `lantern_out`, `refuel`, `fuel_drain` (every 60 sim_ticks while draining).
- **New snapshot fields**: `lanterns[].fuel`, `lanterns[].ever_lit`, `lanterns[].relit_count`, `player.capacity`.

### Internal
- `fuelTicks` integer storage (`1 tick = 1/60 fuel unit`).
- `Game.capacity` is a computed getter.
- `hasZone(l)` checks both `lit` and `fuelTicks >= threshold`.
- 10 new Phase-3 tests added; 5 existing tests updated with reasons in `docs/notes/phase-3.md`.

---

## Phase 2 — UI Overhaul & Maps

Bright lit lanterns, detailed May model, minimap, score pops, particles, decorative fireflies, Vietnamese font, 3-night maps.

---

## Phase 1 — Core Gameplay

Deterministic sim (60 TPS, mulberry32 RNG), headless CLI, contract v1.0/v1.1, three map nights, drifters, charms, wind.
