// lib-config.mjs — đọc config.env (bản chuyển giao) từ gốc skill, có fallback.
// Dùng: import { CFG, cfg } from './lib-config.mjs';  cfg('GOMMO_MCP_KEY', 'default')
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, '..');

function parseEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').replace(/^﻿/, '').split('\n')) {
    const s = line.trim();
    if (!s || s.startsWith('#') || !s.includes('=')) continue;
    const i = s.indexOf('=');
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

// Ưu tiên: config.env (bản chuyển giao học viên) → .env dự án → giá trị rỗng.
export const CFG = {
  ...parseEnv(path.join(SKILL_ROOT, 'config.env')),
};
// .env dự án (nơi bạn để VBEE_API/VBEE_APP_ID) — bổ sung nếu config.env thiếu.
const PROJ_ENV = parseEnv(path.resolve(SKILL_ROOT, '..', '..', '.env'));
for (const [k, v] of Object.entries(PROJ_ENV)) if (!CFG[k]) CFG[k] = v;

/** Lấy giá trị config: config.env → process.env → default. Rỗng coi như không có. */
export function cfg(key, def = '') {
  const v = (CFG[key] && String(CFG[key]).trim()) || (process.env[key] && String(process.env[key]).trim());
  return v || def;
}
export const SKILL_DIR = SKILL_ROOT;
