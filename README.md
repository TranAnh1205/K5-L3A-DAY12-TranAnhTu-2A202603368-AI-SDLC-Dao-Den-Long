# Day 12 — AI SDLC: Đảo Đèn Lồng

> 👤 **Hình thức:** bài tập **cá nhân** (1 người / 1 MSSV).
> 🎯 **Mục tiêu:** áp dụng trọn vòng đời phát triển phần mềm (SDLC) cùng AI để xây một **game 3D** từ yêu cầu ban đầu tới bản phát hành, qua **4 phase** giống một dự án thật.
> 🏮 **Lab board + trợ giảng:** **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**

---

## Lab board (artifact)

Mọi yêu cầu của dự án được phát hành tại **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**:

- Mỗi phase là một **tab**. Tab của phase chưa phát hành bị khóa và sẽ mở khi giảng viên phát hành.
- Mỗi tab có **trợ giảng AI riêng**, chỉ trả lời thắc mắc trong phạm vi phase đó, ngắn gọn từng câu.
- Trợ giảng cần bạn **đăng nhập claude.ai** và dùng lượt Claude của chính bạn. Khi có mâu thuẫn, lời giảng viên là cuối cùng.
- Trợ giảng **không thay thế** câu hỏi clarify chính thức (xem bên dưới).

---

## Bài lab: áp dụng SDLC với AI

Ngày nay viết code gần như miễn phí: agent viết được hàng nghìn dòng trong vài phút. Phần khó nằm ở **làm rõ yêu cầu**, **cung cấp đúng ngữ cảnh** cho agent và **kiểm chứng** kết quả. Lab này cho bạn trải nghiệm toàn bộ quá trình đó trên một dự án có yêu cầu thay đổi theo thời gian.

Bạn được dùng AI tối đa (Claude Code, Codex, Cursor, Grok Build hoặc công cụ khác). Điều được đánh giá là **bạn dẫn dắt AI qua từng bước SDLC tốt đến đâu** và sản phẩm cuối có chạy đúng không, chứ không phải bạn tự gõ bao nhiêu dòng.

### Dự án

**Đảo Đèn Lồng** là một game 3D góc nhìn người thứ ba. Người chơi vào vai Mây, người giữ đèn nhỏ tuổi, chạy khắp hòn đảo trong đêm gom đom đóm để thắp lại các Đèn Lồng Lớn, đồng thời né những Bóng Mực sống trong sương đen.

- **Không ràng buộc công nghệ:** engine, ngôn ngữ, framework tùy bạn.
- Game phải chạy được trên laptop macOS hoặc Linux (Docker hoặc bản web được chấp nhận).
- Mọi bài nộp phải tuân theo **Test Contract** (chế độ chạy headless) để được chấm tự động và so sánh với nhau.

### Dự án diễn ra thế nào

Dự án nhận yêu cầu giống ngoài thực tế: bản mô tả đầu tiên còn mơ hồ, sau đó các ticket lần lượt bổ sung, chi tiết hóa và **có thể thay đổi** những gì đã có.

| Phase | Bạn nhận được | Nộp bằng tag |
|---|---|---|
| **Phase 1** | **PRD-0**: mô tả tổng quát của khách hàng + Test Contract v1.0 | `phase-1` |
| **Phase 2** | **Ticket-02**, phát hành khi Phase 1 kết thúc | `phase-2` |
| **Phase 3** | **Ticket-03**, phát hành khi Phase 2 kết thúc | `phase-3` |
| **Phase 4** | **Ticket-04**, phát hành khi Phase 3 kết thúc | `phase-4` + Release `v1.0.0` |

Nội dung từng ticket chỉ được công bố trên lab board khi tới phase đó.

### Mỗi phase là một vòng SDLC

1. **Requirements:** đọc ticket, tìm chỗ mơ hồ, dùng lượt clarify nếu cần.
2. **Spec:** viết `docs/spec/phase-N.md` (yêu cầu đã làm rõ, giả định, acceptance criteria).
3. **Design:** cho agent lập kế hoạch (plan mode), bạn duyệt trước khi code. Quyết định lớn ghi vào `docs/adr/`.
4. **Build:** để agent viết code; bạn điều phối, review diff.
5. **Test:** test tự động của bạn + scenario headless; hook chạy test sau khi agent sửa code.
6. **Release:** commit gọn, cập nhật `CHANGELOG.md`, gắn tag `phase-N`.
7. **Cải tiến harness:** mỗi khi agent mắc cùng một lỗi hai lần, cập nhật `AGENTS.md`, viết skill hoặc thêm hook/lint rule.

### Luật clarify

- Mỗi phase bạn được hỏi giảng viên **1 câu clarify chính thức**, gửi bằng văn bản trong **30% thời gian đầu** của phase, chỉ **1 ý** mỗi câu.
- Câu trả lời gửi riêng cho bạn; hết phase, toàn bộ câu hỏi và câu trả lời được công khai cho cả lớp.
- Điểm còn mơ hồ mà không hỏi: **tự đưa ra giả định hợp lý và ghi rõ trong spec**.
- Ghi lại câu hỏi và câu trả lời trong `docs/clarify-log.md`.

---

## Bàn giao cuối cùng

Mỗi bạn nộp **một repo GitHub cá nhân ở chế độ public**, gồm:

1. **Toàn bộ mã nguồn** của game đã hoàn thành qua 4 phase.
2. **Video demo** định dạng **`.mp4`, dài dưới 5 phút**, đưa lên GitHub theo **một** trong hai cách:
   - đính kèm vào GitHub Release `v1.0.0` (khuyến nghị), hoặc
   - commit vào `docs/demo/demo.mp4` nếu file dưới 100 MB.

   Đặt link video ở đầu `README.md` của repo. Video nên có: chơi trực tiếp một đoạn, chạy headless/benchmark, đi nhanh qua harness AI và lịch sử git.
3. **Harness AI đã dùng trong quá trình làm**, giữ nguyên trong repo và lịch sử git: `AGENTS.md` (và/hoặc `CLAUDE.md`, rules của Cursor…), skills, hooks, plugins, cấu hình MCP.
4. **Tài liệu dự án:** spec từng phase, ADR, clarify log, nhật ký dùng AI, retro.
5. **Tag** `phase-1` … `phase-4` và **Release** `v1.0.0` có bản chạy được.

### Cấu trúc repo bắt buộc

```
README.md                      # mô tả, link video demo, cài đặt ≤ 3 lệnh, điều khiển, cách chạy test/headless
CHANGELOG.md                   # thay đổi theo từng phase
CREDITS.md                     # nguồn asset, âm thanh, công cụ AI tạo nội dung
LICENSE
game.contract.json             # theo Test Contract
AGENTS.md                      # (và/hoặc CLAUDE.md, .cursor/rules, …)
docs/
  spec/phase-1.md … phase-4.md
  adr/0001-*.md …
  clarify-log.md
  ai-usage-log.md              # công cụ, model, phiên quan trọng, chi phí ước tính, lúc AI sai và cách sửa
  retro.md
  demo/demo.mp4                # nếu không đính kèm vào Release
.agents/skills/ hoặc .claude/skills/ hoặc tương đương
.claude/settings.json (hooks), .mcp.json hoặc tương đương
tests/
src/                           # hoặc cấu trúc của engine bạn chọn
```

Không commit API key, token hay file `.env`.

### Nộp bài

Gửi link repo public theo hướng dẫn của Coach. Hạn nộp từng phase và hạn cuối theo thông báo trong buổi Lab.

---

## Đánh giá (100 điểm)

| Hạng mục | Điểm | Nội dung |
|---|---|---|
| A. Test tự động ẩn | 35 | Chạy headless trên repo của bạn ở mỗi phase, kể cả kiểm tra lại các phase trước |
| B. Hiệu năng & ổn định | 10 | Đo trên cùng một máy chấm cho mọi bài |
| C. Quy trình SDLC & harness AI | 25 | Spec, AGENTS.md, skills, hooks, test của bạn, lịch sử git, nhật ký dùng AI |
| D. Chất lượng sản phẩm | 15 | Mỹ thuật đúng định hướng, cảm giác chơi, giao diện, âm thanh |
| E. Clarify & phản ứng thay đổi | 5 | Chất lượng câu hỏi clarify; cách bạn xử lý khi yêu cầu thay đổi |
| F. Demo & retro | 10 | Video demo và bài retro: giải thích quyết định, số liệu, bài học về AI |

Sau mỗi phase, lớp có **bảng xếp hạng chung** (tỉ lệ test đạt, hiệu năng, điểm chơi thử) để các bạn so sánh sản phẩm với nhau.

---

## Quy định

- Được dùng AI tối đa. **Không** sao chép repo của bạn khác; giảng viên có thể so sánh mã giữa các bài.
- Nhân vật, bối cảnh, tên gọi trong lab là bản gốc. Không dùng nhân vật, nhạc, mô hình hay thương hiệu của game/phim có sẵn. Asset bên ngoài chỉ dùng loại CC0/CC-BY/MIT hoặc tự tạo/AI tạo, và ghi nguồn trong `CREDITS.md`.
- **Không xóa** file harness AI sau khi dùng: lịch sử git phải cho thấy chúng tồn tại trong quá trình làm.
- Câu trả lời clarify của người khác chỉ được dùng sau khi Q&A được công khai.
