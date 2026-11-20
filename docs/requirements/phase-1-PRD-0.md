# Phase 1 — PRD-0 + Test Contract v1.0 (tóm tắt các điểm bắt buộc)

Nguồn: tab Phase 1 trên lab board. Bản này là ghi chú làm việc cho agent, gom những gì **bắt buộc chính xác**.

## Phạm vi
- Một màn: Đêm 1 – Đảo Bến, đảo tròn, 5 Đèn Lồng Lớn.
- Đi lại, nhảy, camera 3D; đom đóm rải rác nhặt được; nạp ánh sáng thắp đèn.
- Bóng Mực xuất hiện, đuổi, chạm thì mất máu; tỏa sáng xua chúng (tốn ánh sáng); Bóng Mực sợ đèn.
- Thắp hết đèn = thắng, hết máu = thua, có điểm, HUD, chơi lại được.
- Phong cách: đêm ấm áp cổ tích, vàng cam = tốt, tím đen = nguy hiểm; Mây đội nón lá treo đèn lồng nhỏ; không bạo lực.

## Test Contract v1.0 (bắt buộc)
- `game.contract.json` ở gốc: contract_version, team, build_cmd, run_cmd, headless_cmd, tuning (số thật game dùng).
- `<headless_cmd> --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out f.jsonl [--snapshot-every n=10]`.
- 60 tick/s; dừng khi đủ ticks hoặc game kết thúc; exit 0; lỗi → khác 0 + stderr; inputs/scenario sai định dạng → exit 2.
- Snapshot tick 0 = sau dựng scenario, trước input. Bước k đọc input tick k → trạng thái k+1, sự kiện ghi tick k+1.
- time_left_s = thời lượng − bước/60. Khoảng cách theo XZ, "trong r" = ≤ r. Người chơi xuất phát (0,0,0).
- Inputs: frames tăng nghiêm ngặt, trường vắng giữ giá trị cũ, move [x,z] ∈[−1,1] chuẩn hóa nếu >1,
  x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ; nút kích hoạt khi false→true.
- Scenario: player, random_motes/random_shades, motes/shades thay thế danh sách, lanterns cập nhật theo id, time_left_s; dựng không phát sự kiện, không cộng điểm.
- Output JSONL: snapshot / event (mote_picked, deposit, lantern_lit, pulse, player_hit, shade_spawned, game_over) / end (dòng cuối).
- Tọa độ làm tròn 3 số; shade state tối thiểu có `stunned`; tất định theo seed.
