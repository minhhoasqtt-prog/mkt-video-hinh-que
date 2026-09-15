#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""rap-video.py — RÁP VIDEO "HÌNH QUE + NGƯỜI THẬT" (bố cục 4 lớp).

Lớp 1 tiêu đề (Phudu, trên cùng) · Lớp 2 MÀN ĐEN phủ từ mép trên xuống quá đáy băng rồi TAN MỀM,
trên đó là BĂNG HÌNH QUE (nét trắng nền đen, blend SCREEN nên nền đen tan biến) · Lớp 3 video người
thật cắt dọc 9:16 · Lớp 4 phụ đề + logo.

Đọc `plan.json` ở THƯ MỤC DỰ ÁN (tham số argv[1], mặc định thư mục hiện tại) và:
  work/clips/<prefix>1..N.mp4   clip hình que (Gommo/VEO)
  work/voice.mp3 + work/words.json        (chế độ voiceover)
  work/words-goc.json                     (chế độ giọng gốc — whisper trên tiếng của video nền)
Xuất `video-final.mp4` trong thư mục dự án.

⚠ QUAN TRỌNG — VÌ SAO MỌI VIỆC NẶNG CHẠY Ở %TEMP%:
Nếu thư mục dự án nằm trên ổ ĐỒNG BỘ ĐÁM MÂY (Synology Drive, OneDrive, Google Drive, Dropbox...) thì
client đồng bộ có thể đụng vào file mp4 lớn lúc ffmpeg đang ghi → video ra hỏng dữ liệu (khung nhoè/xé,
lỗi NAL) DÙ ffmpeg báo thành công. Nên: nguồn + mọi file trung gian được sao về ổ local (%TEMP%),
ráp xong mới chép kết quả cuối về dự án VÀ KIỂM TRA LẠI.

Chế độ:
  voiceover  — nền là b-roll không lời: tắt tiếng gốc, giọng Vbee + nhạc, phụ đề chia theo số từ.
  giong-goc  — nền là người nói trước máy: GIỮ tiếng gốc, phụ đề bám timing thật, nhạc rất nhỏ.
"""
import json, subprocess, os, sys, shutil, math, re, tempfile

PROJ = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.getcwd()
WORK = os.path.join(PROJ, "work")
os.makedirs(WORK, exist_ok=True)
PLAN = json.load(open(os.path.join(PROJ, "plan.json"), encoding="utf-8"))

# thư mục làm việc THẬT trên ổ local (né ổ đồng bộ)
SLUG = re.sub(r"[^a-zA-Z0-9]+", "-", os.path.basename(PROJ))[:40] or "duan"
TMP = os.path.join(tempfile.gettempdir(), "hinhque-rap", SLUG)
os.makedirs(TMP, exist_ok=True)

TITLE = PLAN["title"].replace("\n", chr(92) + "N")
MODE = PLAN.get("mode", "voiceover")
SENTS = PLAN.get("sents", [])
PREFIX = PLAN.get("clip_prefix", "hq")
MUSIC_VOL = float(PLAN.get("music_vol", 0.28 if MODE == "voiceover" else 0.10))
BAND = PLAN.get("band", {})
BAND_Y, BAND_H = int(BAND.get("y", 260)), int(BAND.get("h", 460))
BAND_ZOOM = int(BAND.get("zoom", 1160))
# MÀN ĐEN (veil): phủ TỪ MÉP TRÊN khung (trùm cả tiêu đề) xuống quá đáy băng hình que,
# rồi TAN MỀM (smoothstep) chứ không cắt ngang — đây là thứ làm video "sang" và hook hơn.
VEIL = BAND.get("veil", {})
VEIL_TOP = float(VEIL.get("dark_top", 0.97))                      # độ đậm ở MÉP TRÊN (sau tiêu đề)
VEIL_DARK = float(VEIL.get("dark", BAND.get("dark", 0.86)))       # độ đậm ở vùng hình que
VEIL_EXTRA = int(VEIL.get("bottom_extra", 110))                   # phủ thêm bao nhiêu px dưới đáy băng
VEIL_FEATHER = int(VEIL.get("feather", 200))                      # độ dài dải tan mềm ở mép dưới
BG = PLAN.get("bg", {})
BG_SRC, BG_SEGS = BG.get("src"), BG.get("segments", [])

FF, W, H, FPS, TAIL = "ffmpeg", 1080, 1920, 30, 1.6
# Tài nguyên nhận diện — điền trong config.env. Thiếu cái nào thì bỏ qua cái đó, video vẫn ra.
FONTS = os.environ.get("VIDEO_FONTS", "").strip()
MUSIC = os.environ.get("VIDEO_MUSIC", "").strip()
LOGO = os.environ.get("VIDEO_LOGO", "").strip() or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "assets", "logo.png")
LOGO_W, LOGO_X, LOGO_Y = 300, 36, 1800
MAX_CHAR_DONG, MAX_GIAY_DONG = 44, 3.6


def run(cmd, cwd=None):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       cwd=cwd or TMP)
    if r.returncode != 0:
        print(" ".join(str(c) for c in cmd)[:400])
        print(r.stderr[-1800:])
        sys.exit(1)


def probe(p):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def sach(p):
    """True nếu file video giải mã sạch (không lỗi NAL / khung hỏng)."""
    r = subprocess.run([FF, "-v", "error", "-i", p, "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode == 0 and not (r.stderr or "").strip()


def chep_ve_local(src, ten):
    """Sao file về ổ local (bỏ qua nếu đã có, cùng kích thước). Trả đường dẫn local."""
    dich = os.path.join(TMP, ten)
    try:
        if os.path.exists(dich) and os.path.getsize(dich) == os.path.getsize(src):
            return dich
    except OSError:
        pass
    for lan in range(2):
        shutil.copyfile(src, dich)
        if os.path.getsize(dich) == os.path.getsize(src):
            return dich
    print("KHONG chep duoc ve local: " + src)
    sys.exit(1)


def ass_time(t):
    return "%d:%02d:%05.2f" % (int(t // 3600), int(t % 3600 // 60), t % 60)


# ---------------- 1) NỀN: cắt dọc 9:16 từng đoạn rồi ghép ----------------
if not BG_SEGS:
    print("plan.json thiếu bg.segments (chạy canh-khung.py trước)")
    sys.exit(1)
if not BG_SRC or not os.path.exists(BG_SRC):
    print("không thấy video nền: " + str(BG_SRC))
    sys.exit(1)

print("thu muc lam viec (local): " + TMP)
NEN = chep_ve_local(BG_SRC, "nen-goc" + os.path.splitext(BG_SRC)[1].lower())
giu_tieng = (MODE == "giong-goc")
bg_parts = []
for i, s in enumerate(BG_SEGS, 1):
    w, h, x, y = s["crop"]
    pan = s.get("pan")                      # [x_dau, x_cuoi] → trượt ngang chậm chống cắt mất người
    if pan:
        xexpr = "'%d+(%d)*t/%s'" % (pan[0], pan[1] - pan[0], s["dai"])
    else:
        xexpr = str(x)
    vf = ("crop=%d:%d:%s:%d,scale=%d:%d:flags=lanczos,fps=%d,setsar=1,format=yuv420p"
          % (w, h, xexpr, y, W, H, FPS))
    out = os.path.join(TMP, "bg%d.mp4" % i)
    cmd = [FF, "-y", "-loglevel", "error", "-ss", str(s["tu"]), "-t", str(s["dai"]), "-i", NEN,
           "-vf", vf, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]
    cmd += (["-c:a", "aac", "-b:a", "160k", "-ac", "2"] if giu_tieng else ["-an"])
    run(cmd + [out])
    if not sach(out):                        # cắt lại một lần nếu file ra bị hỏng
        print("  (nen %d hong -> cat lai)" % i)
        run(cmd + [out])
        if not sach(out):
            print("nen %d van hong sau khi cat lai: %s" % (i, out))
            sys.exit(1)
    bg_parts.append(out)
    print("  nen %d: %ss +%ss crop=%s%s" % (i, s["tu"], s["dai"], s["crop"], " (pan)" if pan else ""))


def concat(parts, out, co_tieng):
    ins = []
    for p in parts:
        ins += ["-i", p]
    n = len(parts)
    if co_tieng:
        ch = "".join("[%d:v][%d:a]" % (i, i) for i in range(n)) + "concat=n=%d:v=1:a=1[v][a]" % n
        maps = ["-map", "[v]", "-map", "[a]", "-c:a", "aac", "-b:a", "160k"]
    else:
        ch = "".join("[%d:v]" % i for i in range(n)) + "concat=n=%d:v=1:a=0[v]" % n
        maps = ["-map", "[v]", "-an"]
    cmd = [FF, "-y", "-loglevel", "error", *ins, "-filter_complex", ch, *maps,
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", out]
    run(cmd)
    if not sach(out):
        print("  (ghep hong -> lam lai)")
        run(cmd)
        if not sach(out):
            print("ghep van hong: " + out)
            sys.exit(1)


BG_ALL = os.path.join(TMP, "bg-all.mp4")
concat(bg_parts, BG_ALL, giu_tieng)
BG_DUR = probe(BG_ALL)


# ---------------- 2) THỜI LƯỢNG + PHỤ ĐỀ ----------------
def gom_dong(words):
    """Gom từ (whisper) thành dòng phụ đề: tối đa MAX_CHAR_DONG ký tự / MAX_GIAY_DONG giây."""
    dong, cur, t0, last = [], "", None, 0.0
    for w in words:
        tx = w["w"].strip()
        if not tx:
            continue
        if t0 is None:
            t0 = w["s"]
        thu = (cur + " " + tx).strip()
        if cur and (len(thu) > MAX_CHAR_DONG or (w["e"] - t0) > MAX_GIAY_DONG):
            dong.append((t0, w["s"], cur))
            cur, t0 = tx, w["s"]
        else:
            cur = thu
        last = w["e"]
    if cur:
        dong.append((t0, last, cur))
    return dong


if MODE == "voiceover":
    words = json.load(open(os.path.join(WORK, "words.json"), encoding="utf-8"))
    counts = [len(s.split()) for s in SENTS]
    tc, tw = sum(counts), len(words)
    sub, idx = [], 0.0
    for k, c in enumerate(counts):
        share = c / tc * tw
        si = min(int(round(idx)), tw - 1)
        ei = min(int(round(idx + share)) - 1, tw - 1)
        sub.append((words[si]["s"], words[max(ei, si)]["e"], SENTS[k]))
        idx += share
    for i in range(1, len(sub)):
        sub[i] = (sub[i - 1][1], max(sub[i][1], sub[i - 1][1] + 0.4), sub[i][2])
    sub[-1] = (sub[-1][0], sub[-1][1] + TAIL, sub[-1][2])
    DUR = sub[-1][1]
    N_SCENES = len(PLAN.get("img_prompts") or []) or max(1, len(SENTS) // 2)
    if len(SENTS) >= 2 * N_SCENES:
        bounds = [(sub[i * 2][0] if i else 0.0, sub[i * 2 + 1][1]) for i in range(N_SCENES)]
    else:
        bounds = [(DUR * i / N_SCENES, DUR * (i + 1) / N_SCENES) for i in range(N_SCENES)]
else:
    wp = os.path.join(WORK, "words-goc.json")
    if not os.path.exists(wp):
        print("chế độ giong-goc cần work/words-goc.json (whisper trên tiếng nền)")
        sys.exit(1)
    sub = gom_dong(json.load(open(wp, encoding="utf-8")))
    DUR = BG_DUR
    N_SCENES = len(PLAN.get("img_prompts") or []) or 6
    bounds = [(DUR * i / N_SCENES, DUR * (i + 1) / N_SCENES) for i in range(N_SCENES)]

print("che do %s · tong %.2fs · %d canh hinh que · %d dong phu de" % (MODE, DUR, N_SCENES, len(sub)))

ass = """[Script Info]
ScriptType: v4.00+
PlayResX: %d
PlayResY: %d
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,DT Phudu Black,62,&H00FFFFFF,&H000000FF,&H009E2EFF,&H96000000,-1,0,0,0,100,100,1,0,1,5,2,8,50,50,58,163
Style: Sub,DT Phudu Bold,56,&H00FFFFFF,&H000000FF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,4,2,2,70,70,250,163

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,%s,%s,Title,,0,0,0,,%s
""" % (W, H, ass_time(0), ass_time(DUR), TITLE)
for st, en, tx in sub:
    ass += "Dialogue: 0,%s,%s,Sub,,0,0,0,,%s\n" % (ass_time(st), ass_time(min(en, DUR)), tx)
open(os.path.join(TMP, "subs.ass"), "w", encoding="utf-8-sig").write(ass)
shutil.copy(os.path.join(TMP, "subs.ass"), os.path.join(WORK, "subs.ass"))   # bản lưu để soi lại

fdir = os.path.join(TMP, "fonts")
os.makedirs(fdir, exist_ok=True)
if FONTS and os.path.isdir(FONTS):
    for f in os.listdir(FONTS):
        if f.lower().endswith((".otf", ".ttf")):
            shutil.copy(os.path.join(FONTS, f), os.path.join(fdir, f))
else:
    print("CANH BAO: chua co VIDEO_FONTS -> phu de dung font he thong (khac mau)")

# nền ngắn hơn lời → lặp danh sách đoạn cho đủ
if BG_DUR + 0.05 < DUR:
    lap = int(math.ceil(DUR / max(BG_DUR, 0.1)))
    print("  nen %.1fs < loi %.1fs -> lap nen %d luot" % (BG_DUR, DUR, lap))
    concat(bg_parts * lap, BG_ALL, giu_tieng)
    BG_DUR = probe(BG_ALL)

# ---------------- 3) BĂNG HÌNH QUE ----------------
band_parts = []
for i, (st, en) in enumerate(bounds, 1):
    d = en - st
    goc = os.path.join(WORK, "clips", "%s%d.mp4" % (PREFIX, i))
    if not os.path.exists(goc):
        print("THIEU " + goc)
        sys.exit(1)
    src = chep_ve_local(goc, "clip%d.mp4" % i)
    sd = probe(src)
    pre = ("setpts=%.4f*PTS," % (d / sd)) if d > sd else ""
    out = os.path.join(TMP, "band%d.mp4" % i)
    run([FF, "-y", "-loglevel", "error", "-i", src, "-vf",
         "%sscale=%d:-2:flags=lanczos,crop=%d:%d:(iw-%d)/2:(ih-%d)/2,fps=%d,setsar=1,format=yuv420p"
         % (pre, BAND_ZOOM, W, BAND_H, W, BAND_H, FPS), "-t", "%.3f" % d, "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", out])
    band_parts.append(out)
    print("  canh %d: %.2fs (clip nguon %.1fs)" % (i, d, sd))
BAND_ALL = os.path.join(TMP, "band-all.mp4")
concat(band_parts, BAND_ALL, False)


# ---------------- 4) RÁP LỚP ----------------
def tao_man_den(path):
    """Sinh PNG màn đen 3 tầng: gần ĐEN ĐẶC sau tiêu đề → nhạt dần tới vùng hình que →
    giữ đều hết băng → TAN MỀM (smoothstep) ở mép dưới, không để lộ đường cắt ngang."""
    import numpy as np
    from PIL import Image
    y_bot = min(H, BAND_Y + BAND_H + VEIL_EXTRA)
    y0 = max(0, y_bot - VEIL_FEATHER)
    a = np.zeros(H, dtype=np.float32)
    y_band = min(BAND_Y, y0)
    if y_band > 0:
        a[:y_band] = np.linspace(VEIL_TOP, VEIL_DARK, y_band) * 255.0    # tầng tiêu đề
    a[y_band:y0] = VEIL_DARK * 255.0                                     # tầng hình que
    if y_bot > y0:
        t = (np.arange(y0, y_bot) - y0) / float(y_bot - y0)
        a[y0:y_bot] = VEIL_DARK * 255.0 * (1.0 - (3 * t ** 2 - 2 * t ** 3))   # tan mềm
    img = np.zeros((H, W, 4), dtype=np.uint8)
    img[..., 3] = np.repeat(a[:, None], W, axis=1).astype(np.uint8)
    Image.fromarray(img, "RGBA").save(path)
    print("  man den: dinh %.0f%% -> vung ve %.0f%%, tan mem %d->%d px"
          % (VEIL_TOP * 100, VEIL_DARK * 100, y0, y_bot))


MAN_DEN = os.path.join(TMP, "man-den.png")
tao_man_den(MAN_DEN)

has_logo = os.path.exists(LOGO)
# nền → phủ màn đen mềm → cộng nét hình que bằng SCREEN (nền đen của clip tự tan biến)
ch = ("[0:v]trim=0:%.3f,setpts=PTS-STARTPTS[bg];"
      "[bg][2:v]overlay=0:0:format=auto[veil];"
      "[1:v]pad=%d:%d:0:%d:black,format=gbrp[dood];"
      "[veil]format=gbrp[vg];[vg][dood]blend=all_mode=screen,format=yuv420p[v0];"
      "[v0]subtitles=subs.ass:fontsdir=fonts[v1];"
      % (DUR, W, H, BAND_Y))
ins = ["-i", BG_ALL, "-i", BAND_ALL, "-i", MAN_DEN]
co_nhac = bool(MUSIC) and os.path.exists(MUSIC)
if not co_nhac and MUSIC:
    print("CANH BAO: khong thay file nhac " + MUSIC + " -> video khong co nhac nen")
if MODE == "voiceover":
    voice = chep_ve_local(os.path.join(WORK, "voice.mp3"), "voice.mp3")
    ins += ["-i", voice]
    if co_nhac:
        ins += ["-stream_loop", "-1", "-i", MUSIC]
        achain = ("[4:a]volume=%s,afade=t=out:st=%.2f:d=2.5[m];"
                  "[3:a][m]amix=inputs=2:duration=first:dropout_transition=3,apad=pad_dur=%s[a]"
                  % (MUSIC_VOL, max(DUR - 2.5, 0), TAIL))
        i_logo = 5
    else:
        achain = "[3:a]apad=pad_dur=%s[a]" % TAIL
        i_logo = 4
else:
    if co_nhac:
        ins += ["-stream_loop", "-1", "-i", MUSIC]
        achain = ("[3:a]volume=%s,afade=t=out:st=%.2f:d=2.5[m];"
                  "[0:a]atrim=0:%.3f,asetpts=PTS-STARTPTS,dynaudnorm=g=7[voz];"
                  "[voz][m]amix=inputs=2:duration=first:dropout_transition=3[a]"
                  % (MUSIC_VOL, max(DUR - 2.5, 0), DUR))
        i_logo = 4
    else:
        achain = "[0:a]atrim=0:%.3f,asetpts=PTS-STARTPTS,dynaudnorm=g=7[a]" % DUR
        i_logo = 3
if has_logo:
    ins += ["-i", LOGO]
    ch += ("[%d:v]scale=%d:-1,format=rgba,colorchannelmixer=aa=0.85[lg];[v1][lg]overlay=%d:%d[v2];"
           % (i_logo, LOGO_W, LOGO_X, LOGO_Y))
else:
    ch += "[v1]null[v2];"
    print("CANH BAO: khong thay logo " + LOGO)
ch += "[v2]fade=t=in:st=0:d=0.5,fade=t=out:st=%.2f:d=0.8[v];" % max(DUR - 0.8, 0) + achain

TMP_OUT = os.path.join(TMP, "video-final.mp4")
run([FF, "-y", "-loglevel", "error", *ins, "-filter_complex", ch, "-map", "[v]", "-map", "[a]",
     "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
     "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", TMP_OUT])
if not sach(TMP_OUT):
    print("video ráp ra bị hỏng khung hình — chạy lại")
    sys.exit(1)

# ---------------- 5) CHÉP KẾT QUẢ VỀ DỰ ÁN + KIỂM TRA LẠI ----------------
DICH = os.path.join(PROJ, "video-final.mp4")
ok = False
for lan in range(2):
    shutil.copyfile(TMP_OUT, DICH)
    if os.path.getsize(DICH) == os.path.getsize(TMP_OUT) and sach(DICH):
        ok = True
        break
    print("  (ban chep ve du an bi hong -> chep lai)")
if not ok:
    print("KHONG chep duoc ban sach ve " + DICH + " (ban goc con o " + TMP_OUT + ")")
    sys.exit(1)

for p in bg_parts + band_parts + [BG_ALL, BAND_ALL]:
    try:
        os.remove(p)
    except OSError:
        pass
print("DONE video-final.mp4 %.1fs -> %s" % (DUR, DICH))
