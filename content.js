(() => {
  "use strict";

  if (window.__macondoUtilsLoaded) {
    return;
  }
  window.__macondoUtilsLoaded = true;

  const PROJECT_HOURLY_RATE = {
    1: 40,
    2: 45,
    3: 50,
    4: 60
  };

  const SHOP_CARD_SELECTOR = "[data-flip-id]";
  const PROJECT_CACHE_KEY = "macondo_utils_project_rates_v1";
  const PROJECT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const PROJECT_FETCH_LIMIT = 80;
  let effectiveGoldPerHour = null;
  let refreshInFlight = false;
  let pendingRender = false;
  let harvestInFlight = false;
  let refreshRetryTimer = null;
  const DEBUG_PREFIX = "[Macondo Utils]";
  const IS_HARVEST_TAB = new URLSearchParams(window.location.search).has("macondo_utils_harvest");
  const ALLOW_VISIBLE_FALLBACK_HARVEST = false;

  function parseFloatSafe(text) {
    const n = Number.parseFloat(String(text).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function parseLevelFromText(text) {
    const match = String(text).match(/Level\s+([1-4])/i);
    return match ? Number.parseInt(match[1], 10) : null;
  }

  function parseLevelFromProjectModal() {
    const levelButton = Array.from(document.querySelectorAll("button")).find(
      (button) => /Level\s+[1-4]\s*[.|-]/i.test(button.textContent || "")
    );

    if (!levelButton) {
      return null;
    }

    return parseLevelFromText(levelButton.textContent || "");
  }

  function parseMultiplierFromText(text) {
    const match = String(text).match(/(\d+(?:\.\d+)?)\s*[xX]/);
    const value = match ? Number.parseFloat(match[1]) : null;
    return value && value > 0 ? value : 1;
  }

  function parseMultiplierFromProjectModal() {
    const node = Array.from(document.querySelectorAll("span, p, div")).find(
      (el) => /\d+(?:\.\d+)?\s*[xX×]\s*ship bonus/i.test(el.textContent || "")
    );

    if (!node) {
      return 1;
    }

    return parseMultiplierFromText((node.textContent || "").replace("×", "x"));
  }

  function getCurrentGoldPerHourFromModal() {
    const level = parseLevelFromProjectModal();
    if (!level || !PROJECT_HOURLY_RATE[level]) {
      return null;
    }

    const multiplier = parseMultiplierFromProjectModal();
    return PROJECT_HOURLY_RATE[level] * multiplier;
  }

  function findProjectIdsInHtml(html) {
    const ids = new Set();
    const regex = /\/projects\/(\d+)/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      ids.add(match[1]);
    }
    return ids;
  }

  function getKnownProjectIds() {
    const ids = new Set();
    findProjectIdsInHtml(document.documentElement.innerHTML).forEach((id) => ids.add(id));

    const fromStorage = localStorage.getItem(PROJECT_CACHE_KEY);
    if (fromStorage) {
      try {
        const parsed = JSON.parse(fromStorage);
        if (Array.isArray(parsed.projectIds)) {
          parsed.projectIds.forEach((id) => ids.add(String(id)));
        }
      } catch (_err) {}
    }
    const collected = Array.from(ids).slice(0, PROJECT_FETCH_LIMIT);
    return collected;
  }

  function parseProjectMetricsFromHtml(html) {
    const level = parseLevelFromText(html);
    if (!level || !PROJECT_HOURLY_RATE[level]) {
      return null;
    }

    const multiplierMatch = html.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*ship bonus/i);
    const multiplier = multiplierMatch ? parseMultiplierFromText(multiplierMatch[0].replace("×", "x")) : 1;

    let hours = 0;
    const comboHoursMatch = html.match(/(\d+(?:\.\d+)?)h\s*Hackatime\s*\+\s*(\d+(?:\.\d+)?)h\s*journals/i);
    if (comboHoursMatch) {
      hours = Number.parseFloat(comboHoursMatch[1]) + Number.parseFloat(comboHoursMatch[2]);
    } else {
      const plainMatch = html.match(/(\d+(?:\.\d+)?)h\s*logged/i);
      if (plainMatch) {
        hours = Number.parseFloat(plainMatch[1]);
      }
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      return null;
    }

    return {
      hours,
      goldPerHour: PROJECT_HOURLY_RATE[level] * multiplier,
      level,
      multiplier
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(getValue, timeoutMs = 2500, stepMs = 100) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const value = getValue();
      if (value) {
        return value;
      }
      await sleep(stepMs);
    }
    return null;
  }

  function getOpenModalElement() {
    return document.querySelector(".modal-frame");
  }

  function getProjectModalElement() {
    return Array.from(document.querySelectorAll(".modal-frame")).find((modal) =>
      Boolean(modal.querySelector("a[href*='/projects/']"))
    ) || null;
  }

  function parseMetricsFromOpenModal() {
    const modal = getProjectModalElement();
    if (!modal) {
      return null;
    }

    const html = modal.innerHTML;
    const metrics = parseProjectMetricsFromHtml(html);
    if (!metrics) {
      return null;
    }

    const projectLink = modal.querySelector("a[href*='/projects/']");
    const projectIdMatch = projectLink?.getAttribute("href")?.match(/\/projects\/(\d+)/);
    const projectId = projectIdMatch ? projectIdMatch[1] : null;

    if (!projectId) {
      return null;
    }

    return { projectId, ...metrics };
  }

  async function closeOpenModal() {
    const modal = getProjectModalElement();
    if (!modal) {
      return;
    }

    const backButton = Array.from(modal.querySelectorAll("button")).find((button) =>
      /Back to farm/i.test(button.textContent || "")
    );
    if (backButton) {
      backButton.click();
      await waitFor(() => !getProjectModalElement(), 2000, 80);
      return;
    }

    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(esc);
    await waitFor(() => !getProjectModalElement(), 1500, 80);
  }

  async function harvestProjectMetricsFromFarmTiles() {
    if (harvestInFlight) {
      return [];
    }
    harvestInFlight = true;

    try {
      const tiles = await waitFor(() => {
        const found = Array.from(document.querySelectorAll("#projects .farm-tile-project"));
        return found.length ? found : null;
      }, 10000, 120);
      if (!tiles || !tiles.length) {
        return [];
      }

      const seen = new Set();
      const metricsList = [];

      for (const tile of tiles) {
        if (getProjectModalElement()) {
          await closeOpenModal();
        }
        tile.click();
        const modal = await waitFor(() => getProjectModalElement(), 2500, 80);
        if (!modal) {
          continue;
        }

        const parsed = await waitFor(() => parseMetricsFromOpenModal(), 2500, 120);
        if (parsed && !seen.has(parsed.projectId)) {
          seen.add(parsed.projectId);
          metricsList.push(parsed);
        }
        await closeOpenModal();
        await sleep(120);
      }

      return metricsList;
    } finally {
      harvestInFlight = false;
    }
  }

  function requestBackgroundHarvest() {
    return new Promise((resolve) => {
      if (!chrome?.runtime?.sendMessage) {
        resolve([]);
        return;
      }

      chrome.runtime.sendMessage({ type: "macondo-utils-run-hidden-harvest" }, (response) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        if (!response?.ok || !Array.isArray(response.metrics)) {
          resolve([]);
          return;
        }
        resolve(response.metrics);
      });
    });
  }

  async function fetchProjectHtml(projectId) {
    const response = await fetch(`/projects/${projectId}`, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return response.text();
  }

  function readCachedRate() {
    const raw = localStorage.getItem(PROJECT_CACHE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      if (Date.now() - Number(parsed.timestamp || 0) > PROJECT_CACHE_TTL_MS) {
        return null;
      }
      if (!Number.isFinite(parsed.effectiveGoldPerHour) || parsed.effectiveGoldPerHour <= 0) {
        return null;
      }
      return parsed;
    } catch (_err) {
      return null;
    }
  }

  function writeCache(payload) {
    localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(payload));
  }

  function msUntilNextLocalMidnight() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return Math.max(1000, next.getTime() - now.getTime());
  }

  function hasProjectContextOnPage() {
    return Boolean(document.querySelector("#projects .farm-tile-project")) || Boolean(document.querySelector("a[href*='/projects/']"));
  }

  async function computeWeightedGoldPerHourFromProjects() {
    const projectIds = getKnownProjectIds();
    if (!projectIds.length) {
      let harvested = await requestBackgroundHarvest();
      if (!harvested.length && ALLOW_VISIBLE_FALLBACK_HARVEST) {
        harvested = await harvestProjectMetricsFromFarmTiles();
      }
      if (!harvested.length) {
        return null;
      }

      let weightedRateSum = 0;
      let totalHours = 0;
      const harvestedIds = [];
      harvested.forEach((metrics) => {
        weightedRateSum += metrics.hours * metrics.goldPerHour;
        totalHours += metrics.hours;
        harvestedIds.push(metrics.projectId);
      });

      if (totalHours <= 0 || weightedRateSum <= 0) {
        return null;
      }
      return {
        effectiveGoldPerHour: weightedRateSum / totalHours,
        projectIds: harvestedIds,
        totalHours
      };
    }

    let weightedRateSum = 0;
    let totalHours = 0;

    for (const projectId of projectIds) {
      try {
        const html = await fetchProjectHtml(projectId);
        if (!html) {
          continue;
        }
        const metrics = parseProjectMetricsFromHtml(html);
        if (!metrics) {
          continue;
        }
        weightedRateSum += metrics.hours * metrics.goldPerHour;
        totalHours += metrics.hours;
      } catch (_err) {
        continue;
      }
    }

    if (totalHours <= 0 || weightedRateSum <= 0) {
      return null;
    }

    return {
      effectiveGoldPerHour: weightedRateSum / totalHours,
      projectIds,
      totalHours
    };
  }

  function formatHours(hours) {
    const totalMinutes = Math.max(1, Math.round(hours * 60));
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (wholeHours <= 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${wholeHours}h`;
    }
    return `${wholeHours}h ${minutes}m`;
  }

  function updateShopCardHours() {
    const goldPerHour = effectiveGoldPerHour || getCurrentGoldPerHourFromModal();
    if (!goldPerHour) {
      return;
    }

    const cards = document.querySelectorAll(SHOP_CARD_SELECTOR);
    let updatedCount = 0;
    cards.forEach((card) => {
      const hoursSpan = Array.from(card.querySelectorAll("span"))
        .find((span) => /[>›]\s*\d+(?:\.\d+)?\s*hours?/i.test(span.textContent || ""));
      const goldSpan = Array.from(card.querySelectorAll("span"))
        .find((span) => /\b\d[\d,]*\b/.test(span.textContent || "") && span.querySelector("img[src*='money']"));

      if (!hoursSpan || !goldSpan) {
        return;
      }

      const goldAmount = parseFloatSafe(goldSpan.textContent || "");
      if (!goldAmount || goldAmount <= 0) {
        return;
      }

      const computedHours = goldAmount / goldPerHour;
      if (!Number.isFinite(computedHours) || computedHours <= 0) {
        return;
      }

      hoursSpan.textContent = `> ${formatHours(computedHours)}`;
      hoursSpan.title = `Calculated with ${goldPerHour.toFixed(2)} effective gold/hour`;
      updatedCount += 1;
    });
  }

  async function refreshEffectiveRate() {
    if (refreshInFlight) {
      return;
    }
    refreshInFlight = true;

    try {
      const cached = readCachedRate();
      if (cached) {
        effectiveGoldPerHour = cached.effectiveGoldPerHour;
        if (pendingRender) {
          pendingRender = false;
          updateShopCardHours();
        }
        return;
      }

      const computed = await computeWeightedGoldPerHourFromProjects();
      if (!computed) {
        return;
      }

      effectiveGoldPerHour = computed.effectiveGoldPerHour;
      writeCache({
        timestamp: Date.now(),
        effectiveGoldPerHour: computed.effectiveGoldPerHour,
        totalHours: computed.totalHours,
        projectIds: computed.projectIds
      });
      updateShopCardHours();
    } finally {
      refreshInFlight = false;
    }
  }

  function scheduleRefresh(reason, delayMs = 400) {
    if (effectiveGoldPerHour) {
      return;
    }
    if (refreshRetryTimer) {
      clearTimeout(refreshRetryTimer);
    }
    refreshRetryTimer = window.setTimeout(() => {
      refreshRetryTimer = null;
      refreshEffectiveRate();
    }, delayMs);
  }

  function scheduleRender() {
    pendingRender = true;
    requestAnimationFrame(() => {
      if (!pendingRender) {
        return;
      }
      pendingRender = false;
      updateShopCardHours();
    });
  }

  const observer = new MutationObserver(() => {
    scheduleRender();
    if (hasProjectContextOnPage()) {
      scheduleRefresh("dom-mutation-project-context");
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "macondo-utils-harvest") {
      return;
    }

    (async () => {
      try {
        const metrics = await harvestProjectMetricsFromFarmTiles();
        sendResponse({ ok: true, metrics });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error), metrics: [] });
      }
    })();

    return true;
  });

  if (IS_HARVEST_TAB) {
    return;
  }

  updateShopCardHours();
  refreshEffectiveRate();
  setInterval(() => {
    refreshEffectiveRate();
  }, PROJECT_CACHE_TTL_MS);
  setTimeout(function scheduleMidnightRefresh() {
    refreshEffectiveRate();
    setTimeout(scheduleMidnightRefresh, msUntilNextLocalMidnight());
  }, msUntilNextLocalMidnight());

  window.addEventListener("focus", () => {
    refreshEffectiveRate();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshEffectiveRate();
    }
  });
  window.addEventListener("load", () => {
    refreshEffectiveRate();
  });
  console.log(`${DEBUG_PREFIX} content script loaded`);
})();
