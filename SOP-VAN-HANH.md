# SOP vận hành hằng ngày — video hình que lồng người thật

Dành cho người làm nội dung (không cần biết kỹ thuật). Cài đặt xong rồi thì mỗi video chỉ còn 5 việc.

---

## Nhịp làm việc gợi ý

| Khi nào | Việc |
|---|---|
| Cuối tuần | quay gom 5–7 clip nền, thả hết vào kho video nền |
| Mỗi sáng | chọn 1 chủ đề → viết `plan.json` → chạy 1 lệnh → soi khung → duyệt |
| Trước giờ đăng | xem lại video, đặt lịch và bật trạng thái đăng trên bảng |

---

## Việc 1 — Quay clip nền (mấu chốt của cả video)

**Dạng mạnh nhất cho nhân hiệu (chế độ giọng gốc):**
- Quay dọc bằng điện thoại, **mặt nằm ở NỬA DƯỚI khung** (nửa trên để dành cho hình que).
- Nói liền mạch 30–45 giây, một ý duy nhất.
- Tránh ngược sáng; chỗ yên tĩnh; đừng đeo tai nghe che mặt.

**Dạng b-roll (chế độ voiceover):** cảnh bạn đang làm việc, tập luyện, đi lại. Cần **chủ thể rõ ràng và
máy bám theo** — cảnh đứng yên không có người thì máy không dò được khung cắt.

Thả file vào thư mục kho video nền đã khai trong `config.env`.

## Việc 2 — Viết `plan.json`

```bash
mkdir du-an\2026-01-15-ky-luat
copy mau-plan.json du-an\2026-01-15-ky-luat\plan.json
```

Cần điền:
- **`title`** — 2 dòng, viết HOA, đây là câu người ta đọc đầu tiên. Phải "rõ chủ đề + gây tò mò".
- **`sents`** — 12 câu (chỉ chế độ voiceover), mỗi câu 9–14 từ. Cấu trúc: 2 câu hook nghịch lý →
  4 câu bóc cái giá âm thầm → 4 câu so sánh đảo nhận thức → 2 câu chiêm nghiệm. Không kêu gọi bán.
- **`img_prompts` / `motion_prompts`** — 6 ẩn dụ thị giác + 6 chuyển động nhẹ. Chép khung prompt trong
  `references/cong-thuc-video-hinh-que.md`, chỉ thay phần mô tả cảnh.
- **`caption`** — lời đăng bài.

**Luật vàng:** lời phải ăn khớp với hình nền. Đang đạp xe thì nói chuyện bền bỉ, đừng nói chuyện bàn giấy.

## Việc 3 — Chạy một lệnh

```bash
node scripts/lam-video.mjs --du-an "du-an/2026-01-15-ky-luat" --nen auto --che-do auto
```

Mất 10–15 phút. Trong lúc chờ có thể làm việc khác. Nếu đứt giữa chừng thì **chạy lại đúng lệnh đó** —
bước nào xong rồi sẽ được bỏ qua, không tốn credits lần hai.

## Việc 4 — Soi khung (5 giây, đừng bỏ)

Mở `khung-thu.jpg` trong thư mục dự án. **Vạch đỏ = vùng băng hình que.**
Người phải nằm **hẳn dưới vạch đỏ**. Nếu đầu bị đè:

1. Mở `plan.json`, tìm `bg.segments`.
2. Giảm số thứ hai của `crop` (chiều cao khung cắt) khoảng 10% → người tụt xuống thấp hơn.
3. Chạy lại: thêm `--bo-qua-media --lam-lai` (không tốn credits, chỉ ráp lại).

## Việc 5 — Duyệt và đăng

```bash
ffmpeg -v error -i "du-an/2026-01-15-ky-luat/video-final.mp4" -f null -
```
Không in gì = file sạch. Xem lại video, ưng thì đăng — hoặc đẩy vào bảng chờ duyệt:
```bash
node scripts/day-len-base.mjs --du-an "du-an/2026-01-15-ky-luat"
```
Video vào bảng ở trạng thái **chưa đặt lịch, chưa bật đăng**. Bạn mở bảng, xem lại lần cuối, rồi tự đặt
lịch và bật trạng thái đăng.

---

## Bảng chi phí

| Khoản | Con số |
|---|---|
| 6 ảnh hình que | ~3.000 credits |
| 6 clip chuyển động 8 giây | ~3.600 credits |
| Giọng đọc, ghép hình, phụ đề | miễn phí (chạy trên máy bạn) |
| **Một video** | **~6.600 credits · 10–15 phút** |

Chạy lại phần ráp (`--bo-qua-media`) **không tốn thêm credits** — cứ thoải mái chỉnh bố cục cho ưng.

## Ba lỗi khiến video mất chất (tránh được là hơn 90% người làm)

1. **Hình que đè lên mặt** — bỏ bước soi khung.
2. **Lời không ăn khớp với hình** — viết lời trước khi xem clip.
3. **Tiêu đề chung chung** ("Bài học cuộc sống") — không ai dừng lại. Tiêu đề phải nêu một nghịch lý cụ thể.
