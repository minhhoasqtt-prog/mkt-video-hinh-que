#!/usr/bin/env node
/**
 * gommo-client.mjs — Client Gommo MCP (genful.ai): sinh ảnh & video AI.
 * Gọi thẳng JSON-RPC bằng GOMMO_MCP_KEY trong config.env — KHÔNG cần Claude/MCP đứng giữa
 * (chạy được trong Scheduled Task headless).
 *
 * Lệnh:
 *   node gommo-client.mjs balance
 *   node gommo-client.mjs video --model kling_video_2_5 --prompt-file p.txt --image-url <https://...> \
 *        [--ratio 9:16] [--duration 10] [--mode relax] [--out clip.mp4] [--timeout-min 25]
 *   node gommo-client.mjs image --model <slug> --prompt-file p.txt [--ratio 9:16] [--out img.png]
 *   node gommo-client.mjs status --type video --id <id_base>
 *   node gommo-client.mjs models --type image|video     (xem model nào đang ON — nhà cung cấp hay tắt model cũ)
 *
 * Media tools của Gommo là ASYNC: create trả id_base → poll *_status tới khi có output URL → tải về.
 * Marker: GOMMO_OK <file|url> | GOMMO_FAIL <lý do>
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg } from './lib-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(p) {
  if (!p || !fs.existsSync(p)) return {};
  return Object.fromEntries(fs.readFileSync(p, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()]; }));
}
// Khoá lấy theo thứ tự: config.env của skill → biến môi trường → file env chỉ định qua GOMMO_ENV.
const env = loadEnv(process.env.GOMMO_ENV);
const URL_MCP = cfg('GOMMO_MCP_URL', env.GOMMO_MCP_URL || 'https://api.gommo.net/api/v2/gommo-mcp');
const KEY = cfg('GOMMO_MCP_KEY', env.GOMMO_MCP_KEY || '');
if (!KEY) {
  console.log('GOMMO_FAIL thiếu GOMMO_MCP_KEY — mở config.env của skill và điền khoá Gommo (genful.ai) của bạn');
  process.exit(1);
}

function arg(name, def = null) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const CMD = process.argv[2];
function fail(msg) { console.log('GOMMO_FAIL ' + msg); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

let SID = null;
async function rpc(method, params, id) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': 'Bearer ' + KEY,
  };
  if (SID) headers['Mcp-Session-Id'] = SID;
  const res = await fetch(URL_MCP, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) SID = sid;
  const txt = await res.text();
  // server có thể trả SSE ("data: {...}") hoặc JSON thẳng
  let body = txt.trim();
  if (body.startsWith('event:') || body.includes('\ndata:') || body.startsWith('data:')) {
    const lines = body.split('\n').filter(l => l.startsWith('data:'));
    body = lines[lines.length - 1].slice(5).trim();
  }
  const j = JSON.parse(body.slice(body.indexOf('{')));
  if (j.error) throw new Error('RPC ' + method + ': ' + JSON.stringify(j.error).slice(0, 300));
  return j.result;
}
async function init() {
  await rpc('initialize', {
    protocolVersion: '2025-03-26', capabilities: {},
    clientInfo: { name: 'mkt-video-hinh-que', version: '1.0' },
  }, 1);
}
async function call(tool, args) {
  const r = await rpc('tools/call', { name: tool, arguments: args }, Date.now() % 100000);
  // Server đôi lúc trả result rỗng/không có content (Gommo chập chờn) → không crash, coi như thất bại tạm.
  if (!r || !Array.isArray(r.content)) throw new Error('Gommo trả response bất thường (thiếu content) — thử lại');
  const txt = r.content.filter(c => c && c.type === 'text').map(c => c.text).join('');
  try { return JSON.parse(txt); } catch { return { _raw: txt }; }
}

function findUrls(obj, out = []) {
  if (obj == null) return out;
  if (typeof obj === 'string') {
    if (/^https?:\/\/\S+\.(mp4|mov|webm|png|jpg|jpeg|webp)(\?|$)/i.test(obj)) out.push(obj);
    return out;
  }
  if (Array.isArray(obj)) { obj.forEach(x => findUrls(x, out)); return out; }
  if (typeof obj === 'object') { Object.values(obj).forEach(x => findUrls(x, out)); return out; }
  return out;
}
function findIdBase(obj) {
  if (obj == null || typeof obj !== 'object') return null;
  if (obj.videoInfo && obj.videoInfo.id_base) return obj.videoInfo.id_base;
  if (obj.imageInfo && obj.imageInfo.id_base) return obj.imageInfo.id_base;
  if (obj.requestInfo && obj.requestInfo.id_base) return obj.requestInfo.id_base;
  if (obj.id_base && !obj.name) return obj.id_base;
  for (const v of Object.values(obj)) {
    if (typeof v === 'object') { const r = findIdBase(v); if (r) return r; }
  }
  return null;
}
function statusOf(obj) {
  const s = JSON.stringify(obj);
  const m = s.match(/"status"\s*:\s*"?(\w+)"?/i);
  return m ? String(m[1]).toUpperCase() : '?';
}
async function download(url, out) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('tải output lỗi HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(out, buf);
  return buf.length;
}

(async () => {
  try {
    await init();
    if (CMD === 'balance') {
      const b = await call('gommo.credit_balance', {});
      const bal = (b.balancesInfo || {});
      console.log('credits_ai =', bal.credits_ai);
      console.log('GOMMO_OK balance');
      return;
    }
    if (CMD === 'status') {
      const type = arg('type', 'video');
      const st = await call('gommo.' + type + '_status', { id_base: arg('id') });
      console.log(JSON.stringify(st).slice(0, 1500));
      for (const u of findUrls(st)) console.log('GOMMO_URL ' + u);
      console.log('GOMMO_OK status');
      return;
    }
    if (CMD === 'models') {
      // Nhà cung cấp BẬT/TẮT model theo thời gian. status "ON" = dùng được;
      // rỗng hoặc "maintenance" = job sẽ treo hàng đợi rồi ERROR, phải đổi GOMMO_IMG_MODEL trong config.env.
      const type = arg('type', 'image');
      const m = await call('gommo.models_list', { type });
      const seen = new Set();
      (function walk(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) return o.forEach(walk);
        const slug = o.model || o.slug;
        if (slug && !seen.has(slug)) {
          seen.add(slug);
          console.log(`${String(o.status || '-').padEnd(12)} ${String(slug).padEnd(36)} ${o.name || ''} (${o.price ?? o.credit ?? '?'}cr)`);
        }
        Object.values(o).forEach(walk);
      })(m);
      console.log('GOMMO_OK models ' + type);
      return;
    }
    if (CMD === 'video' || CMD === 'image') {
      const model = arg('model');
      const promptFile = arg('prompt-file');
      if (!model) fail('thiếu --model');
      const prompt = promptFile ? fs.readFileSync(promptFile, 'utf8').replace(/^﻿/, '').trim() : (arg('prompt') || '');
      const args = { model, prompt, privacy: 'PRIVATE' };
      const ratio = arg('ratio'); if (ratio) args.ratio = ratio;
      const mode = arg('mode'); if (mode) args.mode = mode;
      const res = arg('resolution'); if (res) args.resolution = res;
      if (CMD === 'video') {
        const dur = arg('duration'); if (dur) args.duration = String(dur);
        const img = arg('image-url'); if (img) args.images = [{ url: img }];
      } else {
        // DẠNG 2 (phim ngắn có nhân vật): ảnh THAM CHIẾU để giữ nhân dạng qua nhiều cảnh.
        // Nano Banana nhận images[] — nhiều URL cách nhau bằng dấu phẩy.
        const ref = arg('image-url');
        if (ref) args.images = ref.split(',').map(u => ({ url: u.trim() })).filter(x => x.url);
      }
      console.log(`[gommo] tạo ${CMD}: model=${model}${args.duration ? ' dur=' + args.duration + 's' : ''}${args.mode ? ' mode=' + args.mode : ''}${args.images ? ' +start_image' : ''}`);
      const cre = await call('gommo.' + CMD + '_create', args);
      const idBase = findIdBase(cre);
      if (!idBase) fail('create không trả id_base: ' + JSON.stringify(cre).slice(0, 400));
      console.log('[gommo] id_base = ' + idBase + ' — chờ render...');

      const timeoutMs = parseInt(arg('timeout-min', '25'), 10) * 60 * 1000;
      const t0 = Date.now();
      let lastStatus = '';
      while (Date.now() - t0 < timeoutMs) {
        await sleep(30000);
        const st = await call('gommo.' + CMD + '_status', { id_base: idBase });
        const s = statusOf(st);
        if (s !== lastStatus) { console.log(`[gommo] ${Math.round((Date.now() - t0) / 1000)}s: ${s}`); lastStatus = s; }
        if (/FAIL|ERROR|CANCEL/.test(s)) fail('task ' + s + ': ' + JSON.stringify(st).slice(0, 300));
        const urls = findUrls(st).filter(u => CMD === 'video' ? /\.(mp4|mov|webm)/i.test(u) : /\.(png|jpg|jpeg|webp)/i.test(u));
        if (urls.length && /DONE|SUCCESS|COMPLET|FINISH/.test(s) || (urls.length && s === '?')) {
          const url = urls[urls.length - 1];
          const out = arg('out');
          if (out) {
            const n = await download(url, out);
            console.log(`[gommo] đã tải ${(n / 1048576).toFixed(1)}MB -> ${out}`);
            console.log('GOMMO_OK ' + out);
          } else {
            console.log('GOMMO_OK ' + url);
          }
          return;
        }
      }
      fail(`quá ${timeoutMs / 60000} phút chưa xong (id_base=${idBase}) — kiểm tra lại bằng: node gommo-client.mjs status --type ${CMD} --id ${idBase}`);
    }
    fail('lệnh không hợp lệ: ' + CMD);
  } catch (e) { fail(String(e.message || e)); }
})();
