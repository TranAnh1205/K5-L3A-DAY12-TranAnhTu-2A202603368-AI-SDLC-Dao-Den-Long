// Web client: menu → night intro → play → result → next night → dawn. Renders the shared
// deterministic sim (src/sim.js) with Three.js. Rendering, audio and UI are presentation only.
import * as THREE from 'three';
import { Game, TPS, DT } from './sim.js';
import { TUNING, RULES } from './tuning.js';
import { buildWorld, PAL } from './scene.js';
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

function makeMay() {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.65, 4, 12), mat(PAL.may)); body.position.y = 0.72;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 8, 16), mat(PAL.scarf)); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), mat(0xf2d0b0)); head.position.y = 1.5;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.42, 24), mat(0xe8d39a)); hat.position.y = 1.85;
  const stringM = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3), new THREE.MeshBasicMaterial({ color: 0x333333 })); stringM.position.set(0, 1.62, 0.65);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ color: PAL.lampLit })); lamp.position.set(0, 1.4, 0.65);
  const light = new THREE.PointLight(PAL.lampLit, 2, 9, 1.5); light.position.copy(lamp.position);
  g.add(body, scarf, head, hat, stringM, lamp, light);
  g.userData = { light, lamp, scarfMat: scarf.material };
  return g;
}
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
function makeShade() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: PAL.shade, emissive: 0x1a0a2a, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(shadeGeo, bodyMat); body.scale.set(1, 1.25, 1);
  const rimMat = new THREE.MeshBasicMaterial({ color: PAL.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.8 });
  const rim = new THREE.Mesh(shadeGeo, rimMat); rim.scale.set(1.12, 1.4, 1.12);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd9c2ff });
  for (const x of [-0.25, 0.25]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeMat); e.position.set(x, 0.3, 0.7); g.add(e); }
  g.add(body, rim);
  g.userData = { bodyMat, rimMat };
  return g;
}
function makeDrifter() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: PAL.drifter, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const segs = [];
  for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4 - i * 0.04), mat); s.position.z = -i * 0.4; g.add(s); segs.push(s); }
  const loot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: PAL.moteHalo })); loot.position.y = 0.4; loot.visible = false; g.add(loot);
  g.userData = { segs, loot };
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
let acc = 0, last = performance.now(), frames = 0, fpsT = performance.now(), fps = 0;
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
  const help = $('help'); help.style.opacity = '0.65'; clearTimeout(helpTimer);
  helpTimer = setTimeout(() => { help.style.opacity = '0'; }, 15000);   // controls reminder fades out
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
function handleEvent(e) {
  const s = audio.sfx;
  switch (e.name) {
    case 'mote_picked': s.pick(e.data.carried); break;
    case 'deposit': s.deposit(); break;
    case 'lantern_lit': s.light(); flash = 1; break;
    case 'pulse': s.pulse(); pulseT = 1; break;
    case 'player_hit': s.hit(); break;
    case 'dash': s.dash(); fovKick = 1; break;
    case 'charm_picked': s.charm(); break;
    case 'drifter_steal': s.steal(); break;
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
    const stun = s.state === 'stunned', spawning = s.state === 'spawning';
    u.bodyMat.color.setHex(stun ? PAL.shadeStun : PAL.shade);
    u.bodyMat.opacity = spawning ? 0.45 : stun ? 0.7 : 0.95;
    u.rimMat.color.setHex(stun ? 0x6a5a9a : PAL.shadeRim);
    v.scale.setScalar(spawning ? 0.4 + 0.6 * (1 - s.left / RULES.shade_spawning_ticks) : 1);
  });
  sync(game.drifters, views.drifters, makeDrifter, (v, d) => {
    v.position.set(d.pos[0], d.pos[1] + Math.sin(t * 2 + d.pos[2]) * 0.2, d.pos[2]);
    const away = d.state === 'flee';
    const dx = away ? d.pos[0] - p.pos[0] : p.pos[0] - d.pos[0], dz = away ? d.pos[2] - p.pos[2] : p.pos[2] - d.pos[2];
    v.rotation.y = Math.atan2(dx, dz) + Math.PI;
    v.userData.segs.forEach((sg, i) => { sg.position.x = Math.sin(t * 6 - i * 0.9) * 0.3; sg.rotation.y = Math.sin(t * 6 - i) * 0.6; });
    v.userData.loot.visible = d.stolen > 0;
  });

  let lit = 0;
  for (const l of game.lanterns) {
    const v = world.lanterns.get(l.id); if (!v) continue;
    const u = v.userData, k = l.deposited / TUNING.lantern_cost;
    if (l.lit) lit++;
    u.lampMat.color.setHex(l.lit ? PAL.lampLit : PAL.lampOff);
    u.lampMat.emissive.setHex(l.lit ? PAL.lampLit : 0x000000);
    u.coreMat.opacity = l.lit ? 1 : k * 0.55;
    u.light.intensity = l.lit ? 7 : k * 2.2;
    u.ringMat.opacity = l.lit ? 0.22 : 0;
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

const hudEl = { flames: $('flames'), timer: $('timer'), right: $('right'), prompt: $('prompt'), arrow: $('arrow'), charm: $('charm'), wind: $('wind'), dash: $('cd-dash'), pulse: $('cd-pulse') };
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

function draw(t, dt) {
  syncViews(t);
  pulseT = Math.max(0, pulseT - dt * 2.2); flash = Math.max(0, flash - dt * 1.5); fovKick = Math.max(0, fovKick - dt * 5);
  const pp = game.player.pos;
  pulseFx.position.set(pp[0], pp[1] + 0.2, pp[2]);
  pulseFx.scale.setScalar(Math.max(0.01, (1 - pulseT) * TUNING.pulse_radius));
  pulseFx.material.opacity = pulseT * 0.8;
  updateLeaves(t, dt);
  const th = (camYaw * Math.PI) / 180;
  camera.position.set(pp[0] - Math.sin(th) * 9, pp[1] + 5.5, pp[2] - Math.cos(th) * 9);
  camera.lookAt(pp[0], pp[1] + 1.5, pp[2]);
  const fov = 60 + fovKick * 6;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  drawHud();
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
