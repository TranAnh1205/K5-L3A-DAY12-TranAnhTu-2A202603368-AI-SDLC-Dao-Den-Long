#!/usr/bin/env node
// Headless runner — Test Contract v1.0.
// node src/headless.js --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out <f.jsonl> [--snapshot-every n]
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Game } from './sim.js';

class FormatError extends Error {}

function fail(msg, code) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new Error(`unexpected argument ${k}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`missing value for ${k}`);
    a[k.slice(2)] = v;
    i++;
  }
  const int = (name, req, def) => {
    if (a[name] === undefined) { if (req) throw new Error(`--${name} is required`); return def; }
    if (!/^-?\d+$/.test(a[name])) throw new Error(`--${name} must be an integer`);
    return parseInt(a[name], 10);
  };
  const opts = {
    seed: int('seed', true),
    night: int('night', true),
    ticks: int('ticks', true),
    snapshotEvery: int('snapshot-every', false, 10),
    out: a.out,
    scenario: a.scenario,
    inputs: a.inputs,
  };
  if (!opts.out) throw new Error('--out is required');
  if (opts.night !== 1) throw new Error(`night ${opts.night} not supported (only 1)`);
  if (opts.ticks < 0) throw new Error('--ticks must be >= 0');
  if (opts.snapshotEvery < 1) throw new Error('--snapshot-every must be >= 1');
  return opts;
}

function readJson(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { throw new Error(`cannot read ${file}: ${e.message}`); }
  try { return JSON.parse(text); } catch (e) { throw new FormatError(`${file}: invalid JSON (${e.message})`); }
}

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const isVec3 = (x) => Array.isArray(x) && x.length === 3 && x.every(isNum);

export function validateInputs(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.frames)) throw new FormatError('inputs: "frames" array required');
  let last = -1;
  for (const [i, f] of obj.frames.entries()) {
    if (!f || typeof f !== 'object') throw new FormatError(`inputs: frame ${i} is not an object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new FormatError(`inputs: frame ${i} tick must be a non-negative integer`);
    if (f.tick <= last) throw new FormatError(`inputs: frame ${i} tick ${f.tick} not strictly increasing`);
    last = f.tick;
    if ('move' in f && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((v) => isNum(v) && v >= -1 && v <= 1)))
      throw new FormatError(`inputs: frame ${i} move must be [x,z] with values in [-1,1]`);
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) throw new FormatError(`inputs: frame ${i} cam_yaw_deg must be a number`);
    for (const b of ['jump', 'interact', 'pulse', 'dash'])
      if (b in f && typeof f[b] !== 'boolean') throw new FormatError(`inputs: frame ${i} ${b} must be boolean`);
  }
  return obj.frames;
}

export function validateScenario(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new FormatError('scenario: must be an object');
  const bad = (m) => { throw new FormatError(`scenario: ${m}`); };
  if (s.player !== undefined) {
    if (typeof s.player !== 'object' || s.player === null) bad('player must be an object');
    if (s.player.pos !== undefined && !isVec3(s.player.pos)) bad('player.pos must be [x,y,z]');
    for (const k of ['carried', 'flames'])
      if (s.player[k] !== undefined && !(Number.isInteger(s.player[k]) && s.player[k] >= 0)) bad(`player.${k} must be a non-negative integer`);
  }
  for (const k of ['random_motes', 'random_shades']) if (s[k] !== undefined && typeof s[k] !== 'boolean') bad(`${k} must be boolean`);
  if (s.motes !== undefined && !(Array.isArray(s.motes) && s.motes.every(isVec3))) bad('motes must be an array of [x,y,z]');
  if (s.shades !== undefined) {
    if (!Array.isArray(s.shades)) bad('shades must be an array');
    for (const sh of s.shades) {
      if (!sh || !isVec3(sh.pos)) bad('each shade needs pos [x,y,z]');
      if (sh.id !== undefined && typeof sh.id !== 'string') bad('shade id must be a string');
    }
  }
  if (s.lanterns !== undefined) {
    if (!Array.isArray(s.lanterns)) bad('lanterns must be an array');
    for (const l of s.lanterns) {
      if (!l || typeof l.id !== 'string') bad('each lantern needs a string id');
      if (l.pos !== undefined && !isVec3(l.pos)) bad(`lantern ${l.id} pos must be [x,y,z]`);
      if (l.deposited !== undefined && !(Number.isInteger(l.deposited) && l.deposited >= 0)) bad(`lantern ${l.id} deposited must be a non-negative integer`);
      if (l.lit !== undefined && typeof l.lit !== 'boolean') bad(`lantern ${l.id} lit must be boolean`);
    }
  }
  if (s.time_left_s !== undefined && !(isNum(s.time_left_s) && s.time_left_s >= 0)) bad('time_left_s must be a non-negative number');
  return s;
}

export function run({ seed, scenario = null, frames = [], ticks, snapshotEvery = 10 }) {
  const game = new Game({ seed, scenario });
  const lines = [];
  const push = (o) => lines.push(JSON.stringify(o));
  push(game.snapshot());
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false };
  let fi = 0;
  for (let k = 0; k < ticks && game.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick === k) { Object.assign(input, frames[fi]); fi++; }
    for (const e of game.step(input)) push(e);
    if (game.tick % snapshotEvery === 0) push(game.snapshot());
  }
  push({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
  return lines.join('\n') + '\n';
}

function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { fail(e.message, 1); }
  try {
    const scenario = opts.scenario ? validateScenario(readJson(opts.scenario)) : null;
    const frames = opts.inputs ? validateInputs(readJson(opts.inputs)) : [];
    const out = run({ seed: opts.seed, scenario, frames, ticks: opts.ticks, snapshotEvery: opts.snapshotEvery });
    fs.writeFileSync(opts.out, out);
  } catch (e) {
    fail(e.message, e instanceof FormatError ? 2 : 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
