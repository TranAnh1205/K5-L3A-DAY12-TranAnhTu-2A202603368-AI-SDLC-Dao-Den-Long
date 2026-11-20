// Web client: menu → night intro → play → result → next night → dawn. Renders the shared
// deterministic sim (src/sim.js) with Three.js. Rendering, audio and UI are presentation only.
import * as THREE from 'three';
import { Game, TPS, DT } from './sim.js';
import { TUNING, RULES } from './tuning.js';
import { buildWorld, buildSky, PAL } from './scene.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const NIGHT_INFO = {
  1: { name: 'Đêm 1 — Đảo Bến', sub: 'Thắp 5 Đèn Lồng Lớn trước bình minh (5:00).', quote: '"Con ơi, sương đen đã nuốt hết ánh sáng của đảo. Hãy gom đom đóm về thắp lại từng ngọn đèn nhé." — Ông Đăng' },
  2: { name: 'Đêm 2 — Đảo Cau', sub: 'Hai hòn đảo, một cầu tre, 6 ngọn đèn (5:30). Bục vàng sẽ bắn con sang đảo bên kia. Coi chừng Gió Lạc!', quote: '"Gió Lạc thích đom đóm lắm. Ai mang nhiều, nó đuổi theo ngay. Tỏa sáng một cái là nó bỏ chạy." — Ông Đăng' },
  3: { name: 'Đêm 3 — Đảo Chuông', sub: 'Đảo ba tầng, 7 ngọn đèn (6:00). Gió mạnh thổi từng đợt, lá bay là dấu hiệu báo trước.', quote: '"Đèn cuối cùng nằm sát tháp chuông. Đi dốc, hoặc nhảy bục. Nhớ bám chắc khi lá bay lên." — Ông Đăng' },
};

// ---------------------------------------------------------------- settings (persisted)
const settings = { volume: 0.6, sens: 1 };
try { Object.assign(settings, JSON.parse(localStorage.getItem('ddl-settings') || '{}')); } catch { /* private mode */ }
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* ignore */ } };
const audio = createAudio(() => settings.volume);

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.Fog(PAL.fog, 28, 110);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
const ambient = new THREE.AmbientLight(0xb8b0ff, 0.15);
const moon = new THREE.DirectionalLight(0x8f9cff, 0.35);
moon.position.set(-20, 40, 10);
scene.add(ambient, moon);
// starry sky + moon (animated)
const sky = buildSky(); scene.add(sky);
// shooting star
const shootGeo = new THREE.BufferGeometry();
shootGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const shootLine = new THREE.Line(shootGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
scene.add(shootLine);
let shootT = -1, shootStart = new THREE.Vector3(), shootEnd = new THREE.Vector3();
function spawnShootingStar() {
  shootT = 0;
  const a = Math.random() * Math.PI * 2, r = 150;
  shootStart.set(Math.cos(a) * r, 80 + Math.random() * 20, Math.sin(a) * r);
  shootEnd.set(shootStart.x + Math.cos(a + 1) * 40, shootStart.y - 15, shootStart.z + Math.sin(a + 1) * 40);
}
// decorative fireflies (never pickable; purely visual)
const decoFlies = [];
function rebuildDecoFlies(n) {
  for (const f of decoFlies) scene.remove(f);
  decoFlies.length = 0;
  if (!world) return;
  const cx = night === 2 ? 35 : 0, cz = 0;
  for (let i = 0; i < 50; i++) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: PAL.moteCore, transparent: true, opacity: 0.9 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.2 }));
    g.add(core, halo);
    g.userData = { a: i * 0.5, r: 8 + (i * 3.7) % 30, y: 1 + ((i * 13) % 4), speed: 0.3 + ((i * 7) % 5) * 0.1 };
    scene.add(g); decoFlies.push(g);
  }
}
// particle pool for lantern-lit sparkles and score pops
const particlePool = [];
function spawnParticles(pos, color, count = 14) {
  for (let i = 0; i < count; i++) {
    let p = particlePool.find((x) => !x.alive);
    if (!p) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
      scene.add(mesh);
      p = { mesh, alive: false };
      particlePool.push(p);
    }
    p.alive = true; p.mesh.visible = true; p.mesh.material.color.setHex(color);
    p.mesh.position.set(pos[0], pos[1], pos[2]);
    const a = Math.random() * Math.PI * 2;
    const up = 2 + Math.random() * 2;
    p.vx = Math.cos(a) * (1 + Math.random() * 2);
    p.vz = Math.sin(a) * (1 + Math.random() * 2);
    p.vy = up;
    p.life = 1.2;
  }
}
function updateParticles(dt) {
  for (const p of particlePool) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
    p.vy -= 6 * dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.material.opacity = Math.min(1, p.life);
    p.mesh.scale.setScalar(Math.max(0.3, p.life));
  }
}

function makeMay() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const matBasic = (c) => new THREE.MeshBasicMaterial({ color: c });
  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 4, 12), mat(PAL.may)); torso.position.y = 0.95;
  // sash across chest
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.4), mat(PAL.scarf)); sash.position.y = 1.0; sash.rotation.z = 0.3;
  // scarf as flowing ribbon
  const scarfG = new THREE.Group(); scarfG.position.set(0, 1.2, -0.05);
  const scarfSegs = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.35 - i * 0.04, 0.08, 0.06), mat(PAL.scarf)); s.position.set(0, -i * 0.11, -0.05 - i * 0.03); scarfG.add(s); scarfSegs.push(s); }
  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), mat(0xf2d0b0)); head.position.y = 1.5;
  // eyes
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), matBasic(0x120a1a)); eyeL.position.set(-0.08, 1.55, 0.22);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), matBasic(0x120a1a)); eyeR.position.set(0.08, 1.55, 0.22);
  // cheeks
  const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), matBasic(0xff9aa6)); cheekL.position.set(-0.14, 1.48, 0.2);
  const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), matBasic(0xff9aa6)); cheekR.position.set(0.14, 1.48, 0.2);
  // nón lá: wide brim + tall cone
  const brim = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.22, 24, 1, true), mat(0xe8d39a)); brim.position.y = 1.78;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 24), mat(0xd9c08a)); cone.position.y = 2.05;
  const brimRing = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.02, 6, 32), matBasic(PAL.wood)); brimRing.rotation.x = Math.PI / 2; brimRing.position.y = 1.72;
  // arms (will animate)
  const armGeo = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
  const armL = new THREE.Mesh(armGeo, mat(PAL.may)); armL.position.set(-0.38, 1.05, 0);
  const armR = new THREE.Mesh(armGeo, mat(PAL.may)); armR.position.set(0.38, 1.05, 0);
  // legs
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.38, 4, 8);
  const legL = new THREE.Mesh(legGeo, mat(0x3a4d6b)); legL.position.set(-0.15, 0.3, 0);
  const legR = new THREE.Mesh(legGeo, mat(0x3a4d6b)); legR.position.set(0.15, 0.3, 0);
  // hanging lantern: string + lamp
  const stringM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3), matBasic(0x333333)); stringM.position.set(0, 1.62, 0.7);
  const lampHolder = new THREE.Group(); lampHolder.position.set(0, 1.5, 0.7);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), matBasic(PAL.lampLit)); lampHolder.add(lamp);
  const lampGlow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0.4 })); lampHolder.add(lampGlow);
  const light = new THREE.PointLight(PAL.lampLit, 2.2, 10, 1.5); light.position.set(0, 1.5, 0.7);
  // shadow blob under feet
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
  // charm halo
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 32), matBasic(PAL.gold)); halo.rotation.x = Math.PI / 2; halo.position.y = 2.2; halo.visible = false;
  g.add(torso, sash, scarfG, head, eyeL, eyeR, cheekL, cheekR, brim, cone, brimRing, armL, armR, legL, legR, stringM, lampHolder, light, shadow, halo);
  g.userData = { light, lamp, lampGlow, lampHolder, scarfMat: sash.material, scarfSegs, armL, armR, legL, legR, head, eyeL, eyeR, halo, shadow };
  return g;
}
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: PAL.shade, emissive: 0x1a0a2a, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(shadeGeo, bodyMat); body.scale.set(1, 1.25, 1);
  const rimMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.8 });
  const rim = new THREE.Mesh(shadeGeo, rimMat); rim.scale.set(1.12, 1.4, 1.12);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9c2ff, transparent: true, opacity: 1 });
  const eyes = [];
  for (const x of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeMat); e.position.set(x, 0.3, 0.7); g.add(e); eyes.push(e); }
  // trailing smoke tendrils (3 small spheres)
  const smokeMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim, transparent: true, opacity: 0.3 });
  const smokes = [];
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.35 - i * 0.07, 8, 6), smokeMat.clone()); s.position.set(0, -0.3 - i * 0.2, 0); g.add(s); smokes.push(s); }
  // stunned star overhead
  const starMat = new THREE.MeshBasicMaterial({ color: PAL.gold });
  const star = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), starMat); star.position.y = 1.6; star.visible = false; g.add(star);
  // shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshBasicMaterial({ color: 0x120a1a, transparent: true, opacity: 0.4, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  g.add(body, rim, shadow);
  g.userData = { bodyMat, rimMat, eyeMat, eyes, smokes, star, shadow };
  return g;
}
function makeDrifter() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: PAL.drifter, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const headMat = new THREE.MeshBasicMaterial({ color: PAL.drifter, transparent: true, opacity: 0.9 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), headMat); head.scale.set(1, 0.7, 1.3); g.add(head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0e1430 });
  for (const x of [-0.08, 0.08]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), eyeMat); e.position.set(x, 0.03, 0.18); g.add(e); }
  const segs = [];
  // 10 ribbon segments to look like flowing silk
  for (let i = 0; i < 10; i++) {
    const w = 0.5 - i * 0.03, h = 0.35 - i * 0.025;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.08, w), Math.max(0.1, h)), mat);
    s.position.z = -0.2 - i * 0.35;
    g.add(s); segs.push(s);
  }
  // loot motes sparkle along the ribbon
  const lootMat = new THREE.MeshBasicMaterial({ color: PAL.moteHalo });
  const lootSparks = [];
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), lootMat); l.visible = false; g.add(l); lootSparks.push(l); }
  g.userData = { segs, lootSparks, headMat, mat };
  return g;
}
const moteCore = new THREE.SphereGeometry(0.13, 8, 6), moteHaloG = new THREE.SphereGeometry(0.32, 8, 6);
const moteCoreM = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
const moteHaloM = new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.35 });
function makeMote() { const g = new THREE.Group(); g.add(new THREE.Mesh(moteCore, moteCoreM), new THREE.Mesh(moteHaloG, moteHaloM)); return g; }

const pulseFx = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: PAL.lampLit, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseFx.rotation.x = -Math.PI / 2;
scene.add(pulseFx);
const leaves = [];
for (let i = 0; i < 40; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ color: i % 2 ? PAL.grass : PAL.sand, side: THREE.DoubleSide })); l.visible = false; scene.add(l); leaves.push(l); }

// ---------------------------------------------------------------- state
let state = 'menu';        // menu | intro | playing | paused | result | dawn
let night = 1, total = 0;
let game = null, world = null, may = null;
const views = { motes: new Map(), shades: new Map(), drifters: new Map() };
let camYaw = 0, lastSecond = -1, fovKick = 0, pulseT = 0, flash = 0;
let acc = 0, last = performance.now(), frames = 0, fpsT = performance.now(), fps = 0, stepAcc = 0, bellAcc = 0;
const keys = new Set();

function showScreen(id) { for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id); $('hud').style.display = 'none'; }
function hideScreens() { for (const s of document.querySelectorAll('.screen')) s.classList.remove('show'); $('hud').style.display = 'block'; }

function buildNight(n) {
  if (world) scene.remove(world.group);
  if (may) scene.remove(may);
  for (const m of Object.values(views)) { for (const v of m.values()) scene.remove(v); m.clear(); }
  night = n;
  world = buildWorld(n);
  scene.add(world.group);
  may = makeMay(); scene.add(may);
  rebuildDecoFlies();
  game = new Game({ seed: (Math.random() * 1e9) | 0, night: n });
  camYaw = 0; lastSecond = -1; acc = 0;
  const mk = $('motes'); mk.innerHTML = '';
  for (let i = 0; i < TUNING.carry_capacity; i++) mk.appendChild(document.createElement('i'));
}

function beginNight(n, skipIntro = false) {
  buildNight(n);
  if (skipIntro) { startPlaying(); return; }
  const info = NIGHT_INFO[n];
  $('intro-title').textContent = info.name; $('intro-sub').textContent = info.sub; $('intro-quote').textContent = info.quote;
  state = 'intro'; showScreen('intro'); draw(performance.now() / 1000, 0);
}
let helpTimer = 0;
function startPlaying() {
  audio.ensure(); audio.startMusic(); state = 'playing'; hideScreens(); acc = 0; last = performance.now();
  const help = $('help'); help.style.opacity = '0.55'; clearTimeout(helpTimer);
  helpTimer = setTimeout(() => { help.style.opacity = '0'; }, 8000);   // controls reminder fades out quickly
}

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  game.step({ pause: true }); game.step({ pause: false });  // sim-level pause: logic frozen, tick counter still runs
  showScreen('pause');
}
function resumeGame() {
  if (state !== 'paused') return;
  game.step({ pause: true });
  state = 'playing'; hideScreens(); last = performance.now(); acc = 0;
}
function endNight() {
  const won = game.over === 'won';
  audio.stopMusic(); won ? audio.sfx.win() : audio.sfx.lose();
  if (won) total += game.score;
  state = 'result';
  $('res-title').textContent = won ? `${NIGHT_INFO[night].name}: đèn đã sáng!` : 'Mây đã kiệt sức...';
  $('res-text').textContent = won ? 'Bạn đã thắp hết các Đèn Lồng Lớn.' : game.result.reason === 'dawn' ? 'Trời đã sáng mà đèn chưa thắp đủ.' : 'Bóng Mực và vực sâu đã dập hết Ngọn Lửa của Mây.';
  $('stats').textContent = `Điểm đêm này: ${game.score}` + (won ? ` · Tổng: ${total}` : '');
  $('b-next').style.display = won ? '' : 'none';
  $('b-next').textContent = night < 3 ? 'Đêm tiếp theo' : 'Đón Bình Minh';
  $('b-retry').style.display = won ? 'none' : '';
  showScreen('result');
}

// ---------------------------------------------------------------- UI wiring
const click = (id, fn) => $(id).addEventListener('click', () => { audio.ensure(); audio.sfx.click(); fn(); });
let settingsBack = 'menu';
function openSettings(from) {
  settingsBack = from;
  $('s-vol').value = Math.round(settings.volume * 100); $('s-sens').value = Math.round(settings.sens * 100);
  $('s-vol-v').textContent = `${Math.round(settings.volume * 100)}%`; $('s-sens-v').textContent = `${Math.round(settings.sens * 100)}%`;
  showScreen('settings');
}
click('b-play', () => { total = 0; beginNight(1); });
click('b-settings', () => openSettings('menu'));
click('b-start', startPlaying);
click('b-resume', resumeGame);
click('b-restart', () => beginNight(night, true));
click('b-psettings', () => openSettings('pause'));
click('b-pmenu', () => { audio.stopMusic(); state = 'menu'; showScreen('menu'); });
click('b-sback', () => showScreen(settingsBack));
click('b-next', () => {
  if (night < 3) { beginNight(night + 1); return; }
  state = 'dawn'; $('dawn-score').textContent = `Tổng điểm: ${total}`; showScreen('dawn');
});
click('b-retry', () => beginNight(night, true));
click('b-rmenu', () => { state = 'menu'; showScreen('menu'); });
click('b-dmenu', () => { state = 'menu'; showScreen('menu'); });
$('s-vol').addEventListener('input', (e) => { settings.volume = e.target.value / 100; $('s-vol-v').textContent = `${e.target.value}%`; audio.setVolume(settings.volume); saveSettings(); });
$('s-sens').addEventListener('input', (e) => { settings.sens = e.target.value / 100; $('s-sens-v').textContent = `${e.target.value}%`; saveSettings(); });

addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (state === 'playing') pauseGame(); });
let dragging = false, lastX = 0;
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => { if (dragging && state === 'playing') { camYaw -= (e.clientX - lastX) * 0.3 * settings.sens; lastX = e.clientX; } });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function readInput() {
  const x = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);   // camera looks down +Z at yaw 0: screen-right is -X
  const z = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  return {
    move: [x, z], cam_yaw_deg: camYaw, jump: keys.has('Space'), interact: keys.has('KeyE'),
    pulse: keys.has('KeyF') || keys.has('KeyQ'), dash: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

// ---------------------------------------------------------------- per-frame presentation
let shakeT = 0, shakeAmp = 0;
function shake(amp = 0.25) { shakeT = 0.25; shakeAmp = amp; }
function popScore(amount, worldPos, color) {
  const el = document.createElement('div');
  el.className = 'score-pop'; el.textContent = `+${amount}`;
  el.style.color = color; document.body.appendChild(el);
  el.dataset.pos = JSON.stringify(worldPos);
  el.dataset.life = '1.4';
  scorePops.push(el);
}
const scorePops = [];
function updateScorePops(dt) {
  for (let i = scorePops.length - 1; i >= 0; i--) {
    const el = scorePops[i];
    const life = parseFloat(el.dataset.life) - dt;
    if (life <= 0) { el.remove(); scorePops.splice(i, 1); continue; }
    el.dataset.life = String(life);
    const wp = JSON.parse(el.dataset.pos);
    const v = new THREE.Vector3(wp[0], wp[1] + 2 + (1.4 - life) * 1.2, wp[2]).project(camera);
    if (v.z > 1 || v.z < -1) { el.style.opacity = '0'; continue; }
    el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
    el.style.opacity = String(Math.min(1, life));
  }
}
function handleEvent(e) {
  const s = audio.sfx, p = game.player;
  switch (e.name) {
    case 'mote_picked':
      s.pick(e.data.carried);
      popScore(0, p.pos, '#FFF6C2'); // visual only - actual score comes at deposit
      break;
    case 'deposit':
      s.deposit();
      popScore(e.data.amount * TUNING.score.per_mote, p.pos, '#F2C14E');
      break;
    case 'lantern_lit':
      s.light(); flash = 1;
      const lan = game.lanterns.find((l) => l.id === e.data.lantern_id);
      if (lan) { spawnParticles([lan.pos[0], lan.pos[1] + 3.6, lan.pos[2]], PAL.lampLit, 20); popScore(TUNING.score.per_lantern, lan.pos, '#FFB347'); }
      break;
    case 'pulse':
      s.pulse(); pulseT = 1; shake(0.3);
      spawnParticles([p.pos[0], p.pos[1] + 1, p.pos[2]], PAL.lampCore, 16);
      if (e.data.stunned_ids.length) popScore(e.data.stunned_ids.length * TUNING.score.per_stun, p.pos, '#FFE58A');
      break;
    case 'player_hit':
      s.hit(); shake(e.data.by === 'fall' ? 0.6 : 0.4);
      spawnParticles([p.pos[0], p.pos[1] + 1, p.pos[2]], 0xff5a5f, 10);
      break;
    case 'dash': s.dash(); fovKick = 1; break;
    case 'charm_picked': s.charm(); spawnParticles([p.pos[0], p.pos[1] + 1, p.pos[2]], PAL.gold, 20); break;
    case 'drifter_steal': s.steal(); shake(0.2); break;
    case 'shade_spawned': s.spawn(); break;
    default: break;
  }
}

function syncViews(t) {
  const p = game.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  may.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  may.visible = !(p.invuln > 0 && Math.floor(t * 10) % 2 === 0) && p.respawn === 0;
  may.userData.light.intensity = 1.2 + p.carried * 0.35 + pulseT * 14;
  may.userData.light.distance = 9 + pulseT * 10;
  may.userData.scarfMat.color.setHex(p.charm > 0 ? PAL.gold : PAL.scarf);
  // run animation: swing arms/legs with horizontal speed
  const spd = Math.hypot(p.hv[0], p.hv[1]);
  const runPh = t * (6 + spd * 0.8);
  const swing = Math.min(spd / 6, 1) * 0.55;
  may.userData.armL.rotation.x = Math.sin(runPh) * swing;
  may.userData.armR.rotation.x = -Math.sin(runPh) * swing;
  may.userData.legL.rotation.x = -Math.sin(runPh) * swing;
  may.userData.legR.rotation.x = Math.sin(runPh) * swing;
  // jump pose + lantern bob
  const airLift = p.grounded ? 0 : Math.min(0.4, Math.max(-0.2, p.vy * 0.04));
  may.userData.armL.rotation.x += airLift * 0.5;
  may.userData.armR.rotation.x += airLift * 0.5;
  may.userData.lampHolder.rotation.z = Math.sin(runPh * 0.9) * 0.3 * Math.min(spd / 6, 1);
  may.userData.lampHolder.rotation.x = Math.cos(runPh * 0.9) * 0.15 * Math.min(spd / 6, 1);
  may.userData.lampGlow.material.opacity = 0.35 + p.carried * 0.03 + pulseT * 0.4;
  // scarf wave
  may.userData.scarfSegs.forEach((s, i) => {
    s.rotation.x = Math.sin(t * 3 - i * 0.5) * 0.3 + (spd > 1 ? -0.4 : 0);
    s.rotation.z = Math.sin(t * 2 - i * 0.6) * 0.2;
  });
  // eye expression
  const low = p.flames <= 1, happy = flash > 0.5;
  const eyeScale = low ? 0.6 : happy ? 1.3 : 1;
  may.userData.eyeL.scale.set(1, eyeScale, 1);
  may.userData.eyeR.scale.set(1, eyeScale, 1);
  may.userData.eyeMat && (may.userData.eyeMat.color = may.userData.eyeMat.color);
  // charm halo
  may.userData.halo.visible = p.charm > 0;
  if (p.charm > 0) { may.userData.halo.rotation.z = t * 2; may.userData.halo.position.y = 2.2 + Math.sin(t * 3) * 0.05; }
  // hit flash: tint body red briefly
  const hurt = p.invuln > 60; // right after a hit
  const tint = hurt ? 0xff8888 : PAL.may;
  // shadow follows ground under feet
  const feetY = p.grounded ? 0 : -p.pos[1] + 0.01;
  may.userData.shadow.position.y = feetY;
  may.userData.shadow.material.opacity = Math.max(0.1, 0.4 - Math.max(0, p.pos[1]) * 0.05);
  void tint;

  const sync = (list, map, make, apply) => {
    const live = new Set(list.map((o) => o.id));
    for (const [id, v] of map) if (!live.has(id)) { scene.remove(v); map.delete(id); }
    for (const o of list) { let v = map.get(o.id); if (!v) { v = make(); scene.add(v); map.set(o.id, v); } apply(v, o); }
  };
  sync(game.motes, views.motes, makeMote, (v, m) => {
    const ph = parseInt(m.id.slice(1), 10);
    v.position.set(m.pos[0] + Math.sin(t * 1.3 + ph) * 0.12, m.pos[1] + 0.9 + Math.sin(t * 2 + ph) * 0.25, m.pos[2] + Math.cos(t * 1.1 + ph) * 0.12);
    v.visible = !(m.ttl !== null && m.ttl < 120 && Math.floor(t * 8) % 2 === 0);
  });
  sync(game.shades, views.shades, makeShade, (v, s) => {
    const u = v.userData;
    v.position.set(s.pos[0], s.pos[1] - 0.2 + Math.sin(t * 3 + s.pos[0]) * 0.12, s.pos[2]);
    v.lookAt(p.pos[0], v.position.y, p.pos[2]);
    const stun = s.state === 'stunned', spawning = s.state === 'spawning', chase = s.state === 'chase';
    u.bodyMat.color.setHex(stun ? PAL.shadeStun : PAL.shade);
    u.bodyMat.opacity = spawning ? 0.45 : stun ? 0.7 : 0.95;
    u.rimMat.color.setHex(stun ? 0x6a5a9a : PAL.shadeRim);
    v.scale.setScalar(spawning ? 0.4 + 0.6 * (1 - s.left / RULES.shade_spawning_ticks) : 1);
    // eyes glow stronger during chase
    u.eyeMat.color.setHex(chase ? 0xffb347 : stun ? 0xd9c2ff : 0xd9c2ff);
    u.eyeMat.opacity = stun ? 0.4 : 1;
    // smoke tendrils trail behind
    u.smokes.forEach((sm, i) => {
      sm.position.set(Math.sin(t * 2 + i) * 0.1, -0.25 - i * 0.22 + Math.sin(t * 3 + i) * 0.08, Math.cos(t * 2 + i) * 0.1);
      sm.material.opacity = (chase ? 0.4 : 0.25) * (spawning ? 0.3 : 1);
      sm.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.1);
    });
    u.star.visible = stun;
    if (stun) { u.star.rotation.z = t * 3; u.star.rotation.x = Math.PI / 2; }
    u.shadow.position.y = -(s.pos[1] - 1) - 0.1; // ground relative
    u.shadow.material.opacity = 0.4 * (spawning ? 0.4 : 1);
  });
  sync(game.drifters, views.drifters, makeDrifter, (v, d) => {
    v.position.set(d.pos[0], d.pos[1] + Math.sin(t * 2 + d.pos[2]) * 0.2, d.pos[2]);
    const away = d.state === 'flee';
    const dx = away ? d.pos[0] - p.pos[0] : p.pos[0] - d.pos[0], dz = away ? d.pos[2] - p.pos[2] : p.pos[2] - d.pos[2];
    v.rotation.y = Math.atan2(dx, dz) + Math.PI;
    v.userData.segs.forEach((sg, i) => {
      sg.position.x = Math.sin(t * 6 - i * 0.7) * (0.25 + i * 0.03);
      sg.position.y = Math.cos(t * 5 - i * 0.6) * 0.1;
      sg.rotation.y = Math.sin(t * 6 - i) * 0.7;
      sg.rotation.z = Math.cos(t * 4 - i * 0.5) * 0.3;
    });
    // loot sparkles flow along the ribbon
    v.userData.lootSparks.forEach((spark, i) => {
      spark.visible = d.stolen > 0;
      if (d.stolen > 0) {
        const ph = t * 2 + i * 1.3;
        const idx = ((ph % 10) + 10) % 10;
        const seg = v.userData.segs[Math.floor(idx)];
        spark.position.set(seg.position.x, seg.position.y, seg.position.z);
      }
    });
  });

  let lit = 0;
  for (const l of game.lanterns) {
    const v = world.lanterns.get(l.id); if (!v) continue;
    const u = v.userData, k = l.deposited / TUNING.lantern_cost;
    if (l.lit) lit++;
    const flicker = 1 + Math.sin(t * 6 + l.pos[0]) * 0.12 + Math.sin(t * 13 + l.pos[2]) * 0.06;
    // cage: lit => warm orange + translucent (so flame shows); off => dull grey opaque
    u.lampMat.color.setHex(l.lit ? PAL.lampLit : PAL.lampOff);
    u.lampMat.emissive.setHex(l.lit ? PAL.lampLit : 0x000000);
    u.lampMat.emissiveIntensity = l.lit ? 1.5 * flicker : 0;
    u.lampMat.opacity = l.lit ? 0.45 : 1;
    // flame + white-hot core + tongue
    u.flameMat.opacity = l.lit ? 0.95 * flicker : k * 0.4;
    u.coreMat.opacity = l.lit ? 1 : 0;
    u.tongueMat.opacity = l.lit ? 0.85 * flicker : 0;
    u.tongue.scale.y = l.lit ? 0.8 + Math.sin(t * 8 + l.pos[0]) * 0.3 : 1;
    // light: very bright when lit
    u.light.intensity = l.lit ? 14 * flicker : k * 2.5;
    u.light.color.setHex(l.lit ? PAL.lampLit : PAL.lampLit);
    // multi-layer glow
    u.glow1Mat.opacity = l.lit ? 0.5 * flicker : 0;
    u.glow2Mat.opacity = l.lit ? 0.25 * flicker : 0;
    u.glow3Mat.opacity = l.lit ? 0.12 * flicker : 0;
    // vertical beam going up
    u.beamMat.opacity = l.lit ? 0.08 + Math.sin(t * 2 + l.pos[0]) * 0.03 : 0;
    // ground halo pool
    u.haloDiscMat.opacity = l.lit ? 0.35 * flicker : 0;
    // safe-zone ring
    u.ringMat.opacity = l.lit ? 0.3 : 0;
    u.progMat.opacity = !l.lit && k > 0 ? 0.55 * k : 0;
  }
  for (const c of game.charms) {
    const v = world.charms.get(c.id);
    if (v) { v.visible = c.available; v.rotation.y = t * 1.6; v.position.y = c.pos[1] + 1.1 + Math.sin(t * 2) * 0.12; }
  }
  ambient.intensity = 0.15 + 0.55 * (lit / game.lanterns.length) + flash * 0.4;   // standard formula + a short flash on lighting
}

function updateLeaves(t, dt) {
  const on = game.windWarn || game.windActive;
  const a = (game.windDir * Math.PI) / 180, p = game.player.pos;
  leaves.forEach((l, i) => {
    l.visible = on;
    if (!on) return;
    const speed = game.windActive ? 9 : 2.5;
    l.userData.s = (l.userData.s ?? i * 7.3) + dt * speed;
    const s = (((l.userData.s % 30) + 30) % 30) - 15, side = ((i * 37) % 30) - 15;
    l.position.set(p[0] + Math.cos(a) * s - Math.sin(a) * side, p[1] + 1 + ((i * 13) % 5) * 0.8 + Math.sin(t * 3 + i) * 0.3, p[2] + Math.sin(a) * s + Math.cos(a) * side);
    l.rotation.set(t * 3 + i, t * 2, i);
  });
}

const hudEl = { flames: $('flames'), timer: $('timer'), right: $('right'), prompt: $('prompt'), arrow: $('arrow'), charm: $('charm'), wind: $('wind'), dash: $('cd-dash'), pulse: $('cd-pulse'), minimap: $('minimap-c')?.getContext('2d') };
function drawMinimap() {
  const ctx = hudEl.minimap; if (!ctx) return;
  const SZ = 160, C = SZ / 2;
  ctx.clearRect(0, 0, SZ, SZ);
  const p = game.player.pos;
  const R = 60; // meters shown on the minimap
  const toXY = (x, z) => [C + (x - p[0]) * C / R, C + (z - p[2]) * C / R];
  // subtle grid rings
  ctx.strokeStyle = 'rgba(242,193,78,0.12)'; ctx.lineWidth = 1;
  for (let r = C / 3; r < C; r += C / 3) { ctx.beginPath(); ctx.arc(C, C, r, 0, Math.PI * 2); ctx.stroke(); }
  // lit lanterns pulse
  const t = performance.now() / 1000;
  for (const l of game.lanterns) {
    const [mx, my] = toXY(l.pos[0], l.pos[2]);
    if (mx < 5 || mx > SZ - 5 || my < 5 || my > SZ - 5) continue;
    if (l.lit) {
      const r = 6 + Math.sin(t * 3 + l.pos[0]) * 1;
      ctx.beginPath(); ctx.arc(mx, my, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,179,71,0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fillStyle = '#FFB347'; ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#5B5F6E'; ctx.fill();
      ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }
  for (const s of game.shades) {
    const [mx, my] = toXY(s.pos[0], s.pos[2]);
    if (mx < 5 || mx > SZ - 5 || my < 5 || my > SZ - 5) continue;
    ctx.beginPath(); ctx.arc(mx, my, s.state === 'chase' ? 4 : 3, 0, Math.PI * 2);
    ctx.fillStyle = s.state === 'stunned' ? '#6a5a9a' : s.state === 'chase' ? '#FF5A5F' : '#7A3CFF'; ctx.fill();
  }
  for (const d of game.drifters) {
    const [mx, my] = toXY(d.pos[0], d.pos[2]);
    if (mx < 5 || mx > SZ - 5 || my < 5 || my > SZ - 5) continue;
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#8FA3B8'; ctx.fill();
  }
  // Mây at center with facing arrow + glow
  ctx.save(); ctx.translate(C, C);
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(242,193,78,0.25)'; ctx.fill();
  const facing = Math.atan2(game.player.facing[0], game.player.facing[1]);
  ctx.rotate(-facing);
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fillStyle = '#FFE9B0'; ctx.fill();
  ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  // compass N marker
  ctx.fillStyle = 'rgba(242,193,78,0.6)'; ctx.font = 'bold 10px Quicksand, sans-serif';
  ctx.textAlign = 'center'; ctx.fillText('N', C, 10);
}
function drawHud() {
  const p = game.player, lit = game.lanterns.filter((l) => l.lit).length;
  hudEl.flames.innerHTML = Array.from({ length: TUNING.flames }, (_, i) => `<span class="${i < p.flames ? '' : 'off'}">🔥</span>`).join('');
  const t = Math.ceil(game.timeLeft);
  hudEl.timer.textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  hudEl.timer.classList.toggle('low', game.timeLeft <= 30);
  hudEl.right.innerHTML = `Đèn <b>${lit}/${game.lanterns.length}</b><br>Điểm <b>${game.score}</b>`;
  [...$('motes').children].forEach((el, i) => el.classList.toggle('on', i < p.carried));
  const setCd = (el, frac, ready) => { el.querySelector('.fill').style.height = `${Math.round(frac * 100)}%`; el.classList.toggle('ready', ready); el.classList.toggle('noluck', !ready && frac === 0); };
  setCd(hudEl.dash, p.charm > 0 ? 0 : p.dashCd / Math.round(TUNING.dash_cooldown_s * TPS), p.dashCd === 0 || p.charm > 0);
  setCd(hudEl.pulse, p.pulseCd / Math.round(TUNING.pulse_cooldown_s * TPS), p.pulseCd === 0 && p.carried >= TUNING.pulse_cost);
  hudEl.charm.style.display = p.charm > 0 ? 'block' : 'none';
  hudEl.charm.textContent = `BÙA GIÓ ${(p.charm / TPS).toFixed(1)}s`;
  hudEl.wind.style.display = game.windWarn || game.windActive ? 'block' : 'none';
  hudEl.wind.textContent = game.windActive ? '🍃 Gió mạnh!' : '🍃 Gió sắp nổi!';
  const near = game.lanterns.filter((l) => !l.lit).map((l) => [Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]), l]).sort((a, b) => a[0] - b[0])[0];
  hudEl.prompt.textContent = near && near[0] <= TUNING.interact_radius ? `E — Nạp ánh sáng (${near[1].deposited}/${TUNING.lantern_cost})${p.carried ? '' : ' · cần đom đóm'}` : '';
  // arrow towards the nearest unlit lantern when it is off screen
  hudEl.arrow.style.display = 'none';
  if (near) {
    const v = new THREE.Vector3(near[1].pos[0], near[1].pos[1] + 3, near[1].pos[2]).project(camera);
    if (v.z > 1 || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.9) {
      let x = v.x, y = v.y; if (v.z > 1) { x = -x; y = -y; }
      const ang = Math.atan2(y, x);
      const ex = innerWidth / 2 + Math.cos(ang) * innerWidth * 0.42, ey = innerHeight / 2 - Math.sin(ang) * innerHeight * 0.38;
      hudEl.arrow.style.display = 'block';
      hudEl.arrow.style.left = `${Math.max(30, Math.min(innerWidth - 30, ex)) - 14}px`;
      hudEl.arrow.style.top = `${Math.max(60, Math.min(innerHeight - 90, ey)) - 17}px`;
      hudEl.arrow.style.transform = `rotate(${90 - (ang * 180) / Math.PI}deg)`;
    }
  }
}

// camera zoom (mouse wheel); clamp [6, 14]
let camDist = 9;
addEventListener('wheel', (e) => { if (state !== 'playing' && state !== 'paused') return; camDist = Math.max(6, Math.min(14, camDist + Math.sign(e.deltaY) * 0.5)); e.preventDefault(); }, { passive: false });
// shooting star every 30-60 s of real time
let starTimer = 15;
const camLook = new THREE.Vector3();
function draw(t, dt) {
  syncViews(t);
  pulseT = Math.max(0, pulseT - dt * 2.2); flash = Math.max(0, flash - dt * 1.5); fovKick = Math.max(0, fovKick - dt * 5);
  shakeT = Math.max(0, shakeT - dt);
  const pp = game.player.pos;
  pulseFx.position.set(pp[0], pp[1] + 0.2, pp[2]);
  pulseFx.scale.setScalar(Math.max(0.01, (1 - pulseT) * TUNING.pulse_radius));
  pulseFx.material.opacity = pulseT * 0.8;
  updateLeaves(t, dt);
  updateParticles(dt);
  updateScorePops(dt);
  // sky animation: rotate stars slowly, twinkle moon
  sky.rotation.y = t * 0.005;
  const halo = sky.userData.halo;
  halo.material.opacity = 0.18 + Math.sin(t * 0.5) * 0.04;
  // shooting star
  starTimer -= dt;
  if (starTimer <= 0) { spawnShootingStar(); starTimer = 25 + Math.random() * 25; }
  if (shootT >= 0) {
    shootT += dt;
    const k = Math.min(1, shootT / 0.6);
    const sx = shootStart.x + (shootEnd.x - shootStart.x) * k;
    const sy = shootStart.y + (shootEnd.y - shootStart.y) * k;
    const sz = shootStart.z + (shootEnd.z - shootStart.z) * k;
    const back = Math.max(0, k - 0.3);
    const tx = shootStart.x + (shootEnd.x - shootStart.x) * back;
    const ty = shootStart.y + (shootEnd.y - shootStart.y) * back;
    const tz = shootStart.z + (shootEnd.z - shootStart.z) * back;
    const arr = shootGeo.attributes.position.array;
    arr[0] = sx; arr[1] = sy; arr[2] = sz; arr[3] = tx; arr[4] = ty; arr[5] = tz;
    shootGeo.attributes.position.needsUpdate = true;
    shootLine.material.opacity = Math.max(0, 1 - k) * 0.9;
    if (k >= 1) shootT = -1;
  } else shootLine.material.opacity = 0;
  // decorative fireflies drift around
  const cx = night === 2 ? 35 : 0, cz = 0;
  for (const f of decoFlies) {
    const d = f.userData;
    d.a += dt * d.speed;
    f.position.set(cx + Math.cos(d.a) * d.r, d.y + Math.sin(t + d.a) * 0.5, cz + Math.sin(d.a) * d.r);
  }
  // camera: smooth yaw, follow with lerp, screen shake
  const th = (camYaw * Math.PI) / 180;
  const targetY = pp[1] + 5.5;
  const targetPos = new THREE.Vector3(pp[0] - Math.sin(th) * camDist, targetY, pp[2] - Math.cos(th) * camDist);
  camera.position.lerp(targetPos, Math.min(1, dt * 8));
  camLook.set(pp[0], pp[1] + 1.5, pp[2]);
  camera.lookAt(camLook);
  if (shakeT > 0) {
    const s = shakeT * shakeAmp;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }
  const fov = 60 + fovKick * 6;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  drawHud();
  drawMinimap();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- main loop: fixed 60 Hz sim
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  frames++;
  if (now - fpsT >= 1000) { fps = (frames * 1000) / (now - fpsT); frames = 0; fpsT = now; }
  if (game && state === 'playing') {
    if (keys.has('ArrowLeft')) camYaw += 90 * dt * settings.sens;
    if (keys.has('ArrowRight')) camYaw -= 90 * dt * settings.sens;
    acc += dt;
    while (acc >= DT && !game.over) {
      acc -= DT;
      const wasGrounded = game.player.grounded;
      for (const e of game.step(readInput())) handleEvent(e);
      if (wasGrounded && !game.player.grounded && game.player.vy > 0) audio.sfx.jump();
      const sec = Math.ceil(game.timeLeft);
      if (game.timeLeft <= 10 && sec !== lastSecond && !game.over) { lastSecond = sec; audio.sfx.tick(sec <= 3); }
      // footsteps + distant bell
      const spd = Math.hypot(game.player.hv[0], game.player.hv[1]);
      if (spd > 2 && game.player.grounded) {
        stepAcc += dt;
        if (stepAcc > 0.28) { stepAcc = 0; audio.sfx.step(); }
      } else stepAcc = 0;
      bellAcc += dt;
      if (bellAcc > 60) { bellAcc = 0; audio.sfx.bell(); }
    }
    if (game.over) endNight();
  }
  if (game && (state === 'playing' || state === 'paused' || state === 'intro' || state === 'result')) draw(now / 1000, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug / verification hook (the Browser pane throttles rAF when hidden, so checks drive the sim directly).
window.__ddl = {
  get game() { return game; }, get state() { return state; }, get fps() { return fps; },
  begin: (n) => { total = 0; beginNight(n, true); }, draw: () => draw(performance.now() / 1000, 0.016),
  set yaw(v) { camYaw = v; }, pause: pauseGame, resume: resumeGame, settings,
  benchmark(frameCount = 120) {           // renders N frames back-to-back, returns avg ms/frame and fps
    const t0 = performance.now();
    for (let i = 0; i < frameCount; i++) { game.step({ move: [0, 1], cam_yaw_deg: i * 2 }); camYaw = i * 2; draw(i / 60, 0.016); }
    renderer.getContext().finish?.();
    const ms = (performance.now() - t0) / frameCount;
    return { ms, fps: 1000 / ms };
  },
};
