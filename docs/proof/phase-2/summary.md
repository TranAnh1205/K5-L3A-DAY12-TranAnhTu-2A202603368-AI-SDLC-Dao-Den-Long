# Bằng chứng Phase 2 (tự sinh bởi `npm run proof`)

Node v24.15.0, win32 x64. Mỗi dòng chạy qua CLI headless thật (`node src/headless.js`); scenario ở `scenarios/`, output `.jsonl` nằm cạnh file này. Ảnh giao diện `gui-*.jpg` được chụp riêng (xem ghi chú Phase 2).


## P1 hồi quy

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Chơi Đêm 1 từ đầu đến thắng (5 đèn) với số chuẩn | bot tự chơi (seed tìm được), ghi inputs, phát lại qua CLI | ĐẠT | seed 11: thắng ở tick 12121, điểm 1264, 3 lần tỏa sáng, 2 lần bị chạm |
| Nhặt đom đóm, nạp đèn, thắp đèn (+10/đom đóm khi nạp, +100/đèn) | `p1_pickup_deposit` | ĐẠT | mote_picked tick 41, deposit + lantern_lit tick 101, điểm 110 (10 + 100) |
| Bị Bóng Mực chạm mất lửa, hết lửa thì thua | `p1_lose_no_flames` | ĐẠT | player_hit tick 60 {"by":"shade","flames":0,"dropped":2} → lost/no_flames |
| Hết giờ thì thua (dawn) | `p1_dawn` (time_left_s 2) | ĐẠT | game_over lost/dawn ở tick 120 |
| Inputs sai định dạng → mã thoát 2 | frames trùng tick | ĐẠT | exit 2, stderr: error: inputs: frame 1 tick 5 not strictly increasing |

## Phần 1 · Di chuyển

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Lướt 14 m/s trong 0,2 s, hồi chiêu 1,5 s tính từ lúc bắt đầu, bấm khi đang hồi bị bỏ qua | `p2_dash`: bấm ở tick 0, 60 (bị bỏ qua), 90 (được) | ĐẠT | dash ở tick 1 và 91 (lần bấm ở tick 60 bị bỏ qua); sau 12 tick đi được z=2,8 m; dash_cd_s=1,317 (79 tick còn lại) |
| Chạy 6 m/s, nhảy 7 m/s trọng lực 20 | `p2_move_jump` | ĐẠT | sau 1 s z=5.9 (6 m/s, tăng tốc 3 tick); đỉnh nhảy 1.222 m (lý thuyết 1,225) |

## Phần 1 · Rơi

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Rơi khỏi đảo (Y < −10): đúng 1 player_hit by fall, mất hết đom đóm, chờ 60 tick, hồi sinh ở xuất phát, bất tử 90 tick | `p2_fall` | ĐẠT | 1 sự kiện fall ở tick 81 {"by":"fall","flames":2,"dropped":0,"lost":4}; hồi sinh ở (0,0,0) tick 141, invuln=true |

## Phần 1 · Đèn

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Nạp nhiều lần, đèn nhớ tiến độ; chọn đèn gần nhất, bằng nhau thì id nhỏ hơn | `p2_deposit_multi` | ĐẠT | deposit vào L2 (id nhỏ hơn khi bằng khoảng cách) {"lantern_id":"L2","amount":3,"deposited":3}; lần bấm thứ hai không làm gì vì đã hết đom đóm |

## Phần 1 · Tỏa Sáng

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Tốn 3, bán kính 5 (3D từ chân+0,8), choáng 120 tick, đẩy 4 m trong 15 tick, +5/con, hồi 3 s | `p2_pulse` | ĐẠT | pulse tick 31 stunned ["S1"]; carried 5→2; S1 bị đẩy đúng 4,00 m (x tick 30 → tick 50); choáng tới tick ~150; điểm +5; lần bấm lúc tick 60 bị chặn bởi hồi chiêu |

## Phần 1 · Bị đánh

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| −1 lửa, rơi floor(n/2) quanh Mây (ttl 480), bất tử 90 tick, bóng lùi 2 m | `p2_hit` | ĐẠT | hit tick 1 {dropped:3} → 3 đom đóm rơi trên vành 1,5–2,5 m (ttl ~8 s); hit kế tiếp đúng tick 91 (bất tử 90 tick) |

## Phần 1 · Vùng an toàn

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Chỉ đèn đã sáng tạo vùng 6 m chặn Bóng Mực; bóng bên trong lúc thắp bị đẩy ra ≤30 tick, không sát thương | `p2_safe_zone`, `p2_safe_escort` | ĐẠT | 900 tick đứng cạnh đèn sáng: 0 lần bị chạm, khoảng cách bóng–đèn nhỏ nhất 6.002 m; bóng bên trong bị đẩy tới 6.002 m sau 30 tick, 0 sát thương |

## Phần 1 · Lịch sinh

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Đom đóm 20 + 1 mỗi 240 tick (trần 30); Bóng Mực 2 con ở tick 300 rồi mỗi 480/420/360 tick, trần 6/8/10 | chạy mặc định 3 đêm, 5000 tick, không bị chạm (lửa 999) | ĐẠT | Đêm 1: bóng ở tick 300,300,780,1260…; Đêm 2: bóng ở tick 300,300,720,1140…; Đêm 3: bóng ở tick 300,300,660,1020… |

## Phần 3 · Gió Lạc

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Sinh ở tick 1200 (Đêm 2, 3), id D1; chase khi mang ≥5 và ≤15 m; cướp min(3, mang); flee 240 tick rồi biến mất cùng đồ cướp; không mất lửa | `p3_drifter_steal` | ĐẠT | steal tick 76 {"drifter_id":"D1","amount":3,"carried":3}; biến mất ở tick 320 (≈240 tick sau); lửa vẫn 3; D1 sinh ở tick 1200 trên Đêm 3 |
| Tỏa Sáng: chase → flee không cướp; flee có đồ → thả toàn bộ đom đóm rơi, biến mất sau 120 tick | `p3_drifter_pulse`, `p3_drifter_drop` | ĐẠT | chase+pulse → flee, stolen 0, không event steal; flee có đồ+pulse → drifter_drop {"drifter_id":"D1","amount":3}, 3 đom đóm rơi, biến mất ở ~tick 120 |

## Phần 3 · Bùa Gió

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Nhặt như đom đóm, hiệu lực 600 tick, chạy 7,2 m/s, Lướt không hồi chiêu, xuất hiện lại sau 2700 tick | `p3_charm` | ĐẠT | charm_picked tick 21; vel 7,2 m/s; hai lần lướt cách nhau 20 tick (không hồi chiêu); respawn_s≈43,7 (2700 tick trừ ~80 tick đã trôi) |

## Phần 3 · Tạm dừng

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Logic dừng hoàn toàn khi pause: tick vẫn tăng nhưng sim_tick, thời gian, hồi chiêu đứng yên; state "paused"; paused/resumed | `p3_pause` | ĐẠT | paused@21, resumed@81; tick 30 và 70: sim_tick=20, time_left_s=299.667, pulse_cd_s=1.333 (không đổi) |

## Phần 3 · Gió mạnh

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Đêm 3: báo trước 2 s, gió 5 s mỗi 30 s đẩy 2 m/s; wind_enabled=false tắt | `p3_wind` | ĐẠT | cảnh báo từ tick 1680, gió 1800–2099 (dir 225.747°); trong 4 s Mây bị đẩy 8.00 m (2 m/s × 4 s); wind_enabled:false → không gió |

## Phần 2 · Đêm 2

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Cầu tre đi được, khoảng hở thì rơi; bục nhảy bắn sang đảo bên kia, bay ~1,4 s | `p2_n2_pad`, `p2_n2_gap` | ĐẠT | bục (20,18) → đáp ở (50.6, 6.6) trong đảo B sau ~80 tick trên không (≈1,4 s); đi trên cầu (x 24→36) không rơi; bước ra cạnh cầu thì rơi |

## Phần 2 · Đêm 3

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Dốc leo lên tầng 1, vách đứng chặn, bục nhảy đáp tầng 2, tháp chuông đặc | `p2_n3_ramp`, `p2_n3_cliff`, `p2_n3_pad`, `p2_n3_tower` | ĐẠT | leo dốc 30° lên y=3; vách tầng 1 chặn ở z=12; bục (0,3,13) → đáp tầng 2 (y=6); tháp chuông chặn ở r=2.000 (≥2) |

## Hiệu năng

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Một Đêm đầy đủ (21.600 tick) chạy headless ≤ 30 s | CLI, 3 đêm, lửa 999 để không kết thúc sớm | ĐẠT | Đêm 1: 347 ms (18000 tick); Đêm 2: 595 ms (19800 tick); Đêm 3: 691 ms (21600 tick). Máy: 11th Gen Intel(R) Core(TM) i7-1185G7 @ 3.00GHz, Node v24.15.0 |

## Tất định

| Yêu cầu | Cách kiểm chứng | Kết quả | Chi tiết |
|---|---|---|---|
| Cùng seed/scenario/inputs → output giống hệt, cả 3 đêm | chạy 2 lần mỗi đêm với inputs ngẫu nhiên-cố-định, so byte | ĐẠT | Đêm 1: 58745 byte giống hệt; Đêm 2: 76928 byte giống hệt; Đêm 3: 87239 byte giống hệt |
