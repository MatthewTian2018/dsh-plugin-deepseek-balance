/**
 * DeepSeek 余额仪表盘 —— 本地会话日志里的 token 用量统计。
 *
 * DeepSeek 的余额接口只给快照，没有 token 消耗数据；但 DSH 自己把每个会话
 * 记在 `~/.dsh/sessions/<workspace>/<session>/session*.jsonl.zstd` 里，每条
 * `assistant/message` 记录带 `data.usage`：
 *
 *   { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, totalTokens }
 *
 * 这个文件把它们读出来，按天 / 周 / 月聚合成趋势。会话日志是「多次追加的
 * 多帧 zstd」，Node 的 zstdDecompressSync 只解第一帧，所以这里先按 zstd 帧
 * 结构切出每一帧再逐帧解压。
 *
 * 数据只在本机读，不上传任何地方。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const SESSIONS_DIR = path.join(os.homedir(), '.dsh', 'sessions');
const ZSTD_MAGIC = 0xfd2fb528;
const SKIPPABLE_MASK = 0xfffffff0;
const SKIPPABLE_MAGIC = 0x184d2a50;

const CACHE_TTL_MS = 30_000;
const DAY_COUNT = 30;
const WEEK_COUNT = 12;
const MONTH_COUNT = 12;

/** 单文件解析结果缓存：path → { mtimeMs, size, events }。 */
const fileCache = new Map();
/** 聚合结果缓存，避免每次请求都重算。 */
let aggregateCache = { at: 0, payload: null };

/* ------------------------------------------------------------------ zstd */

/**
 * 按 zstd 帧结构切出不重叠的 [start, end) 区间。
 * 末尾正在写入的半帧会被忽略（下一轮再读），不会抛错。
 * @param {Buffer} buf - 整个 .zstd 文件。
 * @returns {Array<[number, number]>} 帧字节区间。
 */
function frameRanges(buf) {
  const ranges = [];
  let off = 0;
  while (off + 4 <= buf.length) {
    try {
      const magic = buf.readUInt32LE(off);
      if (magic !== ZSTD_MAGIC) {
        // 可跳过帧（不产生输出）直接跳过；其它情况说明后面不是合法流，停在这里。
        if ((magic & SKIPPABLE_MASK) !== SKIPPABLE_MAGIC) break;
        off += 8 + buf.readUInt32LE(off + 4);
        continue;
      }
      const fhd = buf[off + 4];
      const fcsFlag = fhd >> 6;
      const singleSegment = (fhd >> 5) & 1;
      const checksum = (fhd >> 2) & 1;
      const dictFlag = fhd & 3;
      let p = off + 5;
      if (!singleSegment) p += 1; // window descriptor
      p += [0, 1, 2, 4][dictFlag]; // dictionary id
      p += fcsFlag === 0 ? (singleSegment ? 1 : 0) : fcsFlag === 1 ? 2 : fcsFlag === 2 ? 4 : 8;
      for (;;) {
        if (p + 3 > buf.length) throw new Error('truncated block header');
        const header = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16);
        const last = header & 1;
        const type = (header >> 1) & 3;
        const size = header >>> 3;
        p += 3;
        if (type === 0 || type === 2) p += size; // raw / compressed block
        else if (type === 1) p += 1; // rle block
        else throw new Error('reserved block type');
        if (last) break;
      }
      if (checksum) p += 4;
      if (p > buf.length) throw new Error('truncated frame');
      ranges.push([off, p]);
      off = p;
    } catch {
      break; // 半帧 / 流结束
    }
  }
  return ranges;
}

/** 单文件压缩上限，超出的会话先跳过，避免一次读入过大文件。 */
const MAX_FILE_BYTES = 64 * 1024 * 1024;

/* ------------------------------------------------------------------ 读取 */

/** 列出所有会话文件，递归两层：sessions/<workspace>/<session>/session*。 */
async function listSessionFiles() {
  const out = [];
  let workspaces;
  try {
    workspaces = await fs.promises.readdir(SESSIONS_DIR, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const workspace of workspaces) {
    if (!workspace.isDirectory()) continue;
    const workspaceDir = path.join(SESSIONS_DIR, workspace.name);
    let sessions;
    try {
      sessions = await fs.promises.readdir(workspaceDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const session of sessions) {
      if (!session.isDirectory()) continue;
      const sessionDir = path.join(workspaceDir, session.name);
      let entries;
      try {
        entries = await fs.promises.readdir(sessionDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.startsWith('session')) continue;
        if (!entry.name.includes('.jsonl')) continue;
        out.push(path.join(sessionDir, entry.name));
      }
    }
  }
  return out;
}

/** 一条 assistant/message 的用量记录。 */
function usageOf(record) {
  const usage = record?.data?.usage;
  if (!usage) return null;
  const input = Number(usage.inputTokens) || 0;
  const output = Number(usage.outputTokens) || 0;
  const cacheRead = Number(usage.cacheReadTokens) || 0;
  const cacheWrite = Number(usage.cacheWriteTokens) || 0;
  const total = Number(usage.totalTokens) || input + output + cacheRead + cacheWrite;
  if (!input && !output && !cacheRead && !cacheWrite) return null;
  const source = record.data.message?.source;
  return {
    t: Number(record.time) || 0,
    input,
    output,
    cacheRead,
    cacheWrite,
    total,
    model: source?.model || null,
    provider: source?.provider || null,
  };
}

/** 从一段 JSONL 文本里挑出用量记录。 */
function eventsFromLines(lines, out) {
  for (const line of lines) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record?.type !== 'assistant/message') continue;
    const event = usageOf(record);
    if (event) out.push(event);
  }
}

/**
 * 解析一个会话文件，返回带用量的记录。
 *
 * 会话日志只会往后追加，所以这里按「帧数」增量解析：只解压上次之后新增的帧，
 * 对话过程中反复调用也不会每次重读整份文件。
 * @param {string} filePath - 会话日志路径。
 * @returns {Promise<Array<object>>} 用量记录。
 */
async function eventsOf(filePath) {
  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    fileCache.delete(filePath);
    return [];
  }
  const cached = fileCache.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.events;
  }
  if (stat.size > MAX_FILE_BYTES) {
    const events = cached ? cached.events : [];
    fileCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, events, frames: 0, carry: '' });
    return events;
  }

  const raw = await fs.promises.readFile(filePath);
  const isZstd = filePath.endsWith('.zstd');
  if (!isZstd) {
    const events = [];
    eventsFromLines(raw.toString('utf8').split('\n'), events);
    fileCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, events, frames: 0, carry: '' });
    return events;
  }

  const ranges = frameRanges(raw);
  // 文件被截断/重写时从头再来；正常追加时只解新帧。
  const from = cached && cached.frames <= ranges.length ? cached.frames : 0;
  const events = cached && from > 0 ? cached.events.slice() : [];
  let carry = cached && from > 0 ? cached.carry : '';

  for (let i = from; i < ranges.length; i += 1) {
    const [start, end] = ranges[i];
    let text;
    try {
      text = carry + zlib.zstdDecompressSync(raw.subarray(start, end)).toString('utf8');
    } catch {
      continue; // 单帧损坏就跳过，下一帧继续
    }
    const lines = text.split('\n');
    carry = lines.pop() ?? '';
    eventsFromLines(lines, events);
    // 最后一行可能恰好是完整记录（写日志方没补换行），能解析就收下。
    if (carry.trim()) {
      try {
        const record = JSON.parse(carry);
        if (record?.type === 'assistant/message') {
          const event = usageOf(record);
          if (event) events.push(event);
        }
        carry = '';
      } catch {
        /* 半行，等下一帧补全 */
      }
    }
  }

  fileCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, events, frames: ranges.length, carry });
  return events;
}

/* ------------------------------------------------------------------ 分桶 */

function pad2(value) {
  return String(value).padStart(2, '0');
}

function startOfDay(ts) {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function startOfWeek(ts) {
  const date = new Date(startOfDay(ts));
  const offset = (date.getDay() + 6) % 7; // 周一为一周起点
  date.setDate(date.getDate() - offset);
  return date.getTime();
}

function startOfMonth(ts) {
  const date = new Date(ts);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function dayKey(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function monthKey(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function shortLabel(ts) {
  const date = new Date(ts);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 生成窗口内连续的时间桶（含空桶），保证图表 x 轴连续。
 * @param {'day'|'week'|'month'} granularity - 粒度。
 * @param {number} now - 当前时间戳。
 * @returns {Array<object>} 桶列表。
 */
function emptyBuckets(granularity, now) {
  const buckets = [];
  if (granularity === 'day') {
    const start = new Date(startOfDay(now));
    start.setDate(start.getDate() - (DAY_COUNT - 1));
    for (let i = 0; i < DAY_COUNT; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const ts = date.getTime();
      buckets.push({ key: dayKey(ts), label: shortLabel(ts), start: ts, input: 0, output: 0, cacheRead: 0, total: 0, requests: 0 });
    }
  } else if (granularity === 'week') {
    const anchor = new Date(startOfWeek(now));
    for (let i = WEEK_COUNT - 1; i >= 0; i -= 1) {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() - i * 7);
      const ts = date.getTime();
      buckets.push({ key: dayKey(ts), label: shortLabel(ts), start: ts, input: 0, output: 0, cacheRead: 0, total: 0, requests: 0 });
    }
  } else {
    const anchor = new Date(startOfMonth(now));
    for (let i = MONTH_COUNT - 1; i >= 0; i -= 1) {
      const date = new Date(anchor);
      date.setMonth(anchor.getMonth() - i, 1);
      const ts = date.getTime();
      buckets.push({ key: monthKey(ts), label: `${date.getFullYear()}/${date.getMonth() + 1}`, start: ts, input: 0, output: 0, cacheRead: 0, total: 0, requests: 0 });
    }
  }
  return buckets;
}

function bucketKeyOf(granularity, ts) {
  if (granularity === 'day') return dayKey(ts);
  if (granularity === 'week') return dayKey(startOfWeek(ts));
  return monthKey(ts);
}

function aggregate(events, granularity, now) {
  const buckets = emptyBuckets(granularity, now);
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]));
  for (const event of events) {
    const i = index.get(bucketKeyOf(granularity, event.t));
    if (i === undefined) continue;
    const bucket = buckets[i];
    bucket.input += event.input;
    bucket.output += event.output;
    bucket.cacheRead += event.cacheRead;
    bucket.total += event.total;
    bucket.requests += 1;
  }
  return buckets;
}

/* ------------------------------------------------------------------ 对外 */

function emptyPayload(now) {
  return {
    ok: true,
    available: false,
    scannedAt: new Date(now).toISOString(),
    source: { dir: SESSIONS_DIR, sessions: 0, files: 0, records: 0, skipped: 0 },
    totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, requests: 0 },
    cacheHitRate: 0,
    lastEventAt: null,
    day: { granularity: 'day', buckets: emptyBuckets('day', now) },
    week: { granularity: 'week', buckets: emptyBuckets('week', now) },
    month: { granularity: 'month', buckets: emptyBuckets('month', now) },
  };
}

/**
 * 汇总本地会话日志里的 token 用量。
 * @param {number} [now] - 当前时间戳（测试用）。
 * @returns {Promise<object>} 用量快照：总计 + 天/周/月分桶。
 */
export async function getUsage(now = Date.now()) {
  if (aggregateCache.payload && now - aggregateCache.at < CACHE_TTL_MS) {
    return aggregateCache.payload;
  }

  const files = await listSessionFiles();
  const alive = new Set(files);
  for (const key of fileCache.keys()) {
    if (!alive.has(key)) fileCache.delete(key);
  }

  const events = [];
  let skipped = 0;
  let sessions = 0;
  const sessionDirs = new Set();
  for (const filePath of files) {
    try {
      const list = await eventsOf(filePath);
      for (const event of list) events.push(event);
      sessionDirs.add(path.dirname(filePath));
    } catch {
      skipped += 1;
    }
  }

  const payload = files.length ? { ...emptyPayload(now) } : emptyPayload(now);
  payload.available = events.length > 0;
  payload.source = {
    dir: SESSIONS_DIR,
    sessions: sessionDirs.size,
    files: files.length,
    records: events.length,
    skipped,
  };
  payload.totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, requests: events.length };
  let last = 0;
  for (const event of events) {
    payload.totals.input += event.input;
    payload.totals.output += event.output;
    payload.totals.cacheRead += event.cacheRead;
    payload.totals.cacheWrite += event.cacheWrite;
    payload.totals.total += event.total;
    if (event.t > last) last = event.t;
  }
  const billedInput = payload.totals.input + payload.totals.cacheRead;
  payload.cacheHitRate = billedInput > 0 ? Number((payload.totals.cacheRead / billedInput).toFixed(4)) : 0;
  payload.lastEventAt = last ? new Date(last).toISOString() : null;
  payload.day = { granularity: 'day', buckets: aggregate(events, 'day', now) };
  payload.week = { granularity: 'week', buckets: aggregate(events, 'week', now) };
  payload.month = { granularity: 'month', buckets: aggregate(events, 'month', now) };
  // sessions 字段在可用时给出会话数，避免前端拿不到线索
  payload.sessions = payload.source.sessions;

  aggregateCache = { at: now, payload };
  return payload;
}
