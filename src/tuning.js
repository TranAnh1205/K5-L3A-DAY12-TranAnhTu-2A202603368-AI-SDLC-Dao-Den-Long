// Single source of gameplay numbers. Must equal game.contract.json "tuning"
// (enforced by tests/contract.test.js).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 3,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 2,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: { per_mote: 10, per_lantern: 100, per_stun: 20, per_second_left: 2, per_flame_left: 50 },
};
