// Web client: renders the shared deterministic sim (src/sim.js) with Three.js.
// Rendering, audio and camera are presentation only; gameplay lives in sim.js.
import * as THREE from 'three';
import { Game, TPS, DT, ISLAND_RADIUS } from './sim.js';
import { TUNING } from './tuning.js';

const WARM = 0xffb347, INK = 0x2a1040;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const darkSky = new THREE.Color(0x120a1f), dawnSky = new THREE.Color(0x3a2a55);
scene.background = darkSky.clone();
scene.fog = new THREE.Fog(0x1a0d2e, 15, 70);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
const ambient = new THREE.AmbientLight(0x8a7aba, 0.7);
const moon = new THREE.DirectionalLight(0x9aa0ff, 0.6);
moon.position.set(-20, 40, 10);
scene.add(ambient, moon);

// island + sea of clouds
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 6, 6, 64), new THREE.MeshStandardMaterial({ color: 0x3f6a4e, roughness: 1 }));
island.position.y = -3;
scene.add(island);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshStandardMaterial({ color: 0x3b3260, roughness: 1 }));
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -5;
scene.add(clouds);
for (let i = 0; i < 40; i++) { // decorative rocks/bushes (fixed layout, not gameplay)
  const a = i * 2.39996, r = 8 + ((i * 37) % 30);
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6 + (i % 3) * 0.3, 0), new THREE.MeshStandardMaterial({ color: 0x23392c, flatShading: true }));
  b.position.set(r * Math.sin(a), 0.2, r * Math.cos(a));
  scene.add(b);
}

// Mây: body, nón lá, small lantern hanging from the brim
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 4, 12), new THREE.MeshStandardMaterial({ color: 0x5b7fb8 }));
  body.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2d0b0 }));
  head.position.y = 1.45;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.4, 24), new THREE.MeshStandardMaterial({ color: 0xe8d39a, flatShading: true }));
  hat.position.y = 1.78;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: WARM, emissive: WARM, emissiveIntensity: 1 }));
  lamp.position.set(0, 1.35, 0.7);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), new THREE.MeshBasicMaterial({ color: 0x333333 }));
  string.position.set(0, 1.55, 0.7);
  const light = new THREE.PointLight(WARM, 2, 8);
  light.position.copy(lamp.position);
  g.add(body, head, hat, lamp, string, light);
  g.userData = { lamp, light, body };
  return g;
}

function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2), new THREE.MeshStandardMaterial({ color: 0x5a3b28 }));
  post.position.y = 1.6;
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x553355, emissive: 0x000000 });
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 8), lampMat);
  lamp.position.y = 3.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x8a2a1f }));
  roof.position.y = 4.35;
  const light = new THREE.PointLight(WARM, 0, 26);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.08, TUNING.safe_radius, 48), new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.18 }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(post, lamp, roof, light, ring);
  g.userData = { lampMat, light, ring };
  return g;
}

const moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff08a });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
function makeShade() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: INK, emissive: 0x3a0a5a, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 });
  const blob = new THREE.Mesh(shadeGeo, mat);
  blob.scale.set(1, 1.3, 1);
  blob.position.y = 1;
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc58aff });
  for (const x of [-0.25, 0.25]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat);
    e.position.set(x, 1.3, 0.7);
    g.add(e);
  }
  g.add(blob);
  g.userData = { mat };
  return g;
}

// ---- audio (presentation only) ----
let actx = null;
function tone(freq, dur = 0.25, vol = 0.08, type = 'sine') {
  try {
    actx ||= new AudioContext();
    const o = actx.createOscillator(), gn = actx.createGain();
    o.type = type; o.frequency.value = freq;
    gn.gain.setValueAtTime(vol, actx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(gn).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch { /* audio unavailable */ }
}
const chime = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.6, 0.07, 'triangle'), i * 110));

// ---- game state & views ----
let game, may, lanternViews, moteViews, shadeViews, camYaw = 0;
function newGame() {
  if (may) scene.remove(may);
  for (const v of [...(lanternViews?.values() || []), ...(moteViews?.values() || []), ...(shadeViews?.values() || [])]) scene.remove(v);
  game = new Game({ seed: (Date.now() % 1e9) | 0 });
  may = makeMay(); scene.add(may);
  lanternViews = new Map(); moteViews = new Map(); shadeViews = new Map();
  for (const l of game.lanterns) { const v = makeLantern(); v.position.set(l.pos[0], 0, l.pos[2]); scene.add(v); lanternViews.set(l.id, v); }
  camYaw = 0;
  document.getElementById('overlay').style.display = 'none';
}

function sync(t) {
  const p = game.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const blink = t < 0 ? 1 : (game.tick < p.invulnUntil && Math.floor(t * 10) % 2 === 0 ? 0 : 1);
  may.visible = blink === 1;
  may.userData.light.intensity = 1 + p.carried * 0.4; // hat lantern grows with carried light
  may.userData.lamp.material.emissiveIntensity = 0.6 + p.carried * 0.15;

  // motes: add/remove by id
  const live = new Set(game.motes.map((m) => m.id));
  for (const [id, v] of moteViews) if (!live.has(id)) { scene.remove(v); moteViews.delete(id); }
  for (const m of game.motes) {
    let v = moteViews.get(m.id);
    if (!v) { v = new THREE.Mesh(moteGeo, moteMat); scene.add(v); moteViews.set(m.id, v); }
    const ph = parseInt(m.id.slice(1), 10);
    v.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.15, 1 + Math.sin(t * 2 + ph) * 0.3, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.15);
  }
  const liveS = new Set(game.shades.map((s) => s.id));
  for (const [id, v] of shadeViews) if (!liveS.has(id)) { scene.remove(v); shadeViews.delete(id); }
  for (const s of game.shades) {
    let v = shadeViews.get(s.id);
    if (!v) { v = makeShade(); scene.add(v); shadeViews.set(s.id, v); }
    v.position.set(s.pos[0], Math.sin(t * 3 + s.id.length) * 0.15, s.pos[2]);
    v.lookAt(p.pos[0], v.position.y, p.pos[2]);
    const stunned = game.tick < s.stunnedUntil;
    v.userData.mat.opacity = stunned ? 0.35 : 0.9;
    v.userData.mat.emissive.setHex(stunned ? 0x8866aa : 0x3a0a5a);
  }
  let lit = 0;
  for (const l of game.lanterns) {
    const v = lanternViews.get(l.id);
    const k = l.lit ? 1 : l.deposited / TUNING.lantern_cost * 0.3;
    v.userData.lampMat.emissive.setHex(WARM);
    v.userData.lampMat.emissiveIntensity = k * 1.5;
    v.userData.light.intensity = l.lit ? 6 : k * 2;
    if (l.lit) lit++;
  }
  // island brightens as lanterns are lit
  const f = lit / game.lanterns.length;
  ambient.intensity = 0.7 + f * 0.8;
  scene.background.copy(darkSky).lerp(dawnSky, f);
  scene.fog.far = 70 + f * 60;
}

// ---- input ----
const keys = new Set();
let pulseFx = 0;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') newGame();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
let dragging = false, lastX = 0;
addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (dragging) { camYaw -= (e.clientX - lastX) * 0.3; lastX = e.clientX; } });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function readInput() {
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0); // looking down +Z, screen-right is -X
  const z = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: keys.has('Space'), interact: keys.has('KeyE'), pulse: keys.has('KeyF') };
}

// ---- HUD ----
const hud = document.getElementById('hud'), hint = document.getElementById('hint');
function drawHud() {
  const p = game.player;
  const lit = game.lanterns.filter((l) => l.lit).length;
  const t = Math.ceil(game.timeLeft), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  const cd = Math.max(0, (p.pulseReadyAt - game.tick) / TPS);
  hud.innerHTML = `Lửa: <b>${'●'.repeat(p.flames)}${'○'.repeat(Math.max(0, TUNING.flames - p.flames))}</b><br>` +
    `Đom đóm: <b>${p.carried}/${TUNING.carry_capacity}</b><br>Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>` +
    `Trời sáng sau: <b>${mm}:${ss}</b><br>Điểm: <b>${game.score}</b><br>` +
    `Tỏa sáng (F): <b>${cd > 0 ? cd.toFixed(1) + 's' : p.carried >= TUNING.pulse_cost ? 'sẵn sàng' : 'cần ' + TUNING.pulse_cost + ' đom đóm'}</b>`;
  const near = game.lanterns.find((l) => !l.lit && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  hint.textContent = near ? (p.carried > 0 ? `Nhấn E để nạp ánh sáng vào đèn ${near.id} (${near.deposited}/${TUNING.lantern_cost})` : `Đèn ${near.id}: ${near.deposited}/${TUNING.lantern_cost} — hãy đi gom đom đóm`) : '';
}

function showEnd() {
  const won = game.state === 'won';
  document.getElementById('ov-title').textContent = won ? 'Đảo đã sáng lại!' : 'Mây đã kiệt sức...';
  document.getElementById('ov-text').textContent = (won ? 'Bạn đã thắp hết 5 Đèn Lồng Lớn. ' : game.result.reason === 'dawn' ? 'Trời đã sáng mà đèn chưa thắp đủ. ' : 'Bóng Mực đã dập hết lửa của Mây. ') + `Điểm: ${game.score}`;
  document.getElementById('overlay').style.display = 'flex';
}

function draw(t, dt) {
  sync(t);
  // pulse ring effect
  pulseFx = Math.max(0, pulseFx - dt * 2.5);
  may.userData.light.distance = 8 + pulseFx * TUNING.pulse_radius * 3;
  if (pulseFx > 0) may.userData.light.intensity += pulseFx * 30;
  // third-person camera behind Mây
  const th = (camYaw * Math.PI) / 180, p = game.player.pos;
  camera.position.set(p[0] - Math.sin(th) * 9, 6, p[2] - Math.cos(th) * 9);
  camera.lookAt(p[0], 1.5, p[2]);
  may.rotation.y = th;
  drawHud();
  renderer.render(scene, camera);
}

// ---- loop: fixed 60 Hz sim, render every frame ----
let acc = 0, last = performance.now();
newGame();
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (keys.has('ArrowLeft')) camYaw += 90 * dt;
  if (keys.has('ArrowRight')) camYaw -= 90 * dt;
  acc += dt;
  while (acc >= DT) {
    acc -= DT;
    if (game.state !== 'playing') break;
    for (const e of game.step(readInput())) {
      if (e.name === 'mote_picked') tone(880 + e.data.carried * 40, 0.12, 0.04);
      if (e.name === 'lantern_lit') chime();
      if (e.name === 'deposit') tone(440, 0.3, 0.06, 'triangle');
      if (e.name === 'pulse') { pulseFx = 1; tone(330, 0.4, 0.07, 'sawtooth'); }
      if (e.name === 'player_hit') tone(140, 0.4, 0.1, 'square');
      if (e.name === 'game_over') { e.data.result === 'won' ? chime() : tone(110, 0.8, 0.1); showEnd(); }
    }
  }
  draw(now / 1000, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug/verification hook (used to capture proof screenshots when the tab is hidden).
window.__ddl = { get game() { return game; }, draw: () => draw(performance.now() / 1000, 0), set yaw(v) { camYaw = v; } };
