# Phase 2 — TICKET-02 "Ba hòn đảo" (contract v1.1) — tóm tắt cho agent

Nguồn: tab Phase 2 trên lab board. Bản này gom các điểm bắt buộc; số liệu cụ thể nằm trong code (`src/tuning.js`, `src/maps.js`) và được kiểm bởi test.

- Hai việc: (1) số liệu chuẩn thay mọi giá trị tự chọn; (2) mở rộng thành 3 Đêm + tính năng mới.
- Thứ tự một tick (bắt buộc): 1 input (pause trước) · 2 giảm bộ đếm · 3 di chuyển Mây (nhảy, lướt, bục, gió) + rơi · 4 nhặt đom đóm/bùa · 5 tương tác đèn · 6 vùng an toàn · 7 Tỏa Sáng · 8 di chuyển Bóng Mực/Gió Lạc · 9 chạm (Gió Lạc cướp trước, rồi Bóng Mực theo id tăng dần) · 10 sinh (thực thể mới tương tác từ tick sau) · 11 thắng/thua · 12 snapshot.
- Pause: tick vẫn tăng; `sim_tick`, thời gian, hồi chiêu, spawn, TTL đứng yên; snapshot `state:"paused"`.
- Bản đồ: Đêm 1 Đảo Bến, Đêm 2 Đảo Cau (2 đảo + cầu tre + 2 bục), Đêm 3 Đảo Chuông (3 tầng, 2 dốc, bục, tháp chuông, gió mạnh).
- Mới: Gió Lạc (idle/chase/flee), Bùa Gió, chuỗi 3 Đêm, tạm dừng, cài đặt lưu, âm thanh, HUD đầy đủ, bảng màu chuẩn.
- Contract v1.1: `contract_version "1.1"`, thêm khóa tuning (dash_*, night2/3_duration_s), `--night 1|2|3`, snapshot/scenario/input/event mới, tên trạng thái bóng `spawning|wander|chase|recoil|stunned`, một Đêm đầy đủ headless ≤ 30 s.
- DoD: bằng chứng; hồi quy Phase 1 với số chuẩn; spec có tiêu chí cho từng mục Phần 3; AGENTS/CLAUDE.md và skill cập nhật; ít nhất 1 scenario headless cho mỗi tính năng mới; ≥ 30 FPS ở 1280×720.
