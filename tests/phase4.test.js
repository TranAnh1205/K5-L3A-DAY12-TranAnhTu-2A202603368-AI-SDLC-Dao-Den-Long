import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p4-'));
const run = (file, args) => spawnSync(process.execPath, [file, ...args], { cwd: root, encoding: 'utf8' });

// ---------------------------------------------------------------- bench.js
test('bench: exits 0, produces valid JSON with required fields', () => {
  const out = path.join(tmp, 'bench.json');
  const r = run('src/bench.js', ['--seed', '1', '--duration', '5', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  for (const k of ['avg_fps', 'p1_low_fps', 'frame_ms_p95', 'load_ms', 'peak_mem_mb', 'frames'])
    assert.ok(typeof j[k] === 'number' && isFinite(j[k]), `${k} = ${j[k]}`);
  assert.ok(j.avg_fps >= 60, `avg_fps=${j.avg_fps} should be >= 60 headless`);
  assert.equal(j.frames, 5 * 60);
});

test('bench: --duration must be >= 1; missing --out exits non-zero', () => {
  assert.notEqual(run('src/bench.js', ['--seed', '1', '--duration', '0', '--out', path.join(tmp, 'x.json')]).status, 0);
  assert.notEqual(run('src/bench.js', ['--seed', '1', '--duration', '5']).status, 0);
});

// ---------------------------------------------------------------- soak.js
test('soak: exits 0, passed=true, crashes=0, mem_ok=true for 5 nights', () => {
  const out = path.join(tmp, 'soak.json');
  const r = run('src/soak.js', ['--seed', '7', '--nights', '5', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.ok(j.passed, `passed=${j.passed} crashes=${j.crashes} mem_ratio=${j.mem_ratio}`);
  assert.equal(j.crashes, 0);
  assert.ok(j.mem_ok, `mem_ratio=${j.mem_ratio}`);
  assert.equal(j.nights_detail.length, 5);
});

test('soak: missing --out exits non-zero', () => {
  assert.notEqual(run('src/soak.js', ['--seed', '1', '--nights', '3']).status, 0);
});

// ---------------------------------------------------------------- leaderboard.js
test('leaderboard: addEntry keeps top-10 sorted by score descending', async () => {
  const { addEntry, getTop } = await import('../src/leaderboard.js');
  const f = path.join(tmp, 'lb.json');
  for (let i = 1; i <= 12; i++) addEntry({ name: `P${i}`, score: i * 7, night: 1, seed: i, reason: 'won' }, f);
  const top = getTop(f);
  assert.equal(top.length, 10);
  assert.equal(top[0].score, 84); // 12 * 7
  assert.equal(top[9].score, 21); // 3 * 7
  for (let i = 0; i < top.length - 1; i++) assert.ok(top[i].score >= top[i + 1].score);
});

test('leaderboard: addEntry throws on non-finite score', async () => {
  const { addEntry } = await import('../src/leaderboard.js');
  const f = path.join(tmp, 'lb2.json');
  assert.throws(() => addEntry({ name: 'x', score: NaN, night: 1, seed: 1, reason: 'x' }, f));
});

// ---------------------------------------------------------------- headless: --export-leaderboard
test('headless: --export-leaderboard writes top-10 to file and prints it', () => {
  const lbFile = path.join(tmp, 'hl.json');
  const out = path.join(tmp, 'hl.jsonl');
  const r = run('src/headless.js', ['--seed', '1', '--night', '1', '--ticks', '600', '--out', out, '--export-leaderboard', lbFile, '--player-name', 'TestPlayer']);
  assert.equal(r.status, 0, r.stderr);
  const top = JSON.parse(fs.readFileSync(lbFile, 'utf8'));
  assert.ok(Array.isArray(top) && top.length >= 1);
  assert.equal(top[0].name, 'TestPlayer');
  assert.ok(r.stdout.includes('TestPlayer'));
});
