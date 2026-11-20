# Phase 2 — tiêu chí nghiệm thu (TICKET-02, contract v1.1)

Mỗi tiêu chí có dạng "làm A thì thấy B", kèm cách kiểm chứng. **H** = scenario headless (`scripts/proof.js`, kết quả ở `docs/proof/phase-2/summary.md`),
**T** = test đơn vị (`tests/sim.test.js`), **G** = kiểm bằng giao diện (ảnh/đo trong `docs/proof/phase-2/`).
Giả định cho chỗ ticket chưa nói nằm ở `docs/notes/phase-2.md`.

## Phần 1 — Số liệu chuẩn

| # | Làm | Thấy | Kiểm |
|---|---|---|---|
| 1.1 | Giữ `move [0,1]` 1 s | z ≈ 6 (tăng tốc ≤ 0,1 s), vận tốc đạt 6 trong ≤ 6 tick; thả phím → dừng ≤ 6 tick | T, H `p2_move_jump` |
| 1.2 | Bấm jump | vận tốc 7, trọng lực 20, đỉnh 1,225 m, ~42 tick; bấm khi đang trên không không nhảy thêm | T, H |
| 1.3 | Bấm dash | event `dash`, 12 tick × 14 m/s = 2,8 m theo hướng đang chạy (đứng yên thì hướng đang quay mặt); hồi 90 tick tính từ lúc bắt đầu; bấm khi đang lướt/hồi bị bỏ qua; trên không giữ độ cao; không bất tử | T, H `p2_dash` |
| 1.4 | Đi vào ≤ 1,0 m (XZ) và chênh cao ≤ 1,5 m | `mote_picked`; đầy 10 thì không nhặt | T |
| 1.5 | Chạy 240 tick | thêm 1 đom đóm ở điểm trống nếu < 30; hết điểm thì bỏ lượt; lúc đầu 20 con ở 20 điểm khác nhau | T, H `p2_spawn_*` |
| 1.6 | Bấm interact trong 2,0 m | nạp min(mang, thiếu) vào đèn chưa sáng gần nhất (bằng nhau → id nhỏ hơn); đèn nhớ tiến độ; +10/đom đóm nạp, +100/đèn | T, H `p2_deposit_multi` |
| 1.7 | Thắp đèn | vùng an toàn 6 m: bóng ở ngoài bị chặn ở mép; bóng đang ở trong bị đẩy ra ≤ 30 tick, không sát thương; đèn chưa sáng không có vùng | T, H `p2_safe_*` |
| 1.8 | Bấm pulse (≥ 3 đom đóm) | tốn 3; mục tiêu chốt tại tick bấm (3D ≤ 5 từ chân+0,8); choáng 120 tick; đẩy 4 m trong 15 tick; +5/con kể cả con đang choáng; hồi 180 tick; dừng nếu gặp vật cản | T, H `p2_pulse` |
| 1.9 | Bóng chạm (XZ ≤ 1,0, dy ≤ 1,5) | −1 lửa; rơi floor(n/2) trên vành 1,5–2,5 m sống 480 tick; bất tử 90 tick; bóng lùi 2 m trong 60 tick; tối đa 1 lần mất lửa/tick; bóng chạm lúc bất tử không làm gì | T, H `p2_hit` |
| 1.10 | Rơi (Y < −10) | đúng 1 `player_hit by fall` (có `lost`), −1 lửa, mất hết đom đóm, chờ 60 tick, hồi sinh ở xuất phát, vận tốc 0, bất tử 90 tick; hết lửa thì thua ngay | T, H `p2_fall` |
| 1.11 | Cuối mỗi tick | hết lửa → thua `no_flames` (ưu tiên); tất cả đèn sáng → thắng (kể cả tick hết giờ); hết giờ → `dawn`; điểm thắng cộng floor(giây còn)×2 + 50×lửa | T, H `p1_*` |
| 1.12 | Đêm 1/2/3 | 300/330/360 s, lửa 3, bóng 4,0 m/s (Đêm 3: 4,5), phát hiện 12 / bỏ đuổi 18 m, lịch sinh 2 con ở tick 300 rồi mỗi 480/420/360 tick, trần 6/8/10 | T, H |
| 1.13 | Pause (nút false→true) | `tick` tăng, `sim_tick`/thời gian/hồi chiêu/spawn/TTL đứng yên, snapshot `state:"paused"`, event `paused`/`resumed` | T, H `p3_pause`, G |

## Phần 2 — Bản đồ

| # | Tiêu chí | Kiểm |
|---|---|---|
| 2.1 | Đêm 1: đảo r=40, 5 đèn L1–L5 đúng tọa độ, 24 điểm đom đóm (8 r=12 + 16 r=33), 12 điểm bóng r=37 | T |
| 2.2 | Đêm 2: 2 đảo r=28 tại (0,0) và (70,0), cầu x∈[26,44] z∈[−2,2] không lan can (bước ra thì rơi), 6 đèn, 24 điểm đom đóm, 16 điểm bóng | T, H `p2_n2_*` |
| 2.3 | Đêm 2: bục (20,0,18) và (50,0,−18) bắn Y 14 m/s, ngang 24 m/s về tâm đảo kia, bay ≈ 1,4 s, phím di chuyển không ghi đè, vẫn lướt được | T, H `p2_n2_pad` |
| 2.4 | Đêm 3: 3 tầng, vách đứng chặn, 2 dốc rộng 3 m (30°, 150°) từ r=30 (Y=0) lên r=24 (Y=3), bục (0,3,13) bắn lên tầng 2, tháp chuông r=2 đặc, 7 đèn, 30 điểm đom đóm, 16 điểm bóng | T, H `p2_n3_*` |
| 2.5 | Bùa/đèn/bóng nằm đúng mặt sàn (Y của sàn tại tọa độ đó) | T (`floors of all lanterns and spawn points exist`) |

## Phần 3 — Tính năng mới

| Tính năng | Tiêu chí | Kiểm |
|---|---|---|
| **Gió Lạc** | Đêm 2, 3: sinh ở tick 1200, 2400…, tối đa 2, id D1, D2…, Đêm 1 không có | T, H `p3_drifter_steal` |
| | idle → chase khi mang ≥ 5 và ≤ 15 m (kiểm mỗi tick, mất điều kiện về idle) | T |
| | Chạm (XZ ≤ 1,2) cướp min(3, mang), `drifter_steal`, chuyển flee 240 tick rồi biến mất cùng đồ; chỉ cướp 1 lần; không mất lửa; bất tử và vùng an toàn không ngăn | T, H |
| | Tỏa Sáng trúng chase → flee không cướp; trúng flee có đồ → `drifter_drop`, đom đóm rơi tại chỗ, biến mất sau 120 tick | T, H `p3_drifter_pulse/drop` |
| **Bùa Gió** | Nhặt như đom đóm → `charm_picked {charm_id, charm_ticks:600}`; chạy 7,2 m/s; Lướt không hồi chiêu (vẫn phải bấm lại, bấm khi đang lướt bị bỏ qua); nhặt lại làm mới; hiện lại sau 2700 tick; vị trí Đêm 2 (35,0,0), Đêm 3 (±30,0,25) | T, H `p3_charm` |
| **Gió mạnh** (Đêm 3) | Báo trước 2 s (lá bay + trường `warning`), gió 5 s mỗi 30 s hướng ngẫu nhiên đẩy 2 m/s; `wind_enabled:false` tắt | T, H `p3_wind`, G |
| **Chuỗi 3 Đêm** | Menu → giới thiệu (tên đảo, lời Ông Đăng) → chơi → kết quả → đêm kế; thắng Đêm 3 ra màn Bình Minh với tổng điểm (tổng điểm các đêm đã thắng); thua thì chơi lại đúng đêm đó | G (`gui-menu.jpg`, kiểm DOM) |
| **Tạm dừng** | Esc/P: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; logic đứng hẳn | G, T |
| **Cài đặt** | Âm lượng và độ nhạy chuột, lưu giữa các lần mở (localStorage) | G (đã tải lại trang kiểm) |
| **Âm thanh** | Nhạc nền đêm + hiệu ứng: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, bóng xuất hiện, đếm ngược 10 s cuối | G (không tự động hóa được; kiểm bằng đọc code `audio.js` + `handleEvent`) |
| **HUD** | Lửa trên trái; mm:ss trên giữa (đỏ + nhấp nháy ≤ 30 s); đèn k/n và điểm trên phải; thanh 10 ô đom đóm dưới giữa; biểu tượng hồi chiêu Lướt/Tỏa Sáng dưới phải; nhắc "E — Nạp ánh sáng (x/10)"; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | G (`gui-night2-bridge-charm.jpg`, `gui-night3-tier2-hud.jpg`) |
| **Bảng màu** | Các màu chuẩn trong `src/scene.js` (`PAL`); ánh sáng môi trường = 0,15 + 0,55 × (đèn sáng/tổng) (+ chớp ngắn khi vừa thắp) | G, đọc code |

## Contract v1.1

| # | Tiêu chí | Kiểm |
|---|---|---|
| C.1 | `contract_version "1.1"`, tuning khớp số chuẩn + 5 khóa mới | T (`cli.test.js`) |
| C.2 | `--night 1\|2\|3`; snapshot có `night`, `wind`, `player.{vel,grounded,invuln,dash_cd_s,pulse_cd_s,charm_s}`, `motes{kind,ttl_s}`, `drifters`, `charms` | T |
| C.3 | Scenario: `player.{invuln_ticks,dash_cd_ticks,pulse_cd_ticks,charm_ticks}`, `shades[].{state,state_ticks_left}`, `drifters`, `charms`, `random_drifters`, `wind_enabled`; input `dash`, `pause`; file sai → exit 2 | T |
| C.4 | Tên trạng thái bóng: `spawning`, `wander`, `chase`, `recoil`, `stunned` | T |
| C.5 | Một Đêm 21.600 tick headless ≤ 30 s | T, H `perf_night*` (≈ 0,5–1,1 s) |
| C.6 | Tất định cả 3 đêm | T, H `determinism_night*` |
| C.7 | Bản thường ≥ 30 FPS trung bình ở 1280×720 | G (đo ở `docs/notes/phase-2.md`) |
