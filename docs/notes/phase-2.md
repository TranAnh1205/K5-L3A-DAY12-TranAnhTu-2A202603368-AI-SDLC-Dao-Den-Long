# Phase 2 — TICKET-02 "Ba hòn đảo": giả định, thay đổi, nhật ký AI, đánh giá

Tiêu chí nghiệm thu: [docs/spec/phase-2-acceptance.md](../spec/phase-2-acceptance.md). Bằng chứng: [docs/proof/phase-2/summary.md](../proof/phase-2/summary.md) (tự sinh, 22 mục ĐẠT, 0 CHƯA ĐẠT) và `npm test` (48 test).
Bằng chứng Phase 1 trong `docs/proof/phase-1/` chỉ đúng với mã ở tag `phase-1` (số liệu cũ).

## Thay đổi so với Phase 1 và lý do

| Thay đổi | Lý do (ticket) | Test/bằng chứng bị ảnh hưởng |
|---|---|---|
| Mọi số liệu thay bằng số chuẩn (pickup 1,0 / interact 2,0 / pulse 3 đom đóm, 5 m, hồi 3 s / safe 6 m / flames, bất tử 90 tick…) | Phần 1 "thay mọi giá trị bạn tự chọn" | Các test Phase 1 viết lại với số mới; `game.contract.json` v1.1 |
| Điểm +10 tính **khi nạp** (không phải khi nhặt); +5/bóng trúng Tỏa Sáng (trước +20); không còn thưởng riêng khi nhặt | Bảng điểm chuẩn hóa | Test pickup (bỏ kiểm điểm), deposit (+10/đom đóm), pulse |
| Vùng an toàn chỉ có ở đèn **đã sáng** (Phase 1: mọi đèn) | "Đèn đã sáng tạo vùng bán kính 6 m" | Test/proof `safe_zone` dùng đèn `lit:true`; thêm test "đèn chưa sáng không có vùng" |
| Bóng Mực không còn 2 con lúc đầu; 2 con ở tick 300 rồi định kỳ; có trạng thái `spawning` 30 tick | Lịch sinh chuẩn | Test "default game spawns" thay bằng test lịch sinh 3 đêm |
| Bóng bị chạm thì **lùi** (recoil), đom đóm rơi ra **vành quanh Mây** nhặt lại được (Phase 1: mất luôn) | Bảng "Bị đánh" | Test hit viết lại |
| Rơi khỏi đảo có phạt (`fall_enabled: true`; Phase 1: đảo có mép chặn) | Mục "Rơi khỏi đảo" | Đảo không còn tường vô hình; test mới `fall` |
| Thắng/thua chỉ xét **cuối tick**; `no_flames` luôn thắng `all_lit` | "Thắng / thua" | Test `win` sửa (đèn cuối thắp ở tick cuối vẫn thắng) |
| Tọa độ đèn Đêm 1 dùng số chuẩn (23,8 / 7,7…; Phase 1 là 25·sin/cos) | Bản đồ chuẩn | Scenario Phase 1 viết lại |
| Snapshot/scenario/input mở rộng (v1.1); thêm event `night_start`, `dash`, `charm_picked`, `drifter_*`, `paused`, `resumed` | Phần 4 | `tests/cli.test.js` |
| Client viết lại (menu, 3 đêm, tạm dừng, cài đặt, HUD đầy đủ, âm thanh, bảng màu) | Phần 3 | Ảnh GUI mới |
| `scenarios/*.json` của Phase 1 xóa, thay bằng bộ mới sinh bởi `scripts/proof.js` (giữ các ca hồi quy `p1_*`) | Số liệu đổi nên scenario cũ vô nghĩa; bản cũ còn trong tag `phase-1` | `docs/proof/phase-2/` |

Hồi quy Phase 1: các hành vi lõi (nhặt → nạp → thắp → thắng/thua/hết giờ, exit 2 khi file sai, tất định) chạy lại với số chuẩn trong nhóm "P1 hồi quy" của proof, tất cả ĐẠT. Không test nào bị tắt âm thầm; mọi test đổi kỳ vọng có dòng trong bảng trên.

## Giả định mới (ticket chưa nói rõ)

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | Quy ước góc "ngược chiều kim đồng hồ khi nhìn từ trên xuống" | Dùng x = r·cosθ, z = r·sinθ. Chỉ quy ước này làm dốc 30°/150° nối được với tầng 1 (z > 0) và các điểm đom đóm 20°…160° nằm trên tầng 1. Ảnh hưởng: các tập điểm đối xứng không đổi, chỉ khác thứ tự |
| B2 | Điểm xuất phát Đêm 3 | (0,0,0) nằm trong tháp chuông nên dùng (0,0,−26) trên tầng 0. Đêm 1, 2 là (0,0,0), quay mặt +Z. Hồi sinh sau rơi về đúng điểm này |
| B3 | Hành vi Bóng Mực ngoài chase | `wander` 2 m/s đổi hướng ngẫu nhiên mỗi 1,5–3 s; `spawning` 30 tick (đứng yên, vô hại, vẫn bị Tỏa Sáng trúng); detect/lose đo theo XZ; cùng tầng sàn mới đi được (chênh ≤ 0,5 m), nên bóng không leo vách |
| B4 | Lịch sinh theo tick nào | Theo `sim_tick` (dừng khi pause), "tick 300" = sau 300 bước gameplay |
| B5 | `night_start` | Ghi ở tick 0, ngay sau snapshot tick 0 (dòng đầu vẫn là snapshot) |
| B6 | Kiểu dữ liệu trường mới | `player.invuln` là boolean; `dash_cd_s/pulse_cd_s/charm_s` là giây; `motes[].ttl_s` là `null` với đom đóm thường; `wind` có thêm `warning` |
| B7 | Tăng tốc | 3 tick (0,05 s ≤ 0,1 s) cho cả tăng tốc và dừng, cả trên không |
| B8 | Nhảy | Tích phân động học chính xác (y += v·dt − ½g·dt²) nên đỉnh = 1,225 m; sửa sau khi proof đo được 1,167 m với cách tích phân đơn giản |
| B9 | Bục nhảy | Kích hoạt khi chân chạm bục (XZ ≤ 1, cùng độ cao, đang chạm đất); vận tốc phóng áp dụng từ tick kế tiếp; lướt tạm thay vận tốc phóng trong 12 tick rồi trả lại |
| B10 | Hiệu lực Bùa | Bộ đếm = 600 đặt lúc nhặt, giảm từ tick sau (theo thứ tự tick: đếm → di chuyển → nhặt) nên có hiệu lực 599 tick di chuyển sau tick nhặt |
| B11 | Hồi sinh sau rơi | Chờ 60 tick; tick hồi sinh Mây đứng yên ở điểm xuất phát (vận tốc 0), bất tử 90 tick. Trong lúc chờ Mây đứng yên (không di chuyển, nhặt, nạp, tỏa sáng, bị chạm) |
| B12 | Độ cao bóng | Tâm bóng ở sàn + 1,0 m (Y trong snapshot); điều kiện chạm "chênh cao ≤ 1,5" so chân Mây với sàn dưới bóng; Tỏa Sáng đo 3D tới tâm bóng |
| B13 | Gió Lạc | Bay ở Y = 1,5; idle lượn ngẫu nhiên 2 m/s trong phạm vi đảo; sinh ở một điểm bóng ngẫu nhiên; chỉ `chase` mới cướp; Tỏa Sáng lên Gió Lạc không cộng điểm và không có trong `stunned_ids`; thả đồ khi bị trúng lúc flee làm đom đóm rơi sống 480 tick, Gió Lạc biến mất sau 120 tick |
| B14 | Trần 30 đom đóm | Đếm mọi đom đóm đang có (cả đom đóm rơi). Đêm 1 chỉ có 24 điểm nên thực tế tối đa 24 khi không ai nhặt |
| B15 | Gió mạnh | Báo trước 120 tick trước mỗi bội số 1800 tick (từ tick 1680), gió active tick 1800–2099, hướng chọn lúc bắt đầu báo trước bằng RNG có seed; gió cộng thêm vào dịch chuyển (kể cả khi lướt/phóng) |
| B16 | Vùng an toàn và vật cản | Bóng bị giữ ở r = 6,002 m (biên 2 mm để số làm tròn 3 chữ số vẫn ≥ 6); tháp chuông và vách tầng cũng chặn đẩy lùi do Tỏa Sáng |
| B17 | Kiểu thông báo | `player_hit by fall` có `dropped: 0` và `lost: n` (số đom đóm mất) |
| B18 | Cài đặt, âm thanh, HUD | Âm thanh tạo bằng WebAudio, không dùng file; nhạc nền là chuỗi arpeggio 5 âm; mũi tên chỉ đèn dùng chiếu 3D lên màn hình |

## Sáng tạo của Phase 1 còn giữ

Chỉ ở phía hiển thị, không đổi đầu ra headless: đèn nhỏ trên nón lá sáng theo số đom đóm đang mang (và bùng lên khi Tỏa Sáng), vòng sáng mờ quanh đèn đã sáng cho thấy vùng an toàn (nay chỉ hiện khi đèn sáng, đúng luật mới), đảo sáng dần theo tiến độ (theo công thức chuẩn 0,15 + 0,55 × tỷ lệ đèn), âm thanh tổng hợp. Thêm: khăn Mây đổi vàng khi có Bùa, chớp sáng khi thắp đèn.

## Hiệu năng

- Headless một Đêm đầy đủ (≤ 21.600 tick): 0,44 s (Đêm 1, 18.000 tick), 0,52 s (Đêm 2), 0,64 s (Đêm 3, 21.600 tick); ngưỡng 30 s. i7-1185G7, Node 24.
- Bản thường ở 1280×720: **60 FPS** đo bằng `requestAnimationFrame` thật trong 2 s ở Đêm 1 và Đêm 3 với phím W giữ (sim chạy 60 tick/s tương ứng), GPU Intel Iris Xe, Chromium trong pane trình duyệt của app (bị giới hạn vsync 60 Hz, nên đây là cận trên có thể đo; chưa đo trên máy chấm). Lần đo đầu bằng `benchmark()` cho 1,2 ms/khung chỉ là thời gian CPU gửi lệnh vẽ nên không dùng.

## Nhật ký dùng AI

| Bước | Công cụ | Việc | Ghi chú |
|---|---|---|---|
| 1 | Claude Code (Sonnet 5.5) | Đọc ticket, lập danh sách giả định, thiết kế lại sim theo 11 giai đoạn của ticket | Viết `maps.js`, `tuning.js`, `sim.js` một lượt |
| 2 | Claude Code | Viết 43 test sim + cập nhật test CLI | 13 test đỏ lần đầu, phân tích từng cái (xem dưới) |
| 3 | Claude Code | Client (3 file) và kiểm bằng pane trình duyệt | Chụp ảnh, đo FPS thật |
| 4 | Claude Code | `proof.js` mới + scenario; cập nhật CLAUDE.md và skills | |

**Token/chi phí ước tính Phase 2:** khoảng 250–300k token input (phần lớn là ngữ cảnh lặp lại, ngữ cảnh dài vì cùng phiên với Phase 1) và 70–80k token output; ước lượng thô, chưa đo bằng công cụ. Tiết kiệm: viết mỗi file một lượt rồi để test báo lỗi; ảnh chụp thu nhỏ 0,5–0,6; không dùng subagent; proof sinh tự động thay vì viết tay.

## Lỗi của AI và cách chỉnh

- **Test đếm sai tick (nhiều lần):** 13/43 test đỏ lần chạy đầu. Phân tích từng cái: 12 là kỳ vọng sai của test (cooldown tính từ tick bắt đầu, thời gian rơi 1 s, đẩy 4 m rải trên 15 tick, Gió Lạc cần ~76 tick để chạm, hiệu lực Bùa tính từ tick sau…), 1 là scenario trái luật (đèn vừa thắp đã tạo vùng an toàn nên bóng không thể gây hại đồng thời với thắng). Không sửa game để làm test xanh. Chỉnh harness: thêm vào CLAUDE.md "kiểm tra thứ tự giai đoạn và cách đánh số tick bằng test trước"; skill `add-scenario` nhắc "tính kỳ vọng từ số của ticket, không từ output".
- **Thực sự sai ở sim, do test/proof phát hiện:** tick hồi sinh vẫn cho Mây di chuyển (vận tốc ≠ 0 trái "vận tốc 0"), sửa; tích phân nhảy làm đỉnh thấp 5% so với lý thuyết, đổi sang động học chính xác.
- **Thao tác sai của AI:** dùng `git rm --cached docs/proof/phase-1` nhầm (gỡ bằng chứng Phase 1 khỏi index), phát hiện ngay ở `git status` và hoàn tác trước khi commit; ghi một ký tự xuống dòng thật vào chuỗi trong file test bằng script Python (lỗi cú pháp), sửa bằng Edit. Thêm quy tắc "Windows: ghi file bằng Edit/Write" vào CLAUDE.md.
- **Số đo gây hiểu nhầm:** `benchmark()` cho ~800 FPS (chỉ CPU) và pane ẩn làm `requestAnimationFrame` dừng. Đã ghi vào skill `verify` cách đo đúng (mở pane, đếm rAF).

## Đánh giá Phase 2

- Đạt: toàn bộ Phần 1 (số chuẩn), Phần 2 (3 bản đồ), Phần 3 mục có thể tự động kiểm (Gió Lạc, Bùa, gió, pause), Contract v1.1, tất định 3 đêm, hiệu năng headless và 60 FPS đo được.
- Kiểm bằng mắt/đọc code, chưa tự động: âm thanh (không nghe được trong môi trường làm việc này), mũi tên chỉ đèn, màn Bình Minh và nút của các màn hình (đã kiểm menu, giới thiệu, tạm dừng, cài đặt bằng DOM; chưa chơi trọn một Đêm bằng tay từ menu đến kết quả).
- Chưa đạt/rủi ro: Bot tự chơi chỉ thắng được một phần seed ở Đêm 1 với số chuẩn, nên chưa có bằng chứng thắng trọn Đêm 2 và 3 bằng headless, chỉ có từng cơ chế. Rủi ro với test ẩn nằm ở B1 (quy ước góc), B2 (xuất phát Đêm 3), B3 (hành vi `wander`), B6 (kiểu `invuln`), B9–B11 (lệch 1 tick).
- Việc cần cho phase sau: giữ `docs/spec/` cập nhật theo từng ticket; nếu ticket đổi số chuẩn thì sửa `tuning.js` và `game.contract.json` cùng lúc (test ép khớp nhau).
