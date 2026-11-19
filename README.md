# Day 12 — AI SDLC: Đảo Đèn Lồng

> 👤 **Hình thức:** bài tập **cá nhân** (1 người / 1 MSSV).
> 🎯 **Mục tiêu:** áp dụng trọn vòng đời phát triển phần mềm (SDLC) cùng AI để xây một **game 3D** từ yêu cầu ban đầu tới bản phát hành, qua **4 phase** giống một dự án thật.
> 🔬 **Trọng tâm:** **evaluation, proof, verification**. Một tính năng chỉ được coi là xong khi có **bằng chứng** nó chạy đúng.
> 🏮 **Lab board + trợ giảng:** **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**

---

## Lab board (artifact)

Mọi yêu cầu của dự án được phát hành tại **[Đảo Đèn Lồng Lab](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW)**:

- Mỗi phase là một **tab**. Tab của phase chưa phát hành bị khóa và sẽ mở khi giảng viên phát hành.
- Mỗi tab có **trợ giảng AI riêng**, chỉ trả lời thắc mắc trong phạm vi phase đó, ngắn gọn từng câu.
- Trợ giảng cần bạn **đăng nhập claude.ai** và dùng lượt Claude của chính bạn. Khi có mâu thuẫn, lời giảng viên là cuối cùng.

---

## Bài lab: áp dụng SDLC với AI

Ngày nay viết code gần như miễn phí: agent viết được hàng nghìn dòng trong vài phút. Phần khó, và là phần lab này chấm nặng nhất, nằm ở:

1. **Làm rõ yêu cầu** thành tiêu chí nghiệm thu kiểm chứng được.
2. **Cung cấp đúng ngữ cảnh** để agent làm đúng việc.
3. **Kiểm chứng và đưa ra bằng chứng** rằng sản phẩm làm đúng những gì yêu cầu nói.

Bạn được dùng AI tối đa (Claude Code, Codex, Cursor, Grok Build hoặc công cụ khác). Điều được đánh giá là **bạn dẫn dắt và kiểm chứng AI qua từng bước SDLC tốt đến đâu**, chứ không phải bạn tự gõ bao nhiêu dòng.

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

Nội dung từng ticket chỉ được công bố trên lab board khi tới phase đó. Chỗ nào yêu cầu còn mơ hồ: tự đưa ra giả định hợp lý và **ghi rõ trong spec**.

### Mỗi phase là một vòng SDLC có kiểm chứng

Mỗi bước tạo ra một sản phẩm và một bằng chứng. Viết cách kiểm chứng **trước** khi để agent viết code.

| Bước | Bạn làm gì | Bằng chứng để lại |
|---|---|---|
| 1. Requirements | Đọc ticket, biến từng yêu cầu thành **acceptance criteria (AC) kiểm chứng được**, có mã `AC-Pn-xx` | `docs/spec/phase-N.md` |
| 2. Verification plan | Với mỗi AC, chọn cách kiểm chứng: unit test, scenario headless, kiểm tra thủ công có ảnh/video, hoặc số đo | `docs/verification/phase-N.md` (ma trận truy vết) |
| 3. Design | Cho agent lập kế hoạch (plan mode), bạn duyệt. Quyết định lớn ghi ADR | `docs/adr/` |
| 4. Build | Agent viết code theo kế hoạch; bạn điều phối, review diff | Commit nhỏ, thông điệp rõ |
| 5. Verify | Agent và bạn chạy toàn bộ kiểm chứng; sửa tới khi mọi AC có kết quả **Đạt** kèm bằng chứng | `docs/proof/phase-N/` |
| 6. Evaluate | Đánh giá chất lượng và quy trình: số test đạt, lỗi agent gặp, harness nào giúp, chi phí AI | Mục "Evaluation" trong `docs/verification/phase-N.md`, `docs/ai-usage-log.md` |
| 7. Release | CI xanh, `CHANGELOG.md`, gắn tag `phase-N` | Tag + lần chạy CI tương ứng |

---

## Evaluation, Proof & Verification

Đây là phần quan trọng nhất của lab. Nguyên tắc chung: **không có bằng chứng thì chưa xong**. Câu "agent bảo là chạy rồi" không phải bằng chứng.

### 1. Ma trận truy vết: yêu cầu → kiểm chứng → bằng chứng

`docs/verification/phase-N.md` liệt kê mọi AC của phase và cách bạn chứng minh nó:

```markdown
| AC | Yêu cầu (tóm tắt) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| AC-P1-03 | Nhặt đom đóm khi đi tới gần | tests/scenarios/pickup_basic.json | docs/proof/phase-1/pickup_basic.jsonl | Đạt |
| AC-P1-07 | Thua khi hết máu | tests/unit/test_flames.py::test_lose | CI run #42 | Đạt |
| AC-P1-12 | Đảo sáng dần khi thắp đèn | Kiểm tra thủ công | docs/proof/phase-1/lit_progress.gif | Đạt |
```

Mọi AC phải có một dòng. AC chưa đạt ghi rõ **Chưa đạt** kèm lý do; ghi trung thực được đánh giá cao hơn giấu lỗi.

### 2. Kiểm chứng tự động

- **Test của bạn:** unit test cho logic + **scenario headless** (file scenario + inputs + kết quả mong đợi) theo Test Contract. Chạy toàn bộ bằng **1 lệnh**.
- **Tính tất định:** có ít nhất một test chạy headless hai lần cùng seed và so sánh output phải giống hệt.
- **CI:** GitHub Actions chạy test + scenario headless ở mỗi lần push. Badge CI đặt ở đầu README. Mỗi tag `phase-N` phải ứng với một lần CI xanh.
- **Regression:** test của phase trước vẫn chạy ở phase sau. Khi yêu cầu thay đổi làm test cũ sai, **sửa hoặc xóa test có ghi lý do** trong spec/ADR, không tắt âm thầm.

### 3. Agent phải tự kiểm chứng

- Viết ít nhất một **verification skill**: hướng dẫn agent chạy game (headless và/hoặc có giao diện), kiểm tra hành vi thật, lưu output, ảnh chụp hoặc video làm bằng chứng.
- Dùng **hook** để agent không thể kết thúc khi test đang đỏ (ví dụ chạy test khi agent dừng, chạy lint/format sau khi sửa file).
- Người/agent **chấm** một thay đổi không phải là người/agent đã **viết** nó: dùng subagent review riêng hoặc tự review diff.

### 4. Thư mục bằng chứng

`docs/proof/phase-N/` chứa bằng chứng thô, đặt tên khớp với ma trận truy vết:

- output headless (`.jsonl`) của các scenario quan trọng;
- báo cáo test (ví dụ JUnit XML hoặc log) của lần chạy cuối;
- ảnh chụp, GIF hoặc clip ngắn cho những gì chỉ nhìn mới thấy (đồ họa, HUD, menu, hiệu ứng);
- từ Phase 4: `bench.json`, `soak.json` và cấu hình máy đã đo.

Giữ file nhỏ (GIF/clip vài giây). Video lớn để ở GitHub Release.

### 5. Evaluation sau mỗi phase

Cuối mỗi phase, viết mục **Evaluation** trong `docs/verification/phase-N.md`:

- Số AC đạt / tổng; số test, tỉ lệ đạt; có regression nào không.
- Những lần **AI làm sai** (bịa yêu cầu, test giả, sửa sai chỗ), bạn phát hiện bằng cách nào, và bạn đã thêm gì vào harness (rule, skill, hook, test) để không lặp lại.
- Skill/hook nào thực sự giúp; skill nào nên bỏ. Nếu có thể, đánh giá skill bằng một **eval nhỏ**: chạy cùng một nhiệm vụ có và không có skill, so kết quả.
- Chi phí AI ước tính (token / $ / giờ) cho phase.

---

## Bàn giao cuối cùng

Mỗi bạn nộp **một repo GitHub cá nhân ở chế độ public**, gồm:

1. **Toàn bộ mã nguồn** của game đã hoàn thành qua 4 phase.
2. **Video demo** định dạng **`.mp4`, dài dưới 5 phút**, đưa lên GitHub theo **một** trong hai cách:
   - đính kèm vào GitHub Release `v1.0.0` (khuyến nghị), hoặc
   - commit vào `docs/demo/demo.mp4` nếu file dưới 100 MB.

   Đặt link video ở đầu `README.md` của repo. Video phải có phần **bằng chứng**: chơi trực tiếp một đoạn, chạy bộ test và scenario headless (thấy kết quả đạt), chạy benchmark, và đi nhanh qua ma trận truy vết, harness AI, lịch sử git.
3. **Bằng chứng kiểm chứng** cho cả 4 phase: `docs/verification/`, `docs/proof/`, CI xanh ở mỗi tag.
4. **Harness AI đã dùng trong quá trình làm**, giữ nguyên trong repo và lịch sử git: `AGENTS.md` (và/hoặc `CLAUDE.md`, rules của Cursor…), skills (gồm verification skill), hooks, plugins, cấu hình MCP.
5. **Tài liệu dự án:** spec từng phase, ADR, nhật ký dùng AI, retro.
6. **Tag** `phase-1` … `phase-4` và **Release** `v1.0.0` có bản chạy được.

### Cấu trúc repo bắt buộc

```
README.md                      # badge CI, link video demo, cài đặt ≤ 3 lệnh, điều khiển, cách chạy test/headless
CHANGELOG.md                   # thay đổi theo từng phase
CREDITS.md                     # nguồn asset, âm thanh, công cụ AI tạo nội dung
LICENSE
game.contract.json             # theo Test Contract
AGENTS.md                      # (và/hoặc CLAUDE.md, .cursor/rules, …)
.github/workflows/ci.yml       # chạy test + scenario headless mỗi lần push
docs/
  spec/phase-1.md … phase-4.md           # acceptance criteria AC-Pn-xx
  verification/phase-1.md … phase-4.md   # ma trận truy vết + mục Evaluation
  proof/phase-1/ … phase-4/              # bằng chứng thô: jsonl, báo cáo test, ảnh, GIF, bench
  adr/0001-*.md …
  ai-usage-log.md              # công cụ, model, phiên quan trọng, chi phí, lúc AI sai và cách sửa
  retro.md
  demo/demo.mp4                # nếu không đính kèm vào Release
.agents/skills/ hoặc .claude/skills/ hoặc tương đương   # gồm verification skill
.claude/settings.json (hooks), .mcp.json hoặc tương đương
tests/
  unit/
  scenarios/                   # scenario + inputs + kết quả mong đợi
src/                           # hoặc cấu trúc của engine bạn chọn
```

Không commit API key, token hay file `.env`.

### Nộp bài

Gửi link repo public theo hướng dẫn của Coach. Hạn nộp từng phase và hạn cuối theo thông báo trong buổi Lab.

---

## Đánh giá (100 điểm)

| Hạng mục | Điểm | Nội dung |
|---|---|---|
| A. Test tự động ẩn | 30 | Giảng viên chạy headless trên repo của bạn ở mỗi phase, kể cả kiểm tra lại các phase trước |
| B. Verification & bằng chứng của bạn | 20 | Ma trận truy vết đủ AC, bằng chứng khớp, test + scenario của bạn, kiểm tra tất định, CI xanh ở mỗi tag, verification skill, hook chặn khi test đỏ |
| C. Quy trình SDLC & harness AI | 15 | Spec có AC kiểm chứng được, ADR, AGENTS.md/skills/hooks được cải tiến qua các phase, lịch sử git |
| D. Evaluation & retro | 10 | Mục Evaluation mỗi phase, phân tích lỗi của AI và cách khắc phục, eval cho skill, retro cuối |
| E. Hiệu năng & ổn định | 10 | Đo trên cùng một máy chấm cho mọi bài |
| F. Chất lượng sản phẩm | 10 | Mỹ thuật đúng định hướng, cảm giác chơi, giao diện, âm thanh |
| G. Video demo | 5 | Dưới 5 phút, có phần bằng chứng như mô tả ở trên |

Sau mỗi phase, lớp có **bảng xếp hạng chung** (tỉ lệ test ẩn đạt, hiệu năng, điểm chơi thử) để các bạn so sánh sản phẩm với nhau.

---

## Quy định

- Được dùng AI tối đa. **Không** sao chép repo của bạn khác; giảng viên có thể so sánh mã giữa các bài.
- **Bằng chứng phải thật:** test giả (luôn đạt), output headless sửa tay, ảnh/clip không khớp với code ở tag tương ứng đều bị coi là vi phạm.
- Nhân vật, bối cảnh, tên gọi trong lab là bản gốc. Không dùng nhân vật, nhạc, mô hình hay thương hiệu của game/phim có sẵn. Asset bên ngoài chỉ dùng loại CC0/CC-BY/MIT hoặc tự tạo/AI tạo, và ghi nguồn trong `CREDITS.md`.
- **Không xóa** file harness AI sau khi dùng: lịch sử git phải cho thấy chúng tồn tại trong quá trình làm.
