#!/usr/bin/env node
/**
 * lam-video.mjs — ORCHESTRATOR: video nền (người thật) + hình que → 1 video 9:16 hoàn chỉnh.
 *
 * Phần CƠ KHÍ (không cần LLM): chọn nền → dò chế độ → giọng/timing → 6 ảnh + 6 clip hình que (Gommo)
 * → canh khung cắt dọc → ráp lớp → (tuỳ chọn) đẩy kho video Lark Base.
 * Phần SÁNG TẠO (LLM viết trước vào plan.json): title, sents (chế độ voiceover), img_prompts,
 * motion_prompts, caption.
 *
 * Dùng:
 *   node lam-video.mjs --du-an "output/2026-08-19-video-hinh-que-abc" [--nen auto|<file>]
 *        [--che-do auto|voiceover|giong-goc] [--doan "4:10.2,18:10.2,30:10.2,42:10.2"]
 *        [--bo-qua-media] [--lam-lai] [--day-base]
 *
 * --nen auto      : lấy video MỚI NHẤT trong thư mục VIDEO_NEN_DIR (khai báo trong config.env)
 * --che-do auto   : whisper thử tiếng nền — có người nói → giong-goc, chỉ tiếng động → voiceover
 * --bo-qua-media  : bỏ TTS + Gommo (khi đã có sẵn trong work/), chỉ canh khung + ráp
 * --lam-lai       : làm lại cả những bước đã có kết quả
 * --day-base      : đẩy vào kho video Lark Base (KHÔNG đặt lịch, KHÔNG bật TT Reel — chờ duyệt)
 *
 * Marker: LAM_OK <đường dẫn video> | LAM_FAIL <lý do>
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cfg, SKILL_DIR } from './lib-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NODE = process.execPath;
const PY = cfg('PYTHON', 'python');
const VBEE = path.join(__dirname, 'vbee-tts.py');               // bản TTS độc lập đi kèm gói
const GOMMO = path.join(__dirname, 'gommo-client.mjs');
const RAP = path.join(__dirname, 'rap-video.py');
const CANH = path.join(__dirname, 'canh-khung.py');
const DAY_BASE = path.join(__dirname, 'day-len-base.mjs');

const NEN_DIR = cfg('VIDEO_NEN_DIR', '');                       // kho video nền — khai trong config.env
const VBEE_VOICE = cfg('VBEE_VOICE', 'hn_male_phuthang_stor80dt_48k-fhg');
const IMG_MODEL = cfg('GOMMO_IMG_MODEL', 'google_image_gen_banana_2');
const IMG_MODEL_ALT = cfg('GOMMO_IMG_MODEL_ALT', 'google_image_gen_banana_pro');
const IMG_RES = cfg('GOMMO_IMG_RES', '1k');
const IMG_MODE = cfg('GOMMO_IMG_MODE', 'vip');
const VID_MODEL = cfg('GOMMO_VID_MODEL', 'veo_3_1');
const NGUONG_TU_NOI = parseInt(cfg('NGUONG_TU_NOI', '25'), 10);   // ≥ N từ → coi là có người nói

const CHILD_ENV = { ...process.env };
for (const k of ['VBEE_API', 'VBEE_APP_ID', 'VIDEO_MUSIC', 'VIDEO_LOGO', 'VIDEO_FONTS', 'GOMMO_MCP_KEY', 'GOMMO_MCP_URL']) {
  const v = cfg(k, ''); if (v) CHILD_ENV[k] = v;
}

const arg = (n, d = null) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const has = f => process.argv.includes('--' + f);
const log = (...a) => console.log('[lam-video]', ...a);
function fail(m) { console.log('LAM_FAIL ' + m); process.exit(1); }

function runSync(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    env: { ...CHILD_ENV, PYTHONIOENCODING: 'utf-8' }, ...opts });
}
function runAsync(cmd, args, logfile) {
  return new Promise(resolve => {
    const fd = fs.openSync(logfile, 'w');
    const p = spawn(cmd, args, { stdio: ['ignore', fd, fd], env: { ...CHILD_ENV, PYTHONIOENCODING: 'utf-8' } });
    p.on('close', c => { fs.closeSync(fd); resolve(c === 0); });
    p.on('error', () => { try { fs.closeSync(fd); } catch {} resolve(false); });
  });
}

const DU_AN = path.resolve(arg('du-an') || '');
if (!arg('du-an') || !fs.existsSync(DU_AN)) fail('thiếu --du-an (thư mục output/YYYY-MM-DD-… đã có plan.json)');
const WORK = path.join(DU_AN, 'work');
const CLIPS = path.join(WORK, 'clips');
const LOGS = path.join(WORK, 'logs');
[WORK, CLIPS, LOGS].forEach(d => fs.mkdirSync(d, { recursive: true }));
const PLANP = path.join(DU_AN, 'plan.json');
if (!fs.existsSync(PLANP)) fail('thiếu plan.json trong ' + DU_AN);
const readPlan = () => JSON.parse(fs.readFileSync(PLANP, 'utf8').replace(/^\uFEFF/, ''));
const writePlan = p => fs.writeFileSync(PLANP, JSON.stringify(p, null, 2), 'utf8');
let plan = readPlan();
const LAM_LAI = has('lam-lai');
const co = f => !LAM_LAI && fs.existsSync(f);

(async () => {
  try {
    // ---------- 0) VIDEO NỀN ----------
    let nen = arg('nen', plan.bg?.src || 'auto');
    if (nen === 'auto') {
      if (!NEN_DIR) fail('chưa khai VIDEO_NEN_DIR trong config.env — hoặc truyền thẳng --nen "<đường dẫn video>"');
      if (!fs.existsSync(NEN_DIR)) fail('không thấy thư mục video nền: ' + NEN_DIR);
      const ds = fs.readdirSync(NEN_DIR)
        .filter(f => /\.(mp4|mov|mkv|m4v|avi)$/i.test(f))
        .map(f => ({ f, t: fs.statSync(path.join(NEN_DIR, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      if (!ds.length) fail(`thư mục nền RỖNG: ${NEN_DIR} — thả video short vào đó rồi chạy lại`);
      nen = path.join(NEN_DIR, ds[0].f);
      log('nền (mới nhất): ' + nen);
    }
    if (!fs.existsSync(nen)) fail('không thấy video nền: ' + nen);

    // ---------- 1) CHẾ ĐỘ: có người nói hay không ----------
    let mode = arg('che-do', plan.mode || 'auto');
    const wavGoc = path.join(WORK, 'tieng-nen.wav');
    if (mode === 'auto' || mode === 'giong-goc') {
      if (!co(wavGoc)) {
        runSync('ffmpeg', ['-v', 'error', '-i', nen, '-vn', '-ac', '1', '-ar', '16000', '-y', wavGoc]);
      }
      if (!fs.existsSync(wavGoc)) fail('không bóc được tiếng của video nền');
    }
    if (mode === 'auto') {
      log('1/6 dò tiếng nền (whisper)...');
      const r = runSync(PY, ['-c', `
from faster_whisper import WhisperModel
m = WhisperModel('small', device='cpu', compute_type='int8')
segs, info = m.transcribe(r'''${wavGoc}''', language='vi', vad_filter=True)
print(sum(len(s.text.split()) for s in segs))`]);
      const n = parseInt((r.stdout || '0').trim().split('\n').pop(), 10) || 0;
      mode = n >= NGUONG_TU_NOI ? 'giong-goc' : 'voiceover';
      log(`   nghe được ~${n} từ → chế độ ${mode}`);
    }
    plan.mode = mode;
    plan.bg = plan.bg || {};
    plan.bg.src = nen;
    writePlan(plan);

    // ---------- 2) CANH KHUNG CẮT DỌC ----------
    if (!plan.bg.segments || !plan.bg.segments.length || LAM_LAI) {
      const doanArg = arg('doan', null);
      let doan = doanArg;
      if (!doan) {
        const dur = parseFloat((runSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
          '-of', 'csv=p=0', nen]).stdout || '0').trim()) || 0;
        if (mode === 'giong-goc') {
          doan = `0:${Math.max(1, dur - 0.1).toFixed(2)}`;            // giữ nguyên một mạch để khớp giọng
        } else {
          const n = Math.max(1, Math.min(4, Math.floor(dur / 10)));    // b-roll: tối đa 4 đoạn ~10s
          const d = Math.min(10.2, dur / n);
          doan = Array.from({ length: n }, (_, i) => `${(i * (dur / n)).toFixed(1)}:${d.toFixed(2)}`).join(',');
        }
      }
      log('2/6 canh khung cắt dọc: ' + doan);
      const soi = path.join(DU_AN, 'khung-thu.jpg');
      const r = runSync(PY, [CANH, '--nen', nen, '--doan', doan, '--soi', soi]);
      let k; try { k = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); }
      catch { fail('canh-khung lỗi: ' + ((r.stderr || r.stdout) || '').slice(-300)); }
      plan.bg.segments = k.doan.map(d => ({ tu: d.tu, dai: d.dai, crop: d.crop }));
      const rui_ro = k.doan.filter(d => !d.an_toan).length;
      if (rui_ro) log(`   CẢNH BÁO: ${rui_ro} đoạn có chủ thể cao gần băng hình que — soi ${soi} rồi sửa crop trong plan.json nếu cần`);
      writePlan(plan);
    }

    if (!has('bo-qua-media')) {
      // ---------- 3) GIỌNG + TIMING ----------
      if (mode === 'voiceover') {
        const sents = plan.sents || [];
        if (sents.length < 4) fail('chế độ voiceover cần plan.sents (≥4 câu) do LLM viết trước');
        const voice = path.join(WORK, 'voice.mp3');
        if (!co(voice)) {
          log('3/6 giọng đọc (Vbee ' + (plan.voice_code || VBEE_VOICE) + ')...');
          fs.writeFileSync(path.join(WORK, 'kich-ban.txt'), sents.join(' '), 'utf8');
          runSync(PY, [VBEE, '--file', path.join(WORK, 'kich-ban.txt'),
            '--voice_code', plan.voice_code || VBEE_VOICE, '--speed_rate', String(plan.speed_rate || '0.95'),
            '-o', voice]);
          if (!fs.existsSync(voice)) fail('Vbee TTS lỗi (kiểm tra VBEE_API/VBEE_APP_ID)');
        }
        const wj = path.join(WORK, 'words.json');
        if (!co(wj)) {
          log('   timing (whisper trên voice.mp3)...');
          runSync(PY, ['-c', wordsPy(voice, wj)]);
          if (!fs.existsSync(wj)) fail('whisper lỗi khi lấy timing giọng đọc');
        }
      } else {
        const wj = path.join(WORK, 'words-goc.json');
        if (!co(wj)) {
          if (plan.bg.segments.length !== 1)
            fail('chế độ giong-goc chỉ dùng MỘT đoạn nền liên tục (để phụ đề khớp giọng) — sửa bg.segments');
          const s = plan.bg.segments[0];
          const cut = path.join(WORK, 'tieng-doan.wav');
          runSync('ffmpeg', ['-v', 'error', '-ss', String(s.tu), '-t', String(s.dai), '-i', nen,
            '-vn', '-ac', '1', '-ar', '16000', '-y', cut]);
          log('3/6 bóc lời từ giọng gốc (whisper word-timestamps)...');
          runSync(PY, ['-c', wordsPy(cut, wj)]);
          if (!fs.existsSync(wj)) fail('whisper lỗi khi bóc lời giọng gốc');
        }
      }

      // ---------- 4) 6 ẢNH HÌNH QUE (Gommo, 16:9) ----------
      const IMGS = plan.img_prompts || [];
      const MOTS = plan.motion_prompts || [];
      if (IMGS.length < 1 || IMGS.length !== MOTS.length)
        fail(`plan.img_prompts (${IMGS.length}) phải khớp plan.motion_prompts (${MOTS.length})`);
      const urlOf = k => {
        try {
          const m = fs.readFileSync(path.join(LOGS, `img${k + 1}.log`), 'utf8').match(/GOMMO_OK\s+(https?:\S+)/);
          return m ? m[1] : null;
        } catch { return null; }
      };
      const imgJob = (k, model = IMG_MODEL) => {
        const pf = path.join(WORK, `p${k + 1}.txt`);
        fs.writeFileSync(pf, IMGS[k], 'utf8');
        return runAsync(NODE, [GOMMO, 'image', '--model', model, '--prompt-file', pf,
          '--ratio', '16:9', '--resolution', IMG_RES, '--mode', IMG_MODE, '--timeout-min', '12'],
          path.join(LOGS, `img${k + 1}.log`));
      };
      const thieuAnh = IMGS.map((_, k) => k).filter(k => LAM_LAI || !urlOf(k));
      if (thieuAnh.length) {
        log(`4/6 sinh ${thieuAnh.length} ảnh hình que (Gommo ${IMG_MODEL}, ratio 16:9, song song)...`);
        await Promise.all(thieuAnh.map(k => imgJob(k)));
        for (let lan = 1; lan <= 2; lan++) {
          const miss = IMGS.map((_, k) => k).filter(k => !urlOf(k));
          if (!miss.length) break;
          const model = lan === 2 && IMG_MODEL_ALT ? IMG_MODEL_ALT : IMG_MODEL;
          log(`   retry ảnh ${lan} (${model}): ${miss.map(k => k + 1).join(',')}`);
          await Promise.all(miss.map(k => imgJob(k, model)));
        }
      }
      const urls = IMGS.map((_, k) => urlOf(k));
      if (urls.some(u => !u)) fail('ảnh hình que lỗi sau retry — xem work/logs/img*.log');

      // ---------- 5) 6 CLIP CHUYỂN ĐỘNG (VEO 16:9) ----------
      const clipOf = k => path.join(CLIPS, `${plan.clip_prefix || 'hq'}${k + 1}.mp4`);
      const clipJob = k => {
        const mf = path.join(WORK, `m${k + 1}.txt`);
        fs.writeFileSync(mf, MOTS[k], 'utf8');
        return runAsync(NODE, [GOMMO, 'video', '--model', VID_MODEL, '--mode', 'lite', '--resolution', '720p',
          '--duration', '8', '--ratio', '16:9', '--prompt-file', mf, '--image-url', urls[k],
          '--out', clipOf(k), '--timeout-min', '40'], path.join(LOGS, `vid${k + 1}.log`));
      };
      const thieuClip = IMGS.map((_, k) => k).filter(k => LAM_LAI || !fs.existsSync(clipOf(k)));
      if (thieuClip.length) {
        log(`5/6 thổi chuyển động ${thieuClip.length} cảnh (${VID_MODEL} lite, song song)...`);
        await Promise.all(thieuClip.map(k => clipJob(k)));
        for (let lan = 1; lan <= 2; lan++) {
          const miss = IMGS.map((_, k) => k).filter(k => !fs.existsSync(clipOf(k)));
          if (!miss.length) break;
          log(`   retry clip ${lan}: ${miss.map(k => k + 1).join(',')}`);
          await Promise.all(miss.map(k => clipJob(k)));
        }
      }
      const thieu = IMGS.map((_, k) => k).filter(k => !fs.existsSync(clipOf(k)));
      if (thieu.length) fail('clip hình que lỗi sau retry: cảnh ' + thieu.map(k => k + 1).join(',') + ' — xem work/logs/vid*.log');
    }

    // ---------- 6) RÁP LỚP ----------
    const final = path.join(DU_AN, 'video-final.mp4');
    if (!co(final)) {
      log('6/6 ráp lớp (nền + băng hình que blend screen + tiêu đề + phụ đề)...');
      const r = runSync(PY, [RAP, DU_AN]);
      if (!fs.existsSync(final)) fail('ráp lỗi: ' + ((r.stdout || '') + (r.stderr || '')).slice(-500));
      log((r.stdout || '').trim().split('\n').pop());
    } else log('6/6 đã có video-final.mp4 (dùng --lam-lai để dựng lại)');

    // ---------- 7) ĐẨY KHO VIDEO LARK BASE (tuỳ chọn, chờ duyệt) ----------
    if (has('day-base')) {
      const r = runSync(NODE, [DAY_BASE, '--du-an', DU_AN]);
      const out = ((r.stdout || '') + (r.stderr || ''));
      const m = out.match(/DAY_OK\s+(\S+)/);
      if (!m) fail('đẩy Base lỗi: ' + out.slice(-400));
      log('đã đẩy kho video Base, record: ' + m[1] + ' (TT Reel để trống — chờ anh duyệt)');
    }

    console.log('LAM_OK ' + final);
  } catch (e) { fail(String(e.message || e)); }
})();

function wordsPy(audio, out) {
  return `
from faster_whisper import WhisperModel
import json
m = WhisperModel('small', device='cpu', compute_type='int8')
segs, info = m.transcribe(r'''${audio}''', language='vi', word_timestamps=True)
out=[]
for s in segs:
    for w in (s.words or []): out.append({'w': w.word, 's': round(w.start,2), 'e': round(w.end,2)})
json.dump(out, open(r'''${out}''','w',encoding='utf-8'), ensure_ascii=False)
print(len(out))`;
}
