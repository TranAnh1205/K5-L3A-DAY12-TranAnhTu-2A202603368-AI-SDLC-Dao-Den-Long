#!/usr/bin/env node
// Benchmark CLI — Contract v1.3.
// node src/bench.js --seed 42 --duration 30 --out bench.json
// Runs the headless sim with the Phase 4 bench scenario (200 shades, 100 motes, 3 lit lanterns)
// and measures wall-clock step timing to derive FPS / latency metrics.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Game } from './sim.js';

function fail(msg) { process.stderr.write(`error: ${msg}\n`); process.exit(1); }

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) fail(`unexpected argument ${k}`);
    const v = argv[i + 1];
    if (v === undefined || (v.startsWith('--') && !/^--?\d/.test(v))) fail(`missing value for ${k}`);
    a[k.slice(2)] = v; i++;
  }
  const int = (name, def) => {
    if (a[name] === undefined) return def;
    if (!/^-?\d+$/.test(a[name])) fail(`--${name} must be an integer`);
    return parseInt(a[name], 10);
  };
  const seed = int('seed', 42);
  const duration = int('duration', 30);
  if (!a.out) fail('--out is required');
  if (duration < 1) fail('--duration must be >= 1');
  return { seed, duration, out: a.out };
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function runBench({ seed, duration }) {
  // Bench scenario: 200 shades, 100 motes, 3 lit lanterns
  const scenario = {
    random_motes: false, random_shades: false, random_drifters: false,
    player: { flames: 999 },
    lanterns: [
      { id: 'L1', lit: true, pos: [5, 0, 0] },
      { id: 'L2', lit: true, pos: [-5, 0, 0] },
      { id: 'L3', lit: true, pos: [0, 0, 5] },
    ],
    motes: Array.from({ length: 100 }, (_, i) => [Math.cos(i) * 10, 0, Math.sin(i) * 10]),
    shades: Array.from({ length: 200 }, (_, i) => ({
      id: `S${i + 1}`,
      pos: [Math.cos((i / 200) * 2 * Math.PI) * 20, 0, Math.sin((i / 200) * 2 * Math.PI) * 20],
      state: 'wander',
    })),
    drifters: [],
    charms: [],
  };

  const loadStart = performance.now();
  const game = new Game({ seed, night: 1, scenario });
  const loadMs = performance.now() - loadStart;

  const ticks = duration * 60; // 60 TPS
  const frameTimes = [];
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };

  const memStart = process.memoryUsage().heapUsed;
  let memPeak = memStart;

  for (let k = 0; k < ticks; k++) {
    const t0 = performance.now();
    game.step(input);
    frameTimes.push(performance.now() - t0);
    if (k % 60 === 0) {
      const m = process.memoryUsage().heapUsed;
      if (m > memPeak) memPeak = m;
    }
  }

  const avgFrameMs = frameTimes.reduce((s, v) => s + v, 0) / frameTimes.length;
  const avgFps = 1000 / avgFrameMs;
  const p1FrameMs = percentile(frameTimes, 99); // worst 1% frame time
  const p1LowFps = 1000 / p1FrameMs;
  const p95FrameMs = percentile(frameTimes, 95);

  return {
    seed, duration_s: duration, frames: ticks,
    avg_fps: Math.round(avgFps * 10) / 10,
    p1_low_fps: Math.round(p1LowFps * 10) / 10,
    frame_ms_p95: Math.round(p95FrameMs * 1000) / 1000,
    load_ms: Math.round(loadMs * 100) / 100,
    peak_mem_mb: Math.round((memPeak / 1024 / 1024) * 100) / 100,
  };
}

function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { fail(e.message); }
  const result = runBench(opts);
  fs.writeFileSync(opts.out, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
export { runBench };
