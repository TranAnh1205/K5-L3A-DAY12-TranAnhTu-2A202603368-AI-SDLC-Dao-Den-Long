import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TUNING } from '../src/tuning.js';

const root = path.resolve(import.meta.dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-'));
const contract = JSON.parse(fs.readFileSync(path.join(root, 'game.contract.json'), 'utf8'));
const cli = (args) => spawnSync(process.execPath, ['src/headless.js', ...args], { cwd: root, encoding: 'utf8' });
const write = (name, obj) => { const f = path.join(tmp, name); fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj)); return f; };

test('game.contract.json tuning equals the numbers the game uses', () => {
  assert.equal(contract.contract_version, '1.1');
  assert.deepEqual(contract.tuning, TUNING);
  assert.equal(contract.headless_cmd, 'node src/headless.js');
});

test('CLI: valid run exits 0, last line is end, two runs byte-identical', () => {
  const a = path.join(tmp, 'a.jsonl'), b = path.join(tmp, 'b.jsonl');
  const args = ['--seed', '11', '--night', '1', '--ticks', '1200', '--snapshot-every', '7'];
  assert.equal(cli([...args, '--out', a]).status, 0);
  assert.equal(cli([...args, '--out', b]).status, 0);
  const A = fs.readFileSync(a, 'utf8');
  assert.equal(A, fs.readFileSync(b, 'utf8'));
  const last = JSON.parse(A.trim().split('\n').at(-1));
  assert.equal(last.type, 'end');
});

test('CLI: malformed inputs/scenario exit 2 with stderr', () => {
  const out = path.join(tmp, 'x.jsonl');
  const base = ['--seed', '1', '--night', '1', '--ticks', '10', '--out', out];
  for (const [flag, content] of [
    ['--inputs', '{not json'],
    ['--inputs', { frames: [{ tick: 3 }, { tick: 2 }] }],
    ['--inputs', { frames: [{ tick: 0, move: [2, 0] }] }],
    ['--inputs', { frames: [{ tick: 0, pulse: 'yes' }] }],
    ['--scenario', { shades: [{ pos: [1, 2] }] }],
    ['--scenario', '[]'],
  ]) {
    const r = cli([...base, flag, write('bad.json', content)]);
    assert.equal(r.status, 2, `${flag} ${JSON.stringify(content)}`);
    assert.match(r.stderr, /error/);
  }
});

test('CLI: bad arguments exit non-zero', () => {
  assert.notEqual(cli(['--seed', '1', '--night', '1', '--out', path.join(tmp, 'y')]).status, 0);
  for (const night of ['0', '4']) assert.notEqual(cli(['--seed', '1', '--night', night, '--ticks', '5', '--out', path.join(tmp, 'y')]).status, 0);
  for (const night of ['1', '2', '3']) assert.equal(cli(['--seed', '1', '--night', night, '--ticks', '5', '--out', path.join(tmp, `n${night}`)]).status, 0);
});

test('CLI: v1.1 inputs (dash, pause) and scenario fields (drifters, charms, flags, ticks) are accepted; bad ones exit 2', () => {
  const out = path.join(tmp, 'v11.jsonl');
  const ok = cli(['--seed', '1', '--night', '2', '--ticks', '30', '--out', out,
    '--inputs', write('i.json', { frames: [{ tick: 0, dash: true }, { tick: 1, dash: false, pause: true }, { tick: 2, pause: false }, { tick: 3, pause: true }, { tick: 4, pause: false }] }),
    '--scenario', write('s.json', { random_drifters: false, wind_enabled: false, player: { invuln_ticks: 5, dash_cd_ticks: 3, pulse_cd_ticks: 4, charm_ticks: 100 },
      shades: [{ id: 'S1', pos: [30, 0, 0], state: 'wander', state_ticks_left: 0 }], drifters: [{ id: 'D1', pos: [5, 1.5, 5], state: 'idle' }], charms: [{ id: 'C1', pos: [35, 0, 0] }] })]);
  assert.equal(ok.status, 0, ok.stderr);
  const lines = fs.readFileSync(out, 'utf8').trim().split(/\r?\n/).map((l) => JSON.parse(l));
  assert.ok(lines.some((l) => l.name === 'dash') && lines.some((l) => l.name === 'paused') && lines.some((l) => l.name === 'resumed'));
  for (const [flag, content] of [['--scenario', { shades: [{ pos: [1, 0, 0], state: 'sleepy' }] }], ['--scenario', { drifters: [{ pos: [1, 0, 0], state: 'x' }] }],
    ['--scenario', { charms: [{ pos: [1, 2] }] }], ['--scenario', { random_drifters: 'no' }], ['--scenario', { player: { charm_ticks: -1 } }], ['--inputs', { frames: [{ tick: 0, pause: 1 }] }]])
    assert.equal(cli(['--seed', '1', '--night', '1', '--ticks', '5', '--out', out, flag, write('bad2.json', content)]).status, 2, `${flag} ${JSON.stringify(content)}`);
});

test('performance: a full night (21600 ticks) finishes headless in well under 30 s on every night', () => {
  const long = write('long.json', { player: { flames: 999 } });
  for (const night of ['1', '2', '3']) {
    const t0 = Date.now();
    const r = cli(['--seed', '5', '--night', night, '--scenario', long, '--ticks', '21600', '--out', path.join(tmp, `p${night}.jsonl`)]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(Date.now() - t0 < 30000, `night ${night} took ${Date.now() - t0} ms`);
  }
});
