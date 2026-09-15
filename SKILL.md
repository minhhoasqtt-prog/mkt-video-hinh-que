---
name: mkt-video-hinh-que
description: >
  Biên tập VIDEO NHÂN HIỆU dạng "hình que lồng người thật": băng hoạt hình hình que nét trắng nền đen
  chạy ở nửa trên khung 9:16 (blend SCREEN nên nền đen tan biến), phủ trên một MÀN ĐEN có mép dưới tan
  mềm, đè lên VIDEO NGƯỜI THẬT cắt dọc bám chủ thể; kèm tiêu đề trên cùng, phụ đề khớp giọng, logo và
  nhạc nền. Video nền lấy từ kho clip của bạn (mặc định lấy clip mới nhất).
  Hai chế độ tự dò: GIỌNG GỐC (nền là người nói trước máy → giữ tiếng thật, phụ đề bám giọng) và
  VOICEOVER (nền là b-roll không lời → viết 12 câu đạo lý, đọc bằng giọng AI). Hình que sinh bằng Gommo
  (6 ảnh 16:9 + 6 clip chuyển động), ráp bằng ffmpeg, xong có thể đẩy vào kho video Lark Base ở trạng
  thái CHỜ DUYỆT (không tự đăng).
  Dùng khi người dùng muốn: làm video đạo lý có mặt người thật, biên tập clip cá nhân thành reel nhân
  hiệu, lồng hoạt hình hình que lên video của mình, làm video xây thương hiệu cá nhân từ footage đời
  thường (tập luyện, đi lại, giảng bài, hậu trường).
  Kích hoạt khi có từ: video hình que, hình que lồng người thật, video đạo lý có mặt người, biên tập
  video nhân hiệu, video triết lý người thật, lồng hoạt hình lên video, reel nhân hiệu, doodle overlay,
  video xây thương hiệu cá nhân, biên tập clip cá nhân.
---

# Skill: Video hình que lồng người thật

Biến một clip đời thường thành reel 9:16 có **tri thức ở trên, gương mặt ở dưới**: băng hoạt hình hình
que giữ mắt người xem trong hai giây đầu, người thật gắn thông điệp vào một con người cụ thể.

> Luồng: **video nền → dò chế độ → lời + giọng → 6 ảnh + 6 clip hình que → canh khung cắt dọc →
> ráp 4 lớp → (tuỳ chọn) kho video Lark Base ở trạng thái chờ duyệt**

**Cài đặt lần đầu:** đọc [HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md) (A–Z, khoảng 30 phút).
**Vận hành hằng ngày:** đọc [SOP-VAN-HANH.md](SOP-VAN-HANH.md).
**Tri thức lõi về bố cục và công thức:** [references/cong-thuc-video-hinh-que.md](references/cong-thuc-video-hinh-que.md).

## Vì sao dạng video này hiệu quả

| Lớp | Việc nó làm cho người xem |
|---|---|
| Hình que ở băng trên | giữ mắt trong 2 giây đầu (chuyển động lạ, hiểu ngay, không cần đọc) |
| Người thật bên dưới | gắn thông điệp vào một con người có thật |
| Phụ đề | xem không tiếng vẫn hiểu |
| Tiêu đề đứng yên | người vào giữa video vẫn biết đang nói chuyện gì |

Hình que một mình = video đạo lý vô danh, ai làm cũng được. Người thật một mình = hook yếu.
Ghép lại = **tri thức có gương mặt**.

## Khi nào dùng / KHÔNG dùng

- **DÙNG:** có clip người thật (nói trước máy, tập luyện, hậu trường, giảng bài) và muốn ra reel nhân hiệu.
- **KHÔNG dùng:** video hình vẽ chiếm cả khung (không có người thật); cắt short từ video dài; chỉ cần
  đăng video có sẵn lên mạng xã hội.

## Tiền điều kiện

| Hạng mục | Ghi chú |
|---|---|
| Kho video nền | thư mục bạn thả clip vào — khai `VIDEO_NEN_DIR` trong `config.env` |
| Gommo (genful.ai) | sinh ảnh + chuyển động hình que — ~6.600 credits/video |
| Vbee TTS (vbee.vn) | chỉ cần cho chế độ voiceover |
| ffmpeg + ffprobe | có trong PATH |
| Python | `faster-whisper`, `numpy`, `pillow`, `requests` |
| Node.js 18+ | chạy các script `.mjs` |
| Font, nhạc nền, logo | tuỳ chọn — thiếu thì video vẫn ra, chỉ khác nhận diện |
| Lark Base + lark-cli | tuỳ chọn — chỉ cần nếu muốn đẩy video vào kho chờ duyệt |

Kiểm tra một phát cho chắc: `node scripts/kiem-tra-he-thong.mjs` (không tốn credits).

## Quy trình thực thi

### Bước 0 — Tạo thư mục dự án
```bash
mkdir -p "du-an/2026-01-01-video-abc"
```

### Bước 1 — Chọn clip nền
Mặc định skill lấy **clip mới nhất** trong `VIDEO_NEN_DIR`. Muốn chỉ định: `--nen "<đường dẫn>"`.

### Bước 2 — Xem clip rồi VIẾT `plan.json` (phần sáng tạo)
Xem vài khung hình để biết bối cảnh — **lời phải ăn khớp với hình**:
```bash
ffmpeg -v error -ss 5 -i "<clip>" -frames:v 1 -vf scale=560:-1 -y xem.jpg
```
Chép [mau-plan.json](mau-plan.json) vào thư mục dự án rồi sửa. Cấu trúc:
```json
{
  "title": "DÒNG TIÊU ĐỀ 1\nDÒNG TIÊU ĐỀ 2",
  "mode": "auto",
  "sents": ["12 câu, mỗi câu 9-14 từ (chỉ cần cho chế độ voiceover)"],
  "img_prompts": ["6 prompt ảnh hình que 16:9 — theo khung trong references/"],
  "motion_prompts": ["6 prompt chuyển động nhẹ"],
  "band": { "y": 260, "h": 460, "zoom": 1160,
            "veil": { "dark_top": 0.97, "dark": 0.86, "bottom_extra": 110, "feather": 200 } },
  "music_vol": 0.28,
  "clip_prefix": "hq",
  "caption": "caption đăng bài",
  "note": "nguồn footage + ngày quay"
}
```
**Chế độ `giong-goc`:** bỏ `sents` (lời lấy từ chính giọng nói trong clip), nhưng `img_prompts` /
`motion_prompts` vẫn phải minh hoạ đúng nội dung nói → nghe trước bằng:
```bash
python -c "from faster_whisper import WhisperModel as M; m=M('small',device='cpu',compute_type='int8');
print(' '.join(s.text for s in m.transcribe('<clip>',language='vi',vad_filter=True)[0]))"
```

### Bước 3 — Chạy dây chuyền
```bash
node scripts/lam-video.mjs --du-an "du-an/2026-01-01-video-abc" --nen auto --che-do auto
```
Script tự làm: dò chế độ → canh khung cắt dọc (xuất `khung-thu.jpg`) → giọng + timing →
6 ảnh + 6 clip hình que (song song, có retry) → ráp 4 lớp → `video-final.mp4`.

Cờ hữu ích: `--doan "4:10.2,18:10.2"` tự chọn đoạn nền · `--bo-qua-media` đã có sẵn media, chỉ ráp lại ·
`--lam-lai` dựng lại từ đầu · `--day-base` đẩy luôn vào kho video Lark.

### Bước 4 — Soi khung trước khi tin (5 giây)
Mở `khung-thu.jpg` trong thư mục dự án: **vạch đỏ = vùng băng hình que**. Người phải nằm HẲN dưới vạch đỏ.
Nếu bị đè hoặc bị cắt mép → sửa `bg.segments[].crop` (hoặc thêm `"pan": [x_đầu, x_cuối]`) trong
`plan.json` rồi chạy lại với `--bo-qua-media --lam-lai`.

### Bước 5 — Kiểm video ra
```bash
ffmpeg -v error -i "<dự án>/video-final.mp4" -f null -      # không in gì = file sạch
```

### Bước 6 — (Tuỳ chọn) Đẩy kho video Lark Base
```bash
node scripts/day-len-base.mjs --du-an "<dự án>"
```
Tạo record với caption + đính video, **không đặt lịch, không bật trạng thái đăng** → máy đăng tự động
(nếu có) sẽ bỏ qua, video nằm chờ bạn duyệt. Chạy lại không tạo record trùng (ledger `.da-day-base.json`).

## Tham chiếu

| Tệp | Việc |
|---|---|
| `scripts/lam-video.mjs` | orchestrator toàn dây chuyền |
| `scripts/canh-khung.py` | dò chủ thể, tính khung cắt dọc 9:16, xuất ảnh soi có vạch băng |
| `scripts/rap-video.py` | ráp 4 lớp (nền + màn đen mềm + băng hình que + tiêu đề/phụ đề/logo/nhạc) |
| `scripts/gommo-client.mjs` | gọi Gommo tạo ảnh / clip |
| `scripts/vbee-tts.py` | giọng đọc (bản độc lập, chỉ cần `requests`) |
| `scripts/day-len-base.mjs` | đẩy kho video Lark Base, idempotent |
| `scripts/kiem-tra-he-thong.mjs` | tự kiểm công cụ + config + khoá còn sống (không tốn credits) |
| `references/cong-thuc-video-hinh-que.md` | **tri thức lõi**: số đo bố cục, 3 chìa khoá kỹ thuật, 2 chế độ, khung prompt, bảng gotcha |

## Lưu ý / gotcha

- **Không bỏ bước canh khung.** Cắt dọc giữa khung là hình que đè lên mặt — lỗi chí mạng của dạng này.
- **Nếu thư mục dự án nằm trên ổ đồng bộ đám mây** (Synology Drive / OneDrive / Google Drive), mp4 lớn
  ghi thẳng vào đó có thể hỏng dữ liệu. `rap-video.py` vì thế làm việc trong `%TEMP%\hinhque-rap\<dự án>`
  rồi mới chép kết quả về và kiểm tra lại. Viết thêm bước ffmpeg nào cũng phải theo lệ này.
- **Màn đen phải có mép dưới tan mềm** (`veil.feather`): hộp đen cắt ngang cứng là mất sang.
- **Ảnh hình que phải ratio 16:9** và prompt phải có "small and centered + generous black space".
- Gommo hay tắt model theo thời gian: `node scripts/gommo-client.mjs models --type image|video` xem model nào ON.
- Mọi chữ đi qua file `.ass` + `fontsdir`, KHÔNG dùng `drawtext` (Windows thiếu font mặc định là lỗi ngay).

## Output

Mỗi video = **một thư mục** chứa: `plan.json`, `video-final.mp4`, `khung-thu.jpg`, và `work/`
(clip hình que, ảnh, prompt, giọng, phụ đề). Xoá `work/` sau khi hài lòng để tiết kiệm ổ đĩa.
