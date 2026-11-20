// Standard maps (TICKET-02 Part 2). Pure data + geometry queries, no rendering.
// Angles: measured from +X toward +Z (x = r·cosθ, z = r·sinθ). This is the only convention under
// which the night-3 ramps (30°, 150°) meet the z>0 half-ring tier and the 20°..160° mote points lie on it.

const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const rad = (d) => (d * Math.PI) / 180;
const polar = (cx, cz, r, deg) => [r3(cx + r * Math.cos(rad(deg))), r3(cz + r * Math.sin(rad(deg)))];
const ring = (cx, cz, r, start, step, n) => Array.from({ length: n }, (_, i) => polar(cx, cz, r, start + i * step));
const withY = (pts, floorAt) => pts.map(([x, z]) => [x, floorAt(x, z) ?? 0, z]);

// ---- Night 1: Đảo Bến ----
const floor1 = (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null);
const night1 = {
  id: 1,
  name: 'Đảo Bến',
  start: [0, 0, 0],
  floorAt: floor1,
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  moteSpawns: withY([...ring(0, 0, 12, 0, 45, 8), ...ring(0, 0, 33, 0, 22.5, 16)], floor1),
  shadeSpawns: ring(0, 0, 37, 15, 30, 12),
  shadeEvery: 480,
  shadeMax: 6,
  shadeSpeed: 4,
  platforms: [],
  charms: [],
  drifters: false,
  wind: false,
  tower: null,
  center: [0, 0],
};

// ---- Night 2: Đảo Cau ----
const ISLE2 = [{ cx: 0, cz: 0, r: 28 }, { cx: 70, cz: 0, r: 28 }];
const BRIDGE = { x0: 26, x1: 44, hz: 2 };
const floor2 = (x, z) => {
  for (const i of ISLE2) if (Math.hypot(x - i.cx, z - i.cz) <= i.r) return 0;
  if (x >= BRIDGE.x0 && x <= BRIDGE.x1 && Math.abs(z) <= BRIDGE.hz) return 0;
  return null;
};
const launch = (from, to, vy, vh) => {
  const dx = to[0] - from[0], dz = to[1] - from[2], d = Math.hypot(dx, dz);
  return { pos: from, vy, vel: [(dx / d) * vh, (dz / d) * vh] };
};
const night2 = {
  id: 2,
  name: 'Đảo Cau',
  start: [0, 0, 0],
  floorAt: floor2,
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  moteSpawns: withY(ISLE2.flatMap((i) => [...ring(i.cx, i.cz, 10, 0, 90, 4), ...ring(i.cx, i.cz, 22, 0, 45, 8)]), floor2),
  shadeSpawns: ISLE2.flatMap((i) => ring(i.cx, i.cz, 26, 22.5, 45, 8)),
  shadeEvery: 420,
  shadeMax: 8,
  shadeSpeed: 4,
  platforms: [launch([20, 0, 18], [70, 0], 14, 24), launch([50, 0, -18], [0, 0], 14, 24)],
  charms: [[35, 0, 0]],
  drifters: true,
  wind: false,
  tower: null,
  center: [35, 0],
};

// ---- Night 3: Đảo Chuông ----
export const RAMPS = [30, 150].map((deg) => ({ deg, dx: Math.cos(rad(deg)), dz: Math.sin(rad(deg)), width: 3, s0: 24, s1: 30 }));
const floor3 = (x, z) => {
  const r = Math.hypot(x, z);
  if (r > 45) return null;
  let h = 0;
  if (r <= 8) h = 6;
  else if (z > 0 && r >= 12 && r <= 24) h = 3;
  for (const rp of RAMPS) {
    const s = x * rp.dx + z * rp.dz, t = -x * rp.dz + z * rp.dx;
    if (s >= rp.s0 && s <= rp.s1 && Math.abs(t) <= rp.width / 2) h = Math.max(h, (3 * (rp.s1 - s)) / (rp.s1 - rp.s0));
  }
  return h;
};
const night3 = {
  id: 3,
  name: 'Đảo Chuông',
  start: [0, 0, -26], // assumption: (0,0,0) is inside the bell tower on this map
  floorAt: floor3,
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  moteSpawns: withY([...ring(0, 0, 34, 0, 20, 18), ...ring(0, 0, 18, 20, 20, 8), ...ring(0, 0, 5, 45, 90, 4)], floor3),
  shadeSpawns: ring(0, 0, 43, 0, 22.5, 16),
  shadeEvery: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  platforms: [{ pos: [0, 3, 13], vy: 12, vel: [0, -8] }],
  charms: [[30, 0, 25], [-30, 0, 25]],
  drifters: true,
  wind: true,
  tower: { r: 2, h: 8, base: 6 },
  center: [0, 0],
};

export const NIGHTS = { 1: night1, 2: night2, 3: night3 };
export const ISLANDS = { 1: [{ cx: 0, cz: 0, r: 40 }], 2: ISLE2, 3: [{ cx: 0, cz: 0, r: 45 }] };
export { BRIDGE };
