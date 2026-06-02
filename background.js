"use strict";

const BG_PREFIX = "[Macondo Utils BG]";
const HARVEST_TIMEOUT_MS = 30000;
const HARVEST_RESULT_TTL_MS = 45000;

const TELEMETRY_DEFAULT_BASE_URL = "https://macondoutils.hridya.tech";
const TELEMETRY_ALLOWED_BASE_URLS = Object.freeze([
  "https://macondoutils.hridya.tech",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);
const ATTEST_PATH = "/api/telemetry/attest";
const EVENTS_PATH = "/api/telemetry/events";
const TELEMETRY_TIMEOUT_MS = 12000;

let harvestRunInFlight = null;
let lastHarvestMetrics = [];
let lastHarvestAt = 0;
const lastAttestByInstall = new Map();
const ATTEST_CACHE_MS = 5 * 60 * 1000;

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for tab to load"));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sendHarvestMessage(tabId) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function attempt() {
      chrome.tabs.sendMessage(tabId, { type: "macondo-utils-harvest" }, (response) => {
        if (chrome.runtime.lastError) {
          if (Date.now() - startedAt > HARVEST_TIMEOUT_MS) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          setTimeout(attempt, 300);
          return;
        }
        resolve(response);
      });
    }

    attempt();
  });
}

async function runHiddenHarvest() {
  const harvestUrl = "https://macondo.hackclub.com/dashboard?macondo_utils_harvest=1";
  const tab = await chrome.tabs.create({
    url: harvestUrl,
    active: false,
    pinned: true,
    index: 0
  });
  if (!tab.id) {
    throw new Error("Failed to create harvest tab");
  }

  try {
    await waitForTabComplete(tab.id);
    const response = await sendHarvestMessage(tab.id);
    return response && Array.isArray(response.metrics) ? response.metrics : [];
  } finally {
    chrome.tabs.remove(tab.id);
  }
}

async function runHiddenHarvestSingleFlight() {
  const now = Date.now();
  if (lastHarvestMetrics.length && now - lastHarvestAt < HARVEST_RESULT_TTL_MS) {
    return lastHarvestMetrics;
  }

  if (harvestRunInFlight) {
    return harvestRunInFlight;
  }

  harvestRunInFlight = (async () => {
    const metrics = await runHiddenHarvest();
    lastHarvestMetrics = Array.isArray(metrics) ? metrics : [];
    lastHarvestAt = Date.now();
    return lastHarvestMetrics;
  })();

  try {
    return await harvestRunInFlight;
  } finally {
    harvestRunInFlight = null;
  }
}

async function postJson(url, body, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-MacondoUtils-Client": "1",
        ...headers,
      },
      body: JSON.stringify(body),
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function resolveTelemetryBaseUrl(requested) {
  if (typeof requested === "string" && TELEMETRY_ALLOWED_BASE_URLS.includes(requested)) {
    return requested;
  }
  return TELEMETRY_DEFAULT_BASE_URL;
}

function attestUrlFor(baseUrl) {
  return `${baseUrl}${ATTEST_PATH}`;
}

function eventsUrlFor(baseUrl) {
  return `${baseUrl}${EVENTS_PATH}`;
}

async function handleAttest(message) {
  if (!message || typeof message.installId !== "string" || !message.installId) {
    return { ok: false, code: "bad_request" };
  }
  const baseUrl = resolveTelemetryBaseUrl(message.baseUrl);
  const cacheKey = `${baseUrl}::${message.installId}`;
  const cached = lastAttestByInstall.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60 * 1000) {
    return { ok: true, token: cached.token, baseUrl, expiresInSeconds: Math.max(0, Math.floor((cached.expiresAt - Date.now()) / 1000)) };
  }
  const result = await postJson(attestUrlFor(baseUrl), {
    install_id: message.installId,
  });
  if (!result.ok || !result.data?.ok) {
    return {
      ok: false,
      code: result.data?.code || "attest_failed",
      baseUrl,
      status: result.status,
    };
  }
  const token = String(result.data.token || "");
  const expiresInSeconds = Number(result.data.expiresInSeconds) || 0;
  if (token && expiresInSeconds > 0) {
    lastAttestByInstall.set(cacheKey, {
      token,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });
    if (lastAttestByInstall.size > 512) {
      const cutoff = Date.now();
      for (const [key, value] of lastAttestByInstall.entries()) {
        if (value.expiresAt < cutoff) lastAttestByInstall.delete(key);
      }
    }
  }
  return { ok: true, token, baseUrl, expiresInSeconds };
}

async function handleEvents(message) {
  if (!message || typeof message.token !== "string" || !message.token) {
    return { ok: false, code: "bad_request" };
  }
  if (!Array.isArray(message.events) || message.events.length === 0) {
    return { ok: false, code: "bad_request" };
  }
  if (typeof message.installId !== "string" || !message.installId) {
    return { ok: false, code: "bad_request" };
  }
  const baseUrl = resolveTelemetryBaseUrl(message.baseUrl);
  const result = await postJson(
    eventsUrlFor(baseUrl),
    {
      install_id: message.installId,
      seq: Number(message.seq) || 1,
      categories: Array.isArray(message.categories) ? message.categories : [],
      events: message.events,
      browser: typeof message.browser === "string" ? message.browser : "other",
    },
    { Authorization: `Bearer ${message.token}` },
  );
  if (!result.ok) {
    return {
      ok: false,
      code: result.data?.code || "ingest_failed",
      baseUrl,
      status: result.status,
    };
  }
  return {
    ok: true,
    baseUrl,
    accepted: result.data?.accepted,
    rejected: result.data?.rejected,
    dedup: result.data?.dedup,
    lastSeq: result.data?.lastSeq,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "macondo-utils-run-hidden-harvest") {
    (async () => {
      try {
        const metrics = await runHiddenHarvestSingleFlight();
        sendResponse({ ok: true, metrics });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    })();
    return true;
  }

  if (message.type === "muTelemetryAttest") {
    handleAttest(message).then(sendResponse);
    return true;
  }

  if (message.type === "muTelemetryEvents") {
    handleEvents(message).then(sendResponse);
    return true;
  }
});
