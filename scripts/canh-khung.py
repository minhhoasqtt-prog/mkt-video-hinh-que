#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""canh-khung.py — CANH KHUNG CẮT DỌC 9:16 bám chủ thể + xuất ảnh soi khung.

Vì sao cần: băng hình que nằm ở nửa trên khung. Nếu cắt dọc kiểu "giữa khung" thì đầu người
thường rơi vào đúng vùng băng → hình que đè lên mặt. Script này dò chủ thể rồi tính khung cắt
sao cho chủ thể TỤT XUỐNG dưới mép băng.

Cách dò (không cần OpenCV): lấy ~2 khung/giây ở độ phân giải thấp, tính
    điểm = biên_không_gian / (độ_lệch_chuẩn_theo_thời_gian + k)
Chủ thể được máy bám → nhiều biên nhưng ÍT rung giữa các khung → điểm cao;
nền chạy vụt qua → rung mạnh → điểm thấp.

Dùng:
  python canh-khung.py --nen <video> --tu 4 --dai 10.2 [--ty-le-cao 0.72] [--json]
  python canh-khung.py --nen <video> --doan "4:10.2,18:10.2,30:10.2" --soi khung-thu.jpg
Trả JSON: {"crop":[w,h,x,y], "chu_the":[x,y], "ghi_chu":"..."} cho từng đoạn.
"""
import argparse, json, os, subprocess, sys, tempfile, glob, shutil
import numpy as np
from PIL import Image

W_OUT, H_OUT = 1080, 1920
BAND_Y_MAC_DINH, BAND_H_MAC_DINH = 260, 460

def probe(src):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0",
                        "-show_entries", "stream=width,height", "-show_entries", "format=duration",
                        "-of", "json", src], capture_output=True, text=True)
    j = json.loads(r.stdout)
    st = j["streams"][0]
    return int(st["width"]), int(st["height"]), float(j["format"]["duration"])

def do_chu_the(src, tu, dai, mau_w=192):
    """Trả (x, y) tâm chủ thể theo toạ độ NGUỒN."""
    tmp = tempfile.mkdtemp(prefix="canhkhung-")
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(tu), "-t", str(dai), "-i", src,
                        "-vf", f"fps=2,scale={mau_w}:-2", "-y", os.path.join(tmp, "f_%03d.png")],
                       capture_output=True)
        fs = sorted(glob.glob(os.path.join(tmp, "f_*.png")))
        if len(fs) < 3: return None
        a = np.stack([np.asarray(Image.open(f).convert("L"), dtype=np.float32) for f in fs])
        T, h, w = a.shape
        std = a.std(axis=0)
        mean = a.mean(axis=0)
        edge = np.pad(np.abs(np.diff(mean, axis=1)), ((0, 0), (0, 1)))
        score = edge / (std + 8.0)
        col = np.convolve(score[int(h * 0.33):, :].sum(axis=0), np.ones(9) / 9, mode="same")
        x = int(col.argmax())
        row = np.convolve(score[:, max(0, x - 15):x + 16].sum(axis=1), np.ones(7) / 7, mode="same")
        y = int(row.argmax())
        return x / w, y / h          # tỉ lệ 0..1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def tinh_crop(SW, SH, tx, ty, ty_le_cao=0.72, cao_toi_thieu=0.62):
    """Khung cắt 9:16 sao cho tâm chủ thể nằm ở ty_le_cao (vd 0.72 = 72% chiều cao khung ra)."""
    yc = ty * SH
    h = min(SH, max(SH * cao_toi_thieu, yc / max(ty_le_cao, 0.35)))
    h = int(round(min(h, SH)))
    w = int(round(h * 9 / 16))
    if w > SW:                                   # nguồn đã dọc hơn 9:16 → lấy hết bề ngang
        w = SW; h = min(SH, int(round(w * 16 / 9)))
    y = int(round(min(max(0, yc - ty_le_cao * h), SH - h)))
    x = int(round(min(max(0, tx * SW - w / 2), SW - w)))
    return [w - w % 2, h - h % 2, x - x % 2, y - y % 2]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nen", required=True)
    ap.add_argument("--tu", type=float, default=0.0)
    ap.add_argument("--dai", type=float, default=10.0)
    ap.add_argument("--doan", default=None, help='nhiều đoạn "tu:dai,tu:dai,..."')
    ap.add_argument("--ty-le-cao", type=float, default=0.72)
    ap.add_argument("--soi", default=None, help="xuất ảnh soi khung (kèm vạch băng hình que)")
    ap.add_argument("--band-y", type=int, default=BAND_Y_MAC_DINH)
    ap.add_argument("--band-h", type=int, default=BAND_H_MAC_DINH)
    a = ap.parse_args()

    SW, SH, DUR = probe(a.nen)
    doan = [(a.tu, a.dai)]
    if a.doan:
        doan = []
        for it in a.doan.split(","):
            t, d = it.split(":"); doan.append((float(t), float(d)))

    ket = []
    for tu, dai in doan:
        t = do_chu_the(a.nen, tu, min(dai, max(0.5, DUR - tu)))
        if t is None:
            tx, ty, note = 0.5, 0.5, "không dò được chủ thể (đoạn quá ngắn) → cắt giữa khung"
        else:
            tx, ty = t; note = f"chủ thể ≈ ({round(tx*SW)}, {round(ty*SH)}) px nguồn"
        crop = tinh_crop(SW, SH, tx, ty, a.ty_le_cao)
        w, h, x, y = crop
        dau_ra_y = round(((ty * SH) - y) / h * H_OUT)
        ket.append({"tu": tu, "dai": dai, "crop": crop, "chu_the": [round(tx * SW), round(ty * SH)],
                    "tam_chu_the_o_khung_ra_y": dau_ra_y,
                    "an_toan": dau_ra_y > a.band_y + a.band_h * 0.55, "ghi_chu": note})

    out = {"nguon": a.nen, "kich_thuoc": [SW, SH], "thoi_luong": round(DUR, 2), "doan": ket}
    print(json.dumps(out, ensure_ascii=False, indent=2))

    if a.soi:
        tiles = []
        tmp = tempfile.mkdtemp(prefix="soi-")
        for i, d in enumerate(ket, 1):
            w, h, x, y = d["crop"]
            p = os.path.join(tmp, f"t{i}.jpg")
            subprocess.run(["ffmpeg", "-v", "error", "-ss", str(d["tu"] + d["dai"] / 2), "-i", a.nen,
                            "-frames:v", "1", "-vf",
                            f"crop={w}:{h}:{x}:{y},scale={W_OUT}:{H_OUT},"
                            f"drawbox=x=0:y={a.band_y}:w={W_OUT}:h={a.band_h}:color=red@0.9:t=5,"
                            f"drawbox=x=0:y=0:w={W_OUT}:h={a.band_y}:color=yellow@0.55:t=4,"
                            f"scale=300:-1", "-y", p], capture_output=True)
            tiles.append(p)
        ins = []
        for p in tiles: ins += ["-i", p]
        subprocess.run(["ffmpeg", "-v", "error", *ins, "-filter_complex",
                        f"hstack=inputs={len(tiles)}" if len(tiles) > 1 else "null", "-y", a.soi],
                       capture_output=True)
        shutil.rmtree(tmp, ignore_errors=True)
        print("ẢNH SOI KHUNG: " + a.soi, file=sys.stderr)

if __name__ == "__main__":
    main()
