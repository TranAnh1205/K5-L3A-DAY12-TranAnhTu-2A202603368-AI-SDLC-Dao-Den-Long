# Bằng chứng Phase 1 (tự sinh bởi `npm run proof`)

Node v24.15.0, win32 x64. Mỗi dòng chạy qua CLI headless thật; output nằm cạnh file này.

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Chơi Đêm 1 từ đầu tới thắng (5 đèn, mặc định của game) | bot ghi inputs → `--seed 1 --inputs scenarios/bot_seed1.inputs.json` | ĐẠT | won ở tick 5017, score 1582, 50 lần nhặt, 0 lần tỏa sáng, 0 lần bị chạm |
| Tính tất định: chạy 2 lần cùng seed/inputs ra file giống hệt | so sánh byte 2 lần chạy | ĐẠT | giống hệt (19495 byte) |
| Nhặt đom đóm + nạp đèn + thắp đèn | `scenarios/pickup_deposit.*` | ĐẠT | mote_picked tick 35, deposit+lantern_lit tick 101, score 110 |
| Tỏa sáng làm choáng + đẩy Bóng Mực trong bán kính, tốn ánh sáng | `scenarios/pulse_stun.*` | ĐẠT | pulse tick 31 stunned [S1]; S2 ngoài bán kính không bị; carried 4→2 |
| Bị Bóng Mực chạm mất lửa, hết lửa thì thua | `scenarios/lose_no_flames.scenario.json` | ĐẠT | player_hit tick 60 {"by":"shade","flames":0,"dropped":2} → lost/no_flames |
| Bóng Mực sợ đèn: không vào safe_radius, người chơi đứng ở đèn không bị chạm | `scenarios/safe_radius.scenario.json` | ĐẠT | 900 tick, 0 lần bị chạm, khoảng cách nhỏ nhất shade→đèn = 6.010 m (> 6) |
| Hết thời gian Đêm thì thua (dawn) | `scenarios/dawn.scenario.json` (time_left_s 2) | ĐẠT | game_over lost/dawn ở tick 120 |
| Inputs sai định dạng → mã thoát 2 | file tick không tăng | ĐẠT | exit 2, stderr: error: inputs: frame 1 tick 5 not strictly increasing |
