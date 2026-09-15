#!/usr/bin/env node
/**
 * kiem-tra-he-thong.mjs — Chạy TRƯỚC KHI làm video đầu tiên (và mỗi khi thấy lạ).
 * Kiểm: công cụ đã cài chưa · config.env đã điền chưa · khoá có sống không · model AI có đang bật không.
 * KHÔNG tốn credits (chỉ hỏi số dư và danh sách model, không sinh ảnh/video).
 *
 * Dùng:  node scripts/kiem-tra-he-thong.mjs
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cfg } from './lib-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOC = path.resolve(__dirname, '..');
let loi = 0, canhbao = 0;
const ok = (m) => console.log('  [OK]    ' + m);
const warn = (m) => { canhbao++; console.log('  [!]     ' + m); };
const bad = (m) => { loi++; console.log('  [THIEU] ' + m); };

function co(cmd, args = ['--version']) {
  let r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) r = spawnSync(cmd, args, { encoding: 'utf8', shell: true });   // Windows: .cmd cần shell
  return r.status === 0 ? (r.stdout || r.stderr || '').trim().split('\n')[0] : null;
}

console.log('\n=== 1. CONG CU TREN MAY ===');
ok('Node ' + process.version);
const PY = cfg('PYTHON', 'python');
const py = co(PY, ['--version']);
py ? ok(py) : bad('Python — cai tai python.org (nho tich "Add Python to PATH")');
co('ffmpeg', ['-version']) ? ok('ffmpeg san sang') : bad('ffmpeg — tai tai ffmpeg.org roi them vao PATH');
co('ffprobe', ['-version']) ? ok('ffprobe san sang') : bad('ffprobe — di kem ffmpeg, kiem tra lai PATH');

const lib = spawnSync(PY, ['-c', 'import numpy, PIL, requests; print("ok")'], { encoding: 'utf8' });
(lib.stdout || '').includes('ok') ? ok('Thu vien Python: numpy + pillow + requests')
  : bad('Thu vien Python — chay: pip install numpy pillow requests');
const wh = spawnSync(PY, ['-c', 'import faster_whisper; print("ok")'], { encoding: 'utf8' });
(wh.stdout || '').includes('ok') ? ok('faster-whisper (do tieng + lam phu de)')
  : bad('faster-whisper — chay: pip install faster-whisper');

console.log('\n=== 2. FILE CAU HINH ===');
const cfgFile = path.join(GOC, 'config.env');
if (!fs.existsSync(cfgFile)) {
  bad('config.env chua co — copy config.env.example thanh config.env roi dien khoa');
} else {
  ok('config.env da co');
  cfg('GOMMO_MCP_KEY') ? ok('GOMMO_MCP_KEY da dien') : bad('GOMMO_MCP_KEY — khoa AI tao hinh que (genful.ai)');
  const nen = cfg('VIDEO_NEN_DIR');
  if (!nen) bad('VIDEO_NEN_DIR — thu muc kho video nen cua ban');
  else if (!fs.existsSync(nen)) bad('VIDEO_NEN_DIR tro toi thu muc khong ton tai: ' + nen);
  else {
    const clip = fs.readdirSync(nen).filter(f => /\.(mp4|mov|mkv|m4v|avi)$/i.test(f));
    clip.length ? ok(`Kho video nen: ${clip.length} clip`) : warn('Kho video nen dang RONG — tha clip vao roi chay lai');
  }
  const vb = cfg('VBEE_API') && cfg('VBEE_APP_ID');
  vb ? ok('Vbee TTS da dien (dung duoc che do voiceover)')
     : warn('Chua dien VBEE_API/VBEE_APP_ID — chi chay duoc che do giong goc (clip co nguoi noi)');
  for (const [k, mota] of [['VIDEO_MUSIC', 'nhac nen'], ['VIDEO_FONTS', 'font phu de'], ['VIDEO_LOGO', 'logo']]) {
    const v = cfg(k);
    if (!v) warn(`${k} chua dien — video van ra, chi thieu ${mota}`);
    else if (!fs.existsSync(v)) bad(`${k} tro toi duong dan khong ton tai: ${v}`);
    else ok(`${k} ok`);
  }
  if (cfg('LARK_POST_BASE')) {
    const du = cfg('LARK_POST_TABLE') && cfg('LARK_POST_VIDEO_FIELD_ID');
    du ? ok('Cau hinh kho video Lark Base day du') : bad('Thieu LARK_POST_TABLE hoac LARK_POST_VIDEO_FIELD_ID');
    co(cfg('LARK_CLI', 'lark-cli'), ['--version']) ? ok('lark-cli san sang') : warn('Khong goi duoc lark-cli — bo qua neu khong day len Base');
  } else {
    warn('Chua noi Lark Base — bo qua neu chi can file mp4 tren may');
  }
}

console.log('\n=== 3. KHOA AI CON SONG KHONG (khong ton credits) ===');
if (!cfg('GOMMO_MCP_KEY')) {
  bad('Bo qua vi chua co GOMMO_MCP_KEY');
} else {
  const g = spawnSync(process.execPath, [path.join(__dirname, 'gommo-client.mjs'), 'balance'], { encoding: 'utf8' });
  const out = (g.stdout || '') + (g.stderr || '');
  const m = out.match(/credits_ai\s*=\s*(\d+)/);
  if (m) {
    const so = parseInt(m[1], 10);
    ok('Khoa Gommo song — con ' + so.toLocaleString('vi-VN') + ' credits');
    if (so < 7000) warn('Con duoi 7.000 credits — khong du 1 video (can ~6.600)');
    else ok('Du lam ~' + Math.floor(so / 6600) + ' video nua');
  } else {
    bad('Khong hoi duoc so du Gommo: ' + out.slice(-200).trim());
  }
  for (const loai of ['image', 'video']) {
    const key = loai === 'image' ? cfg('GOMMO_IMG_MODEL', 'google_image_gen_banana_2') : cfg('GOMMO_VID_MODEL', 'veo_3_1');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'gommo-client.mjs'), 'models', '--type', loai], { encoding: 'utf8' });
    const dong = ((r.stdout || '').split('\n').find(l => l.includes(' ' + key + ' ')) || '').trim();
    if (!dong) warn(`Khong thay model ${key} trong danh sach ${loai} — kiem tra lai ten trong config.env`);
    else if (dong.startsWith('ON')) ok(`Model ${loai}: ${key} dang BAT`);
    else bad(`Model ${loai}: ${key} KHONG bat (${dong.split(/\s+/)[0]}) — doi sang model dang ON trong config.env`);
  }
}

console.log('\n=== KET LUAN ===');
if (loi) console.log(`  Con ${loi} muc THIEU (va ${canhbao} canh bao) — xu ly xong roi hay lam video.`);
else if (canhbao) console.log(`  San sang lam video. Co ${canhbao} canh bao, doc lai neu can tinh nang do.`);
else console.log('  Tat ca san sang.');
console.log('');
process.exit(loi ? 1 : 0);
