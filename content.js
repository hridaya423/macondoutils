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
  const PROJECT_TITLE_CACHE_KEY = "macondo_utils_project_titles_v1";
  const PROJECT_TILE_ORDER_CACHE_KEY = "macondo_utils_project_tile_order_v1";
  const PROJECT_LABEL_META_CACHE_KEY = "macondo_utils_project_label_meta_v1";
  const PROJECT_ID_BOOTSTRAP_CACHE_KEY = "macondo_utils_project_id_bootstrap_v1";
  const PROJECT_LABEL_PREFS_CACHE_KEY = "macondo_utils_project_label_prefs_v1";
  const PROJECT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const PROJECT_LABEL_META_REFRESH_MS = 60 * 1000;
  const PROJECT_FETCH_LIMIT = 80;
  let effectiveGoldPerHour = null;
  let refreshInFlight = false;
  let pendingRender = false;
  let harvestInFlight = false;
  let refreshRetryTimer = null;
  const DEBUG_PREFIX = "[Macondo Utils]";
  const IS_HARVEST_TAB = new URLSearchParams(window.location.search).has("macondo_utils_harvest");
  const ALLOW_VISIBLE_FALLBACK_HARVEST = false;
  const CREATE_TILE_DRAG_THRESHOLD_PX = 6;
  const PROJECT_LABEL_LAYER_ID = "macondo-utils-project-label-layer";
  const PROJECT_LABEL_SETTINGS_ID = "macondo-utils-project-label-settings";
  const PROJECT_LABEL_TEXT_MAX = 26;
  const CREATE_MODAL_ID = "macondo-utils-create-modal";
  const CREATE_STYLE_ID = "macondo-utils-create-style";
  let createTilePointerState = null;
  let suppressNextCreateTileClickUntil = 0;
  let projectLabelsQueued = false;
  let projectMetaRefreshInFlight = false;
  let lastProjectMetaRefreshAt = 0;
  let projectIdsBootstrapped = false;
  let projectTitleById = {};
  let projectMetaById = {};
  let projectTileOrder = [];
  let projectLabelPrefs = {
    showHours: true,
    showStreak: true,
    showEstCoins: true
  };
  const LEVEL_META = {
    software: {
      1: { name: "L1 Beginner", goldPerHour: 40, fruit: "Mango", fruitIcon: "/images/fruits/mango/icon.webp", desc: "A first ship: simple site, script, or tiny tool." },
      2: { name: "L2 Intermediate", goldPerHour: 45, fruit: "Pineapple", fruitIcon: "/images/fruits/pineapple/icon.webp", desc: "A focused app, CLI, or game with clean polish." },
      3: { name: "L3 Advanced", goldPerHour: 50, fruit: "Papaya", fruitIcon: "/images/fruits/papaya/icon_interior.webp", desc: "Multiple systems together: backend, state, infra." },
      4: { name: "L4 Expert", goldPerHour: 60, fruit: "Cocoa", fruitIcon: "/images/fruits/cocoa/icon_interior.webp", desc: "Deep systems work: complex architecture, serious scope." }
    },
    hardware: {
      1: { name: "L1 Beginner", goldPerHour: 40, fruit: "Guava", fruitIcon: "/images/fruits/guava/icon_interior.webp", desc: "First physical build with documented progress." },
      2: { name: "L2 Intermediate", goldPerHour: 45, fruit: "Coconut", fruitIcon: "/images/fruits/coco/icon_interior.webp", desc: "Solid prototype with wiring and iteration." },
      3: { name: "L3 Advanced", goldPerHour: 50, fruit: "Watermelon", fruitIcon: "/images/fruits/watermelon/icon_interior.webp", desc: "Complex integration: sensors, logic, enclosure." },
      4: { name: "L4 Expert", goldPerHour: 60, fruit: "Avocado", fruitIcon: "/images/fruits/avocado/icon_interior.webp", desc: "High complexity build with major technical depth." }
    }
  };

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

  function getProjectIdsFromDomLinks(root = document) {
    const ids = new Set();
    Array.from(root.querySelectorAll("a[href*='/projects/']")).forEach((link) => {
      const href = link.getAttribute("href") || "";
      const match = href.match(/\/projects\/(\d+)/);
      if (match?.[1]) {
        ids.add(String(match[1]));
      }
    });
    return Array.from(ids).slice(0, PROJECT_FETCH_LIMIT);
  }

  function mergeKnownProjectIds(ids) {
    if (!Array.isArray(ids) || !ids.length) {
      return false;
    }
    const merged = new Set(projectTileOrder.map((id) => String(id)));
    ids.forEach((id) => merged.add(String(id)));
    const next = Array.from(merged).slice(0, PROJECT_FETCH_LIMIT);
    const changed = JSON.stringify(next) !== JSON.stringify(projectTileOrder);
    if (changed) {
      projectTileOrder = next;
      writeProjectTileOrderCache(projectTileOrder);
    }
    return changed;
  }

  function getKnownProjectIds() {
    const ids = new Set();
    findProjectIdsInHtml(document.documentElement.innerHTML).forEach((id) => ids.add(id));
    getProjectIdsFromDomLinks(document).forEach((id) => ids.add(id));

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

    const streakMatch = html.match(/(\d+)\s*[- ]\s*d(?:ay|ays)?(?:\s+project)?\s*streak/i)
      || html.match(/(\d+)\s*d(?:ay|ays)?\s*streak/i);
    const streakDays = streakMatch ? Number.parseInt(streakMatch[1], 10) : 0;
    const totalEarnedMatch = html.match(/Total\s*Earned:\s*([\d,]+)\s*gold/i);
    const totalEarnedGold = totalEarnedMatch
      ? Number.parseInt(String(totalEarnedMatch[1]).replace(/,/g, ""), 10)
      : 0;
    const goldPerHour = PROJECT_HOURLY_RATE[level] * multiplier;

    return {
      hours,
      goldPerHour,
      streakDays,
      estCoins: Math.round(hours * goldPerHour),
      totalEarnedGold: Number.isFinite(totalEarnedGold) ? Math.max(0, totalEarnedGold) : 0,
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

  function parseProjectTitleFromModalElement(modal) {
    if (!modal) {
      return "";
    }

    const titleCandidates = [
      modal.querySelector("h1"),
      modal.querySelector("h2"),
      modal.querySelector("[class*='title']"),
      modal.querySelector("[class*='name']"),
      modal.querySelector("a[href*='/projects/']")
    ];
    const title = titleCandidates
      .map((el) => String(el?.textContent || "").trim())
      .find((value) => value.length > 1 && !/^back to farm$/i.test(value));

    return title || "";
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

    const title = parseProjectTitleFromModalElement(modal);
    return { projectId, title, ...metrics };
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

  async function bootstrapProjectIdsFromHiddenHarvestOnce() {
    if (projectIdsBootstrapped || projectTileOrder.length) {
      return;
    }

    const harvested = await requestBackgroundHarvest();
    if (!Array.isArray(harvested) || !harvested.length) {
      return;
    }

    let weightedRateSum = 0;
    let totalHours = 0;
    const harvestedIds = [];
    const mergedTitles = { ...projectTitleById };
    const mergedMeta = { ...projectMetaById };
    harvested.forEach((metrics) => {
      weightedRateSum += (metrics.hours || 0) * (metrics.goldPerHour || 0);
      totalHours += metrics.hours || 0;
      harvestedIds.push(String(metrics.projectId));
      if (metrics.title) {
        mergedTitles[String(metrics.projectId)] = String(metrics.title).trim();
      }
      const meta = buildProjectMeta(metrics.title, metrics);
      if (meta) {
        mergedMeta[String(metrics.projectId)] = meta;
      }
    });

    if (harvestedIds.length) {
      projectTileOrder = harvestedIds;
      writeProjectTileOrderCache(projectTileOrder);
      projectIdsBootstrapped = true;
      writeProjectIdBootstrapCache(true);
    }
    if (Object.keys(mergedTitles).length) {
      projectTitleById = mergedTitles;
      writeProjectTitleCache(projectTitleById);
    }
    if (Object.keys(mergedMeta).length) {
      projectMetaById = mergedMeta;
      writeProjectLabelMetaCache(projectMetaById);
      queueProjectGroundLabelsSync();
    }
    if (totalHours > 0 && weightedRateSum > 0) {
      effectiveGoldPerHour = weightedRateSum / totalHours;
      writeCache({
        timestamp: Date.now(),
        effectiveGoldPerHour,
        totalHours,
        projectIds: harvestedIds
      });
    }
  }

  async function fetchProjectHtml(projectId) {
    const response = await fetch(`/projects/${projectId}`, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return response.text();
  }

  function parseProjectTitleFromHtml(html) {
    if (!html) {
      return "";
    }

    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const candidates = [
        doc.querySelector("h1"),
        doc.querySelector("h2"),
        doc.querySelector("meta[property='og:title']"),
        doc.querySelector("title")
      ];
      for (const node of candidates) {
        if (!node) {
          continue;
        }
        const raw = node.getAttribute?.("content") || node.textContent || "";
        const clean = String(raw).trim().replace(/\s*\|\s*Macondo.*$/i, "");
        if (clean.length > 1) {
          return clean;
        }
      }
    } catch (_err) {}

    return "";
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

  function readProjectTitleCache() {
    const raw = localStorage.getItem(PROJECT_TITLE_CACHE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      if (Date.now() - Number(parsed.timestamp || 0) > PROJECT_CACHE_TTL_MS) {
        return {};
      }
      if (!parsed.titles || typeof parsed.titles !== "object") {
        return {};
      }
      return parsed.titles;
    } catch (_err) {
      return {};
    }
  }

  function writeProjectTitleCache(titles) {
    localStorage.setItem(PROJECT_TITLE_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      titles
    }));
  }

  function readProjectLabelMetaCache() {
    const raw = localStorage.getItem(PROJECT_LABEL_META_CACHE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return {};
      }
      if (Date.now() - Number(parsed.timestamp || 0) > PROJECT_CACHE_TTL_MS) {
        return {};
      }
      if (!parsed.meta || typeof parsed.meta !== "object") {
        return {};
      }
      return parsed.meta;
    } catch (_err) {
      return {};
    }
  }

  function writeProjectLabelMetaCache(meta) {
    localStorage.setItem(PROJECT_LABEL_META_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      meta
    }));
  }

  function readProjectLabelPrefsCache() {
    const raw = localStorage.getItem(PROJECT_LABEL_PREFS_CACHE_KEY);
    if (!raw) {
      return { showHours: true, showStreak: true, showEstCoins: true };
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        showHours: parsed?.showHours !== false,
        showStreak: parsed?.showStreak !== false,
        showEstCoins: parsed?.showEstCoins !== false
      };
    } catch (_err) {
      return { showHours: true, showStreak: true, showEstCoins: true };
    }
  }

  function writeProjectLabelPrefsCache(prefs) {
    localStorage.setItem(PROJECT_LABEL_PREFS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      showHours: prefs.showHours !== false,
      showStreak: prefs.showStreak !== false,
      showEstCoins: prefs.showEstCoins !== false
    }));
  }

  function readProjectIdBootstrapCache() {
    const raw = localStorage.getItem(PROJECT_ID_BOOTSTRAP_CACHE_KEY);
    if (!raw) {
      return false;
    }
    try {
      const parsed = JSON.parse(raw);
      return Boolean(parsed && parsed.done);
    } catch (_err) {
      return false;
    }
  }

  function writeProjectIdBootstrapCache(done) {
    localStorage.setItem(PROJECT_ID_BOOTSTRAP_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      done: Boolean(done)
    }));
  }

  function buildProjectMeta(title, metrics) {
    if (!metrics || !Number.isFinite(metrics.hours) || metrics.hours <= 0) {
      return null;
    }
    const hours = Number(metrics.hours);
    const streakDays = Number.isFinite(metrics.streakDays) ? Math.max(0, Math.round(metrics.streakDays)) : 0;
    const estCoins = Number.isFinite(metrics.estCoins)
      ? Math.max(0, Math.round(metrics.estCoins))
      : Number.isFinite(metrics.goldPerHour) ? Math.max(0, Math.round(hours * Number(metrics.goldPerHour))) : 0;
    const totalEarnedGold = Number.isFinite(metrics.totalEarnedGold)
      ? Math.max(0, Math.round(metrics.totalEarnedGold))
      : 0;
    const futureCoins = Math.max(0, estCoins - totalEarnedGold);
    return {
      title: String(title || "").trim(),
      hours,
      streakDays,
      estCoins,
      totalEarnedGold,
      futureCoins
    };
  }

  function formatLabelMetaLines(meta) {
    if (!meta) {
      return [];
    }
    const lines = [];
    if (projectLabelPrefs.showHours !== false) {
      lines.push(formatHours(meta.hours));
    }
    if (projectLabelPrefs.showStreak !== false) {
      lines.push(`${meta.streakDays || 0}d streak`);
    }
    if (projectLabelPrefs.showEstCoins !== false) {
      const futureOrEst = Number.isFinite(meta.futureCoins) ? meta.futureCoins : (meta.estCoins || 0);
      lines.push(`${futureOrEst} est coins`);
    }
    return lines;
  }

  function readProjectTileOrderCache() {
    const raw = localStorage.getItem(PROJECT_TILE_ORDER_CACHE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return [];
      }
      if (Date.now() - Number(parsed.timestamp || 0) > PROJECT_CACHE_TTL_MS) {
        return [];
      }
      if (!Array.isArray(parsed.order)) {
        return [];
      }
      return parsed.order.map((id) => String(id));
    } catch (_err) {
      return [];
    }
  }

  function readProjectIdsFromRateCache() {
    const raw = localStorage.getItem(PROJECT_CACHE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.projectIds)) {
        return [];
      }
      return parsed.projectIds.map((id) => String(id));
    } catch (_err) {
      return [];
    }
  }

  function writeProjectTileOrderCache(order) {
    localStorage.setItem(PROJECT_TILE_ORDER_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      order: Array.isArray(order) ? order.map((id) => String(id)) : []
    }));
  }

  function msUntilNextLocalMidnight() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    return Math.max(1000, next.getTime() - now.getTime());
  }

  function truncateProjectLabel(text, max = PROJECT_LABEL_TEXT_MAX) {
    const clean = String(text || "").trim().replace(/\s+/g, " ");
    if (!clean) {
      return "";
    }
    if (clean.length <= max) {
      return clean;
    }
    return `${clean.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
  }

  function splitProjectLabelLines(text) {
    const clean = truncateProjectLabel(text, 28);
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 2 && clean.length > 12) {
      return words;
    }
    if (words.length <= 2 || clean.length <= 15) {
      return [clean];
    }

    let bestIndex = 1;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let i = 1; i < words.length; i += 1) {
      const left = words.slice(0, i).join(" ");
      const right = words.slice(i).join(" ");
      const score = Math.abs(left.length - right.length);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    return [
      words.slice(0, bestIndex).join(" "),
      words.slice(bestIndex).join(" ")
    ];
  }

  function getLabelRect(anchorX, anchorY, placement, lineCount) {
    const width = placement === "bottom" || placement === "top" ? 120 : 108;
    const height = lineCount > 1 ? 32 : 18;

    if (placement === "right") {
      return { x: anchorX, y: anchorY - height / 2, width, height };
    }
    if (placement === "left") {
      return { x: anchorX - width, y: anchorY - height / 2, width, height };
    }
    if (placement === "top") {
      return { x: anchorX - width / 2, y: anchorY - height, width, height };
    }
    return { x: anchorX - width / 2, y: anchorY, width, height };
  }

  function getRectOverlapArea(a, b) {
    const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return overlapX * overlapY;
  }

  function buildTileClusters(tileModels) {
    const visited = new Set();
    const clusters = [];

    function touches(a, b) {
      const ax2 = a.left + a.width;
      const ay2 = a.top + a.height;
      const bx2 = b.left + b.width;
      const by2 = b.top + b.height;
      const gapX = Math.max(0, Math.max(a.left - bx2, b.left - ax2));
      const gapY = Math.max(0, Math.max(a.top - by2, b.top - ay2));
      return gapX <= 54 && gapY <= 54;
    }

    tileModels.forEach((tile) => {
      if (visited.has(tile.tileId)) {
        return;
      }
      const queue = [tile];
      const cluster = [];
      visited.add(tile.tileId);

      while (queue.length) {
        const current = queue.shift();
        cluster.push(current);
        tileModels.forEach((candidate) => {
          if (visited.has(candidate.tileId)) {
            return;
          }
          if (touches(current, candidate)) {
            visited.add(candidate.tileId);
            queue.push(candidate);
          }
        });
      }

      clusters.push(cluster);
    });

    return clusters;
  }

  function getClusterBounds(cluster) {
    return cluster.reduce((acc, tile) => ({
      left: Math.min(acc.left, tile.left),
      top: Math.min(acc.top, tile.top),
      right: Math.max(acc.right, tile.left + tile.width),
      bottom: Math.max(acc.bottom, tile.top + tile.height)
    }), { left: Number.POSITIVE_INFINITY, top: Number.POSITIVE_INFINITY, right: 0, bottom: 0 });
  }

  function classifyClusterShape(cluster) {
    if (cluster.length <= 1) {
      return "single";
    }
    const bounds = getClusterBounds(cluster);
    const spanX = bounds.right - bounds.left;
    const spanY = bounds.bottom - bounds.top;
    if (spanY > spanX * 1.2) {
      return "vertical";
    }
    if (spanX > spanY * 1.15) {
      return "horizontal";
    }
    return "compact";
  }

  function getProjectVisualObstacleRects(projectsRoot) {
    return Array.from(projectsRoot.querySelectorAll(".farm-tile-project, .farm-tile-add"))
      .map((tile, index) => {
        const tileId = tile.dataset.muTileId || `obstacle-${index}`;
        if (!tile.dataset.muTileId) {
          tile.dataset.muTileId = tileId;
        }
        return {
          tileId,
          x: tile.offsetLeft,
          y: tile.offsetTop,
          width: tile.offsetWidth || 120,
          height: tile.offsetHeight || 90
        };
      });
  }

  function getTileLabelCandidate(tileModel, placement) {
    const anchor = placement === "bottom"
      ? { x: tileModel.left + tileModel.width * 0.62, y: tileModel.top + tileModel.height + 9 }
      : placement === "top"
        ? { x: tileModel.left + tileModel.width * 0.58, y: tileModel.top - 9 }
        : placement === "right"
          ? { x: tileModel.left + tileModel.width + 10, y: tileModel.top + tileModel.height * 0.64 }
          : { x: tileModel.left - 10, y: tileModel.top + tileModel.height * 0.64 };

    return { placement, anchor };
  }

  function applyMeasuredLabelCandidate(label, candidate, layerRect, bounds) {
    label.setAttribute("data-placement", candidate.placement);
    label.style.left = `${Math.round(candidate.anchor.x)}px`;
    label.style.top = `${Math.round(candidate.anchor.y)}px`;
    let rect = label.getBoundingClientRect();
    let localRect = {
      x: rect.left - layerRect.left,
      y: rect.top - layerRect.top,
      width: rect.width,
      height: rect.height
    };

    if (bounds) {
      const minX = 4;
      const maxX = Math.max(minX, bounds.width - localRect.width - 4);
      const minY = 4;
      const maxY = Math.max(minY, bounds.height - localRect.height - 4);

      if (candidate.placement === "bottom" || candidate.placement === "top") {
        const clampedX = Math.min(maxX, Math.max(minX, localRect.x));
        if (Math.abs(clampedX - localRect.x) > 0.5) {
          label.style.left = `${Math.round(candidate.anchor.x + (clampedX - localRect.x))}px`;
          rect = label.getBoundingClientRect();
          localRect = {
            x: rect.left - layerRect.left,
            y: rect.top - layerRect.top,
            width: rect.width,
            height: rect.height
          };
        }
      } else {
        const clampedY = Math.min(maxY, Math.max(minY, localRect.y));
        if (Math.abs(clampedY - localRect.y) > 0.5) {
          label.style.top = `${Math.round(candidate.anchor.y + (clampedY - localRect.y))}px`;
          rect = label.getBoundingClientRect();
          localRect = {
            x: rect.left - layerRect.left,
            y: rect.top - layerRect.top,
            width: rect.width,
            height: rect.height
          };
        }
      }
    }

    return {
      rect: localRect,
      anchor: {
        x: Number.parseFloat(label.style.left || "0"),
        y: Number.parseFloat(label.style.top || "0")
      }
    };
  }

  function scoreMeasuredLabelRect(rect, bounds, visualObstacleRects, placedLabelRects, placement, placementIndex, ownTileId) {
    let score = placementIndex * 80;

    if (placement === "top") {
      score += 650;
    }

    if (rect.x < 0) {
      score += Math.abs(rect.x) * 20;
    }
    if (rect.y < 0) {
      score += Math.abs(rect.y) * 20;
    }
    if (rect.x + rect.width > bounds.width) {
      score += Math.abs(rect.x + rect.width - bounds.width) * 20;
    }
    if (rect.y + rect.height > bounds.height) {
      score += Math.abs(rect.y + rect.height - bounds.height) * 20;
    }

    visualObstacleRects.forEach((obstacleRect) => {
      if (obstacleRect.tileId === ownTileId) {
        return;
      }
      const overlap = getRectOverlapArea(rect, obstacleRect);
      if (overlap > 8) {
        score += 10000 + overlap * 18;
      }
    });

    placedLabelRects.forEach((labelRect) => {
      const overlap = getRectOverlapArea(rect, labelRect);
      if (overlap > 4) {
        score += 180 + overlap * 1.5;
      }
    });

    return score;
  }

  function chooseClusterSharedSide(cluster, bounds) {
    const clusterBounds = getClusterBounds(cluster);
    const leftSpace = clusterBounds.left;
    const rightSpace = bounds.width - clusterBounds.right;
    return rightSpace >= leftSpace ? "right" : "left";
  }

  function getClusterSharedSideByTile(tileModels, bounds) {
    const sharedSideByTile = new Map();
    buildTileClusters(tileModels).forEach((cluster) => {
      if (classifyClusterShape(cluster) !== "vertical") {
        return;
      }
      const side = chooseClusterSharedSide(cluster, bounds);
      cluster.forEach((tile) => {
        sharedSideByTile.set(tile.tileId, side);
      });
    });
    return sharedSideByTile;
  }

  function getHorizontalClusterForceBottomByTile(tileModels) {
    const forceBottomByTile = new Map();
    buildTileClusters(tileModels).forEach((cluster) => {
      if (classifyClusterShape(cluster) !== "horizontal" || cluster.length < 2) {
        return;
      }
      cluster.forEach((tile) => {
        if (tile?.tileId) {
          forceBottomByTile.set(tile.tileId, true);
        }
      });
    });
    return forceBottomByTile;
  }

  function chooseMeasuredTileLabelPlacement(tileModel, label, layerRect, bounds, visualObstacleRects, placedLabelRects, sharedSide, forceBottom) {
    if (forceBottom) {
      const bottomCandidate = getTileLabelCandidate(tileModel, "bottom");
      const measuredBottom = applyMeasuredLabelCandidate(label, bottomCandidate, layerRect, bounds);
      return {
        ...bottomCandidate,
        anchor: measuredBottom.anchor,
        rect: measuredBottom.rect,
        score: Number.NEGATIVE_INFINITY
      };
    }

    const placements = sharedSide
      ? ["bottom", sharedSide, sharedSide === "right" ? "left" : "right", "top"]
      : ["bottom", "right", "left", "top"];

    const bottomCandidate = getTileLabelCandidate(tileModel, "bottom");
    const measuredBottom = applyMeasuredLabelCandidate(label, bottomCandidate, layerRect, bounds);
    const bottomScore = scoreMeasuredLabelRect(
      measuredBottom.rect,
      bounds,
      visualObstacleRects,
      placedLabelRects,
      "bottom",
      0,
      tileModel.tileId
    );
    if (bottomScore < 1200) {
      return {
        ...bottomCandidate,
        anchor: measuredBottom.anchor,
        rect: measuredBottom.rect,
        score: bottomScore
      };
    }

    let best = null;
    placements.forEach((placement, index) => {
      const candidate = getTileLabelCandidate(tileModel, placement);
      const measured = applyMeasuredLabelCandidate(label, candidate, layerRect, bounds);
      const score = scoreMeasuredLabelRect(measured.rect, bounds, visualObstacleRects, placedLabelRects, placement, index, tileModel.tileId);
      if (!best || score < best.score) {
        best = { ...candidate, anchor: measured.anchor, rect: measured.rect, score };
      }
    });

    return best;
  }

  function guessProjectTitleFromTile(tile) {
    const projectId = tile.getAttribute("data-mu-project-id") || "";
    if (projectId && projectTitleById[projectId]) {
      return projectTitleById[projectId];
    }

    const direct = tile.getAttribute("data-project-name")
      || tile.getAttribute("data-title")
      || tile.getAttribute("title")
      || tile.getAttribute("aria-label");
    if (direct && direct.trim()) {
      return direct.trim();
    }

    const imgAlt = tile.querySelector("img[alt]")?.getAttribute("alt") || "";
    if (imgAlt && imgAlt.trim() && !/^(tile|ground|fruit)$/i.test(imgAlt.trim())) {
      return imgAlt.trim();
    }

    const modalLink = tile.querySelector("a[href*='/projects/']");
    if (modalLink?.textContent?.trim()) {
      return modalLink.textContent.trim();
    }

    return "";
  }

  function getProjectMetaFromTile(tile) {
    const projectId = tile.getAttribute("data-mu-project-id") || "";
    if (!projectId) {
      return null;
    }
    return projectMetaById[projectId] || null;
  }

  function ensureProjectLabelLayer() {
    const projectsRoot = document.getElementById("projects");
    if (!projectsRoot) {
      return null;
    }

    let layer = document.getElementById(PROJECT_LABEL_LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = PROJECT_LABEL_LAYER_ID;
      projectsRoot.appendChild(layer);
    }
    return layer;
  }

  function closeProjectLabelSettingsPanel() {
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel) {
      panel.hidden = true;
    }
  }

  function ensureProjectLabelSettingsButton() {
    let root = document.getElementById(PROJECT_LABEL_SETTINGS_ID);  
    const target = document.querySelector("[class*='absolute'][class*='top-0'] [class*='ml-auto'], [class*='absolute'][class*='top-0'] [class*='items-center'][class*='justify-between'] > div:last-child");
    if (!target) {
      return;
    }

    if (root && root.parentElement !== target) {
      root.remove();
      root = null;
    }

    if (!root) {
      root = document.createElement("div");
      root.id = PROJECT_LABEL_SETTINGS_ID;
      root.className = "mu-label-settings";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "mu-label-settings-btn";
      button.setAttribute("aria-label", "Macondo Utils settings");
      button.title = "Macondo Utils settings";
      button.innerHTML = [
        "<svg class='mu-label-settings-gear' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>",
        "<g id='SVGRepo_bgCarrier' stroke-width='0'></g>",
        "<g id='SVGRepo_tracerCarrier' stroke-linecap='round' stroke-linejoin='round'></g>",
        "<g id='SVGRepo_iconCarrier'>",
        "<path fill-rule='evenodd' clip-rule='evenodd' d='M12 8.25C9.92894 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92894 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25ZM9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z' fill='#1C274C'></path>",
        "<path fill-rule='evenodd' clip-rule='evenodd' d='M11.9747 1.25C11.5303 1.24999 11.1592 1.24999 10.8546 1.27077C10.5375 1.29241 10.238 1.33905 9.94761 1.45933C9.27379 1.73844 8.73843 2.27379 8.45932 2.94762C8.31402 3.29842 8.27467 3.66812 8.25964 4.06996C8.24756 4.39299 8.08454 4.66251 7.84395 4.80141C7.60337 4.94031 7.28845 4.94673 7.00266 4.79568C6.64714 4.60777 6.30729 4.45699 5.93083 4.40743C5.20773 4.31223 4.47642 4.50819 3.89779 4.95219C3.64843 5.14353 3.45827 5.3796 3.28099 5.6434C3.11068 5.89681 2.92517 6.21815 2.70294 6.60307L2.67769 6.64681C2.45545 7.03172 2.26993 7.35304 2.13562 7.62723C1.99581 7.91267 1.88644 8.19539 1.84541 8.50701C1.75021 9.23012 1.94617 9.96142 2.39016 10.5401C2.62128 10.8412 2.92173 11.0602 3.26217 11.2741C3.53595 11.4461 3.68788 11.7221 3.68786 12C3.68785 12.2778 3.53592 12.5538 3.26217 12.7258C2.92169 12.9397 2.62121 13.1587 2.39007 13.4599C1.94607 14.0385 1.75012 14.7698 1.84531 15.4929C1.88634 15.8045 1.99571 16.0873 2.13552 16.3727C2.26983 16.6469 2.45535 16.9682 2.67758 17.3531L2.70284 17.3969C2.92507 17.7818 3.11058 18.1031 3.28089 18.3565C3.45817 18.6203 3.64833 18.8564 3.89769 19.0477C4.47632 19.4917 5.20763 19.6877 5.93073 19.5925C6.30717 19.5429 6.647 19.3922 7.0025 19.2043C7.28833 19.0532 7.60329 19.0596 7.8439 19.1986C8.08452 19.3375 8.24756 19.607 8.25964 19.9301C8.27467 20.3319 8.31403 20.7016 8.45932 21.0524C8.73843 21.7262 9.27379 22.2616 9.94761 22.5407C10.238 22.661 10.5375 22.7076 10.8546 22.7292C11.1592 22.75 11.5303 22.75 11.9747 22.75H12.0252C12.4697 22.75 12.8407 22.75 13.1454 22.7292C13.4625 22.7076 13.762 22.661 14.0524 22.5407C14.7262 22.2616 15.2616 21.7262 15.5407 21.0524C15.686 20.7016 15.7253 20.3319 15.7403 19.93C15.7524 19.607 15.9154 19.3375 16.156 19.1985C16.3966 19.0596 16.7116 19.0532 16.9974 19.2042C17.3529 19.3921 17.6927 19.5429 18.0692 19.5924C18.7923 19.6876 19.5236 19.4917 20.1022 19.0477C20.3516 18.8563 20.5417 18.6203 20.719 18.3565C20.8893 18.1031 21.0748 17.7818 21.297 17.3969L21.3223 17.3531C21.5445 16.9682 21.7301 16.6468 21.8644 16.3726C22.0042 16.0872 22.1135 15.8045 22.1546 15.4929C22.2498 14.7697 22.0538 14.0384 21.6098 13.4598C21.3787 13.1586 21.0782 12.9397 20.7378 12.7258C20.464 12.5538 20.3121 12.2778 20.3121 11.9999C20.3121 11.7221 20.464 11.4462 20.7377 11.2742C21.0783 11.0603 21.3788 10.8414 21.6099 10.5401C22.0539 9.96149 22.2499 9.23019 22.1547 8.50708C22.1136 8.19546 22.0043 7.91274 21.8645 7.6273C21.7302 7.35313 21.5447 7.03183 21.3224 6.64695L21.2972 6.60318C21.0749 6.21825 20.8894 5.89688 20.7191 5.64347C20.5418 5.37967 20.3517 5.1436 20.1023 4.95225C19.5237 4.50826 18.7924 4.3123 18.0692 4.4075C17.6928 4.45706 17.353 4.60782 16.9975 4.79572C16.7117 4.94679 16.3967 4.94036 16.1561 4.80144C15.9155 4.66253 15.7524 4.39297 15.7403 4.06991C15.7253 3.66808 15.686 3.2984 15.5407 2.94762C15.2616 2.27379 14.7262 1.73844 14.0524 1.45933C13.762 1.33905 13.4625 1.29241 13.1454 1.27077C12.8407 1.24999 12.4697 1.24999 12.0252 1.25H11.9747ZM10.5216 2.84515C10.5988 2.81319 10.716 2.78372 10.9567 2.76729C11.2042 2.75041 11.5238 2.75 12 2.75C12.4762 2.75 12.7958 2.75041 13.0432 2.76729C13.284 2.78372 13.4012 2.81319 13.4783 2.84515C13.7846 2.97202 14.028 3.21536 14.1548 3.52165C14.1949 3.61826 14.228 3.76887 14.2414 4.12597C14.271 4.91835 14.68 5.68129 15.4061 6.10048C16.1321 6.51968 16.9974 6.4924 17.6984 6.12188C18.0143 5.9549 18.1614 5.90832 18.265 5.89467C18.5937 5.8514 18.9261 5.94047 19.1891 6.14228C19.2554 6.19312 19.3395 6.27989 19.4741 6.48016C19.6125 6.68603 19.7726 6.9626 20.0107 7.375C20.2488 7.78741 20.4083 8.06438 20.5174 8.28713C20.6235 8.50382 20.6566 8.62007 20.6675 8.70287C20.7108 9.03155 20.6217 9.36397 20.4199 9.62698C20.3562 9.70995 20.2424 9.81399 19.9397 10.0041C19.2684 10.426 18.8122 11.1616 18.8121 11.9999C18.8121 12.8383 19.2683 13.574 19.9397 13.9959C20.2423 14.186 20.3561 14.29 20.4198 14.373C20.6216 14.636 20.7107 14.9684 20.6674 15.2971C20.6565 15.3799 20.6234 15.4961 20.5173 15.7128C20.4082 15.9355 20.2487 16.2125 20.0106 16.6249C19.7725 17.0373 19.6124 17.3139 19.474 17.5198C19.3394 17.72 19.2553 17.8068 19.189 17.8576C18.926 18.0595 18.5936 18.1485 18.2649 18.1053C18.1613 18.0916 18.0142 18.045 17.6983 17.8781C16.9973 17.5075 16.132 17.4803 15.4059 17.8995C14.68 18.3187 14.271 19.0816 14.2414 19.874C14.228 20.2311 14.1949 20.3817 14.1548 20.4784C14.028 20.7846 13.7846 21.028 13.4783 21.1549C13.4012 21.1868 13.284 21.2163 13.0432 21.2327C12.7958 21.2496 12.4762 21.25 12 21.25C11.5238 21.25 11.2042 21.2496 10.9567 21.2327C10.716 21.2163 10.5988 21.1868 10.5216 21.1549C10.2154 21.028 9.97201 20.7846 9.84514 20.4784C9.80512 20.3817 9.77195 20.2311 9.75859 19.874C9.72896 19.0817 9.31997 18.3187 8.5939 17.8995C7.86784 17.4803 7.00262 17.5076 6.30158 17.8781C5.98565 18.0451 5.83863 18.0917 5.73495 18.1053C5.40626 18.1486 5.07385 18.0595 4.81084 17.8577C4.74458 17.8069 4.66045 17.7201 4.52586 17.5198C4.38751 17.314 4.22736 17.0374 3.98926 16.625C3.75115 16.2126 3.59171 15.9356 3.4826 15.7129C3.37646 15.4962 3.34338 15.3799 3.33248 15.2971C3.28921 14.9684 3.37828 14.636 3.5801 14.373C3.64376 14.2901 3.75761 14.186 4.0602 13.9959C4.73158 13.5741 5.18782 12.8384 5.18786 12.0001C5.18791 11.1616 4.73165 10.4259 4.06021 10.004C3.75769 9.81389 3.64385 9.70987 3.58019 9.62691C3.37838 9.3639 3.28931 9.03149 3.33258 8.7028C3.34348 8.62001 3.37656 8.50375 3.4827 8.28707C3.59181 8.06431 3.75125 7.78734 3.98935 7.37493C4.22746 6.96253 4.3876 6.68596 4.52596 6.48009C4.66055 6.27983 4.74468 6.19305 4.81093 6.14222C5.07395 5.9404 5.40636 5.85133 5.73504 5.8946C5.83873 5.90825 5.98576 5.95483 6.30173 6.12184C7.00273 6.49235 7.86791 6.51962 8.59394 6.10045C9.31998 5.68128 9.72896 4.91837 9.75859 4.12602C9.77195 3.76889 9.80512 3.61827 9.84514 3.52165C9.97201 3.21536 10.2154 2.97202 10.5216 2.84515Z' fill='#1C274C'></path>",
        "</g>",
        "</svg>"
      ].join("");

      const panel = document.createElement("div");
      panel.className = "mu-label-settings-panel";
      panel.hidden = true;
      panel.innerHTML = [
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showHours' checked /> <span>Show time</span></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showStreak' checked /> <span>Show streak</span></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showEstCoins' checked /> <span>Show est coins</span></label>"
      ].join("");

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        panel.hidden = !panel.hidden;
      });

      panel.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      panel.addEventListener("change", (event) => {
        const input = event.target instanceof HTMLInputElement ? event.target : null;
        const key = input?.dataset?.key;
        if (!input || !key || !(key in projectLabelPrefs)) {
          return;
        }
        projectLabelPrefs = {
          ...projectLabelPrefs,
          [key]: input.checked
        };
        writeProjectLabelPrefsCache(projectLabelPrefs);
        queueProjectGroundLabelsSync();
      });

      root.appendChild(button);
      root.appendChild(panel);
      target.appendChild(root);
    }

    const panel = root.querySelector(".mu-label-settings-panel");
    if (!panel) {
      return;
    }
    Array.from(panel.querySelectorAll("input[type='checkbox'][data-key]"))
      .forEach((node) => {
        const input = node;
        const key = input.dataset.key;
        if (!key || !(key in projectLabelPrefs)) {
          return;
        }
        input.checked = projectLabelPrefs[key] !== false;
      });
  }

  function syncProjectGroundLabels() {
    const projectsRoot = document.getElementById("projects");
    if (!projectsRoot) {
      return;
    }

    const layer = ensureProjectLabelLayer();
    if (!layer) {
      return;
    }

    const tiles = Array.from(projectsRoot.querySelectorAll(".farm-tile-project"));
    const existing = new Map();
    Array.from(layer.querySelectorAll(".mu-ground-label")).forEach((el) => {
      const id = el.getAttribute("data-tile-id");
      if (id) {
        existing.set(id, el);
      }
    });

    const fallbackOrder = projectTileOrder.length
      ? projectTileOrder
      : (Object.keys(projectTitleById).length ? Object.keys(projectTitleById) : readProjectIdsFromRateCache());

    const layerRect = layer.getBoundingClientRect();

    const tileModels = [];
    const seen = new Set();
    tiles.forEach((tile, index) => {
      const tileId = tile.dataset.muTileId || `tile-${index}`;
      tile.dataset.muTileId = tileId;
      seen.add(tileId);

      if (!tile.getAttribute("data-mu-project-id") && fallbackOrder[index]) {
        tile.setAttribute("data-mu-project-id", String(fallbackOrder[index]));
      }

      const rawTitle = guessProjectTitleFromTile(tile);
      if (!rawTitle) {
        return;
      }

      const left = tile.offsetLeft;
      const top = tile.offsetTop;
      const tileWidth = tile.offsetWidth || 120;
      const tileHeight = tile.offsetHeight || 90;

      tileModels.push({
        tile,
        tileId,
        rawTitle,
        lines: splitProjectLabelLines(rawTitle),
        left,
        top,
        width: tileWidth,
        height: tileHeight,
        centerX: left + tileWidth / 2,
        centerY: top + tileHeight / 2
      });
    });

    const bounds = {
      width: projectsRoot.clientWidth || projectsRoot.offsetWidth || 0,
      height: projectsRoot.clientHeight || projectsRoot.offsetHeight || 0
    };
    const visualObstacleRects = getProjectVisualObstacleRects(projectsRoot);
    const placedLabelRects = [];
    const sharedSideByTile = getClusterSharedSideByTile(tileModels, bounds);
    const forceBottomByTile = getHorizontalClusterForceBottomByTile(tileModels);

    tileModels
      .slice()
      .sort((a, b) => a.top - b.top || a.left - b.left)
      .forEach((tileModel) => {
        let label = existing.get(tileModel.tileId);
        if (!label) {
          label = document.createElement("div");
          label.className = "mu-ground-label";
          label.setAttribute("data-tile-id", tileModel.tileId);
          layer.appendChild(label);
        }

        label.replaceChildren();
        const inner = document.createElement("div");
        inner.className = "mu-ground-label-inner";
        tileModel.lines.forEach((line) => {
          const lineNode = document.createElement("span");
          lineNode.className = "mu-ground-label-line";
          lineNode.textContent = line;
          inner.appendChild(lineNode);
        });

        const tileMeta = getProjectMetaFromTile(tileModel.tile);
        const metaLines = formatLabelMetaLines(tileMeta);
        metaLines.forEach((metaText) => {
          const metaNode = document.createElement("span");
          metaNode.className = "mu-ground-label-meta";
          metaNode.textContent = metaText;
          inner.appendChild(metaNode);
        });
        label.appendChild(inner);
        label.setAttribute("title", tileModel.rawTitle);

        label.style.visibility = "hidden";
        const chosenPlacement = chooseMeasuredTileLabelPlacement(
          tileModel,
          label,
          layerRect,
          bounds,
          visualObstacleRects,
          placedLabelRects,
          sharedSideByTile.get(tileModel.tileId),
          forceBottomByTile.get(tileModel.tileId)
        );

        if (chosenPlacement) {
          label.setAttribute("data-placement", chosenPlacement.placement);
          label.style.left = `${Math.round(chosenPlacement.anchor.x)}px`;
          label.style.top = `${Math.round(chosenPlacement.anchor.y)}px`;
          placedLabelRects.push(chosenPlacement.rect);
        }
        label.style.visibility = "";
      });

    existing.forEach((node, id) => {
      if (!seen.has(id)) {
        node.remove();
      }
    });
  }

  function queueProjectGroundLabelsSync() {
    if (projectLabelsQueued) {
      return;
    }
    projectLabelsQueued = true;
    requestAnimationFrame(() => {
      projectLabelsQueued = false;
      syncProjectGroundLabels();
    });
  }

  async function hydrateProjectTitlesFromKnownIds() {
    if (Object.keys(projectTitleById).length > 0 && Object.keys(projectMetaById).length > 0) {
      return;
    }

    const ids = getKnownProjectIds();
    if (!ids.length) {
      return;
    }

    const mergedTitles = { ...projectTitleById };
    const mergedMeta = { ...projectMetaById };
    for (const projectId of ids) {
      try {
        const html = await fetchProjectHtml(projectId);
        if (!html) {
          continue;
        }
        const title = parseProjectTitleFromHtml(html);
        if (title) {
          mergedTitles[String(projectId)] = title;
        }
        const metrics = parseProjectMetricsFromHtml(html);
        const meta = buildProjectMeta(title, metrics);
        if (meta) {
          mergedMeta[String(projectId)] = meta;
        }
      } catch (_err) {
        continue;
      }
    }

    if (Object.keys(mergedTitles).length > 0) {
      projectTitleById = mergedTitles;
      writeProjectTitleCache(projectTitleById);
      projectMetaById = mergedMeta;
      writeProjectLabelMetaCache(projectMetaById);
      queueProjectGroundLabelsSync();
    }
  }

  function onCreateEscape(event) {
    if (event.key === "Escape") {
      removeCreateModal();
    }
  }

  function removeCreateModal() {
    const root = document.getElementById(CREATE_MODAL_ID);
    if (root) {
      root.remove();
    }
    document.removeEventListener("keydown", onCreateEscape, true);
  }

  async function submitCreateProject(payload, optionalPayload, errorNode, submitBtn) {
    errorNode.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating...";

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try {
          const body = await response.json();
          if (body?.error) {
            message = body.error;
          }
        } catch (_err) {}
        throw new Error(message);
      }

      let createdProject = null;
      try {
        createdProject = await response.json();
      } catch (_err) {}

      const projectId = createdProject?.id;
      const patchBody = {};
      if (optionalPayload?.repositoryUrl) {
        patchBody.repositoryUrl = optionalPayload.repositoryUrl;
      }
      if (optionalPayload?.demoUrl) {
        patchBody.demoUrl = optionalPayload.demoUrl;
      }
      if (optionalPayload?.thumbnailUrl) {
        patchBody.thumbnailUrl = optionalPayload.thumbnailUrl;
      }
      if (optionalPayload?.nextShipIsUpdate) {
        patchBody.nextShipIsUpdate = true;
      }
      if (optionalPayload?.nextShipUpdateDescription) {
        patchBody.next_ship_update_description = optionalPayload.nextShipUpdateDescription;
      }
      if (Array.isArray(optionalPayload?.hackatimeProjects) && optionalPayload.hackatimeProjects.length > 0) {
        patchBody.hackatimeProjects = optionalPayload.hackatimeProjects;
      }

      if (projectId && Object.keys(patchBody).length > 0) {
        const patchResponse = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(patchBody)
        });
        if (!patchResponse.ok) {
          throw new Error(`Created project, but optional fields failed (${patchResponse.status})`);
        }
      }

      removeCreateModal();
      window.location.reload();
    } catch (error) {
      errorNode.textContent = error instanceof Error ? error.message : "Failed to create project";
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Project";
    }
  }

  async function fetchHackatimeProjects() {
    const since = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const response = await fetch(`/api/hackatime/projects?since=${since}`, {
      method: "GET",
      credentials: "include"
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    if (!Array.isArray(data?.projects)) {
      return [];
    }
    return data.projects
      .filter((project) => typeof project?.name === "string" && project.name.trim().length > 0)
      .sort((a, b) => Number(b.total_seconds_in_window || 0) - Number(a.total_seconds_in_window || 0))
      .map((project) => ({
        name: project.name.trim(),
        seconds: Number(project.total_seconds_in_window || 0)
      }));
  }

  async function uploadProjectImage(file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload-image", {
      method: "POST",
      credentials: "include",
      body: formData
    });

    if (!response.ok) {
      throw new Error(`Image upload failed (${response.status})`);
    }

    const body = await response.json();
    const url = body?.url || body?.file;
    if (!url || typeof url !== "string") {
      throw new Error("Image upload did not return a URL");
    }
    return url;
  }

  function formatSecondsToHM(seconds) {
    const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) {
      return `${m}m`;
    }
    if (m === 0) {
      return `${h}h`;
    }
    return `${h}h ${m}m`;
  }

  function isLikelyUrl(value) {
    if (!value) {
      return true;
    }
    return /^https?:\/\//i.test(value);
  }

  function openCreateProjectModal() {
    if (document.getElementById(CREATE_MODAL_ID)) {
      return;
    }

    const root = document.createElement("div");
    root.id = CREATE_MODAL_ID;
    root.innerHTML = `
      <div class="mu-card" role="dialog" aria-modal="true" aria-label="Create Project">
        <div class="mu-paper"></div>
        <div class="mu-inner">
        <div class="mu-top">
          <div><h2>New Project</h2></div>
          <button class="mu-x" type="button" aria-label="Close">✕</button>
        </div>
        <div class="mu-hr"></div>
        <div class="mu-row">
          <label for="mu-name">Project Name</label>
          <input id="mu-name" maxlength="50" placeholder="My Awesome Project" />
        </div>
        <div class="mu-row">
          <label for="mu-desc">Description</label>
          <div class="mu-textarea-wrap">
            <textarea id="mu-desc" maxlength="1000" placeholder="Describe your project idea..."></textarea>
            <span class="mu-textarea-hint" id="mu-desc-counter">Min 0/20</span>
          </div>
        </div>
        <div class="mu-row">
          <label class="mu-mini-check" for="mu-next-ship-update">
            <input id="mu-next-ship-update" type="checkbox" />
            <span>This project is a update</span>
          </label>
        </div>
        <div class="mu-row mu-hidden" id="mu-next-ship-update-row">
          <label for="mu-next-ship-update-desc">What changed since last ship?</label>
          <textarea class="mu-mini-textarea" id="mu-next-ship-update-desc" maxlength="500" placeholder="Describe the improvements, fixes, or new features."></textarea>
        </div>
        <div class="mu-grid">
          <div class="mu-row">
            <label>Project Type</label>
            <div class="mu-type-cards" id="mu-type-cards">
              <button type="button" class="mu-type" data-type="software" data-active="true">
                <img src="/images/orpheus/orpheus_coding.webp" alt="Software">
                <span>
                  <span class="mu-type-title">Software</span>
                  <span class="mu-type-sub">Websites, apps, tools</span>
                </span>
              </button>
              <button type="button" class="mu-type" data-type="hardware" data-active="false">
                <img src="/images/orpheus/orpheus_solding.webp" alt="Hardware">
                <span>
                  <span class="mu-type-title">Hardware</span>
                  <span class="mu-type-sub">Circuits, devices, robots</span>
                </span>
              </button>
            </div>
          </div>
        </div>
        <div class="mu-row">
          <label>Complexity Level</label>
          <div class="mu-levels" id="mu-levels"></div>
        </div>
        <div class="mu-error" id="mu-error"></div>
        <div class="mu-row">
          <div class="mu-split">
            <div>
              <label for="mu-repo">GitHub URL (optional)</label>
              <input id="mu-repo" placeholder="https://github.com/user/repo" />
            </div>
            <div>
              <label for="mu-demo">Demo URL (optional)</label>
              <input id="mu-demo" placeholder="https://your-demo-site.com" />
            </div>
          </div>
        </div>
        <div class="mu-row">
          <label>Hackatime Projects (optional)</label>
          <div class="mu-pills" id="mu-hackatime-pills">
            <span class="mu-help">Loading projects...</span>
          </div>
        </div>
        <div class="mu-row">
          <label for="mu-thumb-file">Thumbnail Image (optional)</label>
          <div class="mu-upload-row" tabindex="0">
            <div class="mu-upload-overlay" aria-hidden="true"></div>
            <div class="mu-upload-control">
              <input id="mu-thumb-file" type="file" accept="image/*" class="mu-hidden" />
              <button type="button" class="mu-upload-trigger" id="mu-thumb-trigger">Choose image</button>
              <span class="mu-upload-filename" id="mu-thumb-filename">No image selected</span>
            </div>
            <span class="mu-upload-status" id="mu-thumb-status">Ready</span>
          </div>
          <div class="mu-upload-note">You can also paste an image from clipboard.</div>
        </div>
        <div class="mu-actions">
          <button class="mu-btn alt" type="button" id="mu-cancel">Cancel</button>
          <button class="mu-btn" type="button" id="mu-submit">Create Project</button>
        </div>
        </div>
      </div>
    `;

    root.addEventListener("click", (event) => {
      if (event.target === root) {
        removeCreateModal();
      }
    });

    const closeBtn = root.querySelector(".mu-x");
    const cancelBtn = root.querySelector("#mu-cancel");
    const submitBtn = root.querySelector("#mu-submit");
    const errorNode = root.querySelector("#mu-error");
    const nameInput = root.querySelector("#mu-name");
    const descInput = root.querySelector("#mu-desc");
    const descCounter = root.querySelector("#mu-desc-counter");
    const repoInput = root.querySelector("#mu-repo");
    const demoInput = root.querySelector("#mu-demo");
    const thumbFileInput = root.querySelector("#mu-thumb-file");
    const thumbTrigger = root.querySelector("#mu-thumb-trigger");
    const thumbFilename = root.querySelector("#mu-thumb-filename");
    const thumbStatus = root.querySelector("#mu-thumb-status");
    const thumbUploadRow = root.querySelector(".mu-upload-row");
    const nextShipUpdateCheckbox = root.querySelector("#mu-next-ship-update");
    const nextShipUpdateRow = root.querySelector("#mu-next-ship-update-row");
    const nextShipUpdateDescInput = root.querySelector("#mu-next-ship-update-desc");
    const hackatimePillsRoot = root.querySelector("#mu-hackatime-pills");
    const typeButtons = Array.from(root.querySelectorAll(".mu-type"));
    const levelsRoot = root.querySelector("#mu-levels");
    let selectedLevel = 1;
    let selectedType = "software";
    let uploadedThumbnailUrl = "";
    const selectedHackatimeProjects = new Set();

    const updateDescriptionCounter = () => {
      const length = String(descInput.value || "").trim().length;
      descCounter.textContent = `Min ${Math.min(length, 20)}/20`;
    };
    descInput.addEventListener("input", updateDescriptionCounter);
    updateDescriptionCounter();

    const updateNextShipVisibility = () => {
      const isUpdate = Boolean(nextShipUpdateCheckbox.checked);
      nextShipUpdateRow.classList.toggle("mu-hidden", !isUpdate);
    };

    nextShipUpdateCheckbox.addEventListener("change", updateNextShipVisibility);
    updateNextShipVisibility();

    const setThumbnailPreview = (url) => {
      if (!url) {
        thumbUploadRow.style.backgroundImage = "none";
        thumbUploadRow.setAttribute("data-has-image", "false");
        return;
      }
      const safeUrl = String(url).replace(/"/g, "\\\"");
      thumbUploadRow.style.backgroundImage = `url("${safeUrl}")`;
      thumbUploadRow.setAttribute("data-has-image", "true");
    };

    thumbTrigger.addEventListener("click", () => {
      thumbFileInput.click();
    });

    thumbFileInput.addEventListener("change", async () => {
      const file = thumbFileInput.files && thumbFileInput.files[0];
      uploadedThumbnailUrl = "";
      if (!file) {
        thumbFilename.textContent = "No image selected";
        thumbStatus.textContent = "Ready";
        setThumbnailPreview("");
        return;
      }
      thumbFilename.textContent = file.name || "pasted-image.png";
      try {
        thumbStatus.textContent = "Uploading...";
        uploadedThumbnailUrl = await uploadProjectImage(file);
        thumbStatus.textContent = "Uploaded";
        setThumbnailPreview(uploadedThumbnailUrl);
      } catch (_error) {
        thumbStatus.textContent = "Upload failed";
        setThumbnailPreview("");
      }
    });

    const handleThumbnailPaste = async (event) => {
      const items = event.clipboardData?.items;
      if (!items || !items.length) {
        return;
      }
      const imageItem = Array.from(items).find((item) => item.type && item.type.startsWith("image/"));
      if (!imageItem) {
        return;
      }
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) {
        return;
      }
      try {
        thumbStatus.textContent = "Uploading pasted image...";
        thumbFilename.textContent = file.name || "pasted-image.png";
        uploadedThumbnailUrl = await uploadProjectImage(file);
        thumbStatus.textContent = "Pasted image uploaded";
        setThumbnailPreview(uploadedThumbnailUrl);
      } catch (_error) {
        thumbStatus.textContent = "Upload failed";
        setThumbnailPreview("");
      }
    };

    thumbUploadRow.addEventListener("click", () => {
      thumbUploadRow.focus();
    });
    thumbUploadRow.addEventListener("paste", handleThumbnailPaste);
    root.addEventListener("paste", handleThumbnailPaste);

    const renderLevelCards = () => {
      const meta = LEVEL_META[selectedType] || LEVEL_META.software;
      levelsRoot.innerHTML = "";
      [1, 2, 3, 4].forEach((level) => {
        const m = meta[level];
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mu-level";
        button.setAttribute("data-level", String(level));
        button.setAttribute("data-active", selectedLevel === level ? "true" : "false");
        button.innerHTML = `
          <div class="mu-l-top">
            <span class="mu-l-title">${m.name}</span>
            <span class="mu-l-rate">${m.goldPerHour} gold/h</span>
          </div>
          <div class="mu-l-mid">
            <img src="${m.fruitIcon}" alt="${m.fruit}">
            <div class="mu-l-desc">${m.desc}</div>
          </div>
        `;
        button.addEventListener("click", () => {
          selectedLevel = level;
          renderLevelCards();
        });
        levelsRoot.appendChild(button);
      });
    };

    renderLevelCards();

    (async () => {
      try {
        const projects = await fetchHackatimeProjects();
        if (!projects.length) {
          hackatimePillsRoot.innerHTML = `<span class="mu-help">No Hackatime projects found.</span>`;
          return;
        }
        hackatimePillsRoot.innerHTML = "";
        const DEFAULT_VISIBLE_COUNT = 5;
        let expanded = false;
        let visibleCount = Math.min(DEFAULT_VISIBLE_COUNT, projects.length);

        const renderHackatimePills = () => {
          hackatimePillsRoot.innerHTML = "";
          const visibleProjects = projects.slice(0, visibleCount);

          visibleProjects.forEach((project) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "mu-pill";
            button.setAttribute("data-active", selectedHackatimeProjects.has(project.name) ? "true" : "false");
            button.innerHTML = `<span class="mu-pill-text">${project.name}, ${formatSecondsToHM(project.seconds)}</span>`;
            button.addEventListener("click", () => {
              if (selectedHackatimeProjects.has(project.name)) {
                selectedHackatimeProjects.delete(project.name);
                button.setAttribute("data-active", "false");
              } else {
                selectedHackatimeProjects.add(project.name);
                button.setAttribute("data-active", "true");
              }
            });
            hackatimePillsRoot.appendChild(button);
          });

          const remainingCount = projects.length - visibleCount;
          if (remainingCount > 0 || expanded) {
            const moreChip = document.createElement("button");
            moreChip.type = "button";
            moreChip.className = "mu-pill-more";
            moreChip.textContent = expanded ? "Show less" : `+${remainingCount} more`;
            moreChip.addEventListener("click", () => {
              expanded = !expanded;
              visibleCount = expanded ? projects.length : Math.min(DEFAULT_VISIBLE_COUNT, projects.length);
              renderHackatimePills();
            });
            hackatimePillsRoot.appendChild(moreChip);
          }
        };

        renderHackatimePills();
      } catch (_error) {
        hackatimePillsRoot.innerHTML = `<span class="mu-help">Could not load Hackatime projects.</span>`;
      }
    })();

    typeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        selectedType = button.getAttribute("data-type") || "software";
        typeButtons.forEach((b) => {
          b.setAttribute("data-active", b === button ? "true" : "false");
        });
        renderLevelCards();
      });
    });

    closeBtn.addEventListener("click", removeCreateModal);
    cancelBtn.addEventListener("click", removeCreateModal);
    submitBtn.addEventListener("click", async () => {
      const name = String(nameInput.value || "").trim();
      const description = String(descInput.value || "").trim();
      const repositoryUrl = String(repoInput.value || "").trim();
      const demoUrl = String(demoInput.value || "").trim();
      const nextShipUpdateDescription = String(nextShipUpdateDescInput.value || "").trim();
      const nextShipIsUpdate = Boolean(nextShipUpdateCheckbox.checked);
      const type = selectedType;

      if (!name) {
        errorNode.textContent = "Project name is required.";
        return;
      }
      if (description.length < 20) {
        errorNode.textContent = "Description must be at least 20 characters.";
        return;
      }
      if (type !== "software" && type !== "hardware") {
        errorNode.textContent = "Project type is invalid.";
        return;
      }
      if (![1, 2, 3, 4].includes(selectedLevel)) {
        errorNode.textContent = "Project level is invalid.";
        return;
      }

      if (!isLikelyUrl(repositoryUrl)) {
        errorNode.textContent = "GitHub URL must start with http:// or https://";
        return;
      }
      if (!isLikelyUrl(demoUrl)) {
        errorNode.textContent = "Demo URL must start with http:// or https://";
        return;
      }

      const selectedThumbFile = thumbFileInput.files && thumbFileInput.files[0];
      if (selectedThumbFile && !uploadedThumbnailUrl) {
        try {
          thumbStatus.textContent = "Uploading...";
          uploadedThumbnailUrl = await uploadProjectImage(selectedThumbFile);
          thumbStatus.textContent = "Uploaded";
        } catch (_error) {
          errorNode.textContent = "Thumbnail upload failed.";
          thumbStatus.textContent = "Upload failed";
          return;
        }
      }

      submitCreateProject(
        { name, description, type, level: selectedLevel },
        {
          repositoryUrl,
          demoUrl,
          thumbnailUrl: uploadedThumbnailUrl,
          nextShipIsUpdate,
          nextShipUpdateDescription: nextShipIsUpdate ? nextShipUpdateDescription : "",
          hackatimeProjects: Array.from(selectedHackatimeProjects)
        },
        errorNode,
        submitBtn
      );
    });

    document.body.appendChild(root);
    nameInput.focus();
    document.addEventListener("keydown", onCreateEscape, true);
  }

  function maybeInterceptCreateTileClick(event) {
    if (IS_HARVEST_TAB) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }

    const addTile = target.closest("#projects .farm-tile-add");
    if (!addTile) {
      return;
    }

    if (Date.now() < suppressNextCreateTileClickUntil) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openCreateProjectModal();
  }

  function trackCreateTilePointerDown(event) {
    const target = event.target instanceof Element ? event.target : null;
    const addTile = target ? target.closest("#projects .farm-tile-add") : null;
    if (!addTile) {
      createTilePointerState = null;
      return;
    }

    createTilePointerState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragged: false
    };
  }

  function trackCreateTilePointerMove(event) {
    if (!createTilePointerState || createTilePointerState.pointerId !== event.pointerId) {
      return;
    }

    const dx = Math.abs(event.clientX - createTilePointerState.startX);
    const dy = Math.abs(event.clientY - createTilePointerState.startY);
    if (dx >= CREATE_TILE_DRAG_THRESHOLD_PX || dy >= CREATE_TILE_DRAG_THRESHOLD_PX) {
      createTilePointerState.dragged = true;
    }
  }

  function trackCreateTilePointerUp(event) {
    if (!createTilePointerState || createTilePointerState.pointerId !== event.pointerId) {
      return;
    }

    if (createTilePointerState.dragged) {
      suppressNextCreateTileClickUntil = Date.now() + 300;
    }
    createTilePointerState = null;
  }

  function hasProjectContextOnPage() {
    return Boolean(document.querySelector("#projects .farm-tile-project")) || Boolean(document.querySelector("a[href*='/projects/']"));
  }

  async function computeWeightedGoldPerHourFromProjects() {
    await bootstrapProjectIdsFromHiddenHarvestOnce();
    const discoveredFromDom = getProjectIdsFromDomLinks(document);
    if (discoveredFromDom.length) {
      mergeKnownProjectIds(discoveredFromDom);
    }
    const projectIds = getKnownProjectIds();
    if (!projectIds.length) {
      if (ALLOW_VISIBLE_FALLBACK_HARVEST) {
        const harvested = await harvestProjectMetricsFromFarmTiles();
        if (harvested.length) {
          projectTileOrder = harvested.map((metrics) => String(metrics.projectId));
          writeProjectTileOrderCache(projectTileOrder);
          return computeWeightedGoldPerHourFromProjects();
        }
      }
      return null;
    }

    let weightedRateSum = 0;
    let totalHours = 0;
    const mergedTitles = { ...projectTitleById };
    const mergedMeta = { ...projectMetaById };

    for (const projectId of projectIds) {
      try {
        const html = await fetchProjectHtml(projectId);
        if (!html) {
          continue;
        }
        const title = parseProjectTitleFromHtml(html);
        if (title) {
          mergedTitles[String(projectId)] = title;
        }
        const metrics = parseProjectMetricsFromHtml(html);
        if (!metrics) {
          continue;
        }
        const meta = buildProjectMeta(title, metrics);
        if (meta) {
          mergedMeta[String(projectId)] = meta;
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

    let shouldResyncLabels = false;

    if (Object.keys(mergedTitles).length > Object.keys(projectTitleById).length) {
      projectTitleById = mergedTitles;
      writeProjectTitleCache(projectTitleById);
      shouldResyncLabels = true;
    }
    if (Object.keys(mergedMeta).length > 0) {
      const beforeMeta = JSON.stringify(projectMetaById);
      const afterMeta = JSON.stringify(mergedMeta);
      projectMetaById = mergedMeta;
      writeProjectLabelMetaCache(projectMetaById);
      if (beforeMeta !== afterMeta) {
        shouldResyncLabels = true;
      }
    }
    if (shouldResyncLabels) {
      queueProjectGroundLabelsSync();
    }

    return {
      effectiveGoldPerHour: weightedRateSum / totalHours,
      projectIds,
      totalHours
    };
  }

  async function refreshProjectLabelMeta() {
    const now = Date.now();
    if (projectMetaRefreshInFlight || now - lastProjectMetaRefreshAt < PROJECT_LABEL_META_REFRESH_MS) {
      return;
    }
    projectMetaRefreshInFlight = true;

    try {
      await bootstrapProjectIdsFromHiddenHarvestOnce();
      const discoveredFromDom = getProjectIdsFromDomLinks(document);
      if (discoveredFromDom.length) {
        mergeKnownProjectIds(discoveredFromDom);
      }
      const projectIds = getKnownProjectIds();
      if (!projectIds.length) {
        lastProjectMetaRefreshAt = now;
        return;
      }

      const mergedTitles = { ...projectTitleById };
      const mergedMeta = { ...projectMetaById };

      for (const projectId of projectIds) {
        try {
          const html = await fetchProjectHtml(projectId);
          if (!html) {
            continue;
          }
          const title = parseProjectTitleFromHtml(html);
          if (title) {
            mergedTitles[String(projectId)] = title;
          }
          const metrics = parseProjectMetricsFromHtml(html);
          if (!metrics) {
            continue;
          }
          const meta = buildProjectMeta(title, metrics);
          if (meta) {
            mergedMeta[String(projectId)] = meta;
          }
        } catch (_err) {
          continue;
        }
      }

      const titlesBefore = JSON.stringify(projectTitleById);
      const titlesAfter = JSON.stringify(mergedTitles);
      const metaBefore = JSON.stringify(projectMetaById);
      const metaAfter = JSON.stringify(mergedMeta);

      if (titlesBefore !== titlesAfter) {
        projectTitleById = mergedTitles;
        writeProjectTitleCache(projectTitleById);
      }
      if (metaBefore !== metaAfter) {
        projectMetaById = mergedMeta;
        writeProjectLabelMetaCache(projectMetaById);
        queueProjectGroundLabelsSync();
      }

      lastProjectMetaRefreshAt = Date.now();
    } finally {
      projectMetaRefreshInFlight = false;
    }
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
        refreshProjectLabelMeta();
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
    queueProjectGroundLabelsSync();
    ensureProjectLabelSettingsButton();
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

  projectTitleById = readProjectTitleCache();
  projectMetaById = readProjectLabelMetaCache();
  projectLabelPrefs = readProjectLabelPrefsCache();
  projectTileOrder = readProjectTileOrderCache();
  projectIdsBootstrapped = readProjectIdBootstrapCache();
  if (!projectTileOrder.length) {
    const fromTitles = Object.keys(projectTitleById);
    if (fromTitles.length) {
      projectTileOrder = fromTitles;
    } else {
      projectTileOrder = readProjectIdsFromRateCache();
    }
  }
  if (projectTileOrder.length) {
    projectIdsBootstrapped = true;
    writeProjectIdBootstrapCache(true);
  }

  document.addEventListener("pointerdown", trackCreateTilePointerDown, true);
  document.addEventListener("pointermove", trackCreateTilePointerMove, true);
  document.addEventListener("pointerup", trackCreateTilePointerUp, true);
  document.addEventListener("pointercancel", trackCreateTilePointerUp, true);
  document.addEventListener("click", maybeInterceptCreateTileClick, true);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(`#${PROJECT_LABEL_SETTINGS_ID}`)) {
      closeProjectLabelSettingsPanel();
    }
  });
  window.addEventListener("resize", queueProjectGroundLabelsSync);

  updateShopCardHours();
  queueProjectGroundLabelsSync();
  ensureProjectLabelSettingsButton();
  hydrateProjectTitlesFromKnownIds();
  refreshProjectLabelMeta();
  refreshEffectiveRate();
  setInterval(() => {
    refreshProjectLabelMeta();
  }, PROJECT_LABEL_META_REFRESH_MS);
  setInterval(() => {
    refreshEffectiveRate();
  }, PROJECT_CACHE_TTL_MS);
  setTimeout(function scheduleMidnightRefresh() {
    refreshEffectiveRate();
    setTimeout(scheduleMidnightRefresh, msUntilNextLocalMidnight());
  }, msUntilNextLocalMidnight());

  window.addEventListener("focus", () => {
    refreshProjectLabelMeta();
    refreshEffectiveRate();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshProjectLabelMeta();
      refreshEffectiveRate();
    }
  });
  window.addEventListener("load", () => {
    refreshProjectLabelMeta();
    refreshEffectiveRate();
  });
  console.log(`${DEBUG_PREFIX} content script loaded`);
})();
