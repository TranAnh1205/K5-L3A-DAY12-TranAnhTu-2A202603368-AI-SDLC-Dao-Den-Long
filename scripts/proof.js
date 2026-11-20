// Regenerates docs/proof/phase-1/: runs scenarios through the real headless CLI,
// checks expected outcomes, checks determinism, writes outputs + summary.md.
// Usage: npm run proof   (exit 1 if any check fails)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { playBot } from './bot.js';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'docs/proof/phase-1');
fs.mkdirSync(outDir, { recursive: true });
const sc = (f) => path.join('scenarios', f);

function cli(name, args) {
  const out = path.join(outDir, `${name}.jsonl`);
  const r = spawnSync(process.execPath, ['src/headless.js', ...args, '--out', out], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${name}: exit ${r.status} ${r.stderr}`);
  const text = fs.readFileSync(out, 'utf8');
  return { text, lines: text.trim().split('\n').map((l) => JSON.parse(l)) };
}
const ev = (lines, n) => lines.filter((l) => l.type === 'event' && l.name === n);
const end = (lines) => lines.at(-1);

// Record a full bot playthrough (seed 1) as a contract inputs file.
const bot = playBot(1);
fs.writeFileSync(path.join(root, 'scenarios/bot_seed1.inputs.json'), JSON.stringify({ frames: bot.frames }));

const checks = [];
function check(req, how, fn) {
  let ok = false, detail;
  try { detail = fn(); ok = true; } catch (e) { detail = e.message; }
  checks.push({ req, how, ok, detail });
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

check('Chơi Đêm 1 từ đầu tới thắng (5 đèn, mặc định của game)', 'bot ghi inputs → `--seed 1 --inputs scenarios/bot_seed1.inputs.json`', () => {
  const { lines } = cli('full_win_seed1', ['--seed', '1', '--night', '1', '--inputs', sc('bot_seed1.inputs.json'), '--ticks', '18000', '--snapshot-every', '600']);
  const e = end(lines);
  expect(e.state === 'won', `state ${e.state}`);
  expect(ev(lines, 'lantern_lit').length === 5, 'not 5 lanterns lit');
  expect(ev(lines, 'game_over')[0].data.reason === 'all_lit', 'reason');
  return `won ở tick ${e.ticks}, score ${e.score}, ${ev(lines, 'mote_picked').length} lần nhặt, ${ev(lines, 'pulse').length} lần tỏa sáng, ${ev(lines, 'player_hit').length} lần bị chạm`;
});

check('Tính tất định: chạy 2 lần cùng seed/inputs ra file giống hệt', 'so sánh byte 2 lần chạy', () => {
  const a = cli('determinism_a', ['--seed', '1', '--night', '1', '--inputs', sc('bot_seed1.inputs.json'), '--ticks', '18000', '--snapshot-every', '600']).text;
  const b = cli('determinism_b', ['--seed', '1', '--night', '1', '--inputs', sc('bot_seed1.inputs.json'), '--ticks', '18000', '--snapshot-every', '600']).text;
  expect(a === b, 'outputs differ');
  fs.rmSync(path.join(outDir, 'determinism_b.jsonl'));
  return `giống hệt (${a.length} byte)`;
});

check('Nhặt đom đóm + nạp đèn + thắp đèn', '`scenarios/pickup_deposit.*`', () => {
  const { lines } = cli('pickup_deposit', ['--seed', '1', '--night', '1', '--scenario', sc('pickup_deposit.scenario.json'), '--inputs', sc('pickup_deposit.inputs.json'), '--ticks', '120', '--snapshot-every', '60']);
  expect(ev(lines, 'mote_picked').length === 1, 'pickup');
  expect(ev(lines, 'lantern_lit')[0]?.data.lantern_id === 'L1', 'lit');
  return `mote_picked tick ${ev(lines, 'mote_picked')[0].tick}, deposit+lantern_lit tick ${ev(lines, 'lantern_lit')[0].tick}, score ${end(lines).score}`;
});

check('Tỏa sáng làm choáng + đẩy Bóng Mực trong bán kính, tốn ánh sáng', '`scenarios/pulse_stun.*`', () => {
  const { lines } = cli('pulse_stun', ['--seed', '1', '--night', '1', '--scenario', sc('pulse_stun.scenario.json'), '--inputs', sc('pulse_stun.inputs.json'), '--ticks', '60', '--snapshot-every', '30']);
  const p = ev(lines, 'pulse')[0];
  expect(p && p.data.stunned_ids.join() === 'S1', 'stunned ids');
  const snap = lines.find((l) => l.type === 'snapshot' && l.tick === 60);
  expect(snap.shades.find((s) => s.id === 'S1').state === 'stunned', 'S1 state');
  expect(snap.player.carried === 2, 'cost');
  return `pulse tick ${p.tick} stunned [S1]; S2 ngoài bán kính không bị; carried 4→2`;
});

check('Bị Bóng Mực chạm mất lửa, hết lửa thì thua', '`scenarios/lose_no_flames.scenario.json`', () => {
  const { lines } = cli('lose_no_flames', ['--seed', '1', '--night', '1', '--scenario', sc('lose_no_flames.scenario.json'), '--ticks', '600']);
  const hit = ev(lines, 'player_hit')[0];
  expect(hit.data.dropped === 2 && hit.data.flames === 0, 'hit data');
  expect(end(lines).state === 'lost' && ev(lines, 'game_over')[0].data.reason === 'no_flames', 'lost');
  return `player_hit tick ${hit.tick} ${JSON.stringify(hit.data)} → lost/no_flames`;
});

check('Bóng Mực sợ đèn: không vào safe_radius, người chơi đứng ở đèn không bị chạm', '`scenarios/safe_radius.scenario.json`', () => {
  const { lines } = cli('safe_radius', ['--seed', '1', '--night', '1', '--scenario', sc('safe_radius.scenario.json'), '--ticks', '900', '--snapshot-every', '30']);
  expect(ev(lines, 'player_hit').length === 0, 'got hit');
  const minD = Math.min(...lines.filter((l) => l.type === 'snapshot').map((l) => Math.hypot(l.shades[0].pos[0], l.shades[0].pos[2] - 25)));
  expect(minD > 6, `minD ${minD}`);
  return `900 tick, 0 lần bị chạm, khoảng cách nhỏ nhất shade→đèn = ${minD.toFixed(3)} m (> 6)`;
});

check('Hết thời gian Đêm thì thua (dawn)', '`scenarios/dawn.scenario.json` (time_left_s 2)', () => {
  const { lines } = cli('dawn', ['--seed', '1', '--night', '1', '--scenario', sc('dawn.scenario.json'), '--ticks', '1000']);
  expect(end(lines).state === 'lost' && end(lines).ticks === 120, JSON.stringify(end(lines)));
  return `game_over lost/dawn ở tick 120`;
});

check('Inputs sai định dạng → mã thoát 2', 'file tick không tăng', () => {
  const bad = path.join(os.tmpdir(), 'ddl-bad.json');
  fs.writeFileSync(bad, '{"frames":[{"tick":5},{"tick":5}]}');
  const r = spawnSync(process.execPath, ['src/headless.js', '--seed', '1', '--night', '1', '--ticks', '5', '--inputs', bad, '--out', path.join(os.tmpdir(), 'x.jsonl')], { cwd: root, encoding: 'utf8' });
  expect(r.status === 2, `exit ${r.status}`);
  return `exit 2, stderr: ${r.stderr.trim()}`;
});

const md = [
  '# Bằng chứng Phase 1 (tự sinh bởi `npm run proof`)',
  '',
  `Node ${process.version}, ${os.platform()} ${os.arch()}. Mỗi dòng chạy qua CLI headless thật; output nằm cạnh file này.`,
  '',
  '| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |',
  '|---|---|---|---|',
  ...checks.map((c) => `| ${c.req} | ${c.how} | ${c.ok ? 'ĐẠT' : 'CHƯA ĐẠT'} | ${c.detail} |`),
  '',
].join('\n');
fs.writeFileSync(path.join(outDir, 'summary.md'), md);
console.log(md);
process.exit(checks.every((c) => c.ok) ? 0 : 1);
