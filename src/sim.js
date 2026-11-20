// Đảo Đèn Lồng — deterministic game logic (no rendering, no DOM). Contract v1.2.
// Shared by the headless CLI and the web client. 60 ticks/s fixed step.
// Per-tick order follows TICKET-02/03; stages are numbered below.

import { TUNING, RULES as R } from './tuning.js';
import { NIGHTS } from './maps.js';

export const TPS = 60;
export const DT = 1 / TPS;

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

const r3 = (v) => Math.round(v * 1000) / 1000 + 0; // +0 turns -0 into 0
const r1 = (v) => Math.round(v * 10) / 10 + 0;     // 1 decimal place for fuel
const dxz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const idNum = (id) => { const m = /(\d+)$/.exec(id); return m ? +m[1] : 0; };
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const EDGE_EPS = 0.002; // shades are held this far outside a safe zone so rounded output stays >= radius

// Fuel is stored as integer ticks (1 tick = 1/60 of a fuel unit) to avoid floating-point drift.
const FUEL_TICKS_MAX = (T) => T.fuel_max * TPS;              // 6000
const FUEL_THRESHOLD_TICKS = (T) => T.low_fuel_threshold * TPS; // 1800

export class Game {
  constructor({ seed = 1, night = 1, scenario = null, tuning = TUNING } = {}) {
    this.T = tuning;
    this.night = night;
    this.map = NIGHTS[night];
    if (!this.map) throw new Error(`unknown night ${night}`);
    this.rng = mulberry32(seed);
    this.tick = 0;      // steps executed (includes paused steps)
    this.simTick = 0;   // gameplay steps executed
    this.paused = false;
    this.over = null;   // 'won' | 'lost'
    this.result = null;
    this.score = 0;
    this.events = [];
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.player = {
      pos: [...this.map.start], vy: 0, grounded: true, hv: [0, 0], ctrl: [0, 0], facing: [0, 1], launch: null,
      flames: tuning.flames, carried: 0, invuln: 0, dashCd: 0, dashLeft: 0, dashDir: [0, 1], pulseCd: 0, charm: 0, respawn: 0,
      successfulLights: 0,  // Phase 3: resets each Night (each Game instance), incremented on successful light/relight
    };
    this.lanterns = this.map.lanterns.map((pos, i) => ({
      id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0,
      fuelTicks: 0,          // Phase 3: fuel stored as integer ticks
      everLit: false,        // Phase 3: has this lantern ever been lit?
      relitCount: 0,         // Phase 3: how many times has it been relit?
    }));
    this.charms = this.map.charms.map((pos, i) => ({ id: `C${i + 1}`, pos: [...pos], available: true, respawn: 0 }));
    this.motes = []; this.shades = []; this.drifters = [];
    this.nextMote = 1; this.nextShade = 1; this.nextDrifter = 1;
    this.randomMotes = true; this.randomShades = true; this.randomDrifters = true;
    this.windEnabled = this.map.wind;
    this.windDir = 0; this.windWarn = false; this.windActive = false;
    this.ticksLeft = Math.round(tuning[`night${night}_duration_s`] * TPS);

    const hasMotes = scenario && 'motes' in scenario;
    if (scenario) this.applyScenario(scenario);
    if (!hasMotes && this.randomMotes) this.initialMotes();
  }

  floor(x, z) { return this.map.floorAt(x, z); }

  // Phase 3: dynamic carry capacity
  get capacity() {
    return Math.min(this.T.capacity_max, this.T.carry_capacity + 2 * this.player.successfulLights);
  }

  // Phase 3: does this lantern have an active safe zone?
  hasZone(l) {
    return l.lit && l.fuelTicks >= FUEL_THRESHOLD_TICKS(this.T);
  }

  initialMotes() {
    const idx = this.map.moteSpawns.map((_, i) => i);
    for (let i = 0; i < R.start_motes && i < idx.length; i++) {
      const j = i + Math.floor(this.rng() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j], idx[i]];
      this.addMote([...this.map.moteSpawns[idx[i]]], 'random', null);
    }
  }

  addMote(pos, kind, ttl) { this.motes.push({ id: `M${this.nextMote++}`, pos, kind, ttl }); }

  applyScenario(s) {
    const p = this.player, T = this.T;
    if (s.random_motes === false) this.randomMotes = false;
    if (s.random_shades === false) this.randomShades = false;
    if (s.random_drifters === false) this.randomDrifters = false;
    if (s.wind_enabled !== undefined) this.windEnabled = !!s.wind_enabled;
    if (s.player) {
      const sp = s.player;
      if (sp.pos) p.pos = [...sp.pos];
      if (sp.carried != null) p.carried = sp.carried;
      if (sp.flames != null) p.flames = sp.flames;
      if (sp.invuln_ticks != null) p.invuln = sp.invuln_ticks;
      if (sp.dash_cd_ticks != null) p.dashCd = sp.dash_cd_ticks;
      if (sp.pulse_cd_ticks != null) p.pulseCd = sp.pulse_cd_ticks;
      if (sp.charm_ticks != null) p.charm = sp.charm_ticks;
      if (sp.successful_lights != null) p.successfulLights = sp.successful_lights;
      const fl = this.floor(p.pos[0], p.pos[2]);
      if (fl !== null && p.pos[1] <= fl + 1e-9) { p.pos[1] = fl; p.grounded = true; } else p.grounded = false;
    }
    if (s.lanterns) {
      for (const l of s.lanterns) {
        let lan = this.lanterns.find((x) => x.id === l.id);
        if (!lan) { lan = { id: l.id, pos: [0, 0, 0], lit: false, deposited: 0, fuelTicks: 0, everLit: false, relitCount: 0 }; this.lanterns.push(lan); }
        if (l.pos) lan.pos = [...l.pos];
        if (l.deposited != null) lan.deposited = l.deposited;
        if (l.lit != null) {
          lan.lit = !!l.lit;
          if (lan.lit) {
            // Scenario-lit: fuel defaults to fuel_max if not provided
            lan.fuelTicks = l.fuel != null ? Math.round(l.fuel * TPS) : FUEL_TICKS_MAX(T);
            lan.everLit = true;
          }
        }
        if (l.ever_lit != null) lan.everLit = !!l.ever_lit;
        if (l.relit_count != null) lan.relitCount = l.relit_count;
      }
    }
    if (s.motes) {
      this.motes = [];
      for (const m of s.motes) {
        if (Array.isArray(m)) this.addMote([...m], 'random', null);
        else this.addMote([...m.pos], m.kind || 'random', m.ttl_ticks ?? (m.ttl_s != null ? Math.round(m.ttl_s * TPS) : null));
      }
    }
    if (s.shades) {
      const used = new Set(s.shades.filter((x) => x.id).map((x) => x.id));
      this.shades = s.shades.map((sh) => {
        let id = sh.id;
        if (!id) { do { id = `S${this.nextShade++}`; } while (used.has(id)); used.add(id); }
        const fl = this.floor(sh.pos[0], sh.pos[2]) ?? 0;
        const shade = this.makeShade(id, [sh.pos[0], fl + 1, sh.pos[2]], sh.state || 'wander', sh.state_ticks_left ?? 0);
        if (sh.target_lantern_id !== undefined) shade.drainTarget = sh.target_lantern_id;
        return shade;
      });
    }
    if (s.drifters) {
      this.drifters = s.drifters.map((d) => {
        const id = d.id || `D${this.nextDrifter++}`;
        return this.makeDrifter(id, [d.pos[0], d.pos[1] ?? R.drifter_y, d.pos[2]], d.state || 'idle', d.state_ticks_left ?? 0, d.stolen ?? 0);
      });
    }
    if (s.charms) {
      this.charms = s.charms.map((c, i) => ({
        id: c.id || `C${i + 1}`, pos: [...(c.pos || this.map.charms[i] || [0, 0, 0])],
        available: c.available !== false && !(c.respawn_ticks > 0), respawn: c.respawn_ticks ?? 0,
      }));
    }
    if (s.time_left_s != null) this.ticksLeft = Math.round(s.time_left_s * TPS);
  }

  makeShade(id, pos, state = 'wander', left = 0) {
    if (left === 0) left = { spawning: R.shade_spawning_ticks, recoil: R.recoil_ticks, stunned: R.pulse_stun_ticks }[state] || 0;
    return { id, pos, state, left, pushLeft: 0, pushDir: [1, 0], pushStep: 0, recoilDir: [1, 0], safe: 0, heading: 0, headLeft: 0, drainTarget: null };
  }
  makeDrifter(id, pos, state = 'idle', left = 0, stolen = 0) {
    if (state === 'flee' && left === 0) left = R.drifter_flee_ticks;
    return { id, pos, state, left, stolen, stoleOnce: stolen > 0 || state === 'flee', heading: 0, headLeft: 0 };
  }

  emit(name, data) { this.events.push({ type: 'event', tick: this.tick, name, data }); }
  get timeLeft() { return this.ticksLeft / TPS; }
  get state() { return this.over || (this.paused ? 'paused' : 'playing'); }

  // ---------------------------------------------------------------- step
  step(input = {}) {
    if (this.over) return [];
    this.events = [];
    this.tick += 1;
    const T = this.T, p = this.player;

    // 1. input; pause first
    const btn = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash, pause: !!input.pause };
    const ed = {};
    for (const b of Object.keys(btn)) ed[b] = btn[b] && !this.prev[b];
    this.prev = btn;
    if (ed.pause) {
      if (!this.paused) { this.paused = true; this.emit('paused', {}); return this.events; }
      this.paused = false; this.emit('resumed', {});
    }
    if (this.paused) return this.events;
    this.simTick += 1;

    // 2. counters + fuel decay
    this.ticksLeft = Math.max(0, this.ticksLeft - 1);
    p.dashCd = Math.max(0, p.dashCd - 1);
    p.pulseCd = Math.max(0, p.pulseCd - 1);
    p.invuln = Math.max(0, p.invuln - 1);
    p.charm = Math.max(0, p.charm - 1);
    for (const s of this.shades) {
      s.safe = Math.max(0, s.safe - 1);
      if (s.left > 0 && --s.left === 0 && s.state !== 'wander' && s.state !== 'chase' && s.state !== 'drain') s.state = 'wander';
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.ttl !== null && --m.ttl <= 0) this.motes.splice(i, 1);
    }
    for (const c of this.charms) if (c.respawn > 0 && --c.respawn === 0) c.available = true;
    this.updateWind();
    let respawned = false;
    if (p.respawn > 0 && --p.respawn === 0) { this.respawnPlayer(); respawned = true; }

    // Phase 3: fuel decay for lit lanterns (1 tick base + 5 ticks per draining shade)
    for (const l of this.lanterns) {
      if (!l.lit) continue;
      let drain = 1; // base 1/60 unit per tick
      for (const s of this.shades) {
        if (s.state === 'drain' && s.drainTarget === l.id) drain += 5; // +5/60 per draining shade
      }
      l.fuelTicks = Math.max(0, l.fuelTicks - drain);
    }
    // Phase 3: emit fuel_drain events every 60 sim_ticks while a shade is draining
    if (this.simTick % 60 === 0) {
      for (const s of this.shades) {
        if (s.state === 'drain' && s.drainTarget) {
          const l = this.lanterns.find((x) => x.id === s.drainTarget);
          if (l && l.lit) this.emit('fuel_drain', { lantern_id: l.id, shade_id: s.id, fuel: r1(l.fuelTicks / TPS) });
        }
      }
    }
    // Phase 3: lanterns with fuel <= 0 go out
    for (const l of this.lanterns) {
      if (l.lit && l.fuelTicks <= 0) {
        l.lit = false; l.fuelTicks = 0; l.deposited = 0;
        this.emit('lantern_out', { lantern_id: l.id });
        // Any shade currently draining this lantern → back to wander
        for (const s of this.shades) {
          if (s.state === 'drain' && s.drainTarget === l.id) {
            s.state = 'wander'; s.drainTarget = null; s.left = 0;
          }
        }
      }
    }

    // 3. move Mây
    if (p.respawn === 0 && !respawned) this.movePlayer(input, ed);
    // 4. pick up motes and charms
    if (p.respawn === 0) this.pickups();
    // 5. interact with lanterns
    if (p.respawn === 0 && ed.interact) this.interact();
    // 6. safe zones
    this.safeZones();
    // 7. pulse
    if (p.respawn === 0 && ed.pulse) this.pulse();
    // 8. move shades and drifters
    this.moveShades();
    this.moveDrifters();
    // 9. hits
    this.hits();
    // 10. spawns
    this.spawns();
    // 11. win / lose
    this.checkEnd();
    return this.events;
  }

  // ---------------------------------------------------------------- stage helpers
  updateWind() {
    const st = this.simTick, per = R.wind_period_ticks;
    this.windWarn = false; this.windActive = false;
    if (!this.windEnabled || st < per - R.wind_warn_ticks) return;
    const phase = st % per;
    if (phase === per - R.wind_warn_ticks) this.windDir = r3(this.rng() * 360);
    if (phase >= per - R.wind_warn_ticks) this.windWarn = true;
    else if (st >= per && phase < R.wind_duration_ticks) this.windActive = true;
  }

  respawnPlayer() {
    const p = this.player;
    p.pos = [...this.map.start]; p.vy = 0; p.grounded = true; p.hv = [0, 0]; p.ctrl = [0, 0];
    p.launch = null; p.dashLeft = 0; p.invuln = R.invuln_ticks;
  }

  blockedByTower(x, z, y) {
    const t = this.map.tower;
    return t && Math.hypot(x, z) < t.r && y < t.base + t.h;
  }

  movePlayer(input, ed) {
    const T = this.T, p = this.player, charm = p.charm > 0;
    const speed = charm ? R.charm_speed : T.player_speed;
    let [mx, mz] = input.move || [0, 0];
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    const th = ((input.cam_yaw_deg || 0) * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) p.facing = [wx / wl, wz / wl];

    const maxD = speed / R.accel_ticks;
    const ex = wx * speed - p.ctrl[0], ez = wz * speed - p.ctrl[1], el = Math.hypot(ex, ez);
    if (el <= maxD) p.ctrl = [wx * speed, wz * speed];
    else p.ctrl = [p.ctrl[0] + (ex / el) * maxD, p.ctrl[1] + (ez / el) * maxD];

    if (ed.jump && p.grounded) { p.vy = R.jump_velocity; p.grounded = false; }
    if (ed.dash && p.dashLeft === 0 && (p.dashCd === 0 || charm)) {
      p.dashDir = wl > 1e-9 ? [wx / wl, wz / wl] : [...p.facing];
      p.dashLeft = Math.round(T.dash_duration_s * TPS);
      p.dashCd = charm ? 0 : Math.round(T.dash_cooldown_s * TPS);
      this.emit('dash', {});
    }

    let hv;
    const dashing = p.dashLeft > 0;
    if (dashing) { hv = [p.dashDir[0] * T.dash_speed, p.dashDir[1] * T.dash_speed]; p.dashLeft -= 1; }
    else if (!p.grounded && p.launch) hv = p.launch;
    else hv = p.ctrl;
    p.hv = hv;
    let wxv = 0, wzv = 0;
    if (this.windActive) { const a = (this.windDir * Math.PI) / 180; wxv = R.wind_speed * Math.cos(a); wzv = R.wind_speed * Math.sin(a); }

    const [x0, y0, z0] = p.pos;
    const tryTo = (nx, nz) => {
      if (this.map.tower && this.blockedByTower(nx, nz, y0)) {
        const k = this.map.tower.r / Math.max(1e-9, Math.hypot(nx, nz));
        nx *= k; nz *= k;
      }
      const fl = this.floor(nx, nz);
      if (fl !== null && fl > y0 + R.step_up) return null;
      return [nx, nz];
    };
    const nx = x0 + (hv[0] + wxv) * DT, nz = z0 + (hv[1] + wzv) * DT;
    const to = tryTo(nx, nz) || tryTo(nx, z0) || tryTo(x0, nz) || [x0, z0];
    p.pos[0] = to[0]; p.pos[2] = to[1];

    const fl = this.floor(p.pos[0], p.pos[2]);
    if (p.grounded) {
      if (fl !== null && fl >= y0 - R.step_down) p.pos[1] = fl;
      else { p.grounded = false; p.vy = 0; }
    } else if (!(dashing)) {
      p.pos[1] = y0 + p.vy * DT - 0.5 * R.gravity * DT * DT;
      p.vy -= R.gravity * DT;
      if (fl !== null && p.pos[1] <= fl && p.vy <= 0) { p.pos[1] = fl; p.vy = 0; p.grounded = true; p.launch = null; }
    }

    if (p.grounded) {
      for (const pad of this.map.platforms) {
        if (Math.hypot(p.pos[0] - pad.pos[0], p.pos[2] - pad.pos[2]) <= 1 && Math.abs(p.pos[1] - pad.pos[1]) <= 0.1) {
          p.vy = pad.vy; p.launch = [...pad.vel]; p.grounded = false;
          break;
        }
      }
    }

    if (p.pos[1] < R.fall_y) {
      p.flames -= 1;
      const lost = p.carried;
      p.carried = 0;
      p.respawn = R.fall_wait_ticks;
      p.hv = [0, 0]; p.vy = 0; p.ctrl = [0, 0]; p.launch = null; p.dashLeft = 0;
      this.emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }

  pickups() {
    const T = this.T, p = this.player;
    const cap = this.capacity; // Phase 3: dynamic capacity
    for (let i = 0; i < this.motes.length && p.carried < cap; ) {
      const m = this.motes[i];
      if (dxz(m.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= R.pickup_dy) {
        this.motes.splice(i, 1);
        p.carried += 1;
        this.emit('mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of this.charms) {
      if (c.available && dxz(c.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= R.pickup_dy) {
        c.available = false; c.respawn = R.charm_respawn_ticks; p.charm = R.charm_ticks;
        this.emit('charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  interact() {
    const T = this.T, p = this.player;
    const fuelMaxTicks = FUEL_TICKS_MAX(T);

    // Phase 3: eligible = unlit OR lit-but-not-full; nearest, ties by id
    let best = null, bd = Infinity;
    for (const l of [...this.lanterns].sort(byId)) {
      const eligible = !l.lit || l.fuelTicks < fuelMaxTicks;
      if (!eligible) continue;
      const d = dxz(l.pos, p.pos);
      if (d <= T.interact_radius && d < bd) { best = l; bd = d; }
    }
    if (!best) return;

    if (!best.lit) {
      // Deposit to light (or relight) a lantern
      const cost = best.everLit ? T.relight_cost : T.lantern_cost;
      const amount = Math.min(p.carried, cost - best.deposited);
      if (amount <= 0) return;
      p.carried -= amount;
      best.deposited += amount;
      this.score += amount * T.score.per_mote;
      this.emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      if (best.deposited >= cost) {
        const relight = best.everLit;
        best.lit = true; best.fuelTicks = fuelMaxTicks; best.deposited = 0;
        best.everLit = true;
        if (relight) best.relitCount += 1;
        p.successfulLights += 1;
        this.score += relight ? T.score.per_relight : T.score.per_lantern;
        this.emit('lantern_lit', { lantern_id: best.id, relight });
        // Push any shades inside the new safe zone out
        for (const s of this.shades) {
          if (dxz(s.pos, best.pos) < T.safe_radius && s.safe === 0) s.safe = R.safe_escort_ticks;
        }
      }
    } else {
      // Phase 3: refuel a lit lantern
      const fuelPerMoteTicks = T.fuel_per_mote * TPS;
      const missingTicks = fuelMaxTicks - best.fuelTicks;
      if (missingTicks <= 0) return; // already full (guard)
      const used = Math.min(p.carried, Math.ceil(missingTicks / fuelPerMoteTicks));
      if (used === 0) return;
      const wasLowFuel = best.fuelTicks < FUEL_THRESHOLD_TICKS(T);
      p.carried -= used;
      best.fuelTicks = Math.min(fuelMaxTicks, best.fuelTicks + used * fuelPerMoteTicks);
      this.score += used * T.score.per_mote;
      this.emit('refuel', { lantern_id: best.id, amount: used, fuel: r1(best.fuelTicks / TPS) });
      // Phase 3: if fuel crossed back above threshold, push draining shades out like a fresh light
      const isNowSafe = best.fuelTicks >= FUEL_THRESHOLD_TICKS(T);
      if (wasLowFuel && isNowSafe) {
        for (const s of this.shades) {
          if (s.state === 'drain' && s.drainTarget === best.id) {
            s.state = 'wander'; s.drainTarget = null; s.left = 0;
          }
          if (dxz(s.pos, best.pos) < T.safe_radius && s.safe === 0) s.safe = R.safe_escort_ticks;
        }
      }
    }
  }

  insideLitZone(pos) {
    // Phase 3: only lanterns with fuel >= threshold have a safe zone
    for (const l of this.lanterns) if (this.hasZone(l) && dxz(l.pos, pos) < this.T.safe_radius) return l;
    return null;
  }

  safeZones() {
    const R6 = this.T.safe_radius, step = R6 / R.safe_escort_ticks;
    for (const s of this.shades) {
      const l = this.insideLitZone(s.pos);
      if (!l) { s.safe = 0; continue; }
      if (s.safe === 0) s.safe = R.safe_escort_ticks;
      let ux = s.pos[0] - l.pos[0], uz = s.pos[2] - l.pos[2];
      const d = Math.hypot(ux, uz);
      if (d < 1e-9) { ux = 1; uz = 0; } else { ux /= d; uz /= d; }
      const nd = Math.min(R6 + EDGE_EPS, d + step);
      s.pos[0] = l.pos[0] + ux * nd; s.pos[2] = l.pos[2] + uz * nd;
      if (nd >= R6) s.safe = 0;
    }
  }

  pulse() {
    const T = this.T, p = this.player;
    if (p.pulseCd > 0 || p.carried < T.pulse_cost) return;
    p.carried -= T.pulse_cost;
    p.pulseCd = Math.round(T.pulse_cooldown_s * TPS);
    const c = [p.pos[0], p.pos[1] + R.pulse_center_dy, p.pos[2]];
    const dist3 = (q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]);
    const ids = [];
    for (const s of this.shades) {
      if (dist3(s.pos) > T.pulse_radius) continue;
      ids.push(s.id);
      let dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < 1e-9) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
      // Phase 3: drain bonus
      const wasDraining = s.state === 'drain';
      if (wasDraining) { s.drainTarget = null; }
      s.state = 'stunned'; s.left = R.pulse_stun_ticks;
      s.pushLeft = R.pulse_push_ticks; s.pushDir = [dx, dz]; s.pushStep = T.pulse_push_m / R.pulse_push_ticks;
      this.score += T.score.per_stun + (wasDraining ? T.score.per_drain_stun_bonus : 0);
    }
    for (const d of this.drifters) {
      if (dist3(d.pos) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.left = R.drifter_flee_ticks; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        for (let i = 0; i < amount; i++) this.addMote([d.pos[0], this.floor(d.pos[0], d.pos[2]) ?? 0, d.pos[2]], 'dropped', R.drop_ttl_ticks);
        d.stolen = 0; d.left = R.drifter_drop_ticks;
        this.emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
    this.emit('pulse', { stunned_ids: ids });
  }

  // Phase 3: constrainShade only uses lanterns with fuel >= threshold
  constrainShade(nx, nz, s) {
    const t = this.map.tower;
    if (t && Math.hypot(nx, nz) < t.r + EDGE_EPS) { const k = (t.r + EDGE_EPS) / Math.max(1e-9, Math.hypot(nx, nz)); nx *= k; nz *= k; }
    const Rs = this.T.safe_radius;
    for (const l of this.lanterns) {
      if (!this.hasZone(l)) continue; // Phase 3: only full-safe lanterns block shades
      const d = Math.hypot(nx - l.pos[0], nz - l.pos[2]);
      if (d < Rs + EDGE_EPS && dxz(s.pos, l.pos) >= Rs) {
        const k = (Rs + EDGE_EPS) / Math.max(1e-9, d);
        nx = l.pos[0] + (nx - l.pos[0]) * k; nz = l.pos[2] + (nz - l.pos[2]) * k;
      }
    }
    return [nx, nz];
  }

  moveShade(s, dx, dz) {
    const fl0 = this.floor(s.pos[0], s.pos[2]) ?? 0;
    const tryPos = (nx, nz) => {
      [nx, nz] = this.constrainShade(nx, nz, s);
      const fl = this.floor(nx, nz);
      if (fl === null || Math.abs(fl - fl0) > 0.5) return false;
      s.pos = [nx, fl + 1, nz];
      return true;
    };
    const x = s.pos[0], z = s.pos[2];
    return tryPos(x + dx, z + dz) || tryPos(x + dx, z) || tryPos(x, z + dz);
  }

  moveShades() {
    const p = this.player, T = this.T;
    const lowThreshTicks = FUEL_THRESHOLD_TICKS(T);
    for (const s of this.shades) {
      if (s.state === 'spawning') continue;
      if (s.state === 'stunned') {
        if (s.pushLeft > 0) { s.pushLeft -= 1; this.moveShade(s, s.pushDir[0] * s.pushStep, s.pushDir[1] * s.pushStep); }
        continue;
      }
      if (s.state === 'recoil') { this.moveShade(s, s.recoilDir[0] * R.recoil_m / R.recoil_ticks, s.recoilDir[1] * R.recoil_m / R.recoil_ticks); continue; }

      // Phase 3: drain state — shade stands still but transitions out
      if (s.state === 'drain') {
        const dLan = s.drainTarget ? this.lanterns.find((x) => x.id === s.drainTarget) : null;
        const dp = dxz(s.pos, p.pos);
        if (dp <= T.safe_radius) {
          // Player got within 6 m → chase
          s.state = 'chase'; s.drainTarget = null; s.left = 0;
        } else if (!dLan || !dLan.lit || dxz(s.pos, dLan.pos) > 2) {
          // Lantern out or shade drifted > 2 m (pushed by escort/stun) → wander
          s.state = 'wander'; s.drainTarget = null; s.left = 0;
        }
        // Note: fuel refueled to >= 30 is handled in interact() which sets state = wander
        continue; // drain shades don't move on their own
      }

      if (s.safe > 0) continue;

      // Player detect/lose
      const d = dxz(s.pos, p.pos);
      if (s.state === 'wander' && d <= R.shade_detect) s.state = 'chase';
      else if (s.state === 'chase' && d > R.shade_lose) s.state = 'wander';

      if (s.state === 'chase') {
        const step = Math.min(d, this.map.shadeSpeed * DT);
        if (d > 1e-9) this.moveShade(s, ((p.pos[0] - s.pos[0]) / d) * step, ((p.pos[2] - s.pos[2]) / d) * step);
      } else {
        // Phase 3: wander state — target low-fuel lanterns if available
        const lowFuelTarget = [...this.lanterns]
          .filter((l) => l.lit && l.fuelTicks < lowThreshTicks)
          .sort((a, b) => {
            const da = dxz(s.pos, a.pos), db = dxz(s.pos, b.pos);
            return da !== db ? da - db : byId(a, b);
          })[0] || null;

        if (lowFuelTarget) {
          const ld = dxz(s.pos, lowFuelTarget.pos);
          if (ld <= 2) {
            // Within 2 m of low-fuel lantern → start draining
            s.state = 'drain'; s.drainTarget = lowFuelTarget.id; s.left = 0;
          } else {
            const sp = Math.min(ld, R.shade_wander_speed * DT);
            this.moveShade(s, (lowFuelTarget.pos[0] - s.pos[0]) / ld * sp, (lowFuelTarget.pos[2] - s.pos[2]) / ld * sp);
          }
        } else {
          // No low-fuel target: normal random wander
          if (--s.headLeft <= 0) { s.heading = this.rng() * 2 * Math.PI; s.headLeft = 90 + Math.floor(this.rng() * 90); }
          const sp = R.shade_wander_speed * DT;
          if (!this.moveShade(s, Math.cos(s.heading) * sp, Math.sin(s.heading) * sp)) s.headLeft = 0;
        }
      }
    }
  }

  moveDrifters() {
    const p = this.player;
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const d = this.drifters[i];
      const dist = dxz(d.pos, p.pos);
      if (d.state === 'idle' || d.state === 'chase') {
        d.state = p.carried >= R.drifter_chase_carry && dist <= R.drifter_chase_dist ? 'chase' : 'idle';
      }
      if (d.state === 'chase') {
        const step = Math.min(dist, R.drifter_speed * DT);
        if (dist > 1e-9) { d.pos[0] += ((p.pos[0] - d.pos[0]) / dist) * step; d.pos[2] += ((p.pos[2] - d.pos[2]) / dist) * step; }
      } else if (d.state === 'idle') {
        if (--d.headLeft <= 0) { d.heading = this.rng() * 2 * Math.PI; d.headLeft = 120 + Math.floor(this.rng() * 120); }
        const nx = d.pos[0] + Math.cos(d.heading) * R.drifter_idle_speed * DT, nz = d.pos[2] + Math.sin(d.heading) * R.drifter_idle_speed * DT;
        if (this.floor(nx, nz) === null) {
          d.heading = Math.atan2(this.map.center[1] - d.pos[2], this.map.center[0] - d.pos[0]); d.headLeft = 60;
        } else { d.pos[0] = nx; d.pos[2] = nz; }
      } else if (d.state === 'flee') {
        let ax = d.pos[0] - p.pos[0], az = d.pos[2] - p.pos[2];
        const l = Math.hypot(ax, az);
        if (l < 1e-9) { ax = 1; az = 0; } else { ax /= l; az /= l; }
        d.pos[0] += ax * R.drifter_speed * DT; d.pos[2] += az * R.drifter_speed * DT;
        if (--d.left <= 0) this.drifters.splice(i, 1);
      }
    }
  }

  ringDrop(n) {
    const p = this.player;
    for (let i = 0; i < n; i++) {
      let pos = null;
      for (let t = 0; t < 12 && !pos; t++) {
        const a = this.rng() * 2 * Math.PI, r = R.drop_ring[0] + this.rng() * (R.drop_ring[1] - R.drop_ring[0]);
        const x = p.pos[0] + Math.cos(a) * r, z = p.pos[2] + Math.sin(a) * r;
        const fl = this.floor(x, z);
        if (fl !== null && Math.abs(fl - p.pos[1]) <= R.pickup_dy) pos = [x, fl, z];
      }
      this.addMote(pos || [p.pos[0], p.pos[1], p.pos[2]], 'dropped', R.drop_ttl_ticks);
    }
  }

  hits() {
    const T = this.T, p = this.player;
    if (p.respawn > 0) return;
    for (const d of [...this.drifters].sort(byId)) {
      if (d.state !== 'chase' || d.stoleOnce || p.carried <= 0) continue;
      if (dxz(d.pos, p.pos) <= R.drifter_hit_radius) {
        const amount = Math.min(R.drifter_steal, p.carried);
        p.carried -= amount; d.stolen = amount; d.stoleOnce = true; d.state = 'flee'; d.left = R.drifter_flee_ticks;
        this.emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
      }
    }
    for (const s of [...this.shades].sort(byId)) {
      // Phase 3: drain state can't hit; also check s.state
      if ((s.state !== 'wander' && s.state !== 'chase') || s.safe > 0) continue;
      if (dxz(s.pos, p.pos) > T.shade_hit_radius || Math.abs(p.pos[1] - (s.pos[1] - 1)) > R.hit_dy) continue;
      if (p.invuln > 0) continue;
      p.flames -= 1;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      p.invuln = R.invuln_ticks;
      this.ringDrop(dropped);
      let ax = s.pos[0] - p.pos[0], az = s.pos[2] - p.pos[2];
      const l = Math.hypot(ax, az);
      if (l < 1e-9) { ax = 1; az = 0; } else { ax /= l; az /= l; }
      s.state = 'recoil'; s.left = R.recoil_ticks; s.recoilDir = [ax, az];
      this.moveShade(s, ax * R.recoil_m / R.recoil_ticks, az * R.recoil_m / R.recoil_ticks);
      this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
    }
  }

  validShadePoints() {
    const p = this.player;
    return this.map.shadeSpawns.filter(([x, z]) => Math.hypot(x - p.pos[0], z - p.pos[2]) >= 15 && !this.insideLitZone([x, 0, z]));
  }

  spawns() {
    const st = this.simTick, T = this.T;
    if (this.randomMotes && st % R.mote_spawn_every === 0 && this.motes.length < R.mote_cap) {
      const free = this.map.moteSpawns.filter((q) => !this.motes.some((m) => Math.hypot(m.pos[0] - q[0], m.pos[2] - q[2]) < 0.05));
      if (free.length) this.addMote([...free[Math.floor(this.rng() * free.length)]], 'random', null);
    }
    if (this.randomShades) {
      const every = this.map.shadeEvery;
      const n = st === R.shade_first_tick ? R.shade_first_count : st > R.shade_first_tick && (st - R.shade_first_tick) % every === 0 ? 1 : 0;
      for (let i = 0; i < n && this.shades.length < this.map.shadeMax; i++) {
        const pts = this.validShadePoints();
        if (!pts.length) break;
        const q = pts[Math.floor(this.rng() * pts.length)];
        const id = this.freeShadeId();
        this.shades.push(this.makeShade(id, [q[0], (this.floor(q[0], q[1]) ?? 0) + 1, q[1]], 'spawning', R.shade_spawning_ticks));
        this.emit('shade_spawned', { id });
      }
    }
    if (this.map.drifters && this.randomDrifters && st % R.drifter_every === 0 && this.drifters.length < R.drifter_max) {
      const q = this.map.shadeSpawns[Math.floor(this.rng() * this.map.shadeSpawns.length)];
      this.drifters.push(this.makeDrifter(`D${this.nextDrifter++}`, [q[0], R.drifter_y, q[1]]));
    }
  }

  freeShadeId() {
    let id;
    do { id = `S${this.nextShade++}`; } while (this.shades.some((s) => s.id === id));
    return id;
  }

  checkEnd() {
    const p = this.player;
    // no_flames always wins over dawn
    if (p.flames <= 0) return this.finish('lost', 'no_flames');
    if (this.ticksLeft <= 0) {
      const litCount = this.lanterns.filter((l) => l.lit).length;
      const threshold = Math.ceil(this.T.win_ratio * this.lanterns.length);
      if (litCount >= threshold) return this.finish('won', 'dawn_survived');
      return this.finish('lost', 'dawn');
    }
  }

  finish(result, reason) {
    if (result === 'won') {
      // Phase 3: dawn bonus per lit lantern + per flame
      for (const l of this.lanterns) {
        if (l.lit) this.score += this.T.score.per_lantern_dawn_base + Math.floor(l.fuelTicks / TPS);
      }
      this.score += this.player.flames * this.T.score.per_flame_left;
    }
    this.over = result;
    this.result = { result, reason };
    this.emit('game_over', { result, reason });
  }

  snapshot() {
    const p = this.player, tl = (n) => r3(n / TPS);
    const vel = p.respawn > 0 ? [0, 0, 0] : [p.hv[0], p.vy, p.hv[1]];
    const capacity = this.capacity;
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      night: this.night,
      time_left_s: r3(this.timeLeft),
      score: this.score,
      wind: { active: this.windActive, dir_deg: this.windDir, warning: this.windWarn },
      player: {
        pos: p.pos.map(r3), vel: vel.map(r3), grounded: p.grounded, invuln: p.invuln > 0,
        dash_cd_s: tl(p.dashCd), pulse_cd_s: tl(p.pulseCd), charm_s: tl(p.charm),
        flames: p.flames, carried: p.carried, capacity,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id, pos: l.pos.map(r3), lit: l.lit, deposited: l.deposited,
        fuel: l.lit ? r1(l.fuelTicks / TPS) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount,
      })),
      shades: this.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.ttl === null ? null : tl(m.ttl) })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: tl(c.respawn) })),
    };
  }
}
