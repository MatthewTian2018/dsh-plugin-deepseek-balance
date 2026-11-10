/**
 * DeepSeek 余额仪表盘 —— Host 半边。
 *
 * 在 DSH 的 Web 服务上挂两条只读/单写路由，由浏览器半边轮询：
 *   GET  /api/deepseek-balance/summary   余额 + 趋势 + 统计 + 预算
 *   POST /api/deepseek-balance/budget    {"budget": 100}
 *
 * API Key 只在这里读取并只用于请求 api.deepseek.com，绝不下发浏览器。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Cordis 插件名。 */
export const name = 'deepseek-balance';

/** 依赖 Web 服务来挂路由。 */
export const inject = ['webServer'];

const API_BASE = (process.env.DEEPSEEK_API_BASE || 'https://api.deepseek.com').replace(/\/+$/, '');
const DATA_DIR = path.join(os.homedir(), '.dsh', 'deepseek-balance');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const CACHE_TTL_MS = 15_000;
const SNAPSHOT_GAP_MS = 45_000;
const MAX_HISTORY = 20_000;
const FETCH_TIMEOUT_MS = 15_000;
const BACKGROUND_SAMPLE_MS = 10 * 60_000;

let lastResult = null;
let lastError = null;
let inflight = null;

/* ------------------------------------------------------------------ 存储 */

function ensureDir() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    /* 目录不可写时退化为纯内存，仪表盘仍可用 */
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  try {
    ensureDir();
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
  } catch {
    /* 写盘失败不影响本次读取 */
  }
}

function loadConfig() {
  const raw = readJson(CONFIG_FILE, null);
  const budget = Number(raw?.budget);
  return { budget: Number.isFinite(budget) && budget > 0 ? budget : 100 };
}

function loadHistory() {
  const raw = readJson(HISTORY_FILE, null);
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && Number.isFinite(row.t) && Number.isFinite(row.total));
}

function saveHistory(rows) {
  const trimmed = rows.length > MAX_HISTORY ? rows.slice(rows.length - MAX_HISTORY) : rows;
  writeJson(HISTORY_FILE, trimmed);
  return trimmed;
}

/* ------------------------------------------------------------------ 密钥 */

function readApiKey() {
  if (process.env.DEEPSEEK_API_KEY?.trim()) return process.env.DEEPSEEK_API_KEY.trim();
  const candidates = [
    path.join(os.homedir(), '.dsh', '.credentials.yaml'),
    path.join(os.homedir(), '.dsh', 'credentials.yaml'),
  ];
  for (const file of candidates) {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const match = text.match(/DEEPSEEK_API_KEY\s*[:=]\s*["']?([A-Za-z0-9_\-]+)/);
      if (match?.[1]) return match[1];
    } catch {
      /* 继续找下一个候选文件 */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ 取数 */

function toNumber(value) {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function normalize(json) {
  const infos = Array.isArray(json?.balance_infos) ? json.balance_infos : [];
  const preferred = infos.find((i) => i?.currency === 'CNY') || infos[0] || {};
  return {
    isAvailable: Boolean(json?.is_available),
    currency: preferred.currency || 'CNY',
    total: toNumber(preferred.total_balance),
    granted: toNumber(preferred.granted_balance),
    toppedUp: toNumber(preferred.topped_up_balance),
  };
}

async function fetchBalance() {
  const key = readApiKey();
  if (!key) {
    const error = new Error('未找到 DeepSeek API Key（可设置环境变量 DEEPSEEK_API_KEY）');
    error.code = 'NO_API_KEY';
    throw error;
  }
  const response = await fetch(`${API_BASE}/user/balance`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`DeepSeek 接口返回 ${response.status}${text ? `：${text.slice(0, 160)}` : ''}`);
    error.code = 'UPSTREAM_ERROR';
    throw error;
  }
  try {
    return normalize(JSON.parse(text));
  } catch {
    const error = new Error('DeepSeek 返回了无法解析的内容');
    error.code = 'BAD_RESPONSE';
    throw error;
  }
}

function recordSnapshot(balance) {
  let rows = loadHistory();
  const last = rows[rows.length - 1];
  const changed = !last || last.total !== balance.total || last.granted !== balance.granted;
  if (!last || changed || Date.now() - last.t >= SNAPSHOT_GAP_MS) {
    rows = rows.concat({
      t: Date.now(),
      currency: balance.currency,
      total: Number(balance.total.toFixed(4)),
      granted: Number(balance.granted.toFixed(4)),
      toppedUp: Number(balance.toppedUp.toFixed(4)),
    });
    rows = saveHistory(rows);
  }
  return rows;
}

function statsFor(rows, days = 7) {
  if (!rows.length) {
    return { points: 0, dailyBurn: 0, daysLeft: null, change: 0, spanHours: 0 };
  }
  const cutoff = days ? Date.now() - days * 86_400_000 : 0;
  const window = rows.filter((row) => row.t >= cutoff);
  const first = window[0] || rows[0];
  const last = rows[rows.length - 1];
  const spanHours = (last.t - first.t) / 3_600_000;
  const drop = first.total - last.total;
  const dailyBurn = spanHours >= 0.5 ? (drop / spanHours) * 24 : 0;
  const daysLeft = dailyBurn > 0.001 ? last.total / dailyBurn : null;
  return {
    points: window.length,
    dailyBurn: Math.max(0, Number(dailyBurn.toFixed(4))),
    daysLeft: daysLeft && Number.isFinite(daysLeft) ? Number(daysLeft.toFixed(1)) : null,
    change: Number((last.total - first.total).toFixed(4)),
    spanHours: Number(spanHours.toFixed(3)),
  };
}

async function summary(force = false) {
  if (!force && inflight) return inflight;
  if (!force && lastResult && Date.now() - lastResult.at < CACHE_TTL_MS) return lastResult.payload;

  const task = (async () => {
    try {
      const balance = await fetchBalance();
      const history = recordSnapshot(balance);
      const payload = {
        ok: true,
        fetchedAt: new Date().toISOString(),
        balance,
        stats: statsFor(history, 7),
        budget: loadConfig().budget,
        history: history.slice(-2000),
        stale: false,
      };
      lastResult = { at: Date.now(), payload };
      lastError = null;
      return payload;
    } catch (error) {
      lastError = { message: error?.message || String(error), code: error?.code || 'ERROR' };
      if (lastResult) {
        return { ...lastResult.payload, stale: true, error: lastError };
      }
      const history = loadHistory();
      const fallback = history[history.length - 1] || null;
      return {
        ok: false,
        fetchedAt: null,
        balance: fallback
          ? {
              currency: fallback.currency,
              total: fallback.total,
              granted: fallback.granted,
              toppedUp: fallback.toppedUp,
              isAvailable: null,
            }
          : null,
        stats: statsFor(history, 7),
        budget: loadConfig().budget,
        history: history.slice(-2000),
        stale: true,
        error: lastError,
      };
    } finally {
      inflight = null;
    }
  })();
  inflight = task;
  return task;
}

/* ------------------------------------------------------------------ 路由 */

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

/**
 * 挂载仪表盘路由。
 * @param ctx - Cordis 上下文，已注入 webServer。
 */
export function apply(ctx) {
  ensureDir();
  const base = '/api/deepseek-balance';

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/summary`,
        resource: async (request) => {
          const force = new URL(request.url, 'http://local').searchParams.get('force') === '1';
          try {
            const payload = await summary(force);
            return jsonResponse(payload);
          } catch (error) {
            return jsonResponse({ ok: false, error: { message: error?.message || String(error) } });
          }
        },
      }),
    'deepseek-balance: summary route',
  );

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: `${base}/budget`,
        resource: async (request) => {
          if (request.method !== 'POST') {
            return jsonResponse({ ok: false, error: '仅支持 POST' }, 405);
          }
          let body;
          try {
            body = await request.json();
          } catch {
            return jsonResponse({ ok: false, error: '请求体必须是 JSON' }, 400);
          }
          const budget = Number(body?.budget);
          if (!Number.isFinite(budget) || budget <= 0) {
            return jsonResponse({ ok: false, error: '预算需为正数' }, 400);
          }
          const config = { budget: Math.round(budget * 100) / 100 };
          writeJson(CONFIG_FILE, config);
          return jsonResponse({ ok: true, budget: config.budget });
        },
      }),
    'deepseek-balance: budget route',
  );

  // 页面没打开时也保持采样，趋势才不会断档。
  // timer 是可选依赖：没有 timer 服务时只靠页面轮询，插件本身照常可用。
  ctx.inject(['timer'], (timerCtx) => {
    timerCtx.interval(() => {
      void summary(true).catch(() => {});
    }, BACKGROUND_SAMPLE_MS);
  });
}
