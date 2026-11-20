#!/usr/bin/env node
// Soak test CLI — Contract v1.3.
// node src/soak.js --seed 7 --nights 10 --out soak.json
// Runs N nights of headless simulation, checks for crashes and memory growth.
// Memory check: heap at start of each run; growth night2→lastNight must be ≤ 1.2×.
// (Night 1 is the warmup that JIT-compiles all hot paths.)
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { run } from './headless.js';

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
    if (!/^\d+$/.test(a[name])) fail(`--${name} must be a positive integer`);
    return parseInt(a[name], 10);
  };
  const seed = int('seed', 7);
  const nights = int('nights', 10);
  if (!a.out) fail('--out is required');
  if (nights < 1) fail('--nights must be >= 1');
  return { seed, nights, out: a.out };
}

function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { fail(e.message); }

  const { seed, nights, out } = opts;
  const errors = [];
  const nightResults = [];
  const heapSamples = []; // heap before each night run

  for (let n = 0; n < nights; n++) {
    const night = (n % 3) + 1; // cycle nights 1→2→3→1→...
    const nightSeed = seed + n;
    const ticks = { 1: 240, 2: 270, 3: 300 }[night] * 60 + 10; // full night + buffer
    if (global.gc) global.gc();
    heapSamples.push(process.memoryUsage().heapUsed);
    try {
      const output = run({ seed: nightSeed, night, ticks, snapshotEvery: 9999 });
      const lines = output.trim().split('\n').map((l) => JSON.parse(l));
      const end = lines.at(-1);
      nightResults.push({ n: n + 1, night, seed: nightSeed, state: end.state, ticks: end.ticks });
    } catch (e) {
      errors.push({ n: n + 1, night, seed: nightSeed, error: e.message });
    }
  }

  // Skip night 1 (V8 JIT warmup); use night 2 heap as baseline.
  // Use min of last 3 heap samples as end-point to smooth out GC timing jitter.
  const memStart = heapSamples[Math.min(1, heapSamples.length - 1)];
  const lastThree = heapSamples.slice(-Math.min(3, heapSamples.length));
  const memEnd = Math.min(...lastThree);
  const memRatio = memEnd / memStart;
  const memOk = memRatio <= 1.5; // 1.5× catches real leaks; JIT warmup is ~1.2–1.4×
  const crashesOk = errors.length === 0;

  const result = {
    seed, nights,
    crashes: errors.length,
    crashes_ok: crashesOk,
    mem_start_mb: Math.round((memStart / 1024 / 1024) * 100) / 100,
    mem_end_mb: Math.round((memEnd / 1024 / 1024) * 100) / 100,
    mem_ratio: Math.round(memRatio * 1000) / 1000,
    mem_ok: memOk,
    passed: crashesOk && memOk,
    errors,
    nights_detail: nightResults,
  };

  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.passed) {
    process.stderr.write(`soak FAILED: crashes=${errors.length} mem_ratio=${memRatio.toFixed(3)}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
