# mkt-video-hinh-que — Video "hình que lồng người thật"

Biến một clip đời thường của bạn thành reel dọc 9:16 có **tri thức ở trên, gương mặt ở dưới**:
băng hoạt hình hình que chạy ở nửa trên khung giữ mắt người xem trong hai giây đầu, video người thật
bên dưới gắn thông điệp vào một con người cụ thể.

```
┌───────────────────────────┐
│      TIÊU ĐỀ (đứng yên)   │  ai vào giữa video cũng biết đang nói gì
├───────────────────────────┤
│    BĂNG HÌNH QUE (động)   │  GIỮ MẮT: chuyển động lạ, hiểu ngay, không phải đọc
├───────────────────────────┤
│                           │
│     NGƯỜI THẬT (nền)      │  GẮN NIỀM TIN: thông điệp có một gương mặt
│       phụ đề  ·  logo     │  xem không tiếng vẫn hiểu
└───────────────────────────┘
```

Hình que một mình = video đạo lý vô danh, ai làm cũng được.
Người thật một mình = hook yếu, hai giây đầu không giữ được ai.
**Ghép lại = tri thức có gương mặt.**

## Làm được gì

- Nhận **video nền** từ thư mục clip của bạn (mặc định lấy clip mới nhất).
- **Tự dò chế độ:** clip có người nói → giữ nguyên giọng thật, phụ đề bám timing thật.
  Clip không lời → tự viết lời, đọc bằng giọng AI.
- **Tự canh khung cắt dọc 9:16 bám chủ thể** để hình que không đè lên mặt, kèm ảnh soi khung để bạn kiểm.
- Sinh **6 ảnh + 6 clip hoạt hình hình que** bằng AI, ghép 4 lớp bằng ffmpeg, xuất mp4 1080×1920.
- Tuỳ chọn: đẩy video vào một bảng Lark Base ở trạng thái **chờ duyệt** (không tự đăng).

## Bắt đầu

1. Tải về: `Code` → `Download ZIP`, hoặc `git clone`.
2. Đọc **[HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md)** — 6 phần, khoảng 30 phút, mỗi phần có lệnh kiểm tra.
3. Chạy `node scripts/kiem-tra-he-thong.mjs` — nó nói rõ còn thiếu gì (không tốn credits).
4. Làm video đầu tiên:
   ```bash
   node scripts/lam-video.mjs --du-an "du-an/video-dau-tien" --nen auto --che-do auto
   ```

Vận hành hằng ngày: **[SOP-VAN-HANH.md](SOP-VAN-HANH.md)** (5 việc).
Muốn hiểu sâu bố cục và công thức viết lời: **[references/cong-thuc-video-hinh-que.md](references/cong-thuc-video-hinh-que.md)**.

## Cần chuẩn bị

| Thứ | Ghi chú |
|---|---|
| Node.js 18+, Python 3.10+, ffmpeg | cài một lần |
| `pip install faster-whisper numpy pillow requests` | thư viện Python |
| Tài khoản **genful.ai** (Gommo) | sinh hình que — khoảng **6.600 credits mỗi video** |
| Tài khoản **vbee.vn** | giọng đọc, chỉ cần nếu clip không có tiếng người nói |
| Font, nhạc nền, logo | tuỳ chọn — thiếu thì video vẫn ra, chỉ khác nhận diện |

Khoá của bạn nằm trong `config.env` (đã được `.gitignore` chặn, không bao giờ lên git).

## Một video tốn bao nhiêu

| Khoản | Con số |
|---|---|
| 6 ảnh hình que | ~3.000 credits |
| 6 clip chuyển động 8 giây | ~3.600 credits |
| Giọng đọc, ghép hình, phụ đề | miễn phí, chạy trên máy bạn |
| **Tổng** | **~6.600 credits · 10–15 phút** |

Chạy lại phần ghép (`--bo-qua-media`) **không tốn thêm credits** — chỉnh bố cục thoải mái cho tới khi ưng.

## Ba lỗi khiến video mất chất

1. **Hình que đè lên mặt** — đừng bỏ bước soi `khung-thu.jpg` (vạch đỏ là vùng băng, người phải nằm hẳn dưới).
2. **Lời không ăn khớp với hình** — xem clip trước rồi mới viết lời.
3. **Tiêu đề chung chung** — "Bài học cuộc sống" thì không ai dừng lại; tiêu đề phải nêu một nghịch lý cụ thể.

## Cấu trúc

```
SKILL.md                     hướng dẫn cho trợ lý AI của bạn đọc
HUONG-DAN-CAI-DAT.md         cài đặt A-Z
SOP-VAN-HANH.md              vận hành hằng ngày
config.env.example           mẫu cấu hình (copy thành config.env rồi điền)
mau-plan.json                kịch bản mẫu đầy đủ 12 câu + 6 prompt ảnh + 6 prompt chuyển động
references/                  tri thức lõi về bố cục và công thức
scripts/                     toàn bộ mã chạy
```

## Giấy phép & lưu ý

Dùng cho mục đích học tập và sản xuất nội dung của chính bạn. Nhạc nền, font chữ và logo **không** đi kèm
repo — hãy dùng tài nguyên bạn có quyền sử dụng. Nội dung do AI sinh ra: luôn xem lại trước khi đăng.
