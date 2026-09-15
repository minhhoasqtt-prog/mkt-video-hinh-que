#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""vbee-tts.py — Đọc text thành file MP3 bằng Vbee TTS (vbee.vn).

Bản ĐỘC LẬP đi kèm gói: chỉ cần `requests`, không phụ thuộc skill nào khác.
Khoá lấy theo thứ tự: biến môi trường VBEE_API / VBEE_APP_ID  →  config.env ở gốc skill.

Dùng:
    python vbee-tts.py --file kich-ban.txt --voice_code <ma_giong> [--speed_rate 0.95] -o voice.mp3
    python vbee-tts.py "Xin chào" -o voice.mp3

Lấy khoá: đăng ký vbee.vn → mục API → Bearer JWT (VBEE_API) + App ID (VBEE_APP_ID).
Tra mã giọng:
    curl -H "Authorization: Bearer $VBEE_API" "https://vbee.vn/api/v1/voices?limit=300"
"""
import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

import requests

BASE_URL = "https://vbee.vn/api/v1/tts"
SKILL_ROOT = Path(__file__).resolve().parent.parent
# Vbee bắt buộc có callback_url; ta dùng response_type=indirect + tự hỏi trạng thái nên giá trị này chỉ là chỗ giữ.
PLACEHOLDER_CALLBACK = "https://example.com/vbee/callback"


def load_config():
    """Đọc config.env ở gốc skill (không ghi đè biến môi trường đã có)."""
    f = SKILL_ROOT / "config.env"
    if not f.exists():
        return
    for line in f.read_text(encoding="utf-8").lstrip("﻿").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        k, v = k.strip(), v.strip()
        if k and v and not os.environ.get(k):
            os.environ[k] = v


def creds():
    jwt = os.environ.get("VBEE_API")
    app_id = os.environ.get("VBEE_APP_ID")
    if not jwt or not app_id:
        print("Loi: thieu VBEE_API / VBEE_APP_ID — dien trong config.env cua skill.", file=sys.stderr)
        sys.exit(1)
    return jwt, app_id


def synth(text, voice_code, speed_rate, out_path):
    jwt, app_id = creds()
    headers = {"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"}
    body = {
        "app_id": app_id,
        "callback_url": PLACEHOLDER_CALLBACK,
        "input_text": text,
        "voice_code": voice_code,
        "audio_type": "mp3",
        "bitrate": 128,
        "speed_rate": str(speed_rate),
        "response_type": "indirect",
    }
    r = requests.post(BASE_URL, json=body, headers=headers, timeout=60)
    if r.status_code >= 400:
        print(f"Loi Vbee HTTP {r.status_code}: {r.text[:300]}", file=sys.stderr)
        sys.exit(1)
    req_id = (r.json().get("result") or {}).get("request_id")
    if not req_id:
        print(f"Loi: Vbee khong tra request_id: {r.text[:300]}", file=sys.stderr)
        sys.exit(1)

    audio_link = None
    for _ in range(120):                       # tối đa ~4 phút
        time.sleep(2)
        s = requests.get(f"{BASE_URL}/{req_id}", headers=headers, timeout=60)
        if s.status_code >= 400:
            continue
        res = s.json().get("result") or {}
        status = str(res.get("status", "")).upper()
        if status == "SUCCESS":
            audio_link = res.get("audio_link")
            break
        if status in ("FAILURE", "ERROR"):
            print(f"Loi: Vbee bao {status}: {s.text[:300]}", file=sys.stderr)
            sys.exit(1)
    if not audio_link:
        print("Loi: qua thoi gian cho Vbee tra file am thanh.", file=sys.stderr)
        sys.exit(1)

    data = requests.get(audio_link, timeout=180).content
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Server đôi khi trả WAV — chuyển sang MP3 bằng ffmpeg cho đồng nhất.
    if audio_link.lower().endswith(".wav"):
        tmp = out.with_suffix(".wav")
        tmp.write_bytes(data)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), str(out)], check=True)
        tmp.unlink(missing_ok=True)
    else:
        out.write_bytes(data)
    print(f"OK {out} ({out.stat().st_size} bytes)")


def main():
    load_config()
    p = argparse.ArgumentParser(description="Vbee TTS → MP3")
    p.add_argument("text", nargs="?", help="Nội dung cần đọc (hoặc dùng --file)")
    p.add_argument("--file", help="Đường dẫn file .txt chứa nội dung")
    p.add_argument("--voice_code", default=os.environ.get("VBEE_VOICE", ""), help="Mã giọng Vbee")
    p.add_argument("--speed_rate", default="1.0", help="Tốc độ đọc, ví dụ 0.95")
    p.add_argument("-o", "--output", required=True, help="File MP3 đầu ra")
    a = p.parse_args()

    if a.file:
        text = Path(a.file).read_text(encoding="utf-8").lstrip("﻿").strip()
    elif a.text:
        text = a.text.strip()
    else:
        p.error("thiếu nội dung: truyền chuỗi hoặc --file")
    if not text:
        p.error("nội dung rỗng")
    if not a.voice_code:
        p.error("thiếu --voice_code (hoặc đặt VBEE_VOICE trong config.env)")
    synth(text, a.voice_code, a.speed_rate, a.output)


if __name__ == "__main__":
    main()
