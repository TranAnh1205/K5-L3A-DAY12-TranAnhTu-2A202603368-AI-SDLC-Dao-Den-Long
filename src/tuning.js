// Standard numbers from TICKET-03 (contract v1.2). Single source of gameplay constants.
// Must equal game.contract.json "tuning" (enforced by tests/cli.test.js).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,          // base capacity; actual = min(capacity_max, 10 + 2*successfulLights)
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 3,
  pulse_radius: 5,
  night1_duration_s: 240,      // CHANGED from 300 (Phase 3)
  night2_duration_s: 270,      // CHANGED from 330 (Phase 3)
  night3_duration_s: 300,      // CHANGED from 360 (Phase 3)
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2,
  pulse_push_m: 4,
  pulse_cooldown_s: 3,
  safe_radius: 6,
  shade_speed: 4,
  shade_hit_radius: 1,
  dash_speed: 14,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  fall_enabled: true,
  // Phase 3 additions
  fuel_max: 100,
  fuel_decay_per_s: 1.0,
  fuel_per_mote: 10,
  relight_cost: 5,
  win_ratio: 0.6,
  drain_per_s: 5,
  low_fuel_threshold: 30,
  capacity_max: 20,
  score: {
    per_mote: 5,                   // CHANGED from 10 (Phase 3); applies to all deposits incl. refuel
    per_lantern: 100,              // first light
    per_relight: 40,               // NEW Phase 3
    per_stun: 5,
    per_drain_stun_bonus: 15,      // NEW Phase 3: bonus when shade was draining
    per_lantern_dawn_base: 50,     // NEW Phase 3: dawn bonus per lit lantern (+ floor(fuel))
    per_flame_left: 50,
    // REMOVED Phase 3: per_second_left (time bonus gone)
  },
};

// Constants from the ticket that are not part of the contract "tuning" block.
export const RULES = {
  jump_velocity: 7,
  gravity: 20,
  accel_ticks: 3,            // reach full speed / stop in 3 ticks (0.05 s, <= 0.1 s)
  pickup_dy: 1.5,
  hit_dy: 1.5,
  pulse_center_dy: 0.8,
  pulse_push_ticks: 15,
  pulse_stun_ticks: 120,
  recoil_m: 2,
  recoil_ticks: 60,
  invuln_ticks: 90,
  drop_ttl_ticks: 480,
  drop_ring: [1.5, 2.5],
  fall_y: -10,
  fall_wait_ticks: 60,
  safe_escort_ticks: 30,
  start_motes: 20,
  mote_cap: 30,
  mote_spawn_every: 240,
  shade_first_tick: 300,
  shade_first_count: 2,
  shade_detect: 12,
  shade_lose: 18,
  shade_wander_speed: 2,
  shade_spawning_ticks: 30,
  drifter_speed: 7,
  drifter_idle_speed: 2,
  drifter_every: 1200,
  drifter_max: 2,
  drifter_chase_carry: 5,
  drifter_chase_dist: 15,
  drifter_hit_radius: 1.2,
  drifter_steal: 3,
  drifter_flee_ticks: 240,
  drifter_drop_ticks: 120,
  drifter_y: 1.5,
  charm_ticks: 600,
  charm_respawn_ticks: 2700,
  charm_speed: 7.2,
  wind_period_ticks: 1800,
  wind_duration_ticks: 300,
  wind_warn_ticks: 120,
  wind_speed: 2,
  step_up: 0.3,
  step_down: 0.35,
};
