"use strict";

(function initMacondoUtilsTelemetry(global) {
  if (global.muTelemetry) {
    return;
  }

  const STORAGE_KEYS = {
    installId: "muTelemetryInstallId",
    token: "muTelemetryToken",
    tokenExpiresAt: "muTelemetryTokenExpiresAt",
    baseUrl: "muTelemetryBaseUrl",
    prefs: "muTelemetryPrefs",
    seq: "muTelemetrySeq",
    queue: "muTelemetryQueue",
  };

  const DEFAULT_PREFS = Object.freeze({
    enabled: false,
    activity: false,
    goals: false,
    shop: false,
    projects: false,
    theme: false,
    errors: false,
  });

  const EVENT_CATEGORIES = Object.freeze({
    session_start: ["activity"],
    goal_added: ["goals"],
    goal_removed: ["goals"],
    goal_qty_changed: ["goals"],
    shop_card_interact: ["shop"],
    project_metrics_snapshot: ["projects"],
    theme_preset_changed: ["theme"],
    error_reported: ["errors"],
    onboarding_completed: ["activity"],
  });

  const MAX_QUEUE = 200;
  const MAX_BATCH = 25;
  const FLUSH_INTERVAL_MS = 60_000;
  const ASSUME_TOKEN_EXPIRY_BUFFER_MS = 24 * 60 * 60 * 1000;

  const listeners = new Set();
  let pendingFlushTimer = null;
  let seq = 0;
  let cachedPrefs = { ...DEFAULT_PREFS };
  let cachedToken = "";
  let cachedTokenExpiresAt = 0;
  let cachedBaseUrl = "";
  let cachedInstallId = "";
  let flushInFlight = false;
  let flushScheduled = false;

  function generateUuidV4() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    if (global.crypto && typeof global.crypto.getRandomValues === "function") {
      global.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  function resolveBaseUrl() {
    const candidates = [
      global.__MU_TELEMETRY_BASE_URL__,
      global.window?.__MU_TELEMETRY_BASE_URL__,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate) {
        return candidate.replace(/\/+$/, "");
      }
    }
    return "https://macondoutils.hridya.tech";
  }

  function detectBrowser() {
    const ua = (global.navigator?.userAgent || "").toLowerCase();
    if (!ua) return "other";
    if (ua.includes("firefox/") || ua.includes("firefox ")) return "firefox";
    if (ua.includes("edg/") || ua.includes("edga/") || ua.includes("edgios/")) return "edge";
    if (ua.includes(" opr/") || ua.includes("opera/")) return "opera";
    if (ua.includes("arc/")) return "arc";
    if (ua.includes("brave/")) return "brave";
    if (ua.includes("chrome/") || ua.includes("chromium/")) return "chrome";
    if (ua.includes("safari/")) return "safari";
    return "other";
  }

  function eventCategoriesFromBatch(events) {
    const categories = new Set();
    for (const event of Array.isArray(events) ? events : []) {
      const mapped = EVENT_CATEGORIES[event?.type];
      if (Array.isArray(mapped)) {
        for (const category of mapped) {
          categories.add(category);
        }
      }
    }
    return Array.from(categories);
  }

  function trimToMax(value, max) {
    return String(value || "").trim().slice(0, max);
  }

  function clampInt(value, min, max) {
    const num = Math.round(Number(value) || 0);
    return Math.max(min, Math.min(max, num));
  }

  function clampNumber(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return min;
    }
    return Math.max(min, Math.min(max, num));
  }

  function sanitizeBrowser(browser) {
    return ["chrome", "firefox", "edge", "safari", "opera", "arc", "brave", "other"].includes(browser)
      ? browser
      : "other";
  }

  function sanitizeProjectSnapshot(event) {
    const projectCount = clampInt(event.project_count, 0, 10000);
    const medianLevel = clampNumber(event.median_level, 0, 4);
    const medianStreakDays = clampNumber(event.median_streak_days, 0, 100000);
    const levelCountsMap = new Map();
    const streakCountsMap = new Map();
    for (const entry of Array.isArray(event.level_counts) ? event.level_counts : []) {
      const level = clampInt(entry?.level, 1, 4);
      const count = clampInt(entry?.count, 0, 10000);
      if (count > 0) {
        levelCountsMap.set(level, (levelCountsMap.get(level) || 0) + count);
      }
    }
    for (const entry of Array.isArray(event.streak_counts) ? event.streak_counts : []) {
      const streakDays = clampInt(entry?.streak_days, 0, 100000);
      const count = clampInt(entry?.count, 0, 10000);
      if (count > 0) {
        streakCountsMap.set(streakDays, (streakCountsMap.get(streakDays) || 0) + count);
      }
    }
    const levelCounts = Array.from(levelCountsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, 4)
      .map(([level, count]) => ({ level, count }));
    const streakCounts = Array.from(streakCountsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, 500)
      .map(([streak_days, count]) => ({ streak_days, count }));
    if (!levelCounts.length && !streakCounts.length) {
      return null;
    }
    return {
      type: "project_metrics_snapshot",
      project_count: projectCount,
      median_level: medianLevel,
      median_streak_days: medianStreakDays,
      level_counts: levelCounts,
      streak_counts: streakCounts,
    };
  }

  function sanitizeEvent(event) {
    if (!event || typeof event !== "object" || typeof event.type !== "string") {
      return null;
    }
    switch (event.type) {
      case "session_start": {
        const path = trimToMax(event.path, 120);
        return path ? { type: event.type, path } : null;
      }
      case "goal_added":
      case "goal_removed": {
        const goalId = trimToMax(event.goal_id, 120);
        const name = trimToMax(event.name, 200);
        return goalId && name ? { type: event.type, goal_id: goalId, name } : null;
      }
      case "goal_qty_changed": {
        const goalId = trimToMax(event.goal_id, 120);
        const name = trimToMax(event.name, 200);
        if (!goalId || !name) return null;
        return {
          type: event.type,
          goal_id: goalId,
          name,
          quantity: clampInt(event.quantity, 0, 9999),
        };
      }
      case "shop_card_interact": {
        const itemId = trimToMax(event.item_id, 120);
        const name = trimToMax(event.name, 200);
        if (!itemId || !name) return null;
        return {
          type: event.type,
          item_id: itemId,
          name,
          gold: clampInt(event.gold, 0, 1000000000),
        };
      }
      case "project_metrics_snapshot":
        return sanitizeProjectSnapshot(event);
      case "theme_preset_changed":
        return event.preset === "default" || event.preset === "dark"
          ? { type: event.type, preset: event.preset }
          : null;
      case "onboarding_completed": {
        const flowVersion = trimToMax(event.flow_version, 40);
        return flowVersion ? { type: event.type, flow_version: flowVersion } : null;
      }
      case "error_reported": {
        const kind = trimToMax(event.kind, 80);
        const message = trimToMax(event.message, 500);
        return kind && message ? { type: event.type, kind, message } : null;
      }
      default:
        return null;
    }
  }

  function normalizeQueuedEvent(entry) {
    if (!entry || typeof entry !== "object" || typeof entry.type !== "string") {
      return null;
    }
    if (entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)) {
      return { type: entry.type, ...entry.payload };
    }
    const normalized = { ...entry };
    delete normalized.ts;
    delete normalized.payload;
    return normalized;
  }

  function getStorage() {
    if (global.chrome?.storage?.local) return global.chrome.storage.local;
    if (typeof global.browser !== "undefined" && global.browser?.storage?.local) {
      return global.browser.storage.local;
    }
    return null;
  }

  function storageGet(key) {
    return new Promise((resolve) => {
      const storage = getStorage();
      if (!storage) {
        try {
          const raw = global.localStorage?.getItem(key);
          resolve(raw ? JSON.parse(raw) : undefined);
        } catch {
          resolve(undefined);
        }
        return;
      }
      try {
        storage.get(key, (data) => {
          if (global.chrome?.runtime?.lastError) {
            resolve(undefined);
            return;
          }
          resolve(data ? data[key] : undefined);
        });
      } catch {
        resolve(undefined);
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      const storage = getStorage();
      if (!storage) {
        try {
          global.localStorage?.setItem(key, JSON.stringify(value));
        } catch {
        }
        resolve();
        return;
      }
      try {
        storage.set({ [key]: value }, () => {
          if (global.chrome?.runtime?.lastError) {
          }
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }

  async function loadPrefs() {
    const stored = await storageGet(STORAGE_KEYS.prefs);
    if (stored && typeof stored === "object") {
      cachedPrefs = { ...DEFAULT_PREFS, ...stored };
    } else {
      cachedPrefs = { ...DEFAULT_PREFS };
    }
    return cachedPrefs;
  }

  async function loadToken() {
    const [token, expiresAt, storedSeq, installId, storedBaseUrl] = await Promise.all([
      storageGet(STORAGE_KEYS.token),
      storageGet(STORAGE_KEYS.tokenExpiresAt),
      storageGet(STORAGE_KEYS.seq),
      storageGet(STORAGE_KEYS.installId),
      storageGet(STORAGE_KEYS.baseUrl),
    ]);
    cachedToken = typeof token === "string" ? token : "";
    cachedTokenExpiresAt = typeof expiresAt === "number" ? expiresAt : 0;
    seq = typeof storedSeq === "number" && storedSeq > 0 ? storedSeq : 0;
    cachedInstallId = typeof installId === "string" && installId ? installId : "";
    cachedBaseUrl = typeof storedBaseUrl === "string" ? storedBaseUrl : "";
  }

  async function ensureInstallId() {
    if (cachedInstallId) return cachedInstallId;
    const stored = await storageGet(STORAGE_KEYS.installId);
    if (typeof stored === "string" && stored) {
      cachedInstallId = stored;
    } else {
      cachedInstallId = generateUuidV4();
      await storageSet(STORAGE_KEYS.installId, cachedInstallId);
    }
    return cachedInstallId;
  }

  function notifyPrefsChanged() {
    for (const listener of listeners) {
      try {
        listener({ prefs: cachedPrefs });
      } catch {
      }
    }
  }

  function isCategoryEnabled(category) {
    if (!cachedPrefs.enabled) return false;
    return cachedPrefs[category] === true;
  }

  function eventAllowedByPrefs(eventType) {
    if (!cachedPrefs.enabled) return false;
    const cats = EVENT_CATEGORIES[eventType];
    if (!cats) return false;
    return cats.some((c) => cachedPrefs[c] === true);
  }

  async function requestAttestation() {
    const installId = await ensureInstallId();
    const baseUrl = resolveBaseUrl();
    const response = await sendMessageToBackground({
      type: "muTelemetryAttest",
      installId,
      baseUrl,
    });
    if (!response?.ok) {
      return false;
    }
    cachedToken = response.token;
    cachedTokenExpiresAt = Date.now() + (response.expiresInSeconds || 0) * 1000;
    cachedBaseUrl = response.baseUrl || baseUrl;
    await storageSet(STORAGE_KEYS.token, cachedToken);
    await storageSet(STORAGE_KEYS.tokenExpiresAt, cachedTokenExpiresAt);
    await storageSet(STORAGE_KEYS.baseUrl, cachedBaseUrl);
    return true;
  }

  function isTokenValid() {
    if (!cachedToken) return false;
    if (!cachedTokenExpiresAt) return true;
    return cachedTokenExpiresAt - Date.now() > ASSUME_TOKEN_EXPIRY_BUFFER_MS;
  }

  async function readQueue() {
    const raw = await storageGet(STORAGE_KEYS.queue);
    if (!Array.isArray(raw)) return [];
    return raw.slice(0, MAX_QUEUE);
  }

  async function writeQueue(queue) {
    await storageSet(STORAGE_KEYS.queue, queue.slice(0, MAX_QUEUE));
  }

  async function ensureAttestation() {
    if (isTokenValid()) return true;
    return requestAttestation();
  }

  function sendMessageToBackground(message) {
    return new Promise((resolve) => {
      const sender = (global.chrome && global.chrome.runtime && global.chrome.runtime.sendMessage)
        || (typeof global.browser !== "undefined" && global.browser?.runtime?.sendMessage);
      if (!sender) {
        resolve({ ok: false, code: "no_runtime" });
        return;
      }
      try {
        sender(message, (response) => {
          if (global.chrome?.runtime?.lastError) {
            resolve({ ok: false, code: "runtime_error" });
            return;
          }
          resolve(response);
        });
      } catch {
        resolve({ ok: false, code: "runtime_error" });
      }
    });
  }

  async function flush() {
    if (flushInFlight) {
      flushScheduled = true;
      return;
    }
    if (!cachedPrefs.enabled) {
      await writeQueue([]);
      return;
    }
    flushInFlight = true;
    try {
      const queue = await readQueue();
      if (queue.length === 0) {
        return;
      }
      const att = await ensureAttestation();
      if (!att) {
        return;
      }
      const queuedBatch = queue.slice(0, MAX_BATCH);
      const batch = queuedBatch.map(normalizeQueuedEvent).map(sanitizeEvent).filter(Boolean);
      if (batch.length === 0) {
        await writeQueue(queue.slice(queuedBatch.length));
        return;
      }
      const batchCategories = eventCategoriesFromBatch(batch);
      seq += 1;
      const response = await sendMessageToBackground({
        type: "muTelemetryEvents",
        installId: await ensureInstallId(),
        token: cachedToken,
        seq,
        categories: batchCategories,
        events: batch,
        browser: sanitizeBrowser(detectBrowser()),
        baseUrl: resolveBaseUrl(),
      });
      if (response?.ok) {
        if (response.baseUrl) {
          cachedBaseUrl = response.baseUrl;
          await storageSet(STORAGE_KEYS.baseUrl, cachedBaseUrl);
        }
        await storageSet(STORAGE_KEYS.seq, seq);
        const remaining = queue.slice(queuedBatch.length);
        await writeQueue(remaining);
      } else if (response?.code === "invalid_token" || response?.code === "install_mismatch") {
        cachedToken = "";
        cachedTokenExpiresAt = 0;
        await storageSet(STORAGE_KEYS.token, "");
        await storageSet(STORAGE_KEYS.tokenExpiresAt, 0);
      } else if (response?.code === "out_of_order") {
        if (typeof response.lastSeq === "number" && response.lastSeq >= seq) {
          seq = response.lastSeq;
          await storageSet(STORAGE_KEYS.seq, seq);
        }
      }
    } finally {
      flushInFlight = false;
      if (flushScheduled) {
        flushScheduled = false;
        scheduleFlush();
      }
    }
  }

  function scheduleFlush(delay = 0) {
    if (pendingFlushTimer) {
      clearTimeout(pendingFlushTimer);
      pendingFlushTimer = null;
    }
    pendingFlushTimer = setTimeout(() => {
      pendingFlushTimer = null;
      flush().catch(() => {
      });
    }, delay);
  }

  async function enqueue(eventType, payload) {
    if (!eventType || typeof eventType !== "string") return false;
    if (!EVENT_CATEGORIES[eventType]) return false;
    if (!eventAllowedByPrefs(eventType)) return false;
    const queue = await readQueue();
    const safePayload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    queue.push({ ...safePayload, type: eventType, ts: Date.now() });
    if (queue.length > MAX_QUEUE) {
      queue.splice(0, queue.length - MAX_QUEUE);
    }
    await writeQueue(queue);
    scheduleFlush(1500);
    return true;
  }

  function start() {
    if (pendingFlushTimer) return;
    pendingFlushTimer = setInterval(() => {
      flush().catch(() => {
      });
    }, FLUSH_INTERVAL_MS);
  }

  function stop() {
    if (pendingFlushTimer) {
      clearInterval(pendingFlushTimer);
      pendingFlushTimer = null;
    }
  }

  function getPrefs() {
    return { ...cachedPrefs };
  }

  async function setPrefs(nextPrefs) {
    const merged = { ...DEFAULT_PREFS, ...(nextPrefs || {}) };
    cachedPrefs = merged;
    await storageSet(STORAGE_KEYS.prefs, merged);
    notifyPrefsChanged();
    if (!merged.enabled) {
      await writeQueue([]);
    } else {
      ensureAttestation().catch(() => {
      });
    }
    return { ...merged };
  }

  async function reset() {
    cachedToken = "";
    cachedTokenExpiresAt = 0;
    cachedBaseUrl = "";
    cachedInstallId = "";
    seq = 0;
    cachedPrefs = { ...DEFAULT_PREFS };
    await Promise.all([
      storageSet(STORAGE_KEYS.token, ""),
      storageSet(STORAGE_KEYS.tokenExpiresAt, 0),
      storageSet(STORAGE_KEYS.seq, 0),
      storageSet(STORAGE_KEYS.baseUrl, ""),
      storageSet(STORAGE_KEYS.installId, ""),
      storageSet(STORAGE_KEYS.queue, []),
      storageSet(STORAGE_KEYS.prefs, { ...DEFAULT_PREFS }),
    ]);
    notifyPrefsChanged();
  }

  function onChange(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const api = {
    enqueue,
    flush,
    getPrefs,
    setPrefs,
    reset,
    onChange,
    start,
    stop,
    isTokenValid,
    ensureInstallId,
    getBaseUrl: () => resolveBaseUrl(),
    EVENT_CATEGORIES,
    DEFAULT_PREFS,
  };

  global.muTelemetry = api;

  loadPrefs()
    .then(loadToken)
    .then(ensureInstallId)
    .then(() => {
      if (cachedPrefs.enabled) {
        ensureAttestation().catch(() => {
        });
        start();
      }
    })
    .catch(() => {
    });
})(typeof window !== "undefined" ? window : globalThis);
