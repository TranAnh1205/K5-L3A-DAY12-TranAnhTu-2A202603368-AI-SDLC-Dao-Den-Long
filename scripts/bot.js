// Simple autopilot used only to produce proof: plays the real sim and records
// the inputs it pressed as a contract-format inputs file. The recorded file is
// then replayed through the headless CLI, so the proof goes through the contract.
import { Game } from '../src/sim.js';
import { TUNING as T } from '../src/tuning.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function playBot(seed, maxTicks = 18000) {
  const g = new Game({ seed });
  const frames = [];
  let prev = null, prevPulse = false, prevInteract = false;
  for (let k = 0; k < maxTicks && g.state === 'playing'; k++) {
    const p = g.player;
    let target, interact = false, pulse = false;
    const threat = g.shades.find((s) => g.tick >= s.stunnedUntil && d2(s.pos, p.pos) < 3.5);
    if (threat && p.carried >= T.pulse_cost && g.tick >= p.pulseReadyAt && !prevPulse) pulse = true;
    const need = Math.min(...g.lanterns.filter((l) => !l.lit).map((l) => T.lantern_cost - l.deposited));
    if (p.carried >= Math.min(T.carry_capacity, need + T.pulse_cost) || (p.carried > 0 && g.motes.length === 0)) {
      const lan = g.lanterns.filter((l) => !l.lit).sort((a, b) => d2(a.pos, p.pos) - d2(b.pos, p.pos))[0];
      target = lan.pos;
      if (d2(lan.pos, p.pos) <= T.interact_radius - 0.5) { interact = !prevInteract; target = null; }
    } else if (g.motes.length) {
      target = g.motes.reduce((b, m) => (d2(m.pos, p.pos) < d2(b.pos, p.pos) ? m : b)).pos;
    }
    let move = [0, 0];
    if (target) {
      let dx = target[0] - p.pos[0], dz = target[2] - p.pos[2];
      // steer away from nearby active shades
      for (const s of g.shades) {
        if (g.tick < s.stunnedUntil) continue;
        const d = d2(s.pos, p.pos);
        if (d < 5) { dx += ((p.pos[0] - s.pos[0]) / d) * 6; dz += ((p.pos[2] - s.pos[2]) / d) * 6; }
      }
      const len = Math.hypot(dx, dz) || 1;
      move = [Math.round((dx / len) * 1000) / 1000, Math.round((dz / len) * 1000) / 1000];
    }
    const input = { move, cam_yaw_deg: 0, interact, pulse };
    const key = JSON.stringify(input);
    if (key !== prev) { frames.push({ tick: k, ...input }); prev = key; }
    prevPulse = pulse; prevInteract = interact;
    g.step(input);
  }
  return { frames, state: g.state, score: g.score, ticks: g.tick, result: g.result };
}
