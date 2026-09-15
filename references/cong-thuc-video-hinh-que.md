# Công thức video HÌNH QUE + NGƯỜI THẬT (tri thức lõi)

> Đọc TRƯỚC khi viết `plan.json`. Số đo bóc trực tiếp từ một reel mẫu đang viral theo bố cục này,
> rồi đo đạc lại trên bản dựng thật cho tới khi khớp.

## 1. Vì sao dạng này hiệu quả cho nhân hiệu

| Lớp | Việc nó làm cho người xem |
|---|---|
| Hình que ở băng trên | **giữ mắt** trong 2 giây đầu (chuyển động lạ, dễ hiểu, không cần đọc) |
| Người thật bên dưới | **gắn thông điệp vào một con người** — cái mà hình vẽ không làm được |
| Phụ đề | xem không tiếng vẫn hiểu (80% lướt Reel để chế độ im lặng) |
| Tiêu đề đứng yên | người vào giữa video vẫn biết đang nói chuyện gì |

Hình que một mình = video đạo lý vô danh (ai làm cũng được).
Người thật một mình = video nói chuyện thường, hook yếu.
**Ghép hai cái = tri thức có gương mặt** — đó là toàn bộ ý đồ của dạng này.

## 2. THÔNG SỐ CHUẨN (chốt 19/08/2026)

| Hạng mục | Giá trị |
|---|---|
| Khổ | 9:16 — 1080×1920, 30 fps |
| Độ dài | 35–60 giây (giọng gốc thì theo clip; voiceover thì 12 câu ≈ 40s) |
| Tiêu đề | y 58–215 · DT Phudu Black 62 · trắng viền hồng `&H009E2EFF` · đứng nguyên cả video |
| **Màn đen (veil)** | phủ **từ y 0** (trùm cả tiêu đề) → **đậm 97% ở đỉnh, 86% ở vùng vẽ** → **tan mềm smoothstep 630→830** |
| **Băng hình que** | **y 260, cao 460** · nét trắng nền đen · **blend SCREEN** trên nền màn đen |
| Phóng nét vẽ | scale clip lên 1160px bề ngang rồi cắt băng 1080×460 (nét to hơn ~7%) |
| Người thật | cắt dọc 9:16, **tâm chủ thể ở ~72% chiều cao khung** (đầu nằm dưới y≈760) |
| Phụ đề | DT Phudu Bold 56 · trắng viền đen 4 · MarginV 250 |
| Logo | 300px, góc dưới trái (36, 1800), độ mờ 0.85 |
| Nhạc nền | voiceover 28% · giọng gốc 10% (đừng át lời) · loop + fade 2,5s cuối |
| Vào/ra | fade in 0,5s · fade out 0,8s |

## 3. BA CHÌA KHOÁ KỸ THUẬT (sai là hỏng cả video)

### 3a. Blend SCREEN + MÀN ĐEN 3 tầng mép dưới TAN MỀM
Clip hình que là **nét trắng trên nền đen**. `blend=all_mode=screen` làm nền đen tan biến (đen = 0 = trong suốt),
chỉ còn nét trắng nổi lên footage. NHƯNG nếu phía sau là trời sáng thì nét trắng chìm → phải phủ **màn đen**
xuống trước khi trộn.

**Cách làm sai thường gặp — hộp đen `drawbox`:** để lộ **đường cắt ngang cứng** giữa khung, nhìn là biết
ghép, mất sang; tiêu đề lại nằm trên vùng trời sáng nên chữ không nổi.

**Cách đúng — sinh PNG 1080×1920 đen có kênh alpha biến thiên dọc**, overlay lên nền rồi mới trộn:
```
y 0 … 260   : alpha 97% → 86%   tầng tiêu đề — gần đen đặc, chữ hồng bật hẳn lên
y 260 … 630 : alpha 86%          tầng hình que — còn thấy thấp thoáng cảnh thật
y 630 … 830 : 86% → 0%           TAN MỀM theo smoothstep 3t²−2t³
y 830 …     : trong suốt         người thật hiện nguyên bản
```
Dùng **smoothstep** chứ không tuyến tính: đạo hàm bằng 0 ở hai đầu nên mắt không bắt được chỗ bắt đầu và
kết thúc của dải chuyển — đó chính là cảm giác "mềm mại" của video mẫu.

Chỉnh trong `plan.json`:
```json
"band": { "y": 260, "h": 460, "zoom": 1160,
          "veil": { "dark_top": 0.97, "dark": 0.86, "bottom_extra": 110, "feather": 200 } }
```
`bottom_extra` = phủ thêm bao nhiêu px dưới đáy băng trước khi tan · `feather` = dải tan dài bao nhiêu px
(200 mềm vừa; 260–300 mềm hơn nhưng ăn vào mặt người).

### 3b. Khung cắt dọc phải ĐẨY NGƯỜI XUỐNG
Cắt dọc kiểu "giữa khung" → đầu người rơi đúng vào băng → hình que đè lên mặt.
Quy tắc: đặt **tâm chủ thể ở 72% chiều cao khung ra**, tức
```
h_cắt = y_tâm_chủ_thể / 0.72        (chặn trên bởi chiều cao nguồn)
w_cắt = h_cắt * 9/16
y_cắt = max(0, y_tâm - 0.72*h_cắt)  → thường = 0 (lấy từ mép TRÊN, bỏ bớt mép dưới)
x_cắt = tâm_ngang - w_cắt/2
```
`scripts/canh-khung.py` tự dò chủ thể rồi tính khung này, kèm ảnh soi có vạch đỏ đúng vùng băng.
Chủ thể tiến lại gần / trôi ngang → thêm `"pan": [x_đầu, x_cuối]` cho đoạn đó.

Cách dò chủ thể (không cần OpenCV): `điểm = biên_không_gian / (độ_lệch_chuẩn_thời_gian + k)`.
Chủ thể được máy bám → nhiều biên, ít rung → điểm cao. Nền chạy vụt qua → rung mạnh → điểm thấp.

## 4. HAI CHẾ ĐỘ

| | **giong-goc** (giống mẫu nhất) | **voiceover** |
|---|---|---|
| Nền | người nói trước máy | b-roll (đạp xe, đi lại, làm việc) |
| Tiếng | GIỮ tiếng gốc + nhạc 10% | tắt tiếng gốc, giọng Vbee + nhạc 28% |
| Lời | bóc từ chính giọng nói (whisper word-timestamps) | LLM viết 12 câu theo công thức đạo lý |
| Đoạn nền | **một mạch liên tục** (cắt nhiều đoạn là lệch tiếng) | 2–4 đoạn ~10s, mỗi đoạn một khung cắt |
| Sức nặng nhân hiệu | **mạnh nhất** | vừa, làm được hàng loạt |
| Chi phí | ~6.600 credits (chỉ phần hình que) | ~6.600 credits + TTS |

`lam-video.mjs --che-do auto` tự nghe tiếng nền: ≥25 từ → `giong-goc`, ít hơn → `voiceover`.

## 5. LUẬT VIẾT LỜI (chế độ voiceover)

Theo công thức reel đạo lý kinh điển, rút gọn còn **12 câu / 6 cảnh**:

- **Cảnh 1 (câu 1-2):** HOOK nghịch lý — hai giây đầu phải cho người xem "rõ chủ đề + tò mò".
- **Cảnh 2-3 (câu 3-6):** THÂN — bóc cái giá âm thầm, mỗi cảnh một ý.
- **Cảnh 4-5 (câu 7-10):** CAO TRÀO — phép so sánh đảo nhận thức.
- **Cảnh 6 (câu 11-12):** KẾT — câu chiêm nghiệm đọng lại. KHÔNG kêu gọi bán.

Luật: xưng "bạn" · mỗi câu 9–14 từ (một dòng phụ đề gọn) · tổng ~130–150 từ ≈ 40–45 giây ·
KHÔNG emoji, KHÔNG em-dash · **lời phải ăn khớp với hình nền** (đang đạp xe thì nói chuyện bền bỉ,
đừng nói chuyện bàn giấy).

## 6. KHUNG PROMPT HÌNH QUE (ratio 16:9 — khác skill gốc dùng 9:16)

Ảnh (Gommo `google_image_gen_banana_2`, `--ratio 16:9 --resolution 1k --mode vip`):
```
Monochrome BLACK AND WHITE cartoon line illustration, ONLY clean thin white ink outlines with soft
light-grey shading on a pure solid black background, absolutely NO color, minimalist hand-drawn doodle
sketch style, simple round-headed stick-figure characters with soft expressive faces, <ẨN DỤ CỦA CẢNH>.
wide horizontal 16:9 composition, drawing kept small and centered with generous empty black space
around it. No text, no letters, no words, no numbers anywhere.
```
Chuyển động (Gommo `veo_3_1 --mode lite --resolution 720p --duration 8 --ratio 16:9`):
```
Animate this cartoon: <CHUYỂN ĐỘNG NHẸ CỤ THỂ>. Keep the black and white cartoon line drawing style on
solid black background exactly, subtle smooth gentle motion, no style change, no color added,
no camera shake, static camera.
```

> **Vì sao 16:9:** băng ngang 1080×460. Ảnh 9:16 cắt thành băng sẽ mất gần hết bố cục.
> **Vì sao "small and centered":** băng chỉ lấy dải giữa của khung 16:9 — vẽ tràn viền sẽ bị cắt cụt.
> Nhấn "MONOCHROME / BLACK AND WHITE / NO color" — bỏ là Gommo hay trả ảnh CÓ màu, lệch phong cách.

Sáu ẩn dụ đã chạy tốt (dùng lại làm mẫu): về đích giữa đám đông ↔ một mình lúc 5 giờ sáng ·
biểu đồ + tiếng vỗ tay ↔ ngồi một mình trước bình minh · bắt tay với chính mình trong gương ·
bánh xe mọc rễ thành cây · dốc ngược gió ↔ người ngồi xuống bên lều · đường dài về phía mặt trời mọc.
Cảnh cuối luôn ánh sáng ấm / hy vọng.

## 7. Gotcha đã dính

| Lỗi | Cách tránh |
|---|---|
| Hình que đè lên mặt/đầu người | luôn chạy `canh-khung.py`, soi `khung-thu.jpg` trước khi ráp |
| Nét trắng chìm vào trời sáng | không bỏ màn đen; muốn đậm hơn thì nâng `veil.dark` |
| **Video ra bị NHOÈ / XÉ khung dù ffmpeg báo OK** | thư mục dự án nằm trên **ổ đồng bộ đám mây** (Synology Drive / OneDrive / Google Drive) → client sync đụng vào mp4 lớn lúc ffmpeg đang ghi. `rap-video.py` vì thế bắt buộc: sao nguồn + mọi file trung gian về `%TEMP%\hinhque-rap\<dự án>`, ráp xong mới chép kết quả về **và kiểm tra lại** (`ffmpeg -v error -i x -f null -`). ĐỪNG bỏ bước này |
| Thấy mép cắt ngang cứng dưới băng | `veil.feather` quá nhỏ hoặc còn dùng `drawbox` bản cũ |
| Người bị cắt mất khi tiến lại gần | thêm `"pan": [x_đầu, x_cuối]` cho đoạn đó |
| Phụ đề lệch giọng ở chế độ giọng gốc | chỉ dùng MỘT đoạn nền liên tục; whisper chạy trên đúng đoạn đã cắt |
| File mp4 nền hỏng ngẫu nhiên khi cắt | kiểm `ffmpeg -v error -i bg.mp4 -f null -` (đã dính 1 lần, cắt lại là hết) |
| `drawtext` lỗi thiếu font trên Windows | không dùng `drawtext`, mọi chữ đi qua file `.ass` + `fontsdir` |
| Video nền ngắn hơn lời | `rap-video.py` tự lặp danh sách đoạn cho đủ |
