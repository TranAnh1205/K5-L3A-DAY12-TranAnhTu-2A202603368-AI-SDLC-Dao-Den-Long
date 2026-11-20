#!/usr/bin/env node
// Headless runner — Test Contract v1.1.
// node src/headless.js --seed <int> --night 1|2|3 [--scenario f] [--inputs f] --ticks <int> --out <f.jsonl> [--snapshot-every n]
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
    if (v === undefined || (v.startsWith('--') && !/^--?\d/.test(v))) throw new Error(`missing value for ${k}`);
    a[k.slice(2)] = v;
    i++;
  }
  const int = (name, req, def) => {
    if (a[name] === undefined) { if (req) throw new Error(`--${name} is required`); return def; }
    if (!/^-?\d+$/.test(a[name])) throw new Error(`--${name} must be an integer`);
    return parseInt(a[name], 10);
  };
  const opts = {
    seed: int('seed', true), night: int('night', true), ticks: int('ticks', true),
    snapshotEvery: int('snapshot-every', false, 10), out: a.out, scenario: a.scenario, inputs: a.inputs,
  };
  if (!opts.out) throw new Error('--out is required');
  if (![1, 2, 3].includes(opts.night)) throw new Error(`night ${opts.night} not supported (1, 2 or 3)`);
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
const isNat = (x) => Number.isInteger(x) && x >= 0;

export function validateInputs(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.frames)) throw new FormatError('inputs: "frames" array required');
  let last = -1;
  for (const [i, f] of obj.frames.entries()) {
    if (!f || typeof f !== 'object') throw new FormatError(`inputs: frame ${i} is not an object`);
    if (!isNat(f.tick)) throw new FormatError(`inputs: frame ${i} tick must be a non-negative integer`);
    if (f.tick <= last) throw new FormatError(`inputs: frame ${i} tick ${f.tick} not strictly increasing`);
    last = f.tick;
    if ('move' in f && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((v) => isNum(v) && v >= -1 && v <= 1)))
      throw new FormatError(`inputs: frame ${i} move must be [x,z] with values in [-1,1]`);
    if ('cam_yaw_deg' in f && !isNum(f.cam_yaw_deg)) throw new FormatError(`inputs: frame ${i} cam_yaw_deg must be a number`);
    for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause'])
      if (b in f && typeof f[b] !== 'boolean') throw new FormatError(`inputs: frame ${i} ${b} must be boolean`);
  }
  return obj.frames;
}

export function validateScenario(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) throw new FormatError('scenario: must be an object');
  const bad = (m) => { throw new FormatError(`scenario: ${m}`); };
  const arr = (k) => { if (s[k] !== undefined && !Array.isArray(s[k])) bad(`${k} must be an array`); };
  if (s.player !== undefined) {
    if (typeof s.player !== 'object' || s.player === null) bad('player must be an object');
    if (s.player.pos !== undefined && !isVec3(s.player.pos)) bad('player.pos must be [x,y,z]');
    for (const k of ['carried', 'flames', 'invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights'])
      if (s.player[k] !== undefined && !isNat(s.player[k])) bad(`player.${k} must be a non-negative integer`);
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'])
    if (s[k] !== undefined && typeof s[k] !== 'boolean') bad(`${k} must be boolean`);
  for (const k of ['motes', 'shades', 'lanterns', 'drifters', 'charms']) arr(k);
  for (const m of s.motes || []) if (!isVec3(m) && !(m && isVec3(m.pos))) bad('each mote must be [x,y,z] or {pos}');
  for (const sh of s.shades || []) {
    if (!sh || !isVec3(sh.pos)) bad('each shade needs pos [x,y,z]');
    if (sh.id !== undefined && typeof sh.id !== 'string') bad('shade id must be a string');
    if (sh.state !== undefined && !['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'].includes(sh.state)) bad(`shade state ${sh.state} unknown`);
    if (sh.state_ticks_left !== undefined && !isNat(sh.state_ticks_left)) bad('shade state_ticks_left must be a non-negative integer');
    if (sh.target_lantern_id !== undefined && typeof sh.target_lantern_id !== 'string') bad('shade target_lantern_id must be a string');
  }
  for (const d of s.drifters || []) {
    if (!d || !isVec3(d.pos)) bad('each drifter needs pos [x,y,z]');
    if (d.state !== undefined && !['idle', 'chase', 'flee'].includes(d.state)) bad(`drifter state ${d.state} unknown`);
    for (const k of ['state_ticks_left', 'stolen']) if (d[k] !== undefined && !isNat(d[k])) bad(`drifter ${k} must be a non-negative integer`);
  }
  for (const c of s.charms || []) {
    if (!c || typeof c !== 'object') bad('each charm must be an object');
    if (c.pos !== undefined && !isVec3(c.pos)) bad('charm pos must be [x,y,z]');
    if (c.available !== undefined && typeof c.available !== 'boolean') bad('charm available must be boolean');
  }
  for (const l of s.lanterns || []) {
    if (!l || typeof l.id !== 'string') bad('each lantern needs a string id');
    if (l.pos !== undefined && !isVec3(l.pos)) bad(`lantern ${l.id} pos must be [x,y,z]`);
    if (l.deposited !== undefined && !isNat(l.deposited)) bad(`lantern ${l.id} deposited must be a non-negative integer`);
    if (l.lit !== undefined && typeof l.lit !== 'boolean') bad(`lantern ${l.id} lit must be boolean`);
    if (l.fuel !== undefined && !(isNum(l.fuel) && l.fuel >= 0)) bad(`lantern ${l.id} fuel must be a non-negative number`);
    if (l.ever_lit !== undefined && typeof l.ever_lit !== 'boolean') bad(`lantern ${l.id} ever_lit must be boolean`);
    if (l.relit_count !== undefined && !isNat(l.relit_count)) bad(`lantern ${l.id} relit_count must be a non-negative integer`);
  }
  if (s.time_left_s !== undefined && !(isNum(s.time_left_s) && s.time_left_s >= 0)) bad('time_left_s must be a non-negative number');
  return s;
}

export function run({ seed, night = 1, scenario = null, frames = [], ticks, snapshotEvery = 10 }) {
  const game = new Game({ seed, night, scenario });
  const lines = [];
  const push = (o) => lines.push(JSON.stringify(o));
  push(game.snapshot());
  push({ type: 'event', tick: 0, name: 'night_start', data: { night } });
  const input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let fi = 0;
  for (let k = 0; k < ticks && !game.over; k++) {
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
    fs.writeFileSync(opts.out, run({ seed: opts.seed, night: opts.night, scenario, frames, ticks: opts.ticks, snapshotEvery: opts.snapshotEvery }));
  } catch (e) {
    fail(e.message, e instanceof FormatError ? 2 : 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
