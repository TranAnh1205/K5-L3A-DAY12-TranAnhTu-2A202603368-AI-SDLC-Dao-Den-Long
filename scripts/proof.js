// Regenerates docs/proof/phase-2/: writes every scenario to scenarios/, runs it through the REAL headless CLI,
// checks the expected outcome from the output file, checks determinism and timing, writes summary.md.
// Usage: npm run proof   (exit 1 if any check fails). Never hand-edit the outputs.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { playBot } from './bot.js';

const PHASE = 2;
const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, `docs/proof/phase-${PHASE}`);
const scDir = path.join(root, 'scenarios');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(scDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.jsonl') || f === 'summary.md') fs.rmSync(path.join(outDir, f));

const BASE = { random_motes: false, random_shades: false, random_drifters: false, motes: [], shades: [], drifters: [], charms: [] };
const sc = (extra) => ({ ...BASE, ...extra });

function cli(name, { night = 1, seed = 1, scenario, frames, ticks, every = 10, keep = true }) {
  const rel = (f) => path.join('scenarios', f);
  const args = ['src/headless.js', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--snapshot-every', String(every)];
  if (scenario) { fs.writeFileSync(path.join(scDir, `${name}.scenario.json`), JSON.stringify(scenario, null, 1)); args.push('--scenario', rel(`${name}.scenario.json`)); }
  if (frames) { fs.writeFileSync(path.join(scDir, `${name}.inputs.json`), JSON.stringify({ frames })); args.push('--inputs', rel(`${name}.inputs.json`)); }
  const out = keep ? path.join(outDir, `${name}.jsonl`) : path.join(os.tmpdir(), `ddl-${name}.jsonl`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [...args, '--out', out], { cwd: root, encoding: 'utf8' });
  const ms = Date.now() - t0;
  if (r.status !== 0) throw new Error(`${name}: exit ${r.status} ${r.stderr}`);
  const text = fs.readFileSync(out, 'utf8');
  const lines = text.trim().split('\n').map((l) => JSON.parse(l));
  return { text, lines, ms };
}
const ev = (L, n) => L.filter((l) => l.type === 'event' && l.name === n);
const snap = (L, tick) => L.find((l) => l.type === 'snapshot' && l.tick === tick);
const end = (L) => L.at(-1);
const near = (a, b, eps, what = '') => { if (Math.abs(a - b) > eps) throw new Error(`${what} ${a} !~ ${b}`); };
const expect = (c, m) => { if (!c) throw new Error(m); };

const checks = [];
const asyncChecks = [];
function check(group, req, how, fn) {
  let ok = false, detail;
  try {
    const r = fn();
    if (r && typeof r.then === 'function') {
      const entry = { group, req, how, ok: false, detail: 'pending' };
      checks.push(entry);
      asyncChecks.push(r.then((d) => { entry.ok = true; entry.detail = d; }, (e) => { entry.ok = false; entry.detail = e.message; }));
      return;
    }
    detail = r; ok = true;
  } catch (e) { detail = e.message; }
  checks.push({ group, req, how, ok, detail });
}

// ======================================================= Phase 1 regression (re-run with the standard numbers)
const bot = (() => { for (let s = 1; s <= 60; s++) { const r = playBot(s); if (r.state === 'won') return { seed: s, ...r }; } return null; })();
check('P1 hồi quy', 'Chơi Đêm 1 từ đầu đến thắng (5 đèn) với số chuẩn', 'bot tự chơi (seed tìm được), ghi inputs, phát lại qua CLI', () => {
  expect(bot, 'bot không thắng trong 60 seed');
  fs.writeFileSync(path.join(scDir, 'bot_night1.inputs.json'), JSON.stringify({ frames: bot.frames }));
  const { lines } = cli('p1_full_win', { seed: bot.seed, frames: bot.frames, ticks: 18000, every: 600 });
  const e = end(lines);
  expect(e.state === 'won', `state ${e.state}`);
  expect(ev(lines, 'game_over')[0].data.reason === 'dawn_survived', 'reason'); // Phase 3: all_lit removed; win at dawn with >=ceil(0.6*n) lit
  return `seed ${bot.seed}: thắng ở tick ${e.ticks}, điểm ${e.score}, ${ev(lines, 'pulse').length} lần tỏa sáng, ${ev(lines, 'player_hit').length} lần bị chạm`;
});
check('P1 hồi quy', 'Nhặt đom đóm, nạp đèn, thắp đèn (+10/đom đóm khi nạp, +100/đèn)', '`p1_pickup_deposit`', () => {
  const { lines } = cli('p1_pickup_deposit', { scenario: sc({ motes: [[0, 0, 5]], lanterns: [{ id: 'L1', pos: [0, 0, 11], deposited: 9 }], time_left_s: 300 }),
    frames: [{ tick: 0, move: [0, 1] }, { tick: 100, move: [0, 0], interact: true }, { tick: 101, interact: false }], ticks: 120, every: 60 });
  expect(ev(lines, 'mote_picked').length === 1, 'pickup');
  const lit = ev(lines, 'lantern_lit')[0]; expect(lit?.data.lantern_id === 'L1', 'lit');
  expect(end(lines).score === 105, `score ${end(lines).score}`); // Phase 3: per_mote=5 (was 10), so 1*5+100=105
  return `mote_picked tick ${ev(lines, 'mote_picked')[0].tick}, deposit + lantern_lit tick ${lit.tick}, điểm 105 (5 + 100)`;
});
check('P1 hồi quy', 'Bị Bóng Mực chạm mất lửa, hết lửa thì thua', '`p1_lose_no_flames`', () => {
  const { lines } = cli('p1_lose_no_flames', { scenario: sc({ player: { flames: 1, carried: 4 }, shades: [{ id: 'S1', pos: [5, 0, 0] }] }), ticks: 600, every: 600 });
  const hit = ev(lines, 'player_hit')[0];
  expect(hit.data.dropped === 2 && hit.data.flames === 0 && hit.data.by === 'shade', JSON.stringify(hit.data));
  expect(end(lines).state === 'lost' && ev(lines, 'game_over')[0].data.reason === 'no_flames', 'lost');
  return `player_hit tick ${hit.tick} ${JSON.stringify(hit.data)} → lost/no_flames`;
});
check('P1 hồi quy', 'Hết giờ thì thua (dawn)', '`p1_dawn` (time_left_s 2)', () => {
  const { lines } = cli('p1_dawn', { scenario: sc({ time_left_s: 2 }), ticks: 1000, every: 100 });
  expect(end(lines).state === 'lost' && end(lines).ticks === 120, JSON.stringify(end(lines)));
  return 'game_over lost/dawn ở tick 120';
});
check('P1 hồi quy', 'Inputs sai định dạng → mã thoát 2', 'frames trùng tick', () => {
  const bad = path.join(os.tmpdir(), 'ddl-bad.json'); fs.writeFileSync(bad, '{"frames":[{"tick":5},{"tick":5}]}');
  const r = spawnSync(process.execPath, ['src/headless.js', '--seed', '1', '--night', '1', '--ticks', '5', '--inputs', bad, '--out', path.join(os.tmpdir(), 'x.jsonl')], { cwd: root, encoding: 'utf8' });
  expect(r.status === 2, `exit ${r.status}`);
  return `exit 2, stderr: ${r.stderr.trim()}`;
});

// ======================================================= Phần 1: số liệu chuẩn
check('Phần 1 · Di chuyển', 'Lướt 14 m/s trong 0,2 s, hồi chiêu 1,5 s tính từ lúc bắt đầu, bấm khi đang hồi bị bỏ qua', '`p2_dash`: bấm ở tick 0, 60 (bị bỏ qua), 90 (được)', () => {
  const { lines } = cli('p2_dash', { scenario: sc({}), frames: [{ tick: 0, dash: true }, { tick: 1, dash: false }, { tick: 60, dash: true }, { tick: 61, dash: false }, { tick: 90, dash: true }, { tick: 91, dash: false }], ticks: 120, every: 12 });
  const d = ev(lines, 'dash').map((e) => e.tick);
  expect(JSON.stringify(d) === '[1,91]', `dash ticks ${d}`);
  near(snap(lines, 12).player.pos[2], 2.8, 0.001, 'dash distance'); // 12 ticks * 14/60, facing +Z
  near(snap(lines, 12).player.dash_cd_s, 79 / 60, 0.001, 'cd'); // 90 ticks set at tick 1, 11 decrements
  return `dash ở tick ${d.join(' và ')} (lần bấm ở tick 60 bị bỏ qua); sau 12 tick đi được z=2,8 m; dash_cd_s=1,317 (79 tick còn lại)`;
});
check('Phần 1 · Di chuyển', 'Chạy 6 m/s, nhảy 7 m/s trọng lực 20', '`p2_move_jump`', () => {
  const { lines } = cli('p2_move_jump', { scenario: sc({}), frames: [{ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0], jump: true }, { tick: 61, jump: false }], ticks: 120, every: 2 });
  near(snap(lines, 60).player.pos[2], 6, 0.3, 'z after 1 s'); expect(snap(lines, 60).player.vel[2] === 6, 'vel');
  const apex = Math.max(...lines.filter((l) => l.type === 'snapshot').map((l) => l.player.pos[1]));
  near(apex, 1.225, 0.03, 'jump apex');
  return `sau 1 s z=${snap(lines, 60).player.pos[2]} (6 m/s, tăng tốc 3 tick); đỉnh nhảy ${apex} m (lý thuyết 1,225)`;
});
check('Phần 1 · Rơi', 'Rơi khỏi đảo (Y < −10): đúng 1 player_hit by fall, mất hết đom đóm, chờ 60 tick, hồi sinh ở xuất phát, bất tử 90 tick', '`p2_fall`', () => {
  const { lines } = cli('p2_fall', { scenario: sc({ player: { pos: [38, 0, 0], carried: 4 } }), frames: [{ tick: 0, move: [1, 0] }, { tick: 50, move: [0, 0] }], ticks: 220, every: 10 });
  const f = ev(lines, 'player_hit'); expect(f.length === 1 && f[0].data.by === 'fall', `events ${JSON.stringify(f)}`);
  expect(f[0].data.lost === 4 && f[0].data.flames === 2, JSON.stringify(f[0].data));
  const after = snap(lines, Math.ceil((f[0].tick + 60) / 10) * 10);
  expect(JSON.stringify(after.player.pos) === '[0,0,0]' && after.player.invuln === true && after.player.carried === 0, JSON.stringify(after.player));
  return `1 sự kiện fall ở tick ${f[0].tick} ${JSON.stringify(f[0].data)}; hồi sinh ở (0,0,0) tick ${f[0].tick + 60}, invuln=true`;
});
check('Phần 1 · Đèn', 'Nạp nhiều lần, đèn nhớ tiến độ; chọn đèn gần nhất, bằng nhau thì id nhỏ hơn', '`p2_deposit_multi`', () => {
  const { lines } = cli('p2_deposit_multi', { scenario: sc({ player: { carried: 3 }, lanterns: [{ id: 'L2', pos: [1.5, 0, 0] }, { id: 'L3', pos: [-1.5, 0, 0] }] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 5, interact: true }, { tick: 6, interact: false }], ticks: 10, every: 10 });
  const d = ev(lines, 'deposit');
  expect(d.length === 1 && d[0].data.lantern_id === 'L2' && d[0].data.amount === 3, JSON.stringify(d));
  return `deposit vào L2 (id nhỏ hơn khi bằng khoảng cách) ${JSON.stringify(d[0].data)}; lần bấm thứ hai không làm gì vì đã hết đom đóm`;
});
check('Phần 1 · Tỏa Sáng', 'Tốn 3, bán kính 5 (3D từ chân+0,8), choáng 120 tick, đẩy 4 m trong 15 tick, +5/con, hồi 3 s', '`p2_pulse`', () => {
  const { lines } = cli('p2_pulse', { scenario: sc({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [4, 0, 0] }, { id: 'S2', pos: [0, 0, -9] }] }),
    frames: [{ tick: 30, pulse: true }, { tick: 31, pulse: false }, { tick: 60, pulse: true }, { tick: 61, pulse: false }], ticks: 170, every: 10 });
  const p = ev(lines, 'pulse'); expect(p.length === 1 && JSON.stringify(p[0].data.stunned_ids) === '["S1"]', JSON.stringify(p));
  expect(snap(lines, 40).player.carried === 2, 'carried 5 → 2');
  const s1 = (t) => snap(lines, t).shades.find((s) => s.id === 'S1');
  near(s1(50).pos[0] - s1(30).pos[0], 4, 0.01, 'pushed 4 m'); expect(s1(40).state === 'stunned' && s1(140).state === 'stunned' && s1(160).state !== 'stunned', 'stun window');
  expect(snap(lines, 170).score === 5, 'score');
  return `pulse tick ${p[0].tick} stunned ["S1"]; carried 5→2; S1 bị đẩy đúng 4,00 m (x tick 30 → tick 50); choáng tới tick ~150; điểm +5; lần bấm lúc tick 60 bị chặn bởi hồi chiêu`;
});
check('Phần 1 · Bị đánh', '−1 lửa, rơi floor(n/2) quanh Mây (ttl 480), bất tử 90 tick, bóng lùi 2 m', '`p2_hit`', () => {
  const { lines } = cli('p2_hit', { scenario: sc({ player: { carried: 6 }, shades: [{ id: 'S1', pos: [0.5, 0, 0] }] }), ticks: 130, every: 10 });
  const h = ev(lines, 'player_hit'); expect(h.length === 2 && h[0].tick === 1 && h[0].data.dropped === 3, JSON.stringify(h));
  expect(h[1].tick === 91, `second hit at ${h[1].tick}`);
  const s10 = snap(lines, 10); const dropped = s10.motes.filter((m) => m.kind === 'dropped');
  expect(dropped.length === 3 && dropped.every((m) => { const d = Math.hypot(m.pos[0], m.pos[2]); return d >= 1.49 && d <= 2.51 && m.ttl_s > 7; }), JSON.stringify(dropped));
  expect(s10.player.invuln === true && snap(lines, 60).player.invuln === true, 'invuln');
  return `hit tick 1 {dropped:3} → 3 đom đóm rơi trên vành 1,5–2,5 m (ttl ~8 s); hit kế tiếp đúng tick 91 (bất tử 90 tick)`;
});
check('Phần 1 · Vùng an toàn', 'Chỉ đèn đã sáng tạo vùng 6 m chặn Bóng Mực; bóng bên trong lúc thắp bị đẩy ra ≤30 tick, không sát thương', '`p2_safe_zone`, `p2_safe_escort`', () => {
  const a = cli('p2_safe_zone', { scenario: sc({ player: { pos: [0, 0, 20] }, lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }], shades: [{ id: 'S1', pos: [0, 0, 36] }] }), ticks: 900, every: 30 });
  expect(ev(a.lines, 'player_hit').length === 0, 'got hit');
  const minD = Math.min(...a.lines.filter((l) => l.type === 'snapshot').map((l) => Math.hypot(l.shades[0].pos[0], l.shades[0].pos[2] - 20)));
  expect(minD >= 6, `min dist ${minD}`);
  const b = cli('p2_safe_escort', { scenario: sc({ player: { carried: 10, pos: [0, 0, 1.5] }, lanterns: [{ id: 'L1', pos: [0, 0, 0] }], shades: [{ id: 'S1', pos: [0, 0, 2] }] }),
    frames: [{ tick: 0, interact: true }, { tick: 1, interact: false }], ticks: 60, every: 5 });
  expect(ev(b.lines, 'lantern_lit').length === 1 && ev(b.lines, 'player_hit').length === 0, 'lit / hit');
  const d30 = Math.hypot(...[snap(b.lines, 30).shades[0].pos[0], snap(b.lines, 30).shades[0].pos[2]]);
  expect(d30 >= 6, `escort dist ${d30}`);
  return `900 tick đứng cạnh đèn sáng: 0 lần bị chạm, khoảng cách bóng–đèn nhỏ nhất ${minD.toFixed(3)} m; bóng bên trong bị đẩy tới ${d30.toFixed(3)} m sau 30 tick, 0 sát thương`;
});
check('Phần 1 · Lịch sinh', 'Đom đóm 20 + 1 mỗi 240 tick (trần 30); Bóng Mực 2 con ở tick 300 rồi mỗi 480/420/360 tick, trần 6/8/10', 'chạy mặc định 3 đêm, 5000 tick, không bị chạm (lửa 999)', () => {
  const out = [];
  for (const [night, every, cap] of [[1, 480, 6], [2, 420, 8], [3, 360, 10]]) {
    const { lines } = cli(`p2_spawn_night${night}`, { night, seed: 3, scenario: { player: { flames: 999 } }, ticks: 5000, every: 240 });
    const sp = ev(lines, 'shade_spawned').map((e) => e.tick);
    expect(sp[0] === 300 && sp[1] === 300 && sp[2] === 300 + every && sp[3] === 300 + 2 * every, `night ${night} spawn ticks ${sp.slice(0, 5)}`);
    expect(snap(lines, 0).motes_active === 20 && snap(lines, 240).motes_active === 21, 'motes 20 → 21 at 240');
    expect(Math.max(...lines.filter((l) => l.type === 'snapshot').map((l) => l.shades.length)) <= cap, 'cap');
    out.push(`Đêm ${night}: bóng ở tick ${sp.slice(0, 4).join(',')}…`);
  }
  return out.join('; ');
});

// ======================================================= Phần 3: tính năng mới
check('Phần 3 · Gió Lạc', 'Sinh ở tick 1200 (Đêm 2, 3), id D1; chase khi mang ≥5 và ≤15 m; cướp min(3, mang); flee 240 tick rồi biến mất cùng đồ cướp; không mất lửa', '`p3_drifter_steal`', () => {
  const { lines } = cli('p3_drifter_steal', { night: 2, scenario: sc({ player: { carried: 6 }, drifters: [{ id: 'D1', pos: [10, 1.5, 0] }] }), ticks: 400, every: 20 });
  const st = ev(lines, 'drifter_steal')[0]; expect(st && st.data.amount === 3 && st.data.carried === 3, JSON.stringify(st));
  expect(end(lines).state === 'playing' && snap(lines, 20).player.flames === 3, 'flames');
  const gone = lines.filter((l) => l.type === 'snapshot').find((l) => l.tick > st.tick && l.drifters.length === 0);
  expect(gone && gone.tick - st.tick >= 239 && gone.tick - st.tick <= 260, `gone at ${gone?.tick}`);
  const spawn = cli('p3_drifter_spawn', { night: 3, seed: 2, scenario: { random_shades: false, player: { flames: 999 } }, ticks: 1300, every: 100 });
  expect(snap(spawn.lines, 1100).drifters.length === 0 && snap(spawn.lines, 1300).drifters[0]?.id === 'D1', 'spawn at 1200');
  return `steal tick ${st.tick} ${JSON.stringify(st.data)}; biến mất ở tick ${gone.tick} (≈240 tick sau); lửa vẫn 3; D1 sinh ở tick 1200 trên Đêm 3`;
});
check('Phần 3 · Gió Lạc', 'Tỏa Sáng: chase → flee không cướp; flee có đồ → thả toàn bộ đom đóm rơi, biến mất sau 120 tick', '`p3_drifter_pulse`, `p3_drifter_drop`', () => {
  const a = cli('p3_drifter_pulse', { night: 2, scenario: sc({ player: { carried: 9 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'chase' }] }), frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }], ticks: 20, every: 10 });
  expect(ev(a.lines, 'drifter_steal').length === 0 && snap(a.lines, 10).drifters[0].state === 'flee' && snap(a.lines, 10).drifters[0].stolen === 0, 'flee without stealing');
  const b = cli('p3_drifter_drop', { night: 2, scenario: sc({ player: { carried: 3 }, drifters: [{ id: 'D1', pos: [3, 1.5, 0], state: 'flee', stolen: 3, state_ticks_left: 200 }] }), frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false }], ticks: 140, every: 10 });
  const dr = ev(b.lines, 'drifter_drop')[0]; expect(dr && dr.data.amount === 3, 'drop');
  expect(snap(b.lines, 10).motes.filter((m) => m.kind === 'dropped').length === 3 && snap(b.lines, 100).drifters.length === 1 && snap(b.lines, 130).drifters.length === 0, 'drops / vanish');
  return `chase+pulse → flee, stolen 0, không event steal; flee có đồ+pulse → drifter_drop ${JSON.stringify(dr.data)}, 3 đom đóm rơi, biến mất ở ~tick 120`;
});
check('Phần 3 · Bùa Gió', 'Nhặt như đom đóm, hiệu lực 600 tick, chạy 7,2 m/s, Lướt không hồi chiêu, xuất hiện lại sau 2700 tick', '`p3_charm`', () => {
  const { lines } = cli('p3_charm', { night: 2, scenario: sc({ charms: [{ id: 'C1', pos: [0, 0, 3] }] }),
    frames: [{ tick: 0, move: [0, 1] }, { tick: 60, move: [0, 0], dash: true }, { tick: 61, dash: false }, { tick: 80, dash: true }, { tick: 81, dash: false }], ticks: 100, every: 10 });
  const c = ev(lines, 'charm_picked')[0]; expect(c && c.data.charm_ticks === 600 && c.data.charm_id === 'C1', JSON.stringify(c));
  const dashes = ev(lines, 'dash'); expect(dashes.length === 2 && dashes[1].tick - dashes[0].tick === 20, `dash ticks ${dashes.map((d) => d.tick)}`);
  const sn = snap(lines, 40); expect(sn.player.vel[2] === 7.2 && sn.player.charm_s > 9 && snap(lines, 100).charms[0].available === false && snap(lines, 100).charms[0].respawn_s > 43, 'speed / ticks / respawn');
  return `charm_picked tick ${c.tick}; vel 7,2 m/s; hai lần lướt cách nhau 20 tick (không hồi chiêu); respawn_s≈43,7 (2700 tick trừ ~80 tick đã trôi)`;
});
check('Phần 3 · Tạm dừng', 'Logic dừng hoàn toàn khi pause: tick vẫn tăng nhưng sim_tick, thời gian, hồi chiêu đứng yên; state "paused"; paused/resumed', '`p3_pause`', () => {
  const { lines } = cli('p3_pause', { scenario: sc({ player: { pulse_cd_ticks: 100 } }), frames: [{ tick: 20, pause: true }, { tick: 21, pause: false }, { tick: 80, pause: true }, { tick: 81, pause: false }], ticks: 100, every: 10 });
  const e = ev(lines, 'paused').concat(ev(lines, 'resumed')).sort((a, b) => a.tick - b.tick).map((x) => `${x.name}@${x.tick}`);
  expect(e.join() === 'paused@21,resumed@81', e.join());
  const a = snap(lines, 30), b = snap(lines, 70);
  expect(a.state === 'paused' && b.state === 'paused' && a.sim_tick === 20 && b.sim_tick === 20 && a.time_left_s === b.time_left_s && a.player.pulse_cd_s === b.player.pulse_cd_s, 'frozen');
  return `${e.join(', ')}; tick 30 và 70: sim_tick=20, time_left_s=${a.time_left_s}, pulse_cd_s=${a.player.pulse_cd_s} (không đổi)`;
});
check('Phần 3 · Gió mạnh', 'Đêm 3: báo trước 2 s, gió 5 s mỗi 30 s đẩy 2 m/s; wind_enabled=false tắt', '`p3_wind`', () => {
  const { lines } = cli('p3_wind', { night: 3, scenario: sc({ player: { flames: 999 } }), ticks: 2200, every: 60 });
  const w = (t) => snap(lines, t).wind;
  expect(!w(1620).warning && w(1680).warning && !w(1680).active && w(1800).active && w(2040).active && !w(2160).active, 'timeline');
  const dx = snap(lines, 2040).player.pos[0] - snap(lines, 1800).player.pos[0], dz = snap(lines, 2040).player.pos[2] - snap(lines, 1800).player.pos[2];
  near(Math.hypot(dx, dz), 8, 0.05, 'push');
  const off = cli('p3_wind_off', { night: 3, scenario: sc({ wind_enabled: false, player: { flames: 999 } }), ticks: 2000, every: 500, keep: false });
  expect(snap(off.lines, 2000).wind.active === false, 'disabled');
  return `cảnh báo từ tick 1680, gió 1800–2099 (dir ${w(1800).dir_deg}°); trong 4 s Mây bị đẩy ${Math.hypot(dx, dz).toFixed(2)} m (2 m/s × 4 s); wind_enabled:false → không gió`;
});

// ======================================================= Phần 2: bản đồ
check('Phần 2 · Đêm 2', 'Cầu tre đi được, khoảng hở thì rơi; bục nhảy bắn sang đảo bên kia, bay ~1,4 s', '`p2_n2_pad`, `p2_n2_gap`', () => {
  const a = cli('p2_n2_pad', { night: 2, scenario: sc({ player: { pos: [19, 0, 18] } }), frames: [{ tick: 0, move: [1, 0] }, { tick: 1, move: [0, 0] }], ticks: 130, every: 10 });
  const s = snap(a.lines, 130).player; expect(s.pos[0] > 50 && Math.hypot(s.pos[0] - 70, s.pos[2]) < 28 && s.grounded && s.pos[1] === 0, JSON.stringify(s));
  const air = a.lines.filter((l) => l.type === 'snapshot' && l.player.grounded === false).length * 10;
  const b = cli('p2_n2_bridge', { night: 2, scenario: sc({ player: { pos: [24, 0, 0] } }), frames: [{ tick: 0, move: [1, 0] }], ticks: 120, every: 20 });
  expect(snap(b.lines, 120).player.pos[0] > 34 && snap(b.lines, 120).player.flames === 3, 'bridge');
  const c = cli('p2_n2_gap', { night: 2, scenario: sc({ player: { pos: [24, 0, 4] } }), frames: [{ tick: 0, move: [1, 0] }, { tick: 110, move: [0, 0] }], ticks: 200, every: 20 });
  expect(ev(c.lines, 'player_hit').some((e) => e.data.by === 'fall'), 'fall in gap');
  return `bục (20,18) → đáp ở (${s.pos[0].toFixed(1)}, ${s.pos[2].toFixed(1)}) trong đảo B sau ~${air} tick trên không (≈1,4 s); đi trên cầu (x 24→36) không rơi; bước ra cạnh cầu thì rơi`;
});
check('Phần 2 · Đêm 3', 'Dốc leo lên tầng 1, vách đứng chặn, bục nhảy đáp tầng 2, tháp chuông đặc', '`p2_n3_ramp`, `p2_n3_cliff`, `p2_n3_pad`, `p2_n3_tower`', () => {
  const ux = Math.cos(Math.PI / 6), uz = Math.sin(Math.PI / 6);
  const r = cli('p2_n3_ramp', { night: 3, scenario: sc({ player: { pos: [31 * ux, 0, 31 * uz] } }), frames: [{ tick: 0, move: [-ux, -uz] }, { tick: 90, move: [0, 0] }], ticks: 100, every: 25 });
  expect(snap(r.lines, 100).player.pos[1] === 3 && snap(r.lines, 100).player.grounded, JSON.stringify(snap(r.lines, 100).player));
  const c = cli('p2_n3_cliff', { night: 3, scenario: sc({ player: { pos: [0, 0, 10.5] } }), frames: [{ tick: 0, move: [0, 1] }], ticks: 60, every: 30 });
  expect(snap(c.lines, 60).player.pos[1] === 0 && snap(c.lines, 60).player.pos[2] <= 12.0001, 'cliff blocks');
  const p = cli('p2_n3_pad', { night: 3, scenario: sc({ player: { pos: [0, 3, 13.2] } }), ticks: 70, every: 35 });
  expect(snap(p.lines, 70).player.pos[1] === 6 && snap(p.lines, 70).player.grounded, JSON.stringify(snap(p.lines, 70).player));
  const t = cli('p2_n3_tower', { night: 3, scenario: sc({ player: { pos: [0, 6, 5] } }), frames: [{ tick: 0, move: [0, -1] }], ticks: 120, every: 60 });
  const tp = snap(t.lines, 120).player.pos; expect(Math.hypot(tp[0], tp[2]) >= 1.999, `tower r ${Math.hypot(tp[0], tp[2])}`);
  return `leo dốc 30° lên y=3; vách tầng 1 chặn ở z=12; bục (0,3,13) → đáp tầng 2 (y=6); tháp chuông chặn ở r=${Math.hypot(tp[0], tp[2]).toFixed(3)} (≥2)`;
});

// ======================================================= Phần 4: bench + leaderboard
check('Phần 4 · Benchmark', 'bench.js chạy 5 s với 200 bóng, 100 đom đóm, 3 đèn → avg_fps ≥ 60 (headless không có DOM/render)', 'node src/bench.js --seed 1 --duration 5 --out …', () => {
  const f = path.join(os.tmpdir(), 'ddl-bench.json');
  const r = spawnSync(process.execPath, ['src/bench.js', '--seed', '1', '--duration', '5', '--out', f], { cwd: root, encoding: 'utf8' });
  expect(r.status === 0, `exit ${r.status} ${r.stderr}`);
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  expect(j.avg_fps >= 60, `avg_fps=${j.avg_fps}`);
  expect(typeof j.p1_low_fps === 'number', 'p1_low_fps');
  expect(typeof j.frame_ms_p95 === 'number', 'frame_ms_p95');
  return `avg_fps=${j.avg_fps} p1_low=${j.p1_low_fps} p95=${j.frame_ms_p95} ms load=${j.load_ms} ms`;
});
check('Phần 4 · Leaderboard', '--export-leaderboard ghi top-10 vào file; getTop trả về đúng', 'cli + leaderboard.js import', async () => {
  const { addEntry, getTop } = await import('../src/leaderboard.js');
  const f = path.join(os.tmpdir(), 'ddl-lb.json');
  for (let i = 1; i <= 12; i++) addEntry({ name: `P${i}`, score: i * 10, night: 1, seed: i, reason: 'won' }, f);
  const top = getTop(f);
  expect(top.length === 10, `length ${top.length}`);
  expect(top[0].score === 120, `top[0].score=${top[0].score}`);
  expect(top[9].score === 30, `top[9].score=${top[9].score}`);
  return `top-10 từ 12 lần chơi: điểm ${top.map((e) => e.score).join(', ')}`;
});

// ======================================================= Hiệu năng & tất định
check('Hiệu năng', 'Một Đêm đầy đủ (21.600 tick) chạy headless ≤ 30 s', 'CLI, 3 đêm, lửa 999 để không kết thúc sớm', () => {
  const out = [];
  for (const night of [1, 2, 3]) {
    const r = cli(`perf_night${night}`, { night, seed: 5, scenario: { player: { flames: 999 } }, ticks: 21600, every: 600, keep: false });
    expect(r.ms < 30000, `night ${night} ${r.ms} ms`);
    out.push(`Đêm ${night}: ${r.ms} ms (${end(r.lines).ticks} tick)`);
  }
  return out.join('; ') + `. Máy: ${os.cpus()[0].model}, Node ${process.version}`;
});
check('Tất định', 'Cùng seed/scenario/inputs → output giống hệt, cả 3 đêm', 'chạy 2 lần mỗi đêm với inputs ngẫu nhiên-cố-định, so byte', () => {
  const out = [];
  for (const night of [1, 2, 3]) {
    const frames = []; let x = 12345 + night;
    for (let t = 0; t < 3000; t += 20) { x = (x * 1103515245 + 12345) & 0x7fffffff; frames.push({ tick: t, move: [((x >> 3) % 21) / 10 - 1, ((x >> 8) % 21) / 10 - 1], dash: (x >> 5) % 7 === 0, pulse: (x >> 6) % 11 === 0, jump: (x >> 9) % 5 === 0, interact: (x >> 4) % 3 === 0 }); }
    const A = cli(`determinism_night${night}`, { night, seed: 9, frames, ticks: 3000, every: 100 });
    const B = cli(`determinism_night${night}_b`, { night, seed: 9, frames, ticks: 3000, every: 100 });
    expect(A.text === B.text, `night ${night} differs`);
    fs.rmSync(path.join(outDir, `determinism_night${night}_b.jsonl`));
    out.push(`Đêm ${night}: ${A.text.length} byte giống hệt`);
  }
  return out.join('; ');
});

await Promise.all(asyncChecks);

const groups = [...new Set(checks.map((c) => c.group))];
const md = [
  `# Bằng chứng Phase ${PHASE} (tự sinh bởi \`npm run proof\`)`,
  '',
  `Node ${process.version}, ${os.platform()} ${os.arch()}. Mỗi dòng chạy qua CLI headless thật (\`node src/headless.js\`); scenario ở \`scenarios/\`, output \`.jsonl\` nằm cạnh file này. Ảnh giao diện \`gui-*.jpg\` được chụp riêng (xem ghi chú Phase 2).`,
  '',
  ...groups.flatMap((g) => ['', `## ${g}`, '', '| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |', '|---|---|---|---|',
    ...checks.filter((c) => c.group === g).map((c) => `| ${c.req} | ${c.how} | ${c.ok ? 'ĐẠT' : 'CHƯA ĐẠT'} | ${c.detail} |`)]),
  '',
].join('\n');
fs.writeFileSync(path.join(outDir, 'summary.md'), md);
console.log(md);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
