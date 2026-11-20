# Phase 1 — giả định, tiêu chí nghiệm thu, nhật ký AI, đánh giá

## Quyết định công nghệ
- **Node.js + Three.js (bản web)**: chạy được trên macOS, Linux và Windows mà không cần Docker; giảng viên chỉ cần Node ≥ 22.
- Tách `src/sim.js` (logic thuần, tất định, không DOM) khỏi `src/client.js` (hiển thị). CLI headless và game có giao diện dùng **cùng một** `Game.step()`, nên test headless phản ánh đúng game thật.
- Headless không cần thư viện ngoài, chạy rất nhanh (5000 tick trong vài chục ms).

## Giả định (chỗ PRD-0 mơ hồ)
| # | Chỗ mơ hồ | Giả định của tôi |
|---|---|---|
| A1 | "Máu" | Máu = `flames` (3 ngọn lửa). Mỗi lần bị chạm mất 1, sau đó bất tử `invuln_s` = 2 s |
| A2 | "Tỏa sáng tốn ánh sáng" | Tốn `pulse_cost` = 2 đom đóm **đang mang**. Không đủ thì không tỏa sáng (không có event). Hồi chiêu 1 s |
| A3 | Tỏa sáng tác dụng thế nào | Mọi Bóng Mực trong `pulse_radius` 6 m (kể cả con đang choáng, khi đó làm mới thời gian choáng) bị choáng 3 s và bị đẩy ra xa 4 m theo hướng từ người chơi ra; +20 điểm mỗi con |
| A4 | "Bóng Mực sợ đèn" | Bóng Mực không vào được bán kính `safe_radius` 6 m quanh **mọi** đèn, kể cả đèn chưa thắp (cột đèn thiêng). Bị đẩy ra mép vùng (+0.01 m) |
| A5 | Nạp đèn | Bấm interact trong `interact_radius` 3 m với đèn **chưa thắp gần nhất**: nạp min(đang mang, còn thiếu). Đủ `lantern_cost` = 10 thì đèn sáng. Đèn đã sáng không nhận thêm |
| A6 | Nhặt đom đóm | Tự động khi trong `pickup_radius` 1.5 m, tối đa `carry_capacity` 10 |
| A7 | Bị chạm thì đánh rơi | Rơi floor(mang × 0.5); đom đóm rơi **mất luôn** (không sinh lại trên đất) |
| A8 | Thua | Hết lửa (`no_flames`) hoặc hết thời gian Đêm 300 s (`dawn`) |
| A9 | Rơi khỏi đảo | Không có (`fall_enabled: false`). Người chơi và Bóng Mực bị giữ trong đảo bán kính 40 m |
| A10 | Nhảy | Chỉ là chuyển động trục Y (vận tốc 7 m/s, trọng lực 20). Mọi khoảng cách tính theo XZ nên nhảy không né được Bóng Mực |
| A11 | Sinh đom đóm (mặc định) | 40 con lúc đầu, mỗi 3 s sinh thêm 1 nếu dưới 40. Tắt khi `random_motes: false` |
| A12 | Sinh Bóng Mực (mặc định) | 2 con lúc đầu (không phát event), mỗi 40 s sinh thêm 1 (event `shade_spawned`), tối đa 5; sinh cách người chơi ≥ 15 m, ngoài vùng an toàn |
| A13 | Hành vi Bóng Mực | Luôn đuổi thẳng tới người chơi với 4 m/s (chậm hơn người chơi 6 m/s). State `chase` hoặc `stunned` |
| A14 | Vị trí đèn | 5 đèn trên vòng tròn bán kính 25 m, L1 tại (0,0,25), cách nhau 72° |
| A15 | Điểm | +10 mỗi đom đóm, +100 mỗi đèn, +20 mỗi Bóng Mực bị choáng. Khi **thắng** cộng thêm 2 × floor(giây còn lại) + 50 × lửa còn lại. Thua thì không có thưởng |
| A16 | Scenario đèn `lit: true` | Đặt sáng sẵn, không cộng điểm, giữ `deposited` như khai báo |
| A17 | Thứ tự trong một bước | thời gian → di chuyển/nhảy → nhặt → nạp đèn (có thể thắng) → tỏa sáng → Bóng Mực di chuyển → va chạm (có thể thua) → sinh mới → kiểm tra hết giờ |

## Tiêu chí nghiệm thu → bằng chứng
Xem [docs/proof/phase-1/summary.md](../proof/phase-1/summary.md) (sinh tự động bởi `npm run proof`) và `npm test` (19 test).

| Yêu cầu PRD-0 | Cách kiểm chứng | Kết quả |
|---|---|---|
| Đảo tròn, 5 đèn | test `tick 0 snapshot`; ảnh `gui-start.jpg` | ĐẠT |
| Đi lại, nhảy, camera 3D | test `movement`; GUI chơi bằng WASD/Space/chuột | ĐẠT |
| Đom đóm rải rác, nhặt được | test `pickup`, proof `pickup_deposit` | ĐẠT |
| Nạp ánh sáng thắp đèn | test `interact`, proof `pickup_deposit`, ảnh `gui-lantern-lit.jpg` | ĐẠT |
| Bóng Mực xuất hiện và đuổi | test `shades chase`, `default game spawns` | ĐẠT |
| Tỏa sáng xua Bóng Mực | test `pulse`, proof `pulse_stun` | ĐẠT |
| Thắng / thua / điểm | proof `full_win_seed1`, `lose_no_flames`, `dawn` | ĐẠT |
| HUD | ảnh `gui-*.jpg` (lửa, đom đóm, đèn, thời gian, điểm, trạng thái tỏa sáng) | ĐẠT (kiểm bằng mắt) |
| Chơi lại | phím R gọi `newGame()` | ĐẠT (thử tay, chưa có test tự động) |
| Test Contract v1.0 | `tests/cli.test.js`, proof `determinism`, exit 2 | ĐẠT |

Hạn chế đã biết:
- Ảnh GUI chụp khi tab trình duyệt bị ẩn, nên sim được bước bằng script qua `window.__ddl`. Trong ảnh `gui-lantern-lit.jpg`, lửa được đặt 99 để bot sống tới đèn, nên HUD hiện nhiều chấm.
- Bot tự chơi thắng 7/10 seed. Ở 3 seed còn lại bot bị kẹt dao động tới khi trời sáng; đó là lỗi của bot, không phải của game.

## Nhật ký dùng AI
| Bước | Công cụ | Việc | Ghi chú |
|---|---|---|---|
| 1 | Claude Code (Opus) | Đọc tài liệu lab, tóm tắt | Ngữ cảnh: 6 file md |
| 2 | Claude Code | Viết `sim.js`, `headless.js`, tuning, contract | Một lượt viết, sau đó sửa 2 lỗi nhỏ |
| 3 | Claude Code | 19 test node:test | Phát hiện 1 test sai: ván mặc định thua trước khi Bóng Mực mới kịp sinh. Sửa scenario test (lửa 999), không sửa game |
| 4 | Claude Code | Client Three.js, kiểm bằng browser pane + ảnh | Phát hiện tab bị ẩn nên rAF không chạy; thêm hook `__ddl` để kiểm chứng |
| 5 | Claude Code | Bot + `proof.js`, harness (CLAUDE.md, Stop hook, skill verify, CI) | |

**Token / chi phí ước tính Phase 1:** khoảng 120k token input (phần lớn là đọc lại ngữ cảnh) và 35k token output. Với giá Opus, ước tính vài USD.
Cách tiết kiệm token:
- Viết mỗi file một lần, đầy đủ, rồi kiểm chứng bằng test thay vì đọc lại file.
- Kiểm tra GUI bằng ảnh thu nhỏ 0.6.
- Không dùng subagent.
- Đầu ra proof nhỏ (snapshot mỗi 600 tick).

## Lỗi AI và chỉnh harness
- **Đếm thời gian sai:** lần đầu agent trừ thời gian ở cuối bước, nên khi thắng sớm `time_left` lệch 1 tick. Đã sửa: trừ ở đầu bước. Đã thêm quy ước "time_left = duration − steps/60" vào test `snapshots every N ticks`.
- **Lệnh `npm test` không chạy trên Node 24:** `node --test tests/` không nhận thư mục. Đã đổi sang glob `"tests/*.test.js"` và ghi Node ≥ 22 vào CLAUDE.md.
- **Harness thêm:** Stop hook (`scripts/stop-check.js`) chặn agent kết thúc khi test đỏ. Skill `verify` mô tả cách sinh bằng chứng. CI chạy test và proof trên Ubuntu và macOS mỗi lần push.

## Đánh giá Phase 1
- Đạt toàn bộ yêu cầu lõi của PRD-0 và Test Contract v1.0, có bằng chứng tự động.
- Rủi ro với test ẩn nằm ở các giả định A2, A3, A4 và A15. Đã khai báo đầy đủ trong `game.contract.json` và ở trên.
- Phase sau: theo dõi xem ticket có đổi luật đèn an toàn hay cách tính chi phí tỏa sáng không; nếu đổi thì sửa test kèm lý do.
