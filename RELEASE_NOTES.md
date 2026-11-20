# v1.0.0 — Đảo Đèn Lồng

**GitHub Release notes for tag `phase-4`**

Full release completing all four phases of the AI SDLC Day 12 lab.

## Phase 4 (this release)

**Benchmark CLI** — `npm run bench`
```
node src/bench.js --seed 42 --duration 30 --out bench.json
```
Runs the headless sim with 200 shades, 100 motes, 3 lit lanterns.
Reports: avg_fps, p1_low_fps, frame_ms_p95, load_ms, peak_mem_mb.

**Soak test CLI** — `npm run soak`
```
node src/soak.js --seed 7 --nights 10 --out soak.json
```
Runs N nights sequentially. Checks for crashes and heap memory growth.

**Leaderboard** — `src/leaderboard.js`
- File-backed JSON, top-10 by score descending
- `node src/headless.js ... --export-leaderboard lb.json --player-name YourName`

**Accessibility** (GUI only)
- Base font 18px; large-font toggle (22px)
- Reduce-motion toggle (suppresses all CSS animations)
- Full key rebinding UI in Settings — jump, pulse, dash, interact, pause
- ARIA labels on all range inputs and keybindings group
- Settings persisted in localStorage

## Setup & play
```
npm install
npm start      # GUI at http://localhost:8080
npm test       # 65 tests, all green
npm run bench  # headless benchmark
npm run soak   # 10-night soak test
```

## Previous phases
- **Phase 1**: core simulation, 3 islands, shade AI, pulse, dash, drifters, charms
- **Phase 2**: UI overhaul — lit lanterns, Vietnamese font, minimap, animated sky
- **Phase 3**: fuel system, drain state, dawn_survived win condition (contract v1.3)
