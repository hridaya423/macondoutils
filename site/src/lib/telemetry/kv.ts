import { promises as fs } from "node:fs";
import path from "node:path";

export interface ZSetMember {
  member: string;
  score: number;
}

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number; nx?: boolean }): Promise<boolean>;
  incr(key: string): Promise<number>;
  incrby(key: string, by: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  sismember(key: string, member: string): Promise<boolean>;
  scard(key: string): Promise<number>;
  zincrby(key: string, increment: number, member: string): Promise<number>;
  zrevrange(key: string, start: number, stop: number, withScores?: boolean): Promise<ZSetMember[]>;
  pfadd(key: string, ...elements: string[]): Promise<number>;
  pfcount(...keys: string[]): Promise<number>;
  del(...keys: string[]): Promise<number>;
}

class MemoryKV implements KV {
  private map = new Map<string, { value: string; expiresAt: number }>();
  private sets = new Map<string, { members: Set<string>; expiresAt: number }>();
  private hlls = new Map<string, { members: Set<string>; expiresAt: number }>();
  private zsets = new Map<string, Map<string, number>>();

  private nowMs() {
    return Date.now();
  }

  private isExpired(expiresAt: number) {
    return expiresAt > 0 && expiresAt <= this.nowMs();
  }

  private touchExpiry(target: { expiresAt: number }, ttlSec: number) {
    if (ttlSec > 0) target.expiresAt = this.nowMs() + ttlSec * 1000;
  }

  async get(key: string) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (this.isExpired(entry.expiresAt)) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
    const existing = this.map.get(key);
    if (opts?.nx && existing && !this.isExpired(existing.expiresAt)) {
      return false;
    }
    const entry = { value, expiresAt: 0 };
    this.touchExpiry(entry, opts?.ex ?? 0);
    this.map.set(key, entry);
    return true;
  }

  async incr(key: string) {
    return this.incrby(key, 1);
  }

  async incrby(key: string, by: number) {
    const existing = this.map.get(key);
    const base = existing && !this.isExpired(existing.expiresAt) ? Number(existing.value) : 0;
    const next = (Number.isFinite(base) ? base : 0) + by;
    this.map.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? 0 });
    return next;
  }

  async expire(key: string, seconds: number) {
    const entry = this.map.get(key);
    if (entry) entry.expiresAt = this.nowMs() + seconds * 1000;
    const set = this.sets.get(key);
    if (set) set.expiresAt = this.nowMs() + seconds * 1000;
    const hll = this.hlls.get(key);
    if (hll) hll.expiresAt = this.nowMs() + seconds * 1000;
  }

  async sadd(key: string, ...members: string[]) {
    const entry = this.sets.get(key) ?? { members: new Set<string>(), expiresAt: 0 };
    if (this.isExpired(entry.expiresAt)) entry.members.clear();
    let added = 0;
    for (const m of members) {
      if (!entry.members.has(m)) {
        entry.members.add(m);
        added += 1;
      }
    }
    this.sets.set(key, entry);
    return added;
  }

  async srem(key: string, ...members: string[]) {
    const entry = this.sets.get(key);
    if (!entry) return 0;
    let removed = 0;
    for (const m of members) {
      if (entry.members.delete(m)) removed += 1;
    }
    return removed;
  }

  async sismember(key: string, member: string) {
    const entry = this.sets.get(key);
    if (!entry || this.isExpired(entry.expiresAt)) return false;
    return entry.members.has(member);
  }

  async scard(key: string) {
    const entry = this.sets.get(key);
    if (!entry || this.isExpired(entry.expiresAt)) return 0;
    return entry.members.size;
  }

  async zincrby(key: string, increment: number, member: string) {
    let zset = this.zsets.get(key);
    if (!zset) {
      zset = new Map();
      this.zsets.set(key, zset);
    }
    const next = (zset.get(member) ?? 0) + increment;
    zset.set(member, next);
    return next;
  }

  async zrevrange(key: string, start: number, stop: number, withScores = false) {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const arr = Array.from(zset.entries())
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score);
    const end = stop === -1 ? arr.length : stop + 1;
    const slice = arr.slice(start, end);
    return withScores ? slice : slice.map((e) => ({ member: e.member, score: 0 }));
  }

  async pfadd(key: string, ...elements: string[]) {
    const entry = this.hlls.get(key) ?? { members: new Set<string>(), expiresAt: 0 };
    if (this.isExpired(entry.expiresAt)) entry.members.clear();
    let added = 0;
    for (const el of elements) {
      if (!entry.members.has(el)) {
        entry.members.add(el);
        added += 1;
      }
    }
    this.hlls.set(key, entry);
    return added;
  }

  async pfcount(...keys: string[]) {
    if (keys.length === 1) {
      const entry = this.hlls.get(keys[0]);
      if (!entry || this.isExpired(entry.expiresAt)) return 0;
      return entry.members.size;
    }
    const union = new Set<string>();
    for (const key of keys) {
      const entry = this.hlls.get(key);
      if (entry && !this.isExpired(entry.expiresAt)) {
        for (const m of entry.members) union.add(m);
      }
    }
    return union.size;
  }

  async del(...keys: string[]) {
    let removed = 0;
    for (const k of keys) {
      if (this.map.delete(k)) removed += 1;
      if (this.sets.delete(k)) removed += 1;
      if (this.hlls.delete(k)) removed += 1;
      if (this.zsets.delete(k)) removed += 1;
    }
    return removed;
  }
}

class FileKV implements KV {
  private map = new Map<string, { value: string; expiresAt: number }>();
  private sets = new Map<string, { members: Set<string>; expiresAt: number }>();
  private hlls = new Map<string, { members: Set<string>; expiresAt: number }>();
  private zsets = new Map<string, Map<string, number>>();
  private writeQueue: Promise<void> = Promise.resolve();
  private loaded = false;
  private writing = false;

  constructor(private filePath: string) {}

  private nowMs() {
    return Date.now();
  }

  private isExpired(expiresAt: number) {
    return expiresAt > 0 && expiresAt <= this.nowMs();
  }

  private touchExpiry(target: { expiresAt: number }, ttlSec: number) {
    if (ttlSec > 0) target.expiresAt = this.nowMs() + ttlSec * 1000;
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const data = JSON.parse(raw) as {
        map?: Record<string, { value: string; expiresAt: number }>;
        sets?: Record<string, { members: string[]; expiresAt: number }>;
        hlls?: Record<string, { members: string[]; expiresAt: number }>;
        zsets?: Record<string, Record<string, number>>;
      };
      if (data.map) {
        for (const [k, v] of Object.entries(data.map)) this.map.set(k, v);
      }
      if (data.sets) {
        for (const [k, v] of Object.entries(data.sets)) {
          this.sets.set(k, { members: new Set(v.members), expiresAt: v.expiresAt });
        }
      }
      if (data.hlls) {
        for (const [k, v] of Object.entries(data.hlls)) {
          this.hlls.set(k, { members: new Set(v.members), expiresAt: v.expiresAt });
        }
      }
      if (data.zsets) {
        for (const [k, v] of Object.entries(data.zsets)) {
          this.zsets.set(k, new Map(Object.entries(v)));
        }
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code !== "ENOENT") {
        console.warn(`[telemetry] FileKV: failed to read ${this.filePath}:`, err);
      }
    }
    this.loaded = true;
  }

  private scheduleWrite() {
    this.writeQueue = this.writeQueue.then(() => this.flush());
  }

  private async flush() {
    if (this.writing) return;
    this.writing = true;
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const data = {
        map: Object.fromEntries(this.map.entries()),
        sets: Object.fromEntries(
          Array.from(this.sets.entries()).map(([k, v]) => [k, { members: Array.from(v.members), expiresAt: v.expiresAt }]),
        ),
        hlls: Object.fromEntries(
          Array.from(this.hlls.entries()).map(([k, v]) => [k, { members: Array.from(v.members), expiresAt: v.expiresAt }]),
        ),
        zsets: Object.fromEntries(
          Array.from(this.zsets.entries()).map(([k, v]) => [k, Object.fromEntries(v.entries())]),
        ),
      };
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
      await fs.rename(tmp, this.filePath);
    } catch (err) {
      console.warn(`[telemetry] FileKV: failed to write ${this.filePath}:`, err);
    } finally {
      this.writing = false;
    }
  }

  async get(key: string) {
    await this.ensureLoaded();
    const entry = this.map.get(key);
    if (!entry) return null;
    if (this.isExpired(entry.expiresAt)) {
      this.map.delete(key);
      this.scheduleWrite();
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
    await this.ensureLoaded();
    const existing = this.map.get(key);
    if (opts?.nx && existing && !this.isExpired(existing.expiresAt)) {
      return false;
    }
    const entry = { value, expiresAt: 0 };
    this.touchExpiry(entry, opts?.ex ?? 0);
    this.map.set(key, entry);
    this.scheduleWrite();
    return true;
  }

  async incr(key: string) {
    return this.incrby(key, 1);
  }

  async incrby(key: string, by: number) {
    await this.ensureLoaded();
    const existing = this.map.get(key);
    const base = existing && !this.isExpired(existing.expiresAt) ? Number(existing.value) : 0;
    const next = (Number.isFinite(base) ? base : 0) + by;
    this.map.set(key, { value: String(next), expiresAt: existing?.expiresAt ?? 0 });
    this.scheduleWrite();
    return next;
  }

  async expire(key: string, seconds: number) {
    await this.ensureLoaded();
    let touched = false;
    const entry = this.map.get(key);
    if (entry) {
      entry.expiresAt = this.nowMs() + seconds * 1000;
      touched = true;
    }
    const set = this.sets.get(key);
    if (set) {
      set.expiresAt = this.nowMs() + seconds * 1000;
      touched = true;
    }
    const hll = this.hlls.get(key);
    if (hll) {
      hll.expiresAt = this.nowMs() + seconds * 1000;
      touched = true;
    }
    if (touched) this.scheduleWrite();
  }

  async sadd(key: string, ...members: string[]) {
    await this.ensureLoaded();
    const entry = this.sets.get(key) ?? { members: new Set<string>(), expiresAt: 0 };
    if (this.isExpired(entry.expiresAt)) entry.members.clear();
    let added = 0;
    for (const m of members) {
      if (!entry.members.has(m)) {
        entry.members.add(m);
        added += 1;
      }
    }
    this.sets.set(key, entry);
    if (added > 0) this.scheduleWrite();
    return added;
  }

  async srem(key: string, ...members: string[]) {
    await this.ensureLoaded();
    const entry = this.sets.get(key);
    if (!entry) return 0;
    let removed = 0;
    for (const m of members) {
      if (entry.members.delete(m)) removed += 1;
    }
    if (removed > 0) this.scheduleWrite();
    return removed;
  }

  async sismember(key: string, member: string) {
    await this.ensureLoaded();
    const entry = this.sets.get(key);
    if (!entry || this.isExpired(entry.expiresAt)) return false;
    return entry.members.has(member);
  }

  async scard(key: string) {
    await this.ensureLoaded();
    const entry = this.sets.get(key);
    if (!entry || this.isExpired(entry.expiresAt)) return 0;
    return entry.members.size;
  }

  async zincrby(key: string, increment: number, member: string) {
    await this.ensureLoaded();
    let zset = this.zsets.get(key);
    if (!zset) {
      zset = new Map();
      this.zsets.set(key, zset);
    }
    const next = (zset.get(member) ?? 0) + increment;
    zset.set(member, next);
    this.scheduleWrite();
    return next;
  }

  async zrevrange(key: string, start: number, stop: number, withScores = false) {
    await this.ensureLoaded();
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const arr = Array.from(zset.entries())
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => b.score - a.score);
    const end = stop === -1 ? arr.length : stop + 1;
    const slice = arr.slice(start, end);
    return withScores ? slice : slice.map((e) => ({ member: e.member, score: 0 }));
  }

  async pfadd(key: string, ...elements: string[]) {
    await this.ensureLoaded();
    const entry = this.hlls.get(key) ?? { members: new Set<string>(), expiresAt: 0 };
    if (this.isExpired(entry.expiresAt)) entry.members.clear();
    let added = 0;
    for (const el of elements) {
      if (!entry.members.has(el)) {
        entry.members.add(el);
        added += 1;
      }
    }
    this.hlls.set(key, entry);
    if (added > 0) this.scheduleWrite();
    return added;
  }

  async pfcount(...keys: string[]) {
    await this.ensureLoaded();
    if (keys.length === 1) {
      const entry = this.hlls.get(keys[0]);
      if (!entry || this.isExpired(entry.expiresAt)) return 0;
      return entry.members.size;
    }
    const union = new Set<string>();
    for (const key of keys) {
      const entry = this.hlls.get(key);
      if (entry && !this.isExpired(entry.expiresAt)) {
        for (const m of entry.members) union.add(m);
      }
    }
    return union.size;
  }

  async del(...keys: string[]) {
    await this.ensureLoaded();
    let removed = 0;
    for (const k of keys) {
      if (this.map.delete(k)) removed += 1;
      if (this.sets.delete(k)) removed += 1;
      if (this.hlls.delete(k)) removed += 1;
      if (this.zsets.delete(k)) removed += 1;
    }
    if (removed > 0) this.scheduleWrite();
    return removed;
  }

  getFilePath() {
    return this.filePath;
  }
}

class UpstashRestKV implements KV {
  constructor(private url: string, private token: string) {}

  private async call<T = unknown>(command: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Upstash ${command[0]} failed: ${res.status}`);
    }
    const data = (await res.json()) as { result: T | null };
    if (data.result === null || data.result === undefined) {
      return null as unknown as T;
    }
    return data.result;
  }

  async get(key: string) {
    const r = await this.call<string | null>(["GET", key]);
    return r ?? null;
  }

  async set(key: string, value: string, opts?: { ex?: number; nx?: boolean }) {
    if (opts?.ex && opts.nx) {
      const r = await this.call<unknown>(["SET", key, value, "EX", opts.ex, "NX"]);
      return r === "OK" || r === 1 || r === "ok" || r === true;
    }
    if (opts?.ex) {
      await this.call(["SET", key, value, "EX", opts.ex]);
      return true;
    }
    await this.call(["SET", key, value]);
    return true;
  }

  async incr(key: string) {
    const r = await this.call<number>(["INCR", key]);
    return Number(r);
  }

  async incrby(key: string, by: number) {
    const r = await this.call<number>(["INCRBY", key, by]);
    return Number(r);
  }

  async expire(key: string, seconds: number) {
    await this.call(["EXPIRE", key, seconds]);
  }

  async sadd(key: string, ...members: string[]) {
    const r = await this.call<number>(["SADD", key, ...members]);
    return Number(r);
  }

  async srem(key: string, ...members: string[]) {
    const r = await this.call<number>(["SREM", key, ...members]);
    return Number(r);
  }

  async sismember(key: string, member: string) {
    const r = await this.call<number>(["SISMEMBER", key, member]);
    return Number(r) === 1;
  }

  async scard(key: string) {
    const r = await this.call<number>(["SCARD", key]);
    return Number(r);
  }

  async zincrby(key: string, increment: number, member: string) {
    const r = await this.call<number | string>(["ZINCRBY", key, increment, member]);
    return Number(r);
  }

  async zrevrange(key: string, start: number, stop: number, withScores = false) {
    const cmd = withScores
      ? ["ZREVRANGE", key, start, stop, "WITHSCORES"]
      : ["ZREVRANGE", key, start, stop];
    const r = await this.call<string[]>(cmd);
    if (!Array.isArray(r)) return [];
    if (!withScores) return r.map((member) => ({ member, score: 0 }));
    const out: ZSetMember[] = [];
    for (let i = 0; i < r.length; i += 2) {
      out.push({ member: r[i], score: Number(r[i + 1]) });
    }
    return out;
  }

  async pfadd(key: string, ...elements: string[]) {
    const r = await this.call<number>(["PFADD", key, ...elements]);
    return Number(r);
  }

  async pfcount(...keys: string[]) {
    const r = await this.call<number>(["PFCOUNT", ...keys]);
    return Number(r);
  }

  async del(...keys: string[]) {
    const r = await this.call<number>(["DEL", ...keys]);
    return Number(r);
  }
}

let cached: KV | null = null;

function resolveFileKVPath(): string | null {
  const configured = process.env.TELEMETRY_LOCAL_FILE;
  if (configured !== undefined) {
    if (configured.trim().length === 0) {
      return null;
    }
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.resolve(process.cwd(), ".telemetry", "local.json");
}

export function getKV(): KV {
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    cached = new UpstashRestKV(url, token);
  } else if (process.env.NODE_ENV !== "production") {
    const filePath = resolveFileKVPath();
    if (filePath) {
      cached = new FileKV(filePath);
      console.info(`[telemetry] Using local file store: ${filePath}`);
    } else {
      cached = new MemoryKV();
    }
  } else {
    console.warn("[telemetry] KV_REST_API_URL/TOKEN missing; using in-memory store");
    cached = new MemoryKV();
  }
  return cached;
}

export function isKVConfigured(): boolean {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) return true;
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return false;
}
