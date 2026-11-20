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
  assert.equal(contract.contract_version, '1.0');
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
  assert.notEqual(cli(['--seed', '1', '--night', '2', '--ticks', '5', '--out', path.join(tmp, 'y')]).status, 0);
});
