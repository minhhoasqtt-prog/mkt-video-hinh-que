# Hướng dẫn cài đặt A–Z (khoảng 30 phút)

Làm lần lượt 6 phần. Sau mỗi phần có một lệnh kiểm tra — chạy đúng rồi hãy đi tiếp.
Không cần biết lập trình, chỉ cần copy lệnh và dán vào cửa sổ dòng lệnh.

---

## Phần 1 — Cài công cụ trên máy (một lần duy nhất)

| Công cụ | Tải ở đâu | Lưu ý khi cài |
|---|---|---|
| **Node.js** (bản LTS) | nodejs.org | cài mặc định là được |
| **Python 3.10+** | python.org | **nhớ tích "Add Python to PATH"** ở màn hình đầu |
| **ffmpeg** | ffmpeg.org (bản full) | giải nén rồi thêm thư mục `bin` vào PATH của Windows |

Rồi cài 4 thư viện Python (mở cửa sổ dòng lệnh, dán vào):
```bash
pip install faster-whisper numpy pillow requests
```

Kiểm tra:
```bash
node -v && python --version && ffmpeg -version
```
Ba dòng đều ra số phiên bản là đạt.

---

## Phần 2 — Lấy khoá AI tạo hình que (Gommo / genful.ai)

Đây là nơi tốn "credits" — mỗi video khoảng **6.600 credits** (6 ảnh + 6 clip chuyển động).

1. Đăng ký tài khoản tại **genful.ai**, nạp gói có credits.
2. Vào phần **Cấu hình / API** → copy **MCP key**.
3. Mở file `config.env` (xem Phần 4) và dán vào dòng `GOMMO_MCP_KEY=`.

Kiểm tra (không tốn credits):
```bash
node scripts/gommo-client.mjs balance
```
Ra dòng `credits_ai = <số>` là khoá sống.

Xem model nào đang bật (Gommo hay tắt model cũ, model tắt sẽ treo rồi lỗi):
```bash
node scripts/gommo-client.mjs models --type image
node scripts/gommo-client.mjs models --type video
```
Nếu model trong `config.env` không có chữ `ON`, đổi sang model đang ON.

---

## Phần 3 — Lấy khoá giọng đọc (Vbee) — chỉ cần cho chế độ voiceover

Nếu clip của bạn **có tiếng người nói**, bỏ qua phần này (skill dùng chính giọng thật).
Nếu clip là cảnh quay không lời (b-roll), bạn cần giọng đọc:

1. Đăng ký **vbee.vn** → mục **API** → lấy **Bearer JWT** (`VBEE_API`) và **App ID** (`VBEE_APP_ID`).
2. Điền vào `config.env`.
3. Chọn mã giọng — xem danh sách:
```bash
curl -H "Authorization: Bearer <VBEE_API của bạn>" "https://vbee.vn/api/v1/voices?limit=300"
```
Giọng nam trầm kể chuyện hợp video đạo lý nhất. Điền vào `VBEE_VOICE`.

---

## Phần 4 — Điền `config.env`

```bash
copy config.env.example config.env      # Windows
# cp config.env.example config.env      # Mac/Linux
```
Mở `config.env` bằng Notepad và điền. **Bắt buộc:**

| Khoá | Ý nghĩa |
|---|---|
| `GOMMO_MCP_KEY` | khoá AI tạo hình que |
| `VIDEO_NEN_DIR` | thư mục bạn thả clip quay sẵn vào (kho video nền) |
| `VBEE_API`, `VBEE_APP_ID` | chỉ cần nếu dùng chế độ voiceover |

**Tuỳ chọn (thiếu thì video vẫn ra, chỉ khác nhận diện):** `VIDEO_FONTS` (thư mục font phụ đề),
`VIDEO_MUSIC` (file mp3 nhạc nền), `VIDEO_LOGO` (file PNG logo nền trong suốt).

Kiểm tra toàn bộ:
```bash
node scripts/kiem-tra-he-thong.mjs
```
Không còn dòng `[THIEU]` là xong phần cấu hình.

---

## Phần 5 — (Tuỳ chọn) Nối kho video Lark Base

Bỏ qua nếu bạn chỉ cần file mp4 trên máy.

Nếu muốn video xong tự vào một bảng Lark Base để duyệt rồi đăng:

1. Cài `lark-cli` và đăng nhập (theo hướng dẫn của công cụ đó).
2. Tạo một bảng có tối thiểu 2 cột: **một cột chữ** (đựng caption) và **một cột đính kèm** (đựng video).
3. Lấy `base_token` (đoạn sau `/base/` trên URL) và `table_id` (đoạn `tbl…` trên URL).
4. Lấy **ID của cột đính kèm** (`fld…`):
```bash
lark-cli base +field-list --base-token <base_token> --table-id <table_id> --as user
```
5. Điền `LARK_POST_BASE`, `LARK_POST_TABLE`, `LARK_POST_VIDEO_FIELD_ID`, `LARK_POST_VIDEO_FIELD_NAME`,
   `LARK_POST_CAPTION_FIELD` vào `config.env`.

> Script **cố ý không** đặt lịch đăng và không bật cột trạng thái đăng — video nằm chờ bạn duyệt.

---

## Phần 6 — Làm thử một video

1. Thả 1 clip vào thư mục `VIDEO_NEN_DIR` (quay dọc bằng điện thoại là tốt nhất; nếu quay ngang thì
   skill tự cắt dọc bám người).
2. Tạo thư mục dự án và chép file mẫu:
```bash
mkdir du-an\video-dau-tien
copy mau-plan.json du-an\video-dau-tien\plan.json
```
3. Sửa `plan.json`: đổi `title`, 12 câu `sents`, 6 `img_prompts` + 6 `motion_prompts`, `caption`.
   Đọc `references/cong-thuc-video-hinh-que.md` để viết cho đúng công thức.
4. Chạy:
```bash
node scripts/lam-video.mjs --du-an "du-an/video-dau-tien" --nen auto --che-do auto
```
5. Mở `du-an/video-dau-tien/khung-thu.jpg` — người phải nằm **hẳn dưới vạch đỏ**.
6. Xem `du-an/video-dau-tien/video-final.mp4`.

Lần chạy đầu mất khoảng **10–15 phút** (chờ AI dựng 6 ảnh + 6 clip chuyển động).

---

## Hỏng thì tra ở đây

| Hiện tượng | Nguyên nhân & cách xử |
|---|---|
| `LAM_FAIL chưa khai VIDEO_NEN_DIR` | chưa điền `config.env`, hoặc truyền thẳng `--nen "<đường dẫn clip>"` |
| `GOMMO_FAIL thiếu GOMMO_MCP_KEY` | chưa dán khoá vào `config.env` |
| Job Gommo treo rồi báo lỗi | model bị Gommo tắt → chạy `models --type image` rồi đổi model trong `config.env` |
| Hình que đè lên mặt người | mở `khung-thu.jpg`, sửa `bg.segments[].crop` trong `plan.json`, chạy lại `--bo-qua-media --lam-lai` |
| Người bị cắt mất khi tiến lại gần máy | thêm `"pan": [x_đầu, x_cuối]` cho đoạn đó |
| Video ra nhoè / xé khung | thư mục dự án nằm trên ổ đồng bộ đám mây — script đã tự né, nếu vẫn dính thì chuyển dự án sang ổ local |
| Phụ đề sai font | chưa điền `VIDEO_FONTS`, hoặc thư mục font không có file `.otf/.ttf` |
| Phụ đề lệch giọng (chế độ giọng gốc) | chỉ được dùng MỘT đoạn nền liên tục — sửa `bg.segments` còn 1 đoạn |
| Video không có nhạc | chưa điền `VIDEO_MUSIC` hoặc sai đường dẫn file mp3 |

Còn vướng chỗ nào, chạy `node scripts/kiem-tra-he-thong.mjs` rồi gửi nguyên đoạn kết quả cho người
hướng dẫn — nó nói rõ thiếu gì.
