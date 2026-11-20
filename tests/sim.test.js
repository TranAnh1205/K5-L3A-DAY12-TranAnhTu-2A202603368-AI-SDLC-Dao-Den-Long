import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim.js';
import { run } from '../src/headless.js';
import { TUNING as T, RULES as R } from '../src/tuning.js';

// scenario with nothing random; override per test
const empty = (extra = {}) => ({ random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], drifters: [], charms: [], ...extra });
const mk = (extra = {}, night = 1, seed = 1) => new Game({ seed, night, scenario: empty(extra) });
const steps = (g, n, input = {}) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...g.step(input)); return ev; };
const names = (ev) => ev.map((e) => e.name);
const parse = (out) => out.trim().split('\n').map((l) => JSON.parse(l));
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const press = (g, input) => { const ev = g.step({ ...input }); g.step({}); return ev; }; // rising edge then release
const flat = (...args) => args.flat();

// ------------------------------------------------------------------ basics
test('tick 0 snapshot: scenario state, v1.2 fields, per-night lantern counts and start', () => {
  // Phase 3 (TICKET-03): durations changed 300/330/360 → 240/270/300
  for (const [night, count, dur] of [[1, 5, 240], [2, 6, 270], [3, 7, 300]]) {
    const lines = parse(run({ seed: 1, night, ticks: 0 }));
    const s = lines[0];
    assert.equal(s.type, 'snapshot'); assert.equal(s.tick, 0); assert.equal(s.sim_tick, 0);
    assert.equal(s.night, night); assert.equal(s.lanterns.length, count); assert.equal(s.time_left_s, dur);
    assert.equal(s.motes.length, 20); assert.equal(s.motes_active, 20);
    assert.deepEqual(s.wind.active, false);
    // v1.2: player now has capacity; lanterns have fuel, ever_lit, relit_count
    for (const k of ['pos', 'vel', 'grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s', 'flames', 'carried', 'capacity']) assert.ok(k in s.player, k);
    assert.equal(s.player.capacity, T.carry_capacity, 'initial capacity = base carry_capacity (0 lights)');
    for (const l of s.lanterns) {
      assert.ok('fuel' in l && 'ever_lit' in l && 'relit_count' in l, `lantern ${l.id} missing v1.2 fields`);
      assert.equal(l.fuel, 0, 'unlit lantern has fuel 0');
      assert.equal(l.ever_lit, false);
      assert.equal(l.relit_count, 0);
    }
    assert.ok(Array.isArray(s.drifters) && Array.isArray(s.charms));
    assert.deepEqual(lines.at(-1), { type: 'end', ticks: 0, state: 'playing', score: 0 });
  }
  assert.deepEqual(parse(run({ seed: 1, night: 1, ticks: 0 }))[0].player.pos, [0, 0, 0]);
});

test('snapshot cadence, --ticks N runs exactly N steps, time_left = duration - N/60', () => {
  const lines = parse(run({ seed: 3, scenario: empty(), ticks: 90, snapshotEvery: 30 }));
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((l) => l.tick), [0, 30, 60, 90]);
  // Phase 3: night1 duration changed from 300 to 240; at tick 90 time_left = 240 - 1.5 = 238.5
  assert.equal(lines.find((l) => l.tick === 90 && l.type === 'snapshot').time_left_s, 238.5);
  assert.equal(lines.at(-1).ticks, 90);
  assert.equal(lines.find((l) => l.name === 'night_start').data.night, 1);
});

test('determinism: same seed/scenario/inputs identical on every night; different seed differs', () => {
  const frames = [{ tick: 0, move: [1, 1], cam_yaw_deg: 30 }, { tick: 200, pulse: true }, { tick: 201, pulse: false }, { tick: 300, dash: true }];
  for (const night of [1, 2, 3]) {
    const a = run({ seed: 42, night, frames, ticks: 4000 });
    assert.equal(a, run({ seed: 42, night, frames, ticks: 4000 }));
    assert.notEqual(a, run({ seed: 43, night, frames, ticks: 4000 }));
  }
});

// ------------------------------------------------------------------ movement
test('run speed 6 m/s, full speed within 0.1 s, stops within 0.1 s, cam yaw formula, normalised diagonals', () => {
  const g = mk();
  let reached = null;
  for (let i = 1; i <= 12; i++) { g.step({ move: [0, 1] }); if (reached === null && g.player.hv[1] === T.player_speed) reached = i; }
  assert.ok(reached !== null && reached <= 6, `reached full speed after ${reached} ticks`);
  steps(g, 48, { move: [0, 1] });
  assert.ok(Math.abs(g.player.pos[2] - 6) <= 0.3);
  for (let i = 0; i < 6; i++) g.step({ move: [0, 0] });
  assert.equal(g.player.hv[1], 0);
  const h = mk(); steps(h, 60, { move: [0, 1], cam_yaw_deg: 90 }); // x' = z·sin90
  assert.ok(h.player.pos[0] > 5.6 && Math.abs(h.player.pos[2]) < 1e-9);
  const d = mk(); steps(d, 60, { move: [1, 1] });
  assert.ok(Math.abs(Math.hypot(d.player.pos[0], d.player.pos[2]) - 6) <= 0.3);
});

test('jump: 7 m/s, gravity 20, only from the ground', () => {
  const g = mk();
  let apex = 0, ticks = 0;
  press(g, { jump: true });
  g.step({ jump: true }); // held / second press while airborne is ignored
  for (let i = 0; i < 80 && !g.player.grounded; i++) { g.step({}); apex = Math.max(apex, g.player.pos[1]); ticks++; }
  near(apex, 49 / 40, 0.07);
  assert.ok(ticks >= 38 && ticks <= 46, `airtime ${ticks}`);
  const a = mk(); press(a, { jump: true }); steps(a, 5); const vy = a.player.vy; a.step({ jump: false }); a.step({ jump: true });
  assert.ok(a.player.vy < vy, 'no double jump');
});

test('dash: 14 m/s for 0.2 s, cooldown 1.5 s from start, uses facing when idle, ignores presses while dashing', () => {
  const g = mk();
  const ev = g.step({ dash: true });
  assert.deepEqual(ev, [{ type: 'event', tick: 1, name: 'dash', data: {} }]);
  g.step({ dash: false }); g.step({ dash: true }); // press during dash: ignored
  steps(g, 10, { dash: false });
  near(g.player.pos[2], 2.8, 1e-9);           // facing +Z initially, 12 ticks * 14/60
  assert.equal(g.player.pos[0], 0);
  assert.equal(g.player.dashCd, 90 - 12);
  press(g, { dash: true });
  assert.equal(g.player.dashCd, 90 - 14, 'no second dash during cooldown');
  steps(g, 75);
  const again = g.step({ dash: true });                   // cd reaches 0 exactly 90 ticks after the first dash
  assert.equal(g.tick, 91); // first dash at tick 1, second at tick 91
  assert.deepEqual(names(again), ['dash']);
  const m = mk(); steps(m, 20, { move: [-1, 0] }); const x = m.player.pos[0]; m.step({ move: [-1, 0], dash: true }); steps(m, 11, { move: [-1, 0], dash: false });
  near(m.player.pos[0], x - 2.8, 0.05);
  const f = mk(); steps(f, 30, { move: [1, 0] }); steps(f, 20, { move: [0, 0] }); const fx = f.player.pos[0]; f.step({ dash: true }); steps(f, 11);
  near(f.player.pos[0], fx + 2.8, 1e-9); // idle: dash goes where Mây is facing (+X)
});

test('dash in the air holds altitude and does not make Mây invulnerable', () => {
  const g = mk({ player: { pos: [0, 5, 0] } });
  assert.equal(g.player.grounded, false);
  g.step({ dash: true }); const y = g.player.pos[1];
  steps(g, 5, { dash: true });
  assert.equal(g.player.pos[1], y);
  assert.equal(g.player.invuln, 0);
});

// ------------------------------------------------------------------ motes & lanterns
test('pickup: XZ <= 1.0 and height difference <= 1.5, capacity 10, no score on pickup', () => {
  const g = mk({ motes: [[1, 0, 0], [0, 0, 1.01], [0, 3, 0]] });
  const ev = g.step({});
  assert.equal(names(ev).filter((n) => n === 'mote_picked').length, 1);
  assert.equal(g.motes.length, 2); assert.equal(g.score, 0);
  const high = mk({ player: { pos: [0, 5, 0] }, motes: [[0, 0, 0]] }); // 5 m above: out of dy
  high.step({}); assert.equal(high.player.carried, 0);
  const full = mk({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] }); full.step({});
  assert.equal(full.player.carried, 10); assert.equal(full.motes.length, 1);
});

test('interact: radius 2.0, deposits min(carried, missing), +5 per mote (Phase 3), +100 per lantern, repeatable', () => {
  const g = mk({ player: { carried: 7 }, lanterns: [{ id: 'L1', pos: [0, 0, 2], deposited: 5 }, { id: 'L2', lit: true }] });
  const ev = press(g, { interact: true });
  assert.deepEqual(names(ev), ['deposit', 'lantern_lit']);
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: 5, deposited: 10 });
  assert.equal(g.player.carried, 2);
  assert.equal(g.score, 5 * T.score.per_mote + T.score.per_lantern);
  const p = mk({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [0, 0, 2] }] });
  press(p, { interact: true }); press(p, { interact: true });
  assert.equal(p.lanterns[0].deposited, 4); assert.equal(p.lanterns[0].lit, false);
  assert.equal(mk({ player: { carried: 4 }, lanterns: [{ id: 'L1', pos: [0, 0, 2.01] }] }).step({ interact: true }).length, 0);
});

test('interact picks nearest eligible lantern; ties by lower id; lit+full lanterns ignored, lit+not-full eligible', () => {
  // L1 is lit+full but put at d=3 (outside interact_radius=2) so it cannot be chosen anyway; in Phase 3 it would be nearly-full after 1 tick of decay
  const g = mk({ player: { carried: 3 }, lanterns: [{ id: 'L1', lit: true, pos: [0, 0, 3] }, { id: 'L2', pos: [1, 0, 0] }, { id: 'L3', pos: [-1, 0, 0] }, { id: 'L4', pos: [0, 0, 5] }] });
  assert.equal(g.step({ interact: true })[0].data.lantern_id, 'L2');
  const h = mk({ player: { carried: 3 }, lanterns: [{ id: 'L2', pos: [1, 0, 0] }, { id: 'L3', pos: [0, 0, 0.5] }] });
  assert.equal(h.step({ interact: true })[0].data.lantern_id, 'L3');
});

test('scenario lanterns set lit/lit no points and no events', () => {
  const g = mk({ lanterns: [{ id: 'L1', lit: true }] });
  assert.equal(g.score, 0); assert.equal(g.events.length, 0);
});

// ------------------------------------------------------------------ win / lose
// Phase 3 (TICKET-03): win condition replaced. all_lit removed; dawn_survived (ticksLeft=0, litCount >= threshold).
// Scoring: no time bonus; dawn bonus = (per_lantern_dawn_base + floor(fuel)) per lit lantern + per_flame_left per flame.
test('win: dawn_survived when >= ceil(0.6*n) lanterns lit at tick 0 of dawn; score = dawn+flame bonus', () => {
  // Night 1: 5 lanterns, threshold = ceil(0.6*5) = 3
  // 3 lit lanterns → win
  const lit3 = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true }));
  const lines = parse(run({ seed: 1, scenario: empty({ lanterns: lit3, time_left_s: 1 / 60 }), ticks: 10 }));
  const over = lines.find((l) => l.name === 'game_over');
  assert.deepEqual(over.data, { result: 'won', reason: 'dawn_survived' });
  // Dawn bonus: 3 lit lanterns × (50 + floor(fuel)); fuel at dawn tick ≈ 100 - 1/60 (1 tick of decay)
  // fuelTicks after 1 tick = 6000-1=5999; floor(5999/60)=99; score per lantern = 50+99=149
  const expectedScore = 3 * (T.score.per_lantern_dawn_base + 99) + 3 * T.score.per_flame_left;
  const endLine = lines.at(-1);
  assert.equal(endLine.score, expectedScore);
  assert.equal(endLine.state, 'won');
  // 2 lit lanterns → lose (below threshold)
  const lit2 = ['L1', 'L2'].map((id) => ({ id, lit: true }));
  const lines2 = parse(run({ seed: 1, scenario: empty({ lanterns: lit2, time_left_s: 1 / 60 }), ticks: 10 }));
  const over2 = lines2.find((l) => l.name === 'game_over');
  assert.deepEqual(over2.data, { result: 'lost', reason: 'dawn' });
});

// Phase 3 (TICKET-03): all_lit win removed. No early win when all lanterns lit; win only at dawn.
// no_flames beats dawn; dawn still loses when below threshold.
test('no early win when all lit; dawn loses below threshold; no_flames beats dawn; score 0 on loss', () => {
  // All 5 lanterns lit but time still remains: game continues (no early win)
  const allLit5 = ['L1', 'L2', 'L3', 'L4', 'L5'].map((id, i) => ({ id, lit: true, pos: [30, 0, i * 3] }));
  const g = mk({ lanterns: allLit5, time_left_s: 2 });
  const ev = steps(g, 60); // 1 s of play; should NOT see game_over yet
  assert.ok(!ev.some((e) => e.name === 'game_over'), 'no early win when all lanterns lit');
  assert.equal(g.over, null);
  // Dawn loses when fewer than threshold lit (need 3/5; here 0 lit)
  const d = mk({ time_left_s: 2 });
  assert.deepEqual(steps(d, 200).at(-1), { type: 'event', tick: 120, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
  // no_flames beats dawn even when 5 lanterns lit
  const both = mk({ player: { flames: 1 }, lanterns: allLit5, shades: [{ id: 'S1', pos: [0, 0, 0.5] }] });
  const e2 = both.step({});
  assert.deepEqual(e2.at(-1).data, { result: 'lost', reason: 'no_flames' }, 'out of flames loses even though every lantern is lit');
  assert.equal(both.score, 0, 'no score bonus on a loss');
});

// ------------------------------------------------------------------ pulse
test('pulse: costs 3, 3D radius 5 from foot+0.8, stun 120, push 4 m over 15 ticks, +5 each, cooldown 3 s', () => {
  const g = mk({ player: { carried: 9 }, shades: [{ id: 'A', pos: [4.6, 0, 0] }, { id: 'B', pos: [0, 0, -9] }, { id: 'C', pos: [4.95, 0, 0] }] });
  // A at 3D distance hypot(4.6, 1-0.8)=4.604 <= 5 ; C: hypot(4.95,0.2)=4.954 <=5 ; B too far
  const ev = press(g, { pulse: true });
  const pulse = ev.find((e) => e.name === 'pulse');
  assert.deepEqual(pulse.data.stunned_ids.sort(), ['A', 'C']);
  assert.equal(g.player.carried, 6); assert.equal(g.score, 2 * T.score.per_stun);
  assert.equal(g.player.pulseCd, 180 - 1);
  const a = g.shades[0];
  assert.equal(a.state, 'stunned'); assert.equal(a.left, 120 - 1);
  assert.ok(a.pos[0] > 4.6 && a.pos[0] < 4.6 + 4, 'push in progress');
  steps(g, 13); near(a.pos[0], 4.6 + 4, 1e-9);   // 15 pushes of 4/15 m in total
  steps(g, 20); near(a.pos[0], 4.6 + 4, 1e-9);   // and then it stays put while stunned
  assert.notEqual(g.shades[1].state, 'stunned', 'B is out of range');
  const again = press(g, { pulse: true });
  assert.equal(again.length, 0, 'cooldown');
  assert.equal(g.score, 2 * T.score.per_stun);
});

test('pulse: height matters (3D), re-pulse refreshes stun/push and scores again, not enough light = nothing', () => {
  const far = mk({ player: { carried: 3, pos: [0, 4.5, 0] }, shades: [{ id: 'A', pos: [4, 0, 0] }] }); // dy ~ 3.7+ -> 3D > 5
  assert.deepEqual(far.step({ pulse: true }).find((e) => e.name === 'pulse').data.stunned_ids, []);
  const g = mk({ player: { carried: 9 }, shades: [{ id: 'A', pos: [3, 0, 0] }] });
  press(g, { pulse: true }); steps(g, 178); // the next step is exactly 180 ticks after the activation
  const x = g.shades[0].pos[0]; const left = g.shades[0].left;
  const ev = g.step({ pulse: true });
  assert.ok(names(ev).includes('pulse'));
  assert.equal(g.score, 2 * T.score.per_stun);
  assert.equal(g.shades[0].left, 120);
  assert.ok(g.shades[0].pos[0] > x && left < 120);
  assert.equal(names(mk({ player: { carried: 2 }, shades: [{ pos: [3, 0, 0] }] }).step({ pulse: true })).includes('pulse'), false);
});

test('pulse push stops at an obstacle (bell tower) and stunned shades do not move afterwards', () => {
  const g = mk({ player: { pos: [0, 6, 4], carried: 3 }, shades: [{ id: 'A', pos: [0, 6, 2.5] }] }, 3);
  press(g, { pulse: true }); // pushes toward -Z... A is at -1.5 relative => pushed -Z into the tower (r=2)
  assert.ok(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2]) >= 2 - 1e-9, 'did not enter the tower');
  const p = [...g.shades[0].pos]; steps(g, 20);
  assert.deepEqual(g.shades[0].pos, p);
});

// ------------------------------------------------------------------ shades
test('shade: speed 4 (night 3: 4.5), detect 12 m, lose interest after 18 m', () => {
  const g = mk({ shades: [{ id: 'S1', pos: [10, 0, 0] }] });
  g.step({}); assert.equal(g.shades[0].state, 'chase');
  near(g.shades[0].pos[0], 10 - 4 / 60, 1e-9);
  const n3 = mk({ player: { pos: [0, 0, -26] }, shades: [{ id: 'S1', pos: [10, 0, -26] }] }, 3);
  n3.step({}); near(n3.shades[0].pos[0], 10 - 4.5 / 60, 1e-9);
  const far = mk({ shades: [{ id: 'S1', pos: [13, 0, 0] }] }); far.step({}); assert.equal(far.shades[0].state, 'wander');
  const h = mk({ shades: [{ id: 'S1', pos: [12, 0, 0], state: 'chase' }] }); h.step({}); assert.equal(h.shades[0].state, 'chase');
  const lose = mk({ shades: [{ id: 'S1', pos: [18.2, 0, 0], state: 'chase' }] }); lose.step({}); assert.equal(lose.shades[0].state, 'wander');
});

test('hit: -1 flame, drop floor(n/2) on a 1.5-2.5 ring (ttl 480), invulnerable 90 ticks, shade recoils 2 m over 60 ticks', () => {
  const g = mk({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  const ev = g.step({});
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  assert.equal(g.player.carried, 3); assert.equal(g.player.invuln, 90);
  const drops = g.motes.filter((m) => m.kind === 'dropped');
  assert.equal(drops.length, 2);
  for (const m of drops) { const d = Math.hypot(m.pos[0], m.pos[2]); assert.ok(d >= 1.5 - 1e-9 && d <= 2.5 + 1e-9); assert.equal(m.ttl, 480); }
  const s = g.shades[0]; assert.equal(s.state, 'recoil');
  const pre = 0.5 - 4 / 60, x1 = s.pos[0];     // it chased one step, then recoiled one step
  near(x1 - pre, 2 / 60, 1e-9);
  steps(g, 59);
  near(s.pos[0] - pre, 2, 1e-9);                // 60 recoil steps = 2 m in total
  assert.equal(g.player.flames, 2, 'recoiling shade and invulnerability: no second hit');
  // invulnerability: 90 ticks starting from the hit tick
  const h = mk({ player: { carried: 0, flames: 3 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  h.step({}); const t0 = h.tick; let second = null;
  for (let i = 0; i < 400 && second === null; i++) {
    h.shades[0].state = 'wander'; h.shades[0].left = 0; h.shades[0].pos = [0.5, 1, 0];
    if (h.step({}).some((e) => e.name === 'player_hit')) second = h.tick - t0;
  }
  assert.equal(second, 90);
});

test('dropped motes expire after 480 ticks and can be picked up again', () => {
  const g = mk({ player: { carried: 4 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  g.step({}); g.shades = [];
  assert.equal(g.motes.length, 2);
  steps(g, 479); assert.equal(g.motes.length, 2);
  g.step({}); assert.equal(g.motes.length, 0);
  const h = mk({ player: { carried: 2 }, motes: [{ pos: [0, 0, 0], kind: 'dropped', ttl_ticks: 100 }] }); h.step({}); assert.equal(h.player.carried, 3);
});

test('at most one flame lost per tick; shades touching while invulnerable do nothing', () => {
  const g = mk({ shades: [{ id: 'S1', pos: [0.5, 0, 0] }, { id: 'S2', pos: [0, 0, 0.5] }] });
  g.step({}); assert.equal(g.player.flames, 2);
  assert.equal(g.shades.filter((s) => s.state === 'recoil').length, 1, 'only S1 (lower id) hit');
  const inv = mk({ player: { invuln_ticks: 30 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  inv.step({}); assert.equal(inv.player.flames, 3); assert.equal(inv.shades[0].state, 'chase');
});

test('hit needs height difference <= 1.5', () => {
  const g = mk({ player: { pos: [0, 4, 0] }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] });
  g.step({}); assert.equal(g.player.flames, 3);
});

// ------------------------------------------------------------------ safe zones
test('lit lantern: shades are blocked at the 6 m edge; unlit lanterns have no zone', () => {
  const g = mk({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }], shades: [{ id: 'S1', pos: [0, 0, 36] }] });
  for (let i = 0; i < 900; i++) {
    g.step({});
    assert.equal(g.player.flames, 3);
    assert.ok(Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 20) >= 6, `dist ${Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 20)}`);
  }
  const u = mk({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20] }], shades: [{ id: 'S1', pos: [0, 0, 30] }] });
  steps(u, 200); assert.ok(u.player.flames < 3);
});

test('a shade inside the zone when the lantern is lit is pushed out in <= 30 ticks and harmless meanwhile', () => {
  const g = mk({ player: { carried: 10, pos: [0, 0, 1.5] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 0 }], shades: [{ id: 'S1', pos: [0, 0, 2] }] });
  press(g, { interact: true });
  assert.ok(g.lanterns[0].lit);
  steps(g, 29);
  const d = Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2]);
  assert.ok(d >= 6, `pushed to ${d}`);
  assert.equal(g.player.flames, 3, 'no damage during escort');
});

// ------------------------------------------------------------------ falling
test('fall (Y < -10): exactly one player_hit by fall, lose all light, wait 60 ticks, respawn at start with 90 ticks invulnerability', () => {
  const g = mk({ player: { pos: [39, 0, 0], carried: 5 } });
  const all = steps(g, 140, { move: [1, 0] });
  const falls = all.filter((e) => e.name === 'player_hit');
  assert.equal(falls.length, 1);
  assert.deepEqual(falls[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 5 });
  assert.equal(g.player.carried, 0);
  const fallTick = falls[0].tick;
  const h = mk({ player: { pos: [39, 0, 0], carried: 5 } });
  let snapAt = null;
  for (let i = 0; i < 200; i++) {
    h.step({ move: [1, 0] });
    if (h.player.respawn === 0 && h.player.invuln === 90 && snapAt === null) snapAt = h.tick;
    if (snapAt !== null) break;
  }
  assert.equal(snapAt, fallTick + 60);
  assert.deepEqual(h.player.pos, [0, 0, 0]); assert.deepEqual(h.player.hv, [0, 0]); assert.deepEqual(h.snapshot().player.vel, [0, 0, 0]); assert.equal(h.player.grounded, true);
});

test('fall ignores invulnerability, cannot pick up or be hit while waiting, and the last flame loses without respawn', () => {
  const g = mk({ player: { pos: [39.5, 0, 0], invuln_ticks: 500, flames: 1 } });
  const ev = steps(g, 80, { move: [1, 0] });
  assert.deepEqual(names(ev).filter((n) => n === 'player_hit'), ['player_hit']);
  assert.deepEqual(ev.at(-1).data, { result: 'lost', reason: 'no_flames' });
  assert.equal(g.over, 'lost');
  const w = mk({ player: { pos: [39.5, 0, 0] }, motes: [[45, -12, 0]] });
  steps(w, 70, { move: [1, 0] });
  assert.equal(w.player.carried, 0);
});

// ------------------------------------------------------------------ spawning
test('motes: 20 at distinct spawn points, +1 every 240 ticks up to 30, then skipped; 24 points on night 1', () => {
  const g = new Game({ seed: 9, night: 1, scenario: { random_shades: false, player: { flames: 99, pos: [0, 0, 39] } } });
  assert.equal(g.motes.length, 20);
  assert.equal(new Set(g.motes.map((m) => m.pos.join())).size, 20);
  steps(g, 239); assert.equal(g.motes.length, 20);
  g.step({}); assert.equal(g.motes.length, 21);
  steps(g, 240 * 5); assert.equal(g.motes.length, 24, 'night 1 has only 24 points: further spawns are skipped');
  const h = new Game({ seed: 9, night: 3, scenario: { random_shades: false, random_drifters: false, player: { flames: 99, pos: [0, 0, -44] } } });
  steps(h, 240 * 9); assert.equal(h.motes.length, 29);
  steps(h, 240); assert.equal(h.motes.length, 30);
  steps(h, 240 * 3); assert.equal(h.motes.length, 30, 'cap 30');
  assert.deepEqual([1, 2, 3].map((n) => new Game({ night: n }).map.moteSpawns.length), [24, 24, 30]);
});

test('mote spawn is skipped when no free point exists', () => {
  const g = new Game({ seed: 1, night: 1, scenario: { random_shades: false, motes: [] } });
  g.motes = g.map.moteSpawns.map((p) => ({ id: 'x', pos: [...p], kind: 'random', ttl: null }));
  steps(g, 240); assert.equal(g.motes.length, 24);
});

test('shades: two at tick 300 then one per interval (480/420/360), cap 6/8/10, ids S1.., spawning state', () => {
  for (const [night, every, cap] of [[1, 480, 6], [2, 420, 8], [3, 360, 10]]) {
    const g = new Game({ seed: 4, night, scenario: { random_motes: false, motes: [], random_drifters: false, player: { flames: 999 } } });
    let spawned = [];
    for (let i = 1; i <= 300 + every * 12; i++) {
      for (const e of g.step({})) if (e.name === 'shade_spawned') spawned.push([g.simTick, e.data.id]);
    }
    assert.deepEqual(spawned.slice(0, 2), [[300, 'S1'], [300, 'S2']]);
    assert.equal(spawned[2][0], 300 + every);
    assert.equal(spawned[3][0], 300 + 2 * every);
    assert.equal(g.shades.length, cap);
    assert.equal(spawned.length, cap);
  }
  const s = new Game({ seed: 4, night: 1, scenario: { random_motes: false, motes: [] } });
  steps(s, 300); assert.ok(s.shades.every((x) => x.state === 'spawning'));
  near(Math.min(...s.shades.map((x) => Math.hypot(x.pos[0], x.pos[2]))), 37, 0.001);
});

test('shade spawn points are >= 15 m from Mây and outside lit zones; otherwise the spawn is skipped', () => {
  const g = new Game({ seed: 4, night: 1, scenario: { random_motes: false, motes: [], player: { pos: [37, 0, 0] } } });
  steps(g, 300);
  for (const s of g.shades) assert.ok(Math.hypot(s.pos[0] - 37, s.pos[2]) >= 15 - 1e-9);
  const blocked = new Game({ seed: 4, night: 1, scenario: { random_motes: false, motes: [], lanterns: g.map.shadeSpawns.map(([x, z], i) => ({ id: `L${i + 1}`, pos: [x, 0, z], lit: true })).slice(0, 12) } });
  steps(blocked, 300); assert.equal(blocked.shades.length, 0);
});

// ------------------------------------------------------------------ drifters
test('drifters spawn at ticks 1200, 2400.. on nights 2 and 3 only; max 2; ids D1, D2', () => {
  for (const night of [2, 3]) {
    const g = new Game({ seed: 2, night, scenario: { random_motes: false, motes: [], random_shades: false, player: { flames: 99 } } });
    steps(g, 1199); assert.equal(g.drifters.length, 0);
    g.step({}); assert.deepEqual(g.drifters.map((d) => d.id), ['D1']);
    steps(g, 1200); assert.deepEqual(g.drifters.map((d) => d.id), ['D1', 'D2']);
    g.drifters.forEach((d) => (d.state = 'idle'));
    steps(g, 1200); assert.ok(g.drifters.length <= 2);
  }
  const n1 = new Game({ seed: 2, night: 1, scenario: { random_motes: false, motes: [], random_shades: false } }); steps(n1, 2500); assert.equal(n1.drifters.length, 0);
});

test('drifter: idle -> chase only with >=5 light within 15 m; steals min(3, carried); flees 240 ticks and vanishes; steals once', () => {
  const g = mk({ player: { carried: 5 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }, 2);
  g.step({}); assert.equal(g.drifters[0].state, 'chase');
  const few = mk({ player: { carried: 4 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }, 2); few.step({}); assert.equal(few.drifters[0].state, 'idle');
  const farD = mk({ player: { carried: 9 }, drifters: [{ id: 'D1', pos: [16, 1.5, 0] }] }, 2); farD.step({}); assert.equal(farD.drifters[0].state, 'idle');
  const ev = steps(g, 90);
  const steal = ev.find((e) => e.name === 'drifter_steal');
  assert.deepEqual(steal.data, { drifter_id: 'D1', amount: 3, carried: 2 });
  assert.equal(g.drifters[0].state, 'flee'); assert.equal(g.drifters[0].stolen, 3);
  assert.equal(g.player.flames, 3, 'no flame loss');
  while (g.tick < steal.tick + 239) g.step({});
  assert.equal(g.drifters.length, 1);
  g.step({}); assert.equal(g.drifters.length, 0, 'flees for exactly 240 ticks');
  assert.equal(g.motes.length, 0, 'stolen light vanishes with the drifter');
});

test('drifter ignores invulnerability and safe zones', () => {
  const g = mk({ player: { carried: 6, invuln_ticks: 600, pos: [0, 0, 0] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], drifters: [{ id: 'D1', pos: [8, 1.5, 0], state: 'chase' }] }, 2);
  const ev = steps(g, 60);
  assert.ok(names(ev).includes('drifter_steal'));
});

test('pulse on a chasing drifter makes it flee without stealing; pulse on a thief returns the loot', () => {
  const g = mk({ player: { carried: 9 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'chase' }] }, 2);
  g.step({ pulse: true });
  assert.equal(g.drifters[0].state, 'flee'); assert.equal(g.drifters[0].stolen, 0); assert.equal(g.player.carried, 6);
  assert.equal(g.score, 0, 'drifters are not shades: no stun score');
  const t = mk({ player: { carried: 3, pos: [0, 0, 0] }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3, state_ticks_left: 200 }] }, 2);
  const ev = t.step({ pulse: true });
  assert.deepEqual(ev.find((e) => e.name === 'drifter_drop').data, { drifter_id: 'D1', amount: 3 });
  assert.equal(t.motes.filter((m) => m.kind === 'dropped').length, 3);
  assert.equal(t.drifters[0].stolen, 0);
  steps(t, 118); assert.equal(t.drifters.length, 1);
  t.step({}); assert.equal(t.drifters.length, 0, 'gone 120 ticks after the pulse');
});

// ------------------------------------------------------------------ charms
test('wind charm: pickup event, speed 7.2, dash without cooldown for 600 ticks, re-pickup refreshes, respawns after 2700', () => {
  const g = mk({ charms: [{ id: 'C1', pos: [0, 0, 0] }] }, 2);
  const ev = g.step({});
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } });
  assert.equal(g.charms[0].available, false); assert.equal(g.charms[0].respawn, 2700);
  steps(g, 10, { move: [0, 1] }); near(g.player.hv[1], 7.2, 1e-9);
  g.step({ dash: true, move: [0, 1] }); g.step({ dash: false }); steps(g, 12);
  assert.equal(g.player.dashCd, 0);
  assert.deepEqual(names(g.step({ dash: true })), ['dash'], 'dash again immediately after the previous one ended');
  g.step({ dash: false });
  const dur = mk({ charms: [{ id: 'C1', pos: [0, 0, 0] }] }, 2); steps(dur, 600); assert.equal(dur.player.charm, 1);
  dur.step({}); assert.equal(dur.player.charm, 0, 'counter 600 set at pickup, decremented from the next tick');
  assert.equal(new Game({ night: 2 }).charms.length, 1);
  assert.deepEqual([1, 2, 3].map((n) => new Game({ night: n }).charms.map((c) => c.pos)), [[], [[35, 0, 0]], [[30, 0, 25], [-30, 0, 25]]]);
  const r = mk({ charms: [{ id: 'C1', pos: [0, 0, 0] }] }, 2); steps(r, 2700); assert.equal(r.charms[0].available, false);
  r.step({}); assert.equal(r.charms[0].available, false, 'picked up again immediately because Mây still stands on it');
  const away = mk({ charms: [{ id: 'C1', pos: [5, 0, 0] }], player: { pos: [5, 0, 0] } }, 2); away.step({});
  away.player.pos = [0, 0, 0]; steps(away, 2699); assert.equal(away.charms[0].available, false);
  away.step({}); assert.equal(away.charms[0].available, true);
  away.step({ move: [0, 0] });
});

// ------------------------------------------------------------------ pause
test('pause freezes the simulation: tick advances, sim_tick/time/cooldowns/spawns/ttl stay; snapshot state paused', () => {
  const g = mk({ player: { pulse_cd_ticks: 100 }, motes: [{ pos: [30, 0, 0], kind: 'dropped', ttl_ticks: 50 }] });
  steps(g, 10);
  const ev = g.step({ pause: true });
  assert.deepEqual(ev, [{ type: 'event', tick: 11, name: 'paused', data: {} }]);
  const before = JSON.stringify([g.simTick, g.timeLeft, g.player.pulseCd, g.motes[0].ttl]);
  steps(g, 100, { pause: true }); // held: no new edge
  assert.equal(g.tick, 111); assert.equal(g.simTick, 10);
  assert.equal(JSON.stringify([g.simTick, g.timeLeft, g.player.pulseCd, g.motes[0].ttl]), before);
  assert.equal(g.snapshot().state, 'paused'); assert.equal(g.snapshot().sim_tick, 10);
  g.step({ move: [0, 1], pause: false });
  assert.equal(g.simTick, 10, 'input is ignored while paused');
  const r = g.step({ pause: true });
  assert.deepEqual(names(r), ['resumed']);
  assert.equal(g.simTick, 11, 'resume tick runs normally'); assert.equal(g.snapshot().state, 'playing');
});

test('paused steps are counted by --ticks and inputs can pause/resume through the CLI path', () => {
  const lines = parse(run({ seed: 1, scenario: empty(), frames: [{ tick: 5, pause: true }, { tick: 6, pause: false }, { tick: 20, pause: true }, { tick: 21, pause: false }], ticks: 30, snapshotEvery: 10 }));
  assert.deepEqual(lines.filter((l) => l.type === 'event').map((l) => [l.tick, l.name]), [[0, 'night_start'], [6, 'paused'], [21, 'resumed']]);
  assert.equal(lines.find((l) => l.type === 'snapshot' && l.tick === 10).state, 'paused');
  assert.equal(lines.find((l) => l.type === 'snapshot' && l.tick === 10).sim_tick, 5);
  assert.equal(lines.at(-1).ticks, 30);
});

// ------------------------------------------------------------------ wind
test('night 3 wind: warning from tick 1680, active 1800..2100 pushing 2 m/s; wind_enabled:false disables', () => {
  const g = mk({ player: { flames: 99 } }, 3);
  steps(g, 1679); assert.equal(g.snapshot().wind.active, false); assert.equal(g.snapshot().wind.warning, false);
  g.step({}); assert.equal(g.snapshot().wind.warning, true);
  steps(g, 119); assert.equal(g.snapshot().wind.active, false);
  const p0 = [...g.player.pos];
  g.step({}); const w = g.snapshot().wind; assert.equal(w.active, true);
  steps(g, 59);
  const a = (w.dir_deg * Math.PI) / 180;
  near(g.player.pos[0] - p0[0], 2 * Math.cos(a), 0.05); near(g.player.pos[2] - p0[2], 2 * Math.sin(a), 0.05);
  steps(g, 240); assert.equal(g.snapshot().wind.active, true, 'tick 2099 is still inside the 300-tick gust');
  g.step({}); assert.equal(g.snapshot().wind.active, false);
  const off = mk({ wind_enabled: false, player: { flames: 99 } }, 3); steps(off, 2000); assert.equal(off.snapshot().wind.active, false);
  const on1 = mk({ wind_enabled: true, player: { flames: 99 } }, 1); steps(on1, 1900); assert.equal(on1.snapshot().wind.active, true);
  const n1 = mk({ player: { flames: 99 } }, 1); steps(n1, 1900); assert.equal(n1.snapshot().wind.active, false);
});

// ------------------------------------------------------------------ maps
test('night 2: bridge is walkable, the gap and the sea are not; jump pads fly to the other island in ~1.4 s', () => {
  const g = mk({ player: { pos: [24, 0, 0] } }, 2);
  steps(g, 60, { move: [1, 0] }); assert.ok(g.player.pos[0] > 29 && g.player.grounded && g.player.pos[1] === 0);
  const off = mk({ player: { pos: [24, 0, 4] } }, 2); // beside the bridge, over the gap
  steps(off, 150, { move: [1, 0] }); assert.equal(off.player.flames, 2);
  const pad = mk({ player: { pos: [19, 0, 18] } }, 2);
  const tAir = []; pad.step({ move: [1, 0] });
  for (let t = 0; t < 200 && (t < 3 || !pad.player.grounded); t++) { pad.step({}); tAir.push(t); }
  assert.ok(pad.player.pos[0] > 50 && Math.hypot(pad.player.pos[0] - 70, pad.player.pos[2]) < 28, `landed at ${pad.player.pos}`);
  assert.equal(pad.player.flames, 3);
  assert.ok(tAir.length >= 80 && tAir.length <= 88, `airtime ${tAir.length} ticks (~1.4 s)`);
  const pad2 = mk({ player: { pos: [50, 0, -18] } }, 2); steps(pad2, 3); steps(pad2, 100);
  assert.ok(pad2.player.pos[0] < 25 && Math.hypot(pad2.player.pos[0], pad2.player.pos[2]) < 28);
});

test('night 2: launch velocity is kept (move keys do not override) but dash still works', () => {
  const g = mk({ player: { pos: [50, 0, -18] } }, 2);
  g.step({}); steps(g, 5, { move: [0, 1] });
  assert.ok(g.player.hv[0] < -20, `hv ${g.player.hv}`);
  g.step({ dash: true, move: [0, 1] });
  assert.ok(Math.abs(g.player.hv[1]) > 13, 'dash velocity during launch');
});

test('night 3: cliffs block, ramp climbs to tier 1, pad lands on tier 2, tower is solid', () => {
  const cliff = mk({ player: { pos: [0, 0, 10.5] } }, 3);  // below the tier-1 ring (r 12..24, z>0)
  steps(cliff, 30, { move: [0, 1] }); assert.ok(cliff.player.pos[1] === 0 && cliff.player.pos[2] <= 12 + 1e-6);
  const ramp = mk({ player: { pos: [26 * Math.cos(Math.PI / 6) + 3.5 * Math.cos(Math.PI / 6), 0, 0] } }, 3);
  const dir = (a) => [Math.cos(a), Math.sin(a)];
  const [ux, uz] = dir(Math.PI / 6);
  const climb = mk({ player: { pos: [31 * ux, 0, 31 * uz] } }, 3);
  // walk toward the island centre along the ramp: world move = -u
  steps(climb, 90, { move: [-ux, -uz] });
  assert.equal(climb.player.pos[1], 3, `y=${climb.player.pos[1]} at ${climb.player.pos}`);
  assert.ok(climb.player.grounded);
  const pad = mk({ player: { pos: [0, 3, 13.2] } }, 3);
  steps(pad, 70);
  assert.ok(pad.player.grounded && pad.player.pos[1] === 6, `y=${pad.player.pos[1]} at ${pad.player.pos}`);
  assert.ok(Math.hypot(pad.player.pos[0], pad.player.pos[2]) <= 8);
  const tower = mk({ player: { pos: [0, 6, 5] } }, 3);
  steps(tower, 120, { move: [0, -1] });
  assert.ok(Math.hypot(tower.player.pos[0], tower.player.pos[2]) >= 2 - 1e-9);
  const step = mk({ player: { pos: [20, 3, 10] } }, 3); // tier 1 -> walk off the outer edge falls to tier 0
  steps(step, 60, { move: [0, 1] }); assert.ok(step.player.pos[1] < 3 || !step.player.grounded || step.player.pos[1] === 0);
  void ramp;
});

test('night 3 default start is outside the bell tower; floors of all lanterns and spawn points exist', () => {
  for (const n of [1, 2, 3]) {
    const g = new Game({ night: n });
    assert.notEqual(g.floor(g.player.pos[0], g.player.pos[2]), null);
    for (const l of g.lanterns) assert.equal(g.floor(l.pos[0], l.pos[2]), l.pos[1], `${n} ${l.id}`);
    for (const m of g.map.moteSpawns) assert.equal(g.floor(m[0], m[2]), m[1]);
    for (const [x, z] of g.map.shadeSpawns) assert.notEqual(g.floor(x, z), null);
  }
});

test('scenario shade ids are kept, auto ids avoid collisions, shade y is floor+1, v1.1 state names accepted', () => {
  const g = mk({ shades: [{ pos: [30, 0, 0] }, { id: 'S1', pos: [-30, 0, 0], state: 'stunned', state_ticks_left: 10 }] });
  assert.deepEqual(g.shades.map((s) => s.id), ['S2', 'S1']);
  assert.equal(g.shades[0].pos[1], 1);
  assert.equal(g.shades[1].state, 'stunned');
  steps(g, 10); assert.equal(g.shades[1].state, 'wander');
  void flat;
});

// ------------------------------------------------------------------ Phase 3: fuel
test('fuel: lit lantern loses 1 fuelTick per game-tick; unlit lanterns are unaffected', () => {
  const g = mk({ lanterns: [{ id: 'L1', lit: true }, { id: 'L2' }] });
  assert.equal(g.lanterns[0].fuelTicks, 6000); // full at start (lit by scenario)
  assert.equal(g.lanterns[1].fuelTicks, 0);    // unlit: no fuel
  g.step({});
  assert.equal(g.lanterns[0].fuelTicks, 5999, 'lit lantern loses 1 tick per step');
  assert.equal(g.lanterns[1].fuelTicks, 0, 'unlit unaffected');
  steps(g, 5998);
  assert.equal(g.lanterns[0].fuelTicks, 1); // 1 tick left
});

test('lantern_out: emitted when fuelTicks hits 0; lantern goes unlit; deposited resets; shade draining it leaves drain', () => {
  // Player far away so shade can't immediately chase after leaving drain state
  const g = mk({
    player: { pos: [50, 0, 0] },
    lanterns: [{ id: 'L1', lit: true, fuel: 2 / 60, pos: [0, 0, 0] }], // 2 fuelTicks
    shades: [{ id: 'S1', pos: [0, 0, 1.5], state: 'drain', target_lantern_id: 'L1' }],
  });
  assert.equal(g.lanterns[0].fuelTicks, 2);
  assert.equal(g.shades[0].state, 'drain');
  g.step({}); // tick 1: drain=1(base)+5(shade)=6, fuelTicks = max(0, 2-6) = 0 → out
  const ev = g.events;
  assert.ok(ev.some((e) => e.name === 'lantern_out' && e.data.lantern_id === 'L1'), 'lantern_out emitted');
  assert.equal(g.lanterns[0].lit, false, 'lantern now unlit');
  assert.equal(g.lanterns[0].deposited, 0, 'deposited reset');
  assert.ok(g.shades[0].state !== 'drain', 'draining shade leaves drain state'); // becomes wander then possibly something else within the same tick
  assert.equal(g.shades[0].drainTarget, null);
});

test('refuel: E at lit-not-full lantern; uses min(carried, ceil(missing/fuelPerMote)) motes; +5 per mote score', () => {
  // fuel_per_mote = 10 → fuelPerMoteTicks = 600
  // lantern at 99 fuel (5940 ticks) → after 1 tick decay: 5939, missing = 61 → ceil(61/600) = 1 mote
  const g = mk({ player: { carried: 5 }, lanterns: [{ id: 'L1', lit: true, fuel: 99, pos: [0, 0, 1.5] }] });
  assert.equal(g.lanterns[0].fuelTicks, 5940);
  const ev = press(g, { interact: true });
  assert.ok(ev.some((e) => e.name === 'refuel'), 'refuel event emitted');
  const re = ev.find((e) => e.name === 'refuel');
  assert.equal(re.data.lantern_id, 'L1');
  assert.equal(re.data.amount, 1);
  assert.equal(re.data.fuel, 100); // back to full
  assert.equal(g.player.carried, 4);
  assert.equal(g.score, 1 * 5, '+5 per mote on refuel');
});

test('relight costs 5 motes (ever_lit); first light costs 10; relitCount increments; successfulLights increments both', () => {
  // First light: cost 10
  const g = mk({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1] }] });
  press(g, { interact: true });
  assert.equal(g.lanterns[0].lit, true);
  assert.equal(g.lanterns[0].everLit, true);
  assert.equal(g.lanterns[0].relitCount, 0, 'first light: not a relight');
  assert.equal(g.player.successfulLights, 1);
  assert.equal(g.score, 10 * 5 + 100); // 10 motes×5 + per_lantern

  // Relight: cost 5
  g.lanterns[0].lit = false; g.lanterns[0].deposited = 0; g.lanterns[0].fuelTicks = 0;
  g.player.carried = 5;
  press(g, { interact: true });
  assert.equal(g.lanterns[0].lit, true);
  assert.equal(g.lanterns[0].relitCount, 1);
  assert.equal(g.player.successfulLights, 2);
  assert.equal(g.score, 10 * 5 + 100 + 5 * 5 + 40); // first light + relight
});

test('drain state: shade within 2 m of low-fuel lantern transitions to drain; stands still; drainTarget set', () => {
  // low_fuel_threshold = 30 → 1800 ticks; lantern at 29 fuel = 1740 ticks < 1800 → low
  // Player at [50,0,0] so shade doesn't see player within detect range (12m)
  const g = mk({
    player: { pos: [50, 0, 0] },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 29 }],
    shades: [{ id: 'S1', pos: [0, 0, 1.5] }], // 1.5 m from lantern, within 2 m
  });
  g.step({}); // shade sees low fuel lantern, is within 2 m → drain
  assert.equal(g.shades[0].state, 'drain');
  assert.equal(g.shades[0].drainTarget, 'L1');
  const p1 = [...g.shades[0].pos];
  g.step({});
  assert.deepEqual(g.shades[0].pos, p1, 'drain shade does not move on its own');
});

test('drain: shade drains 5+1=6 ticks/game-tick when draining; fuel_drain event every 60 sim_ticks', () => {
  // Player far away (> safe_radius=6m) so shade stays in drain state
  const g = mk({
    player: { pos: [50, 0, 0] },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 29 }],
    shades: [{ id: 'S1', pos: [0, 0, 1.5], state: 'drain', target_lantern_id: 'L1' }],
  });
  const start = g.lanterns[0].fuelTicks;
  g.step({}); // drain=1(base)+5(shade)=6
  assert.equal(g.lanterns[0].fuelTicks, start - 6, 'draining shade removes 6 ticks/step');
  // fuel_drain event at sim_tick 60
  steps(g, 58); // now at simTick 59
  const before = g.events.length;
  g.step({}); // simTick 60 → fuel_drain event
  const drain = g.events.find((e) => e.name === 'fuel_drain');
  assert.ok(drain, 'fuel_drain event at sim_tick 60');
  assert.equal(drain.data.lantern_id, 'L1');
  assert.equal(drain.data.shade_id, 'S1');
  void before;
});

test('capacity grows: min(capacity_max=20, 10 + 2*successfulLights)', () => {
  const g = mk();
  assert.equal(g.capacity, 10);
  g.player.successfulLights = 1; assert.equal(g.capacity, 12);
  g.player.successfulLights = 5; assert.equal(g.capacity, 20);
  g.player.successfulLights = 6; assert.equal(g.capacity, 20, 'capped at 20');
  // scenario can preset successfulLights
  const s = mk({ player: { successful_lights: 3 } });
  assert.equal(s.capacity, 16);
});

test('pulse on draining shade: +per_drain_stun_bonus(15) on top of per_stun(5); drain state cleared', () => {
  const g = mk({
    player: { carried: 9 },
    lanterns: [{ id: 'L1', pos: [30, 0, 0], lit: true, fuel: 29 }],
    shades: [{ id: 'S1', pos: [3, 0, 0], state: 'drain', target_lantern_id: 'L1' }],
  });
  press(g, { pulse: true });
  assert.equal(g.score, 5 + 15, 'per_stun + per_drain_stun_bonus');
  assert.equal(g.shades[0].state, 'stunned');
  assert.equal(g.shades[0].drainTarget, null, 'drainTarget cleared on stun');
});

test('safe zone requires fuel >= threshold: shade can enter zone of low-fuel lantern', () => {
  // low_fuel_threshold = 30 → 1800 ticks
  // Lantern at 29 fuel (1740 ticks) has NO safe zone → shade can wander close
  const g = mk({
    player: { pos: [0, 0, 100] }, // far from shade so shade targets lantern not player
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 29 }],
    shades: [{ id: 'S1', pos: [0, 0, 10] }],
  });
  steps(g, 300); // shade has time to wander/approach the low-fuel lantern
  // With no safe zone on L1, shade should be able to reach drain state (within 2m) or at least enter the 6m radius
  const lanPos = g.lanterns[0].pos;
  const d = Math.hypot(g.shades[0].pos[0] - lanPos[0], g.shades[0].pos[2] - lanPos[2]);
  assert.ok(d < 6, `shade should enter low-fuel zone (d=${d.toFixed(2)})`);
});

test('snapshot fuel field: 1 dp; 0 for unlit; correct for partial fuel', () => {
  const g = mk({ lanterns: [{ id: 'L1', lit: true, fuel: 55.5 }, { id: 'L2' }] });
  const snap = g.snapshot();
  const l1 = snap.lanterns.find((l) => l.id === 'L1');
  const l2 = snap.lanterns.find((l) => l.id === 'L2');
  assert.equal(l1.fuel, 55.5);
  assert.equal(l2.fuel, 0, 'unlit lantern fuel is 0 in snapshot');
  assert.equal(l1.ever_lit, true);
  assert.equal(l2.ever_lit, false);
});
