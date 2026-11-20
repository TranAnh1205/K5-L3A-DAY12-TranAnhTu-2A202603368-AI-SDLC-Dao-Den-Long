# Đảo Đèn Lồng

> Video demo: *(sẽ thêm ở Phase 4)* · Bài lab Day 12 AI SDLC. Đề bài: [LAB.md](LAB.md)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp Đảo Bến gom đom đóm để thắp lại 5 Đèn Lồng Lớn trước khi trời sáng, đồng thời né những Bóng Mực tím đen trong sương.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node ≥ 22)

```bash
npm install
npm start          # mở http://localhost:8080
```

Chạy test: `npm test`. Sinh lại bằng chứng: `npm run proof`.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Chạy (theo hướng camera) |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn (đứng gần đèn, trong 3 m) |
| F | Tỏa sáng: choáng và đẩy lùi Bóng Mực trong 6 m, tốn 2 đom đóm, hồi chiêu 1 s |
| Kéo chuột / ← → | Xoay camera |
| R | Chơi lại |

## Luật chơi
- Đom đóm tự được nhặt khi tới gần (1.5 m). Mỗi lần mang tối đa 10 con.
- Mỗi đèn cần 10 đom đóm để sáng. Thắp đủ 5 đèn thì **thắng**.
- Mây có 3 ngọn lửa (máu). Bị Bóng Mực chạm thì mất 1 lửa, đánh rơi một nửa số đom đóm đang mang và được bất tử 2 s. Hết lửa thì **thua**.
- Đêm dài 300 s. Trời sáng mà chưa thắp đủ đèn thì **thua**.
- Bóng Mực sợ đèn: chúng không vào được vòng 6 m quanh cột đèn (có vòng sáng mờ trên đất).

## Cách tính điểm

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Làm choáng 1 Bóng Mực | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

## Chế độ headless (Test Contract v1.0)

```bash
node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenarios/pulse_stun.scenario.json] [--inputs scenarios/pulse_stun.inputs.json] [--snapshot-every 10]
```

Khai báo đầy đủ ở [game.contract.json](game.contract.json). Các mục chưa rõ trong PRD-0 được giải thích dưới đây:
- `fall_enabled: false`: đảo có mép chặn, không rơi được, nên không bao giờ có `player_hit` với `by: "fall"`.
- `pulse_cost`: tính bằng số đom đóm **đang mang**. Không đủ thì không tỏa sáng.
- `safe_radius`: áp dụng quanh **mọi** đèn, kể cả đèn chưa thắp.
- `hit_drop_ratio`: số đom đóm rơi = floor(đang mang × 0.5). Đom đóm rơi sẽ mất luôn.
- Snapshot có thêm mảng `motes` (id, pos) như khuyến nghị.

Toàn bộ giả định nằm ở [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Kiến trúc
- `src/sim.js`: toàn bộ logic, tất định (RNG theo seed), 60 tick/s, không phụ thuộc DOM.
- `src/headless.js`: CLI theo contract. `src/client.js`: hiển thị bằng Three.js, dùng chung `Game.step()`.
- `tests/`: 19 test. `scenarios/`: kịch bản dùng cho proof. `scripts/proof.js`: sinh bằng chứng.

## Bằng chứng và ghi chép
- Phase 1: [docs/proof/phase-1/summary.md](docs/proof/phase-1/summary.md), ảnh `docs/proof/phase-1/gui-*.jpg`
- Giả định, nhật ký AI, đánh giá: [docs/notes/phase-1.md](docs/notes/phase-1.md)

## Harness AI
- [CLAUDE.md](CLAUDE.md): lệnh, cấu trúc, quy tắc cho agent.
- `.claude/settings.json`: **Stop hook** chạy `scripts/stop-check.js`, chặn agent kết thúc khi test đỏ.
- `.claude/skills/verify/SKILL.md`: quy trình kiểm chứng và sinh bằng chứng.
- `.github/workflows/ci.yml`: CI chạy test và proof trên Ubuntu và macOS mỗi lần push.

## Sáng tạo của tôi
Mọi phần dưới đây chỉ nằm trong `src/client.js` (hiển thị). Chúng không đổi đầu ra headless; `npm test` và `npm run proof` vẫn đạt.
- **Đảo bừng sáng:** mỗi đèn thắp làm tăng ánh sáng môi trường, đổi màu trời từ tím đen sang tím hửng sáng và đẩy sương ra xa.
- **Đèn trên nón lá:** chiếc đèn nhỏ của Mây sáng hơn theo số đom đóm đang mang. Khi tỏa sáng, ánh đèn bùng lên.
- **Âm thanh tổng hợp bằng WebAudio** (không dùng file asset): tiếng "ting" khi nhặt đom đóm (cao dần theo số đang mang), hợp âm chuông khi thắp đèn, âm trầm khi bị chạm.
- **Vòng an toàn** vàng mờ quanh mỗi đèn để người chơi thấy chỗ Bóng Mực không vào được.
