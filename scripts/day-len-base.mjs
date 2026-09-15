#!/usr/bin/env node
/**
 * day-len-base.mjs — đẩy video đã ráp vào KHO VIDEO trên Lark Base (bảng của bạn).
 *
 * CỐ Ý CHỈ tạo record + đính video: KHÔNG đặt lịch đăng, KHÔNG bật cột trạng thái đăng.
 * Nhờ vậy máy đăng tự động (nếu bạn có) sẽ bỏ qua, video nằm im chờ người duyệt.
 * (Muốn đăng: mở Base, đặt lịch rồi bật trạng thái đăng.)
 *
 * Idempotent: ghi ledger `.da-day-base.json` trong thư mục dự án; chạy lại KHÔNG tạo record trùng.
 *
 * Dùng: node day-len-base.mjs --du-an <thư mục dự án> [--lam-lai]
 * Marker: DAY_OK <record_id> | DAY_FAIL <lý do>
 */
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { cfg } from './lib-config.mjs';

// Bảng kho video của BẠN — khai trong config.env (xem HUONG-DAN-CAI-DAT.md phần 5).
const BASE = cfg('LARK_POST_BASE', '');
const TABLE = cfg('LARK_POST_TABLE', '');
const FIELD_VIDEO_ID = cfg('LARK_POST_VIDEO_FIELD_ID', '');       // ID cột đính kèm (tên cột có "/" thì API 404 → dùng ID)
const FIELD_VIDEO = cfg('LARK_POST_VIDEO_FIELD_NAME', 'Video');
const F_CAPTION = cfg('LARK_POST_CAPTION_FIELD', 'Nội dung');
const F_NOTE = cfg('LARK_POST_NOTE_FIELD', '');
const F_LOAI = cfg('LARK_POST_TYPE_FIELD', '');
const LARK = cfg('LARK_CLI', process.env.LARK_CLI || 'lark-cli');

const arg = (n, d = null) => {
  const i = process.argv.indexOf('--' + n);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const has = f => process.argv.includes('--' + f);
function fail(m) { console.log('DAY_FAIL ' + m); process.exit(1); }

// lark-cli cần cwd ASCII (@file/--file là đường dẫn tương đối) → làm việc trong %TEMP%
const TMP = path.join(os.tmpdir(), 'hinhque-push');
fs.mkdirSync(TMP, { recursive: true });
function lark(args) {
  const r = spawnSync(LARK, args, { cwd: TMP, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, shell: true, windowsHide: true });
  const out = r.stdout || '';
  const i = out.indexOf('{');
  if (i < 0) throw new Error('lark-cli không trả JSON: ' + ((r.stderr || out) || '').slice(0, 300));
  const j = JSON.parse(out.slice(i));
  if (j.ok === false) throw new Error('lark-cli lỗi: ' + JSON.stringify(j.error || j).slice(0, 300));
  return j;
}

(async () => {
  try {
    if (!BASE || !TABLE || !FIELD_VIDEO_ID)
      fail('chưa khai LARK_POST_BASE / LARK_POST_TABLE / LARK_POST_VIDEO_FIELD_ID trong config.env');
    const DU_AN = path.resolve(arg('du-an') || '');
    if (!DU_AN || !fs.existsSync(DU_AN)) fail('thiếu --du-an hợp lệ');
    const video = path.join(DU_AN, 'video-final.mp4');
    if (!fs.existsSync(video)) fail('chưa có video-final.mp4 trong ' + DU_AN);
    const planP = path.join(DU_AN, 'plan.json');
    const plan = fs.existsSync(planP) ? JSON.parse(fs.readFileSync(planP, 'utf8').replace(/^\uFEFF/, '')) : {};

    const ledgerP = path.join(DU_AN, '.da-day-base.json');
    if (fs.existsSync(ledgerP) && !has('lam-lai')) {
      const l = JSON.parse(fs.readFileSync(ledgerP, 'utf8'));
      console.log('[day-base] đã đẩy trước đó, bỏ qua (dùng --lam-lai để đẩy lại)');
      console.log('DAY_OK ' + l.record_id);
      return;
    }

    const caption = String(plan.caption || plan.thong_diep || (plan.title || '').replace(/\n/g, ' ')).trim();
    if (caption.length < 20) fail('caption quá ngắn — điền plan.caption trước');
    if (/[—–]|\p{Extended_Pictographic}/u.test(caption)) fail('caption dính emoji hoặc em-dash (luật content: không emoji, không em-dash)');

    // 1) tạo record — KHÔNG lịch, KHÔNG trạng thái → máy đăng Reel bỏ qua
    const rec = { [F_CAPTION]: caption };
    if (F_LOAI) rec[F_LOAI] = ['Video'];
    if (F_NOTE) rec[F_NOTE] = (plan.note || 'Video hình que + người thật') + ' | nguồn: '
      + path.basename(DU_AN) + ' | chưa đặt lịch, chưa bật trạng thái đăng (chờ duyệt)';
    fs.writeFileSync(path.join(TMP, 'create.json'), JSON.stringify(rec), 'utf8');
    const cre = lark(['base', '+record-upsert', '--base-token', BASE, '--table-id', TABLE,
      '--json', '@./create.json', '--as', 'user']);
    const d = cre.data || {};
    const recId = d.record_id || (d.record && (d.record.record_id
      || (Array.isArray(d.record.record_id_list) && d.record.record_id_list[0])))
      || (Array.isArray(d.record_id_list) && d.record_id_list[0]);
    if (!recId) fail('tạo record xong nhưng không lấy được record_id: ' + JSON.stringify(d).slice(0, 200));

    // 2) upload video (tên ASCII trong cwd ASCII) + verify
    const vName = 'video-' + path.basename(DU_AN).replace(/[^a-zA-Z0-9-]/g, '').slice(-24) + '-' + Date.now() + '.mp4';
    fs.copyFileSync(video, path.join(TMP, vName));
    lark(['base', '+record-upload-attachment', '--base-token', BASE, '--table-id', TABLE,
      '--record-id', recId, '--field-id', FIELD_VIDEO_ID, '--file', './' + vName, '--as', 'user']);
    const chk = lark(['base', '+record-get', '--base-token', BASE, '--table-id', TABLE,
      '--record-id', recId, '--format', 'json', '--as', 'user']);
    const fi = (chk.data.fields || []).indexOf(FIELD_VIDEO);
    const cell = fi >= 0 && chk.data.data && chk.data.data[0] ? chk.data.data[0][fi] : null;
    if (!Array.isArray(cell) || !cell.length) fail(`upload xong nhưng cột "${FIELD_VIDEO}" vẫn trống (record ${recId})`);
    try { fs.unlinkSync(path.join(TMP, vName)); } catch {}

    fs.writeFileSync(ledgerP, JSON.stringify({
      record_id: recId, base: BASE, table: TABLE,
      file: cell[0].name, size: cell[0].size, luc: new Date(Date.now() + 7 * 3600e3).toISOString().replace('T', ' ').slice(0, 19) + ' (GMT+7)',
    }, null, 2), 'utf8');
    console.log(`[day-base] record ${recId} · cột "${FIELD_VIDEO}" có ${cell.length} file · TT Reel để trống (chờ duyệt)`);
    console.log('DAY_OK ' + recId);
  } catch (e) { fail(String(e.message || e)); }
})();
