// Đảo Đèn Lồng — deterministic game logic (no rendering, no DOM).
// Shared by the headless CLI and the web client. 60 ticks/s fixed step.

import { TUNING } from './tuning.js';

export const TPS = 60;
export const DT = 1 / TPS;
export const ISLAND_RADIUS = 40;
const JUMP_VELOCITY = 7;
const GRAVITY = 20;
const MAX_MOTES = 40;
const MOTE_RESPAWN_TICKS = 3 * TPS;
const INITIAL_SHADES = 2;
const MAX_SHADES = 5;
const SHADE_SPAWN_TICKS = 40 * TPS;
const SAFE_EPS = 0.01;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // +0 turns -0 into 0

export function defaultLanterns(count = TUNING.lantern_count_night1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    out.push({ id: `L${i + 1}`, pos: [r3(25 * Math.sin(a)), 0, r3(25 * Math.cos(a))], lit: false, deposited: 0 });
  }
  return out;
}

export class Game {
  constructor({ seed = 1, scenario = null, tuning = TUNING } = {}) {
    this.T = tuning;
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.events = [];
    this.state = 'playing';
    this.result = null;
    this.score = 0;
    this.player = { pos: [0, 0, 0], vy: 0, flames: tuning.flames, carried: 0, invulnUntil: 0, pulseReadyAt: 0 };
    this.lanterns = defaultLanterns(tuning.lantern_count_night1);
    this.motes = [];
    this.shades = [];
    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.randomMotes = true;
    this.randomShades = true;
    this.ticksLeft = Math.round(tuning.night1_duration_s * TPS);
    this.prevButtons = { jump: false, interact: false, pulse: false };
    this.lastMoteSpawn = 0;
    this.lastShadeSpawn = 0;

    if (scenario) this.applyScenario(scenario);
    if (!scenario || !('motes' in scenario)) {
      if (this.randomMotes) for (let i = 0; i < MAX_MOTES; i++) this.spawnMote();
    }
    if (!scenario || !('shades' in scenario)) {
      if (this.randomShades) for (let i = 0; i < INITIAL_SHADES; i++) this.spawnShade(false);
    }
  }

  applyScenario(s) {
    if (s.random_motes === false) this.randomMotes = false;
    if (s.random_shades === false) this.randomShades = false;
    if (s.player) {
      if (s.player.pos) this.player.pos = [...s.player.pos];
      if (s.player.carried != null) this.player.carried = s.player.carried;
      if (s.player.flames != null) this.player.flames = s.player.flames;
    }
    if (s.lanterns) {
      for (const l of s.lanterns) {
        let lan = this.lanterns.find((x) => x.id === l.id);
        if (!lan) { lan = { id: l.id, pos: [0, 0, 0], lit: false, deposited: 0 }; this.lanterns.push(lan); }
        if (l.pos) lan.pos = [...l.pos];
        if (l.deposited != null) lan.deposited = l.deposited;
        if (l.lit != null) lan.lit = !!l.lit;
      }
    }
    if (s.motes) this.motes = s.motes.map((p) => ({ id: `M${this.nextMoteId++}`, pos: [p[0], 0, p[2]] }));
    if (s.shades) {
      const used = new Set(s.shades.filter((x) => x.id).map((x) => x.id));
      this.shades = s.shades.map((sh) => {
        let id = sh.id;
        if (!id) { do { id = `S${this.nextShadeId++}`; } while (used.has(id)); used.add(id); }
        return { id, pos: [...sh.pos], stunnedUntil: 0 };
      });
    }
    if (s.time_left_s != null) this.ticksLeft = Math.round(s.time_left_s * TPS);
  }

  newShadeId() {
    let id;
    do { id = `S${this.nextShadeId++}`; } while (this.shades.some((s) => s.id === id));
    return id;
  }

  randomPointOnIsland(minR, maxR) {
    const a = this.rng() * 2 * Math.PI;
    const r = Math.sqrt(minR * minR + this.rng() * (maxR * maxR - minR * minR));
    return [r3(r * Math.sin(a)), 0, r3(r * Math.cos(a))];
  }

  spawnMote() {
    let pos;
    for (let i = 0; i < 20; i++) {
      pos = this.randomPointOnIsland(3, ISLAND_RADIUS - 2);
      if (distXZ(pos, this.player.pos) > this.T.pickup_radius + 1) break;
    }
    this.motes.push({ id: `M${this.nextMoteId++}`, pos });
  }

  spawnShade(emit) {
    let pos;
    for (let i = 0; i < 30; i++) {
      pos = this.randomPointOnIsland(28, ISLAND_RADIUS - 1);
      if (distXZ(pos, this.player.pos) >= 15 && this.lanterns.every((l) => distXZ(pos, l.pos) > this.T.safe_radius)) break;
    }
    const id = this.newShadeId();
    this.shades.push({ id, pos, stunnedUntil: 0 });
    if (emit) this.emit('shade_spawned', { id });
  }

  emit(name, data) { this.events.push({ type: 'event', tick: this.tick, name, data }); }

  get timeLeft() { return this.ticksLeft / TPS; }

  // One step: reads input for tick k, produces state k+1. Returns events of this step.
  step(input = {}) {
    if (this.state !== 'playing') return [];
    this.events = [];
    const k = this.tick;
    this.tick = k + 1;
    this.ticksLeft = Math.max(0, this.ticksLeft - 1); // time_left_s = duration - steps/60
    const T = this.T, p = this.player;
    const btn = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse };
    const pressed = (b) => btn[b] && !this.prevButtons[b];

    // movement
    let [mx, mz] = input.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.pos[0] += wx * T.player_speed * DT;
    p.pos[2] += wz * T.player_speed * DT;
    const pr = Math.hypot(p.pos[0], p.pos[2]);
    if (pr > ISLAND_RADIUS) { p.pos[0] *= ISLAND_RADIUS / pr; p.pos[2] *= ISLAND_RADIUS / pr; }

    // jump (visual height only; all gameplay distances are XZ)
    if (pressed('jump') && p.pos[1] <= 0) p.vy = JUMP_VELOCITY;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= GRAVITY * DT;
      p.pos[1] += p.vy * DT;
      if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; }
    }

    // pick up motes
    for (let i = 0; i < this.motes.length && p.carried < T.carry_capacity; ) {
      if (distXZ(this.motes[i].pos, p.pos) <= T.pickup_radius) {
        this.motes.splice(i, 1);
        p.carried++;
        this.score += T.score.per_mote;
        this.emit('mote_picked', { carried: p.carried });
      } else i++;
    }

    // interact: deposit into nearest unlit lantern in range
    if (pressed('interact') && p.carried > 0) {
      let best = null, bd = Infinity;
      for (const l of this.lanterns) {
        const d = distXZ(l.pos, p.pos);
        if (!l.lit && d <= T.interact_radius && d < bd) { best = l; bd = d; }
      }
      if (best) {
        const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            this.score += T.score.per_lantern;
            this.emit('lantern_lit', { lantern_id: best.id });
            if (this.lanterns.every((l) => l.lit)) return this.finish('won', 'all_lit');
          }
        }
      }
    }

    // pulse
    if (pressed('pulse') && this.tick >= p.pulseReadyAt && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseReadyAt = this.tick + Math.round(T.pulse_cooldown_s * TPS);
      const ids = [];
      for (const s of this.shades) {
        const d = distXZ(s.pos, p.pos);
        if (d <= T.pulse_radius) {
          ids.push(s.id);
          s.stunnedUntil = this.tick + Math.round(T.pulse_stun_s * TPS);
          let dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2];
          if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
          s.pos[0] += dx * T.pulse_push_m;
          s.pos[2] += dz * T.pulse_push_m;
          this.keepShadeLegal(s);
          this.score += T.score.per_stun;
        }
      }
      this.emit('pulse', { stunned_ids: ids });
    }

    // shades
    for (const s of this.shades) {
      if (this.tick < s.stunnedUntil) continue;
      const dx = p.pos[0] - s.pos[0], dz = p.pos[2] - s.pos[2];
      const d = Math.hypot(dx, dz);
      const stepLen = Math.min(d, T.shade_speed * DT);
      if (d > 1e-9) { s.pos[0] += (dx / d) * stepLen; s.pos[2] += (dz / d) * stepLen; }
      this.keepShadeLegal(s);
    }

    // hits
    if (this.tick >= p.invulnUntil) {
      for (const s of this.shades) {
        if (this.tick < s.stunnedUntil) continue;
        if (distXZ(s.pos, p.pos) <= T.shade_hit_radius) {
          p.flames -= 1;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          p.invulnUntil = this.tick + Math.round(T.invuln_s * TPS);
          this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
          if (p.flames <= 0) return this.finish('lost', 'no_flames');
          break;
        }
      }
    }

    // spawning
    if (this.randomMotes && this.motes.length < MAX_MOTES && this.tick - this.lastMoteSpawn >= MOTE_RESPAWN_TICKS) {
      this.lastMoteSpawn = this.tick;
      this.spawnMote();
    }
    if (this.randomShades && this.shades.length < MAX_SHADES && this.tick - this.lastShadeSpawn >= SHADE_SPAWN_TICKS) {
      this.lastShadeSpawn = this.tick;
      this.spawnShade(true);
    }

    // timer
    if (this.ticksLeft <= 0) return this.finish('lost', 'dawn');

    this.prevButtons = btn;
    return this.events;
  }

  keepShadeLegal(s) {
    for (const l of this.lanterns) {
      const dx = s.pos[0] - l.pos[0], dz = s.pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      const min = this.T.safe_radius + SAFE_EPS;
      if (d < min) {
        const ux = d > 1e-9 ? dx / d : 1, uz = d > 1e-9 ? dz / d : 0;
        s.pos[0] = l.pos[0] + ux * min;
        s.pos[2] = l.pos[2] + uz * min;
      }
    }
    const r = Math.hypot(s.pos[0], s.pos[2]);
    if (r > ISLAND_RADIUS) { s.pos[0] *= ISLAND_RADIUS / r; s.pos[2] *= ISLAND_RADIUS / r; }
  }

  finish(result, reason) {
    if (result === 'won') {
      this.score += Math.floor(this.timeLeft) * this.T.score.per_second_left + this.player.flames * this.T.score.per_flame_left;
    }
    this.state = result;
    this.result = { result, reason };
    this.emit('game_over', { result, reason });
    return this.events;
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(this.timeLeft),
      score: this.score,
      player: { pos: p.pos.map(r3), flames: p.flames, carried: p.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: this.tick < s.stunnedUntil ? 'stunned' : 'chase' })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
    };
  }
}
