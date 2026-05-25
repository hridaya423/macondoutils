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
  const CREATE_TILE_DRAG_THRESHOLD_PX = 6;
  const PROJECT_LABEL_LAYER_ID = "macondo-utils-project-label-layer";
  const PROJECT_LABEL_TEXT_MAX = 26;
  const CREATE_MODAL_ID = "macondo-utils-create-modal";
  const CREATE_STYLE_ID = "macondo-utils-create-style";
  let createTilePointerState = null;
  let suppressNextCreateTileClickUntil = 0;
  let projectLabelsQueued = false;
  let projectTitleById = {};
  let projectTileOrder = [];
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

  function applyMeasuredLabelCandidate(label, candidate, layerRect) {
    label.setAttribute("data-placement", candidate.placement);
    label.style.left = `${Math.round(candidate.anchor.x)}px`;
    label.style.top = `${Math.round(candidate.anchor.y)}px`;
    const rect = label.getBoundingClientRect();
    return {
      x: rect.left - layerRect.left,
      y: rect.top - layerRect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function scoreMeasuredLabelRect(rect, bounds, visualObstacleRects, placedLabelRects, placementIndex, ownTileId) {
    let score = placementIndex * 80;

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

  function chooseMeasuredTileLabelPlacement(tileModel, label, layerRect, bounds, visualObstacleRects, placedLabelRects, sharedSide) {
    const placements = sharedSide
      ? ["bottom", sharedSide, sharedSide === "right" ? "left" : "right", "top"]
      : ["bottom", "top", "right", "left"];

    let best = null;
    placements.forEach((placement, index) => {
      const candidate = getTileLabelCandidate(tileModel, placement);
      const rect = applyMeasuredLabelCandidate(label, candidate, layerRect);
      const score = scoreMeasuredLabelRect(rect, bounds, visualObstacleRects, placedLabelRects, index, tileModel.tileId);
      if (!best || score < best.score) {
        best = { ...candidate, rect, score };
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
    const obstacleTiles = Array.from(projectsRoot.querySelectorAll(".farm-tile-project, .farm-tile-add"));
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

    const tileRects = obstacleTiles.map((tile, index) => {
      const tileId = tile.dataset.muTileId || `obstacle-${index}`;
      if (!tile.dataset.muTileId) {
        tile.dataset.muTileId = tileId;
      }
      const left = tile.offsetLeft;
      const top = tile.offsetTop;
      return {
        tileId,
        x: left,
        y: top,
        width: tile.offsetWidth || 120,
        height: tile.offsetHeight || 90
      };
    });
    const bounds = {
      width: projectsRoot.clientWidth || projectsRoot.offsetWidth || 0,
      height: projectsRoot.clientHeight || projectsRoot.offsetHeight || 0
    };
    const visualObstacleRects = getProjectVisualObstacleRects(projectsRoot);
    const placedLabelRects = [];
    const sharedSideByTile = getClusterSharedSideByTile(tileModels, bounds);

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
          sharedSideByTile.get(tileModel.tileId)
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
    if (Object.keys(projectTitleById).length > 0) {
      return;
    }

    const ids = getKnownProjectIds();
    if (!ids.length) {
      return;
    }

    const mergedTitles = { ...projectTitleById };
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
      } catch (_err) {
        continue;
      }
    }

    if (Object.keys(mergedTitles).length > 0) {
      projectTitleById = mergedTitles;
      writeProjectTitleCache(projectTitleById);
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
      const mergedTitles = { ...projectTitleById };
      harvested.forEach((metrics) => {
        weightedRateSum += metrics.hours * metrics.goldPerHour;
        totalHours += metrics.hours;
        harvestedIds.push(metrics.projectId);
        if (metrics.title) {
          mergedTitles[String(metrics.projectId)] = String(metrics.title).trim();
        }
      });

      if (Object.keys(mergedTitles).length > Object.keys(projectTitleById).length) {
        projectTitleById = mergedTitles;
        writeProjectTitleCache(projectTitleById);
      }
      projectTileOrder = harvestedIds.map((id) => String(id));
      writeProjectTileOrderCache(projectTileOrder);
      queueProjectGroundLabelsSync();

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
    const mergedTitles = { ...projectTitleById };

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
        weightedRateSum += metrics.hours * metrics.goldPerHour;
        totalHours += metrics.hours;
      } catch (_err) {
        continue;
      }
    }

    if (totalHours <= 0 || weightedRateSum <= 0) {
      return null;
    }

    if (Object.keys(mergedTitles).length > Object.keys(projectTitleById).length) {
      projectTitleById = mergedTitles;
      writeProjectTitleCache(projectTitleById);
      queueProjectGroundLabelsSync();
    }
    projectTileOrder = projectIds.map((id) => String(id));
    writeProjectTileOrderCache(projectTileOrder);

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
    queueProjectGroundLabelsSync();
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
  projectTileOrder = readProjectTileOrderCache();
  if (!projectTileOrder.length) {
    const fromTitles = Object.keys(projectTitleById);
    if (fromTitles.length) {
      projectTileOrder = fromTitles;
    } else {
      projectTileOrder = readProjectIdsFromRateCache();
    }
  }

  document.addEventListener("pointerdown", trackCreateTilePointerDown, true);
  document.addEventListener("pointermove", trackCreateTilePointerMove, true);
  document.addEventListener("pointerup", trackCreateTilePointerUp, true);
  document.addEventListener("pointercancel", trackCreateTilePointerUp, true);
  document.addEventListener("click", maybeInterceptCreateTileClick, true);
  window.addEventListener("resize", queueProjectGroundLabelsSync);

  updateShopCardHours();
  queueProjectGroundLabelsSync();
  hydrateProjectTitlesFromKnownIds();
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
