# Đảo Đèn Lồng

> **[Video demo](docs/demo/demo.mp4)** · Bài lab Day 12 AI SDLC. Đề bài: [LAB.md](LAB.md)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp ba hòn đảo (Đảo Bến, Đảo Cau, Đảo Chuông) gom đom đóm để thắp lại các Đèn Lồng Lớn trước khi trời sáng, đồng thời né Bóng Mực tím đen, Gió Lạc và vực sâu.

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
| Space | Nhảy (chỉ khi đang chạm đất) |
| Shift | Lướt: 14 m/s trong 0,2 s, hồi 1,5 s |
| E | Nạp đom đóm vào đèn (đứng trong 2 m) |
| F (hoặc Q) | Tỏa Sáng: tốn 3 đom đóm, choáng và đẩy lùi Bóng Mực trong 5 m, hồi 3 s |
| Kéo chuột / ← → | Xoay camera |
| Esc / P | Tạm dừng (Tiếp tục, Chơi lại Đêm, Cài đặt, Về menu) |

## Luật chơi
- Ba Đêm lần lượt: **Đảo Bến** (5 đèn, 5:00), **Đảo Cau** (2 đảo nối cầu tre, bục nhảy, Gió Lạc, 6 đèn, 5:30), **Đảo Chuông** (3 tầng, dốc, bục nhảy, tháp chuông, gió mạnh, 7 đèn, 6:00). Thắng Đêm 3 thì tới màn Bình Minh; thua thì chơi lại đúng Đêm đó.
- Đom đóm tự được nhặt khi tới trong 1 m. Mang tối đa 10. Mỗi đèn cần 10 đom đóm; nạp nhiều lần được, đèn nhớ tiến độ. Thắp hết đèn là **thắng**.
- Mây có 3 Ngọn Lửa. Bóng Mực chạm thì mất 1 lửa, đánh rơi một nửa số đang mang (nhặt lại được trong 8 s) và bất tử 1,5 s. Rơi khỏi đảo cũng mất 1 lửa và mất hết đom đóm, rồi hồi sinh sau 1 s. Hết lửa là **thua**; hết giờ mà chưa thắp đủ cũng **thua**.
- Đèn đã sáng tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- **Gió Lạc** (Đêm 2, 3) đuổi người mang ≥ 5 đom đóm và cướp 3 con. Tỏa Sáng làm nó bỏ chạy, hoặc ép nó nhả lại đồ cướp.
- **Bùa Gió** (lá bùa đỏ viền vàng): 10 s chạy 7,2 m/s và Lướt không hồi chiêu; hiện lại sau 45 s.
- **Bục vàng** bắn Mây lên cao hoặc sang đảo bên kia. Đêm 3: lá bay báo gió mạnh sắp tới.

## Cách tính điểm

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi con mỗi lần, kể cả con đang choáng) | +5 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm của game là tổng điểm các Đêm đã thắng.

## Chế độ headless (Test Contract v1.1)

```bash
node src/headless.js --seed 1 --night 2 --ticks 600 --out out.jsonl \
  [--scenario scenarios/p2_pulse.scenario.json] [--inputs scenarios/p2_pulse.inputs.json] [--snapshot-every 10]
```

Khai báo ở [game.contract.json](game.contract.json) (số chuẩn của TICKET-02). Giả định cho chỗ ticket chưa nói nằm ở [docs/notes/phase-2.md](docs/notes/phase-2.md). Mấy điểm đáng biết:
- `fall_enabled: true`: rơi khi Y < −10, `player_hit` với `by: "fall"` có thêm `lost`.
- Góc đo từ +X, x = r·cosθ, z = r·sinθ. Đêm 3 xuất phát tại (0,0,−26) vì (0,0,0) nằm trong tháp chuông.
- Snapshot có thêm `wind.warning`; `player.invuln` là boolean; `motes[].ttl_s` là `null` với đom đóm thường.
- Một Đêm đầy đủ (21.600 tick) chạy trong dưới 1 giây.

## Kiến trúc
- `src/sim.js`: toàn bộ logic, tất định (RNG theo seed), 60 tick/s, theo đúng thứ tự giai đoạn của ticket, không phụ thuộc DOM. `src/maps.js`: ba bản đồ. `src/tuning.js`: số chuẩn.
- `src/headless.js`: CLI theo contract. `src/client.js` + `src/scene.js` + `src/audio.js`: giao diện Three.js, dùng chung `Game.step()`.
- `tests/`: 48 test. `scenarios/`: kịch bản của proof. `scripts/proof.js`: sinh bằng chứng.

## Bằng chứng và ghi chép
- Phase 2: [docs/proof/phase-2/summary.md](docs/proof/phase-2/summary.md), ảnh `docs/proof/phase-2/gui-*.jpg`; tiêu chí nghiệm thu [docs/spec/phase-2-acceptance.md](docs/spec/phase-2-acceptance.md); giả định, thay đổi, nhật ký AI, đánh giá [docs/notes/phase-2.md](docs/notes/phase-2.md).
- Phase 1 (đúng với tag `phase-1`): [docs/proof/phase-1/summary.md](docs/proof/phase-1/summary.md), [docs/notes/phase-1.md](docs/notes/phase-1.md).

## Harness AI
- [CLAUDE.md](CLAUDE.md): lệnh, cấu trúc, quy tắc cho agent (cập nhật mỗi phase, xem lịch sử git).
- `.claude/settings.json`: **Stop hook** chạy `scripts/stop-check.js`, chặn agent kết thúc khi test đỏ.
- `.claude/skills/verify`: quy trình kiểm chứng, sinh bằng chứng, đo FPS. `.claude/skills/add-scenario`: thêm scenario và check cho tính năng mới.
- `.github/workflows/ci.yml`: CI chạy test và proof trên Ubuntu và macOS mỗi lần push.

## Sáng tạo của tôi
Chỉ nằm ở phần hiển thị và âm thanh (`src/client.js`, `src/scene.js`, `src/audio.js`), không đổi đầu ra headless; `npm test` và `npm run proof` vẫn đạt (kiểm bằng so sánh hash MD5 của file `.jsonl` trước/sau).

**Nhân vật Mây:** mô hình chi tiết với tay chân riêng vung nhịp khi chạy, chân co khi nhảy, nón lá có vành rộng và chóp nhọn, đèn lồng nhỏ treo đong đưa theo chuyển động, khăn quàng (sash) đổi vàng khi có Bùa Gió và có hào quang vàng xoay quanh người. Mắt đổi kích thước theo trạng thái (lo lắng khi ≤ 1 lửa, vui khi thắp đèn). Bóng đổ tròn dưới chân theo độ cao.

**Thế giới:** bầu trời sao thật với 600 ngôi sao, mặt trăng có quầng nhấp nháy, **sao băng ngẫu nhiên** bay qua bầu trời mỗi 25-50 giây, **50 con đom đóm trang trí** lượn quanh đảo (không nhặt được, không ảnh hưởng gameplay). Thêm cỏ, hoa 4 màu quanh các bụi. Mỗi đèn có mái, cột gỗ, 4 thanh dọc, finial vàng, và **vòng tròn tiến độ** mờ dưới thể hiện số đom đóm đã nạp.

**Hiệu ứng khi chơi:**
- Hạt sáng bay lên khi thắp đèn hoặc Tỏa Sáng (particle pool, không tốn tài nguyên).
- Số điểm bay lên mỗi khi ghi điểm (+10, +100, +5), chiếu từ không gian 3D ra màn hình.
- Rung màn hình (screen shake) khi bị chạm, nổ Tỏa Sáng, rơi khỏi đảo.
- Camera smooth: nội suy vị trí (lerp), FOV tăng nhẹ khi Lướt, cuộn chuột để zoom gần/xa.
- Bóng Mực có tua khói cuộn, mắt đổi vàng khi đang `chase`, ngôi sao vàng xoay trên đầu khi `stunned`.
- Gió Lạc là dải lụa 10 phân đoạn uốn lượn, có đốm vàng lấp lánh chạy dọc khi mang đồ cướp.

**UI:**
- Font **Quicksand** + **Be Vietnam Pro** từ Google Fonts cho tiêu đề và chữ Việt.
- **Minimap tròn** góc dưới trái bán kính 50 m: hiện các đèn (vàng = đã thắp, xám = chưa), Bóng Mực tím, Gió Lạc xám-xanh, Mây là tam giác vàng chỉ hướng đang quay mặt.

**Âm thanh:**
- Nhạc nền 16 nhịp với âm trầm 110 Hz làm nền.
- Hiệu ứng mới: tiếng bước chân (nhỏ, ngẫu nhiên tần số, nhịp theo tốc độ), tiếng chuông xa mỗi 60 s, tiếng tick to hơn khi ≤ 3 s cuối.

Chi tiết có bằng chứng ảnh ở `docs/proof/phase-2/gui-upgrade-*.jpg`. Hash MD5 của headless output giống hệt trước và sau (verify bằng `md5sum out/*.jsonl`).
