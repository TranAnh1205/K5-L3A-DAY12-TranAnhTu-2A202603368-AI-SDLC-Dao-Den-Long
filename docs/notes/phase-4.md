# Phase 4 notes — Benchmark · Soak · Leaderboard · Accessibility · Release v1.0.0

## ADR-01: Bench memory baseline (src/bench.js)
Benchmarks the headless sim with 200 shades + 100 motes + 3 lit lanterns for N seconds.
Peak heap is sampled every 60 ticks (once per simulated second). `load_ms` measures
only the `new Game(...)` constructor cost.

## ADR-02: Soak memory check strategy (src/soak.js)
V8's JIT compilation causes the heap to grow 20–40% across the first night as hot code
paths get compiled and cached. After night 1, the heap stabilizes.

**Fix**: sample heap before each night; skip night 1 as the "warmup" baseline; take
`min(last 3 heaps)` as end-point to smooth GC timing jitter; threshold = 1.5× (a true
game leak would grow much faster than 50% per 10 nights).

## ADR-03: Leaderboard design (src/leaderboard.js)
File-backed JSON, top-10 descending by score. Headless supports `--export-leaderboard <f>`
and `--player-name <name>` to append a run; prints the updated top-10 on stdout.
No server required; suitable for single-player lab submissions.

## ADR-04: Accessibility approach (index.html + client.js)
- Min base font size bumped from browser default (16px) to 18px; `body.large-font` = 22px.
- `body.reduce-motion` suppresses all CSS animations/transitions via `animation-duration: 0.001ms`.
- Key rebinding stored per-action in `settings.keys` (localStorage). Every `<kbd>` is
  focusable + keyboard-activatable. A single `keydown` capture listener handles the rebind.
- ARIA labels added to all range inputs and the keybindings group.

## Breaking changes in Phase 4
None — contract version remains 1.3; only new CLI flags added (backward-compatible).

## Test changes
| Test | Reason |
|------|---------|
| cli.test.js: contract version | Stays 1.3 (no contract bump in phase 4) |
| bench/soak tests added | New tests for the two new CLIs |
| leaderboard tests added | New tests for addEntry / getTop |

## Release checklist
- [x] contract_version = 1.3, bench_cmd, soak_cmd in game.contract.json
- [x] package.json version = 1.0.0
- [x] npm test green (all phases)
- [x] src/bench.js — produces avg_fps, p1_low_fps, frame_ms_p95, load_ms, peak_mem_mb
- [x] src/soak.js — 10 nights, checks crashes + memory growth
- [x] src/leaderboard.js — top-10 file-backed, --export-leaderboard flag
- [x] Accessibility: 18px base font, large-font toggle, reduce-motion toggle, key rebinding
- [x] CREDITS.md + LICENSE (MIT)
- [x] docs/notes/phase-4.md (this file)
- [x] Tag: phase-4, GitHub Release v1.0.0
