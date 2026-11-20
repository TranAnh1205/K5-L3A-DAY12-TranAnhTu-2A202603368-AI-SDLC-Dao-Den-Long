import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim.js';
import { run } from '../src/headless.js';
import { TUNING as T } from '../src/tuning.js';

const empty = (extra = {}) => ({ random_motes: false, random_shades: false, motes: [], shades: [], ...extra });
const parse = (out) => out.trim().split('\n').map((l) => JSON.parse(l));
const events = (lines, name) => lines.filter((l) => l.type === 'event' && l.name === name);
const steps = (g, n, input = {}) => { for (let i = 0; i < n; i++) g.step(input); };

test('tick 0 snapshot is the scenario state; player starts at origin', () => {
  const lines = parse(run({ seed: 1, ticks: 0 }));
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  assert.deepEqual(lines[0].player.pos, [0, 0, 0]);
  assert.equal(lines[0].lanterns.length, 5);
  assert.equal(lines[0].time_left_s, T.night1_duration_s);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 0, state: 'playing', score: 0 });
});

test('snapshots every N ticks, --ticks N runs exactly N steps, time_left = duration - N/60', () => {
  const lines = parse(run({ seed: 3, scenario: empty(), ticks: 90, snapshotEvery: 30 }));
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 30, 60, 90]);
  assert.equal(lines.find((l) => l.tick === 90 && l.type === 'snapshot').time_left_s, 298.5);
  assert.equal(lines.at(-1).ticks, 90);
});

test('determinism: same seed/scenario/inputs gives identical output; different seed differs', () => {
  const frames = [{ tick: 0, move: [1, 1], cam_yaw_deg: 30 }, { tick: 200, pulse: true }, { tick: 201, pulse: false }];
  const a = run({ seed: 42, frames, ticks: 3000 });
  const b = run({ seed: 42, frames, ticks: 3000 });
  const c = run({ seed: 43, frames, ticks: 3000 });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('movement: speed and cam_yaw rotation follow the contract formula', () => {
  const g = new Game({ scenario: empty() });
  steps(g, 60, { move: [0, 1], cam_yaw_deg: 0 });
  assert.ok(Math.abs(g.player.pos[2] - T.player_speed) < 1e-9);
  const h = new Game({ scenario: empty() });
  steps(h, 60, { move: [0, 1], cam_yaw_deg: 90 }); // x' = z·sin90 = 1
  assert.ok(Math.abs(h.player.pos[0] - T.player_speed) < 1e-9 && Math.abs(h.player.pos[2]) < 1e-9);
  const d = new Game({ scenario: empty() });
  steps(d, 60, { move: [1, 1] }); // normalised
  assert.ok(Math.abs(Math.hypot(d.player.pos[0], d.player.pos[2]) - T.player_speed) < 1e-9);
});

test('pickup within pickup_radius (inclusive), respects carry_capacity, scores per_mote', () => {
  const g = new Game({ scenario: empty({ motes: [[T.pickup_radius, 0, 0], [0, 0, T.pickup_radius + 0.01]] }) });
  const ev = g.step({});
  assert.equal(ev.filter((e) => e.name === 'mote_picked').length, 1);
  assert.equal(g.player.carried, 1);
  assert.equal(g.score, T.score.per_mote);
  const full = new Game({ scenario: empty({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }) });
  full.step({});
  assert.equal(full.player.carried, T.carry_capacity);
  assert.equal(full.motes.length, 1);
});

test('interact deposits up to lantern_cost, lights lantern once, scenario lit gives no points', () => {
  const g = new Game({ scenario: empty({ player: { carried: 7 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius], deposited: 5 }, { id: 'L2', lit: true }] }) });
  assert.equal(g.score, 0);
  const ev = g.step({ interact: true });
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit']);
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: 5, deposited: 10 });
  assert.equal(ev[0].tick, 1);
  assert.equal(g.player.carried, 2);
  assert.equal(g.score, T.score.per_lantern);
  assert.equal(g.step({ interact: true }).length, 0, 'held button does not retrigger');
});

test('interact out of range does nothing', () => {
  const g = new Game({ scenario: empty({ player: { carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, T.interact_radius + 0.01] }] }) });
  assert.equal(g.step({ interact: true }).length, 0);
});

test('lighting the last lantern wins with time and flame bonus', () => {
  const lanterns = ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true })).concat([{ id: 'L5', pos: [0, 0, 1], deposited: 9 }]);
  const lines = parse(run({ seed: 1, scenario: empty({ player: { carried: 1 }, lanterns, time_left_s: 100 }), frames: [{ tick: 0, interact: true }], ticks: 50 }));
  const over = events(lines, 'game_over')[0];
  assert.deepEqual(over.data, { result: 'won', reason: 'all_lit' });
  const end = lines.at(-1);
  assert.equal(end.state, 'won');
  assert.equal(end.ticks, 1);
  // time_left after 1 step = 99.983 -> floor 99
  assert.equal(end.score, T.score.per_lantern + 99 * T.score.per_second_left + 3 * T.score.per_flame_left);
});

test('pulse stuns shades in radius, pushes them, costs light, scores per_stun, has cooldown', () => {
  const g = new Game({ scenario: empty({ player: { carried: 5 }, shades: [{ id: 'A', pos: [T.pulse_radius, 0, 0] }, { id: 'B', pos: [0, 0, -T.pulse_radius - 0.5] }] }) });
  const ev = g.step({ pulse: true });
  assert.deepEqual(ev.find((e) => e.name === 'pulse').data, { stunned_ids: ['A'] });
  assert.equal(g.player.carried, 5 - T.pulse_cost);
  assert.equal(g.score, T.score.per_stun);
  assert.equal(g.shades[0].pos[0], T.pulse_radius + T.pulse_push_m);
  assert.equal(g.snapshot().shades[0].state, 'stunned');
  g.step({ pulse: false });
  assert.equal(g.step({ pulse: true }).filter((e) => e.name === 'pulse').length, 0, 'cooldown');
  const pos = [...g.shades[0].pos];
  steps(g, Math.round(T.pulse_stun_s * 60) - 5);
  assert.deepEqual(g.shades[0].pos, pos, 'stunned shade does not move');
  steps(g, 10);
  assert.equal(g.snapshot().shades[0].state, 'chase');
});

test('pulse without enough light fails silently', () => {
  const g = new Game({ scenario: empty({ player: { carried: T.pulse_cost - 1 }, shades: [{ pos: [1, 0, 0] }] }) });
  assert.equal(g.step({ pulse: true }).filter((e) => e.name === 'pulse').length, 0);
});

test('shade hit: lose a flame, drop carried by ratio, invulnerability window, lose at 0 flames', () => {
  const g = new Game({ scenario: empty({ player: { carried: 5, flames: 2 }, shades: [{ id: 'S9', pos: [0.5, 0, 0] }] }) });
  const ev = g.step({});
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 1, dropped: Math.floor(5 * T.hit_drop_ratio) } });
  const inv = Math.round(T.invuln_s * 60);
  let hitAt = null;
  for (let i = 0; i < inv + 5 && !hitAt; i++) if (g.step({}).some((e) => e.name === 'player_hit')) hitAt = g.tick;
  assert.equal(hitAt, 1 + inv);
  assert.equal(g.state, 'lost');
  assert.deepEqual(g.result, { result: 'lost', reason: 'no_flames' });
});

test('shades chase at shade_speed and never enter safe_radius of a lantern', () => {
  const g = new Game({ scenario: empty({ shades: [{ pos: [10, 0, 0] }] }) });
  g.step({});
  assert.ok(Math.abs(g.shades[0].pos[0] - (10 - T.shade_speed / 60)) < 1e-9);
  const s = new Game({ scenario: empty({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20] }], shades: [{ pos: [0, 0, 35] }] }) });
  for (let i = 0; i < 600; i++) {
    const ev = s.step({});
    assert.equal(ev.filter((e) => e.name === 'player_hit').length, 0);
    assert.ok(Math.hypot(s.shades[0].pos[0], s.shades[0].pos[2] - 20) > T.safe_radius);
  }
});

test('dawn: time runs out -> lost/dawn', () => {
  const lines = parse(run({ seed: 1, scenario: empty({ time_left_s: 1 }), ticks: 1000 }));
  assert.deepEqual(events(lines, 'game_over')[0], { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 60, state: 'lost', score: 0 });
});

test('default game spawns motes and shades with unique ids; later shades emit shade_spawned', () => {
  const lines = parse(run({ seed: 5, scenario: { player: { flames: 999 } }, ticks: 2500, snapshotEvery: 2500 })); // survive long enough
  assert.ok(lines[0].motes_active > 0 && lines[0].shades.length > 0);
  const spawned = events(lines, 'shade_spawned');
  assert.ok(spawned.length >= 1);
  const ids = lines.at(-2).shades.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('scenario shade ids are kept and auto ids avoid collisions', () => {
  const g = new Game({ scenario: { random_motes: false, shades: [{ pos: [30, 0, 0] }, { id: 'S1', pos: [-30, 0, 0] }] } });
  assert.deepEqual(g.shades.map((s) => s.id), ['S2', 'S1']);
});
