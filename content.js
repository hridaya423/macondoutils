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
  const PROJECT_CACHE_KEY = "macondo_utils_project_rates";
  const PROJECT_TILE_ORDER_CACHE_KEY = "macondo_utils_project_tile_order";
  const PROJECT_ID_BOOTSTRAP_CACHE_KEY = "macondo_utils_project_id_bootstrap";
  const PROJECT_OWNER_NAME_CACHE_KEY = "macondo_utils_owner_name";
  const PROJECT_LABEL_PREFS_CACHE_KEY = "macondo_utils_project_label_prefs";
  const PROJECT_GOALS_CACHE_KEY = "macondo_utils_project_goals";
  const PROJECT_GOALS_ORDER_SYNC_CACHE_KEY = "macondo_utils_project_goals_order_sync";
  const PROJECT_METRICS_SNAPSHOT_CACHE_KEY = "macondo_utils_project_metrics_snapshot";
  const HACKATIME_PROJECTS_CACHE_KEY = "macondo_utils_hackatime_projects";
  const PROJECT_RATE_CACHE_TTL_MS = 2 * 60 * 1000;
  const HACKATIME_PROJECTS_CACHE_TTL_MS = 30 * 60 * 1000;
  const HACKATIME_PROJECTS_WINDOW_DAYS = 365;
  const PROJECT_LABEL_META_REFRESH_MS = 60 * 1000;
  const PROJECT_GOALS_ORDER_SYNC_MS = 5 * 60 * 1000;
  const PROJECT_FETCH_LIMIT = 80;
  const HIDDEN_HARVEST_FAILURE_BACKOFF_MS = 60 * 1000;
  const FARM_THEME_MAX_RASTER_PIXELS = 4200000;
  const CATPUCCIN_BACKGROUND_ASSET_PATH = "themeassets/catpuccin/catpuccin_background.png";
  const CATPUCCIN_HARDCODED_ASSET_PATH_MAP = {
    "/images/dashboard/en/donkey.webp": "themeassets/catpuccin/images/dashboard/en/donkey.png",
    "/images/dashboard/en/house.webp": "themeassets/catpuccin/images/dashboard/en/house.png",
    "/images/dashboard/en/explore.webp": "themeassets/catpuccin/images/dashboard/en/explore.png",
    "/images/tierra/ground_tile.webp": "themeassets/catpuccin/images/tierra/ground_tile.png",
    "/images/dashboard/palma.webp": "themeassets/catpuccin/images/dashboard/palma.png",
    "/images/fruits/mango/etapa_1.webp": "themeassets/catpuccin/images/fruits/mango/etapa_1.png",
    "/images/fruits/mango/etapa_2.webp": "themeassets/catpuccin/images/fruits/mango/etapa_2.png",
    "/images/fruits/mango/etapa_3.webp": "themeassets/catpuccin/images/fruits/mango/etapa_3.png",
    "/images/fruits/mango/etapa_4.webp": "themeassets/catpuccin/images/fruits/mango/etapa_4.png",
    "/images/fruits/pineapple/etapa_1.webp": "themeassets/catpuccin/images/fruits/pineapple/etapa_1.png",
    "/images/fruits/pineapple/etapa_2.webp": "themeassets/catpuccin/images/fruits/pineapple/etapa_2.png",
    "/images/fruits/pineapple/etapa_3.webp": "themeassets/catpuccin/images/fruits/pineapple/etapa_3.png",
    "/images/fruits/pineapple/etapa_4.webp": "themeassets/catpuccin/images/fruits/pineapple/etapa_4.png",
    "/images/fruits/papaya/etapa_1.webp": "themeassets/catpuccin/images/fruits/papaya/etapa_1.png",
    "/images/fruits/papaya/etapa_2.webp": "themeassets/catpuccin/images/fruits/papaya/etapa_2.png",
    "/images/fruits/papaya/etapa_3.webp": "themeassets/catpuccin/images/fruits/papaya/etapa_3.png",
    "/images/fruits/papaya/etapa_4.webp": "themeassets/catpuccin/images/fruits/papaya/etapa_4.png",
    "/images/fruits/cocoa/etapa_1.webp": "themeassets/catpuccin/images/fruits/cocoa/etapa_1.png",
    "/images/fruits/cocoa/etapa_2.webp": "themeassets/catpuccin/images/fruits/cocoa/etapa_2.png",
    "/images/fruits/cocoa/etapa_3.webp": "themeassets/catpuccin/images/fruits/cocoa/etapa_3.png",
    "/images/fruits/cocoa/etapa_4.webp": "themeassets/catpuccin/images/fruits/cocoa/etapa_4.png"
  };
  let effectiveGoldPerHour = null;
  let refreshInFlight = false;
  let pendingRender = false;
  let harvestInFlight = false;
  let hiddenHarvestRequestPromise = null;
  let hiddenHarvestDisabledUntil = 0;
  let refreshRetryTimer = null;
  const DEBUG_PREFIX = "[Macondo Utils]";
  const IS_HARVEST_TAB = new URLSearchParams(window.location.search).has("macondo_utils_harvest");
  const ALLOW_VISIBLE_FALLBACK_HARVEST = false;
  const CREATE_TILE_DRAG_THRESHOLD_PX = 6;
  const PROJECT_LABEL_LAYER_ID = "macondo-utils-project-label-layer";
  const PROJECT_LABEL_SETTINGS_ID = "macondo-utils-project-label-settings";
  const STREAK_HOVER_CARD_ID = "macondo-utils-streak-hover-card";
  const GOALS_HUD_ID = "macondo-utils-goals-mini";
  const GOALS_NATIVE_EXTRA_ID = "macondo-utils-goals-native-extra";
  const ONBOARDING_STATE_KEY = "macondo_utils_onboarding_state";
  const ONBOARDING_ROOT_ID = "macondo-utils-onboarding";
  const ONBOARDING_VERSION = typeof chrome !== "undefined" && chrome.runtime?.getManifest
    ? chrome.runtime.getManifest().version
    : "0.1.0";
  const PROJECT_LABEL_TEXT_MAX = 26;
  const CREATE_MODAL_ID = "macondo-utils-create-modal";
  const CREATE_STYLE_ID = "macondo-utils-create-style";
  const DASHBOARD_TOP_BAR_SELECTOR = "[class*='absolute'][class*='top-0']";
  const SETTINGS_BUTTON_TARGET_SELECTOR = `${DASHBOARD_TOP_BAR_SELECTOR} [class*='ml-auto'], ${DASHBOARD_TOP_BAR_SELECTOR} [class*='items-center'][class*='justify-between'] > div:last-child`;
  let createTilePointerState = null;
  let suppressNextCreateTileClickUntil = 0;
  let projectLabelsQueued = false;
  let projectMetaRefreshInFlight = false;
  let lastProjectMetaRefreshAt = 0;
  let projectIdsBootstrapped = false;
  let currentOwnerName = "";
  let projectTitleById = {};
  let projectMetaById = {};
  let projectTileOrder = [];
  let projectGoals = [];
  let goalOrderedItemIds = new Set();
  let goalOrderSyncInFlight = false;
  let lastGoalOrderSyncAt = 0;
  let lastProjectLabelsSignature = "";
  let goalsMiniQueued = false;
  let goalsMiniRetryTimer = null;
  let shopModalUiQueued = false;
  let shopModalReadyProbeTimer = null;
  let shopModalReadyProbeAttempts = 0;
  let shopModalObserver = null;
  let shopModalObservedRoot = null;
  let lastGoalsMiniSignature = "";
  let goalsViewMode = "actual";
  let goalsProgressMode = "cumulative";
  let draggedGoalId = "";
  let draggedGoalPreviewNode = null;
  let suppressedObserverMutations = 0;
  let streakHoverCardHideTimer = null;
  let streakHoverDataPromise = null;
  let streakHoverData = null;
  let streakHoverDataCacheKey = "";
  let lastFarmThemeDebugSignature = "";
  let farmThemeRefreshQueued = false;
  let farmThemeRefreshToken = 0;
  const farmThemeCanvasOriginals = new WeakMap();
  let onboardingQueued = false;
  let onboardingTargetNode = null;
  let onboardingAutoStarDone = false;
  let settingsButtonQueued = false;
  let projectLabelPrefs = {
    showHours: true,
    showStreak: true,
    showEstCoins: true,
    showGoalsHud: true,
    hudSize: "medium",
    goalsViewMode: "actual",
    goalsProgressMode: "cumulative",
    showHudGoalsStat: true,
    showHudProgressStat: true,
    showHudRemainingStat: true,
    showHudEtaStat: true,
    theme: "default"
  };
  const LABEL_PLACEMENT_OFFSETS = {
    bottom: { x: 17, y: -14 },
    top: { x: -42, y: -50 },
    left: { x: 42, y: 14 },
    right: { x: -52, y: -47 }
  };
  const LABEL_PLACEMENT_TILTS = {
    bottom: 3,
    top: 2,
    left: -7,
    right: -9
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
    const raw = String(text || "").trim();
    const match = raw.match(/(\d[\d,]*(?:\.\d+)?)\s*([kKmMbB]?)/);
    if (!match) {
      return null;
    }
    let value = Number.parseFloat(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) {
      return null;
    }
    const suffix = match[2].toLowerCase();
    if (suffix === "k") {
      value *= 1e3;
    } else if (suffix === "m") {
      value *= 1e6;
    } else if (suffix === "b") {
      value *= 1e9;
    }
    return value;
  }

  function formatCompactGold(value) {
    const n = Math.round(Number(value) || 0);
    if (n >= 1e9) {
      return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1).replace(/\.0$/, "")}B`;
    }
    if (n >= 1e6) {
      return `${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1).replace(/\.0$/, "")}M`;
    }
    if (n >= 1e3) {
      return `${(n / 1e3).toFixed(n % 1e3 === 0 ? 0 : 1).replace(/\.0$/, "")}k`;
    }
    return String(n);
  }

  function normalizeGoalsProgressMode(mode) {
    return String(mode || "").toLowerCase() === "individual" ? "individual" : "cumulative";
  }

  function normalizeTheme(value) {
    const normalized = String(value || "").toLowerCase();
    return normalized === "catpuccin" || normalized === "dark" || normalized === "dark mode"
      ? "dark"
      : "default";
  }

  function normalizeHudSize(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "small" || normalized === "high") {
      return normalized;
    }
    if (normalized === "large") {
      return "high";
    }
    return "medium";
  }

  function isCatpuccinThemeActive() {
    return normalizeTheme(projectLabelPrefs.theme) === "dark";
  }

  function getStreakThemePalette() {
    if (isCatpuccinThemeActive()) {
      return {
        cardBg: "#1e1e2e",
        cardBorder: "#b4befe",
        cardShadow: "0 18px 42px rgba(17, 17, 27, 0.46)",
        text: "#cdd6f4",
        subtext: "#bac2de",
        muted: "rgba(166, 173, 200, 0.88)",
        rule: "rgba(127, 132, 156, 0.5)",
        panelBg: "rgba(49, 50, 68, 0.92)",
        panelBorder: "rgba(88, 91, 112, 0.95)",
        freezeBg: "rgba(137, 180, 250, 0.16)",
        freezeBorder: "rgba(180, 190, 254, 0.62)",
        freezeText: "#89b4fa",
        active: "#fab387",
        activeStroke: "#f38ba8",
        frozen: "#89b4fa",
        frozenStroke: "#74c7ec",
        review: "#b4befe",
        reviewStroke: "#cba6f7",
        partial: "#f9e2af",
        partialStroke: "#fab387",
        inactive: "#6c7086",
        inactiveStroke: "#9399b2",
        chartLine: "#cba6f7",
        chartTarget: "rgba(180, 190, 254, 0.8)",
        chartAxis: "rgba(166, 173, 200, 0.32)",
        chartAxisStrong: "rgba(166, 173, 200, 0.56)",
        progressTrack: "rgba(69, 71, 90, 0.92)",
        progressFill: "#cba6f7",
        progressBorder: "rgba(180, 190, 254, 0.62)"
      };
    }

    return {
      cardBg: "#f6ead2",
      cardBorder: "#5c3b20",
      cardShadow: "0 16px 36px rgba(74, 48, 24, 0.22)",
      text: "#684d3a",
      subtext: "rgba(104,77,58,0.8)",
      muted: "rgba(104,77,58,0.6)",
      rule: "rgba(104,77,58,0.15)",
      panelBg: "rgba(104,77,58,0.05)",
      panelBorder: "rgba(104,77,58,0.2)",
      freezeBg: "rgb(236 254 255)",
      freezeBorder: "rgba(14,116,144,0.4)",
      freezeText: "rgb(22 78 99)",
      active: "#f97316",
      activeStroke: "#c2410c",
      frozen: "#22d3ee",
      frozenStroke: "#0e7490",
      review: "#7dd3fc",
      reviewStroke: "#0369a1",
      partial: "#fde047",
      partialStroke: "#ca8a04",
      inactive: "#cbd5e1",
      inactiveStroke: "#94a3b8",
      chartLine: "#684d3a",
      chartTarget: "#b08f74",
      chartAxis: "rgba(104,77,58,0.28)",
      chartAxisStrong: "rgba(104,77,58,0.58)",
      progressTrack: "rgba(104,77,58,0.12)",
      progressFill: "#ea580c",
      progressBorder: "rgba(104,77,58,0.28)"
    };
  }

  function applySelectedTheme() {
    const root = document.documentElement;
    if (!(root instanceof HTMLElement)) {
      return;
    }
    const theme = normalizeTheme(projectLabelPrefs.theme);
    root.classList.toggle("mu-theme-catpuccin", theme === "dark");
    syncGameWorldThemeBackground();
    syncFarmThemeTargets();
  }

  const CATPUCCIN_BACKGROUND_STYLE_ID = "mu-catpuccin-background-rule";

  function syncGameWorldThemeBackground() {
    const assetUrl = isCatpuccinThemeActive() && chrome?.runtime?.getURL
      ? chrome.runtime.getURL(CATPUCCIN_BACKGROUND_ASSET_PATH)
      : "";
    let styleEl = document.getElementById(CATPUCCIN_BACKGROUND_STYLE_ID);
    if (!assetUrl) {
      if (styleEl) {
        styleEl.remove();
      }
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = CATPUCCIN_BACKGROUND_STYLE_ID;
      document.documentElement.appendChild(styleEl);
    }
    styleEl.textContent = `.game-world[data-v-e25639c6] {
      background: url("${assetUrl}") 0 0 / cover no-repeat !important;
    }`;
  }

  function describeElementForDebug(node) {
    if (!(node instanceof HTMLElement)) {
      return "<null>";
    }
    const id = node.id ? `#${node.id}` : "";
    const className = typeof node.className === "string"
      ? `.${node.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".")}`
      : "";
    return `${node.tagName.toLowerCase()}${id}${className}`;
  }

  function clearFarmThemeTargets() {
    Array.from(document.querySelectorAll("[data-mu-farm-root], [data-mu-farm-visual]")).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      delete node.dataset.muFarmRoot;
      delete node.dataset.muFarmVisual;
    });
  }

  function getFarmThemeRasterKind(node, precomputedStyle) {
    if (!(node instanceof HTMLElement)) {
      return "";
    }
    if (node instanceof HTMLCanvasElement) {
      return "canvas";
    }
    if (node instanceof HTMLImageElement) {
      return "image";
    }
    const style = precomputedStyle || window.getComputedStyle(node);
    return extractFirstBackgroundImageUrl(style.backgroundImage) ? "background" : "";
  }

  function syncFarmThemeTargets() {
    clearFarmThemeTargets();
    if (!isCatpuccinThemeActive()) {
      lastFarmThemeDebugSignature = "";
      queueFarmThemeVisualRefresh();
      return;
    }

    const projectsRoot = document.getElementById("projects");
    if (!(projectsRoot instanceof HTMLElement)) {
      queueFarmThemeVisualRefresh();
      return;
    }

    let farmRoot = projectsRoot.parentElement;
    let current = projectsRoot;
    while (current instanceof HTMLElement && current !== document.body) {
      const rect = current.getBoundingClientRect();
      if (rect.width >= window.innerWidth * 0.45 && rect.height >= window.innerHeight * 0.45) {
        farmRoot = current;
      }
      current = current.parentElement;
    }
    if (!(farmRoot instanceof HTMLElement)) {
      farmRoot = projectsRoot;
    }
    farmRoot.dataset.muFarmRoot = "true";

    const explicitFarmAssetSelectors = [
      "img.donkey-img",
      "img.explore-img",
      "img.house-img",
      "img.tile-img",
      "img.plot-fruit-icon-iso",
      "img.palma",
      "img[src*='/images/dashboard/en/donkey.webp']",
      "img[src*='/images/dashboard/en/explore.webp']",
      "img[src*='/images/dashboard/en/house.webp']",
      "img[src*='/images/tierra/ground_tile.webp']",
      "img[src*='/images/dashboard/palma.webp']",
      "img[src*='/images/fruits/'][src*='/etapa_1.webp']",
      "img[src*='/images/fruits/'][src*='/etapa_2.webp']",
      "img[src*='/images/fruits/'][src*='/etapa_3.webp']",
      "img[src*='/images/fruits/'][src*='/etapa_4.webp']"
    ];
    let explicitFarmAssetIndex = 0;
    explicitFarmAssetSelectors.forEach((selector) => {
      Array.from(document.querySelectorAll(selector)).forEach((node) => {
        if (!(node instanceof HTMLElement) || isExtensionManagedNode(node)) {
          return;
        }
        node.dataset.muFarmVisual = `explicit-${explicitFarmAssetIndex}`;
        explicitFarmAssetIndex += 1;
      });
    });

    const seen = new Set();
    const candidates = [];
    const minWidth = Math.min(window.innerWidth * 0.35, 320);
    const minHeight = Math.min(window.innerHeight * 0.35, 220);

    function consider(node) {
      if (!(node instanceof HTMLElement) || seen.has(node) || isExtensionManagedNode(node)) {
        return;
      }
      seen.add(node);

      const rect = node.getBoundingClientRect();
      if (rect.width < minWidth || rect.height < minHeight) {
        return;
      }

      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return;
      }

      const rasterKind = getFarmThemeRasterKind(node, style);
      if (!rasterKind) {
        return;
      }

      let score = (rect.width * rect.height) / Math.max(1, window.innerWidth * window.innerHeight);
      const hasBackgroundImage = style.backgroundImage && style.backgroundImage !== "none";
      const name = `${node.id || ""} ${typeof node.className === "string" ? node.className : ""}`;

      if (hasBackgroundImage) {
        score += 24;
      }
      if (rasterKind === "canvas") {
        score += 22;
      }
      if (rasterKind === "image") {
        score += 18;
      }
      if (rasterKind === "background") {
        score += 14;
      }
      if (/background|world|viewport|pane|layer|map|farm/i.test(name)) {
        score += 6;
      }
      if (style.position === "absolute" || style.position === "fixed") {
        score += 3;
      }
      if (node === projectsRoot || node.contains(projectsRoot) || projectsRoot.contains(node)) {
        score -= 6;
      }

      candidates.push({ node, score, rect, hasBackgroundImage });
    }

    consider(farmRoot);
    Array.from(farmRoot.children).forEach((child) => {
      consider(child);
      Array.from(child.children).forEach((grandchild) => consider(grandchild));
    });

    candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .forEach((candidate, index) => {
        if (!candidate.node.dataset.muFarmVisual) {
          candidate.node.dataset.muFarmVisual = index === 0 ? "primary" : index === 1 ? "secondary" : "tertiary";
        }
      });

    const signature = candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((candidate) => `${describeElementForDebug(candidate.node)}:${candidate.score.toFixed(2)}`)
      .join(" | ");
    if (signature && signature !== lastFarmThemeDebugSignature) {
      lastFarmThemeDebugSignature = signature;
      console.debug(`${DEBUG_PREFIX} farm theme targets`, {
        root: describeElementForDebug(farmRoot),
        candidates: candidates
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((candidate) => ({
            node: describeElementForDebug(candidate.node),
            score: Number(candidate.score.toFixed(2)),
            hasBackgroundImage: candidate.hasBackgroundImage,
            width: Math.round(candidate.rect.width),
            height: Math.round(candidate.rect.height)
          }))
      });
    }

    queueFarmThemeVisualRefresh();
  }

  function clamp(value, min = 0, max = 1) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(start, end, t) {
    return start + ((end - start) * clamp(t));
  }

  function smoothstep(min, max, value) {
    if (max <= min) {
      return value >= max ? 1 : 0;
    }
    const t = clamp((value - min) / (max - min));
    return t * t * (3 - (2 * t));
  }

  function mixAnglesDeg(from, to, t) {
    const amount = clamp(t);
    const delta = ((((to - from) % 360) + 540) % 360) - 180;
    return (from + (delta * amount) + 360) % 360;
  }

  function hueDistanceDeg(a, b) {
    return Math.abs(((((Number(a) - Number(b)) % 360) + 540) % 360) - 180);
  }

  function hueProximity(center, width, hue) {
    return 1 - clamp(hueDistanceDeg(hue, center) / Math.max(1, width));
  }

  function srgbChannelToLinear(value) {
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function linearChannelToSrgb(value) {
    return value <= 0.0031308 ? value * 12.92 : (1.055 * Math.pow(value, 1 / 2.4)) - 0.055;
  }

  function rgbToOklab(r, g, b) {
    const lr = srgbChannelToLinear(clamp(r));
    const lg = srgbChannelToLinear(clamp(g));
    const lb = srgbChannelToLinear(clamp(b));

    const l = (0.4122214708 * lr) + (0.5363325363 * lg) + (0.0514459929 * lb);
    const m = (0.2119034982 * lr) + (0.6806995451 * lg) + (0.1073969566 * lb);
    const s = (0.0883024619 * lr) + (0.2817188376 * lg) + (0.6299787005 * lb);

    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);

    return {
      L: (0.2104542553 * lRoot) + (0.793617785 * mRoot) - (0.0040720468 * sRoot),
      a: (1.9779984951 * lRoot) - (2.428592205 * mRoot) + (0.4505937099 * sRoot),
      b: (0.0259040371 * lRoot) + (0.7827717662 * mRoot) - (0.808675766 * sRoot)
    };
  }

  function oklabToRgb(L, a, b) {
    const lRoot = L + (0.3963377774 * a) + (0.2158037573 * b);
    const mRoot = L - (0.1055613458 * a) - (0.0638541728 * b);
    const sRoot = L - (0.0894841775 * a) - (1.291485548 * b);

    const l = lRoot * lRoot * lRoot;
    const m = mRoot * mRoot * mRoot;
    const s = sRoot * sRoot * sRoot;

    const lr = (4.0767416621 * l) - (3.3077115913 * m) + (0.2309699292 * s);
    const lg = (-1.2684380046 * l) + (2.6097574011 * m) - (0.3413193965 * s);
    const lb = (-0.0041960863 * l) - (0.7034186147 * m) + (1.707614701 * s);

    return {
      r: linearChannelToSrgb(lr),
      g: linearChannelToSrgb(lg),
      b: linearChannelToSrgb(lb)
    };
  }

  function oklabToOklch(lab) {
    const C = Math.sqrt((lab.a * lab.a) + (lab.b * lab.b));
    let h = Math.atan2(lab.b, lab.a) * (180 / Math.PI);
    if (h < 0) {
      h += 360;
    }
    return {
      L: lab.L,
      C,
      h
    };
  }

  function oklchToOklab(L, C, h) {
    const angle = (h * Math.PI) / 180;
    return {
      L,
      a: C * Math.cos(angle),
      b: C * Math.sin(angle)
    };
  }

  function isRgbInSrgbGamut(rgb) {
    return rgb.r >= 0 && rgb.r <= 1 && rgb.g >= 0 && rgb.g <= 1 && rgb.b >= 0 && rgb.b <= 1;
  }

  function oklchToClippedSrgb(L, C, h) {
    let lab = oklchToOklab(L, C, h);
    let rgb = oklabToRgb(lab.L, lab.a, lab.b);
    if (isRgbInSrgbGamut(rgb)) {
      return {
        r: clamp(rgb.r),
        g: clamp(rgb.g),
        b: clamp(rgb.b)
      };
    }

    let low = 0;
    let high = C;
    let best = { r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b) };
    for (let i = 0; i < 7; i += 1) {
      const mid = (low + high) / 2;
      lab = oklchToOklab(L, mid, h);
      rgb = oklabToRgb(lab.L, lab.a, lab.b);
      if (isRgbInSrgbGamut(rgb)) {
        low = mid;
        best = { r: clamp(rgb.r), g: clamp(rgb.g), b: clamp(rgb.b) };
      } else {
        high = mid;
      }
    }

    return best;
  }

  function hexToRgbNormalized(hex) {
    const normalized = String(hex || "").replace(/[^0-9a-f]/gi, "");
    if (normalized.length !== 6) {
      return null;
    }
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
      g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
      b: Number.parseInt(normalized.slice(4, 6), 16) / 255
    };
  }

  function extractFirstBackgroundImageUrl(backgroundImage) {
    const match = String(backgroundImage || "").match(/url\((['"]?)(.*?)\1\)/i);
    return match?.[2] ? match[2] : "";
  }

  function measureFarmThemeRasterSize(node) {
    if (!(node instanceof HTMLElement)) {
      return null;
    }
    if (node instanceof HTMLCanvasElement) {
      return {
        width: Math.max(1, Math.round(node.width || node.getBoundingClientRect().width || 1)),
        height: Math.max(1, Math.round(node.height || node.getBoundingClientRect().height || 1))
      };
    }
    const rect = node.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) {
      return null;
    }
    const dpr = clamp(window.devicePixelRatio || 1, 1, 3);
    let width = Math.max(1, Math.round(rect.width * dpr));
    let height = Math.max(1, Math.round(rect.height * dpr));
    const pixels = width * height;
    if (pixels > FARM_THEME_MAX_RASTER_PIXELS) {
      const scale = Math.sqrt(FARM_THEME_MAX_RASTER_PIXELS / pixels);
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }
    return { width, height };
  }

  function rememberFarmThemeOriginals(node, descriptor) {
    if (!(node instanceof HTMLElement) || !descriptor?.kind) {
      return;
    }
    if (descriptor.kind === "image" && node instanceof HTMLImageElement) {
      if (node.dataset.muFarmOriginalSource == null) {
        node.dataset.muFarmOriginalSource = descriptor.source;
      }
      if (node.dataset.muFarmOriginalSrc == null) {
        node.dataset.muFarmOriginalSrc = node.getAttribute("src") || "";
      }
      if (node.dataset.muFarmOriginalSrcset == null) {
        node.dataset.muFarmOriginalSrcset = node.getAttribute("srcset") || "";
      }
      return;
    }
    if (descriptor.kind === "background") {
      if (node.dataset.muFarmOriginalSource == null) {
        node.dataset.muFarmOriginalSource = descriptor.source;
      }
      if (node.dataset.muFarmOriginalInlineBackgroundImage == null) {
        node.dataset.muFarmOriginalInlineBackgroundImage = node.style.backgroundImage || "";
      }
      return;
    }
    if (descriptor.kind === "canvas" && node instanceof HTMLCanvasElement) {
      const context = node.getContext("2d", { willReadFrequently: true });
      if (!context || farmThemeCanvasOriginals.has(node)) {
        return;
      }
      try {
        const snapshot = context.getImageData(0, 0, node.width, node.height);
        farmThemeCanvasOriginals.set(node, snapshot);
      } catch (_err) {}
    }
  }

  function restoreFarmThemeVisual(node) {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.dataset.muFarmThemeManaged === "image" && node instanceof HTMLImageElement) {
      const originalSrcset = node.dataset.muFarmOriginalSrcset || "";
      const originalSrc = node.dataset.muFarmOriginalSrc || node.dataset.muFarmOriginalSource || "";
      if (originalSrcset) {
        node.setAttribute("srcset", originalSrcset);
      } else {
        node.removeAttribute("srcset");
      }
      if (originalSrc) {
        node.setAttribute("src", originalSrc);
      }
    } else if (node.dataset.muFarmThemeManaged === "background") {
      node.style.backgroundImage = node.dataset.muFarmOriginalInlineBackgroundImage || "";
    } else if (node.dataset.muFarmThemeManaged === "canvas" && node instanceof HTMLCanvasElement) {
      const context = node.getContext("2d", { willReadFrequently: true });
      const snapshot = farmThemeCanvasOriginals.get(node);
      if (context && snapshot) {
        try {
          context.putImageData(snapshot, 0, 0);
        } catch (_err) {}
      }
      farmThemeCanvasOriginals.delete(node);
    }
    delete node.dataset.muFarmThemeManaged;
    delete node.dataset.muFarmThemeKey;
    delete node.dataset.muFarmRecolored;
    delete node.dataset.muFarmOriginalSource;
    delete node.dataset.muFarmOriginalSrc;
    delete node.dataset.muFarmOriginalSrcset;
    delete node.dataset.muFarmOriginalInlineBackgroundImage;
  }

  function resolveFarmThemeVisualDescriptor(node) {
    if (!(node instanceof HTMLElement)) {
      return null;
    }

    const size = measureFarmThemeRasterSize(node);
    if (!size) {
      return null;
    }

    if (node instanceof HTMLImageElement) {
      const source = node.dataset.muFarmThemeManaged
        ? (node.dataset.muFarmOriginalSource || node.currentSrc || node.src || "")
        : (node.currentSrc || node.src || "");
      if (source) {
        return { kind: "image", source, width: size.width, height: size.height, role: String(node.dataset.muFarmVisual || "") };
      }
    }

    if (node instanceof HTMLCanvasElement) {
      return {
        kind: "canvas",
        node,
        source: `${describeElementForDebug(node)}:${node.width}x${node.height}`,
        width: Math.max(1, Math.round(node.width || size.width)),
        height: Math.max(1, Math.round(node.height || size.height)),
        role: String(node.dataset.muFarmVisual || "")
      };
    }

    const backgroundImage = node.dataset.muFarmThemeManaged
      ? (node.dataset.muFarmOriginalSource || extractFirstBackgroundImageUrl(window.getComputedStyle(node).backgroundImage))
      : extractFirstBackgroundImageUrl(window.getComputedStyle(node).backgroundImage);
    if (backgroundImage && !backgroundImage.startsWith("data:")) {
      return { kind: "background", source: backgroundImage, width: size.width, height: size.height, role: String(node.dataset.muFarmVisual || "") };
    }

    return null;
  }

  function getFarmThemeSourcePathname(source) {
    try {
      return new URL(String(source || ""), window.location.origin).pathname.toLowerCase();
    } catch (_err) {
      return "";
    }
  }

  function getHardcodedCatpuccinAssetUrl(descriptor) {
    if (!isCatpuccinThemeActive() || !chrome?.runtime?.getURL) {
      return "";
    }
    const pathname = getFarmThemeSourcePathname(descriptor?.source);
    const pathMapped = pathname ? CATPUCCIN_HARDCODED_ASSET_PATH_MAP[pathname] : "";
    if (pathMapped) {
      return chrome.runtime.getURL(pathMapped);
    }
    return "";
  }

  function loadImageForFarmTheme(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load farm visual: ${source}`));
      image.src = source;
    });
  }

  async function applyCatpuccinRecolorToFarmVisual(node, token) {
    if (!(node instanceof HTMLElement) || token !== farmThemeRefreshToken || !isCatpuccinThemeActive()) {
      return;
    }

    const descriptor = resolveFarmThemeVisualDescriptor(node);
    if (!descriptor) {
      restoreFarmThemeVisual(node);
      return;
    }

    const hardcodedAssetUrl = getHardcodedCatpuccinAssetUrl(descriptor);
    if (hardcodedAssetUrl) {
      const hardcodedKey = `hardcoded:${hardcodedAssetUrl}`;
      if (node.dataset.muFarmThemeKey === hardcodedKey && node.dataset.muFarmRecolored === "true") {
        return;
      }
      rememberFarmThemeOriginals(node, descriptor);
      if (descriptor.kind === "image" && node instanceof HTMLImageElement) {
        node.removeAttribute("srcset");
        node.src = hardcodedAssetUrl;
        node.dataset.muFarmThemeManaged = "image";
      } else if (descriptor.kind === "background") {
        node.style.backgroundImage = `url("${hardcodedAssetUrl}")`;
        node.dataset.muFarmThemeManaged = "background";
      } else if (descriptor.kind === "canvas" && node instanceof HTMLCanvasElement) {
        const context = node.getContext("2d", { willReadFrequently: true });
        if (!context) {
          return;
        }
        try {
          const image = await loadImageForFarmTheme(hardcodedAssetUrl);
          if (token !== farmThemeRefreshToken || !isCatpuccinThemeActive()) {
            return;
          }
          context.clearRect(0, 0, descriptor.width, descriptor.height);
          context.drawImage(image, 0, 0, descriptor.width, descriptor.height);
          node.dataset.muFarmThemeManaged = "canvas";
        } catch (_err) {
          return;
        }
      }
      node.dataset.muFarmRecolored = "true";
      node.dataset.muFarmThemeKey = hardcodedKey;
      return;
    }

    restoreFarmThemeVisual(node);
  }

  function syncFarmThemeVisualRefresh() {
    const targets = Array.from(document.querySelectorAll("[data-mu-farm-visual]"))
      .filter((node) => node instanceof HTMLElement);
    const targetSet = new Set(targets);

    Array.from(document.querySelectorAll("[data-mu-farm-theme-managed]")).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      if (!isCatpuccinThemeActive() || !targetSet.has(node)) {
        restoreFarmThemeVisual(node);
      }
    });

    if (!isCatpuccinThemeActive()) {
      return;
    }

    const token = farmThemeRefreshToken;
    targets.forEach((node) => {
      applyCatpuccinRecolorToFarmVisual(node, token).catch(() => {});
    });
  }

  function queueFarmThemeVisualRefresh() {
    farmThemeRefreshToken += 1;
    if (farmThemeRefreshQueued) {
      return;
    }
    farmThemeRefreshQueued = true;
    requestAnimationFrame(() => {
      farmThemeRefreshQueued = false;
      syncFarmThemeVisualRefresh();
    });
  }


  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function withObserverSuppressed(fn) {
    suppressedObserverMutations += 1;
    try {
      return fn();
    } finally {
      queueMicrotask(() => {
        suppressedObserverMutations = Math.max(0, suppressedObserverMutations - 1);
      });
    }
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

  function normalizeOwnerName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function readOwnerNameCache() {
    return String(localStorage.getItem(PROJECT_OWNER_NAME_CACHE_KEY) || "").trim();
  }

  function writeOwnerNameCache(name) {
    const normalized = String(name || "").trim();
    currentOwnerName = normalized;
    if (normalized) {
      localStorage.setItem(PROJECT_OWNER_NAME_CACHE_KEY, normalized);
      return;
    }
    localStorage.removeItem(PROJECT_OWNER_NAME_CACHE_KEY);
  }

  function isOwnedByCurrentOwnerName(ownerName) {
    const current = normalizeOwnerName(currentOwnerName);
    const owner = normalizeOwnerName(ownerName);
    return Boolean(current && owner && current === owner);
  }

  function isExtensionContextValid() {
    try {
      return Boolean(chrome?.runtime?.id);
    } catch (_err) {
      return false;
    }
  }

  function nodeMatchesOrContains(node, selector) {
    if (!(node instanceof Element)) {
      return false;
    }
    return node.matches(selector) || Boolean(node.querySelector(selector));
  }

  function nodeTouchesProjectUi(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    if (node.closest("#projects")) {
      return true;
    }
    return nodeMatchesOrContains(node, "#projects, .farm-tile-project, .modal-frame, a[href*='/projects/'], a[href^='/u/']");
  }

  function nodeTouchesShopUi(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    if (node.closest(SHOP_CARD_SELECTOR) || node.closest(".donkey-area")) {
      return true;
    }
    return nodeMatchesOrContains(node, `${SHOP_CARD_SELECTOR}, .donkey-area, .modal-frame, button[aria-label*='Star'], button[aria-label*='Unstar']`);
  }

  function nodeTouchesDashboardChrome(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    if (node.closest(DASHBOARD_TOP_BAR_SELECTOR)) {
      return true;
    }
    return nodeMatchesOrContains(node, DASHBOARD_TOP_BAR_SELECTOR);
  }

  function summarizeMutationWork(records) {
    const work = {
      project: false,
      shop: false,
      chrome: false,
      goals: false,
      onboarding: false,
      refresh: false
    };

    const inspectNode = (node) => {
      if (!(node instanceof Element)) {
        return;
      }

      if (!work.project && nodeTouchesProjectUi(node)) {
        work.project = true;
        work.refresh = true;
      }
      if (!work.shop && nodeTouchesShopUi(node)) {
        work.shop = true;
      }
      if (!work.chrome && nodeTouchesDashboardChrome(node)) {
        work.chrome = true;
      }
      if (!work.goals && projectGoals.length) {
        if (work.chrome || nodeMatchesOrContains(node, `#${GOALS_HUD_ID}, #${GOALS_NATIVE_EXTRA_ID}`)) {
          work.goals = true;
        }
      }
    };

    records.some((record) => {
      inspectNode(record.target);
      Array.from(record.addedNodes || []).forEach(inspectNode);
      Array.from(record.removedNodes || []).forEach(inspectNode);
      return work.project && work.shop && work.chrome && work.goals;
    });

    work.onboarding = Boolean(document.getElementById(ONBOARDING_ROOT_ID)) && (work.project || work.shop || work.chrome || work.goals);
    return work;
  }

  function getCurrentGoldPerHourFromModal() {
    const level = parseLevelFromProjectModal();
    if (!level || !PROJECT_HOURLY_RATE[level]) {
      return null;
    }

    const modalText = String(getProjectModalElement()?.textContent || getOpenModalElement()?.textContent || "");
    const streakDays = parseProjectStreakDaysFromText(modalText);
    const multiplier = parseMultiplierFromProjectModal();
    return getProjectEffectiveGoldPerHour(level, { streakDays, multiplier });
  }

  function getProjectIdsFromFarmTiles(root = document) {
    const ids = new Set();
    Array.from(root.querySelectorAll("#projects .farm-tile-project a[href*='/projects/']")).forEach((link) => {
      const href = link.getAttribute("href") || "";
      const match = href.match(/\/projects\/(\d+)/);
      if (match?.[1]) {
        ids.add(String(match[1]));
      }
    });
    return Array.from(ids).slice(0, PROJECT_FETCH_LIMIT);
  }

  function replaceKnownProjectIds(ids) {
    if (!Array.isArray(ids) || !ids.length) {
      return false;
    }
    const next = Array.from(new Set(ids.map((id) => String(id)))).slice(0, PROJECT_FETCH_LIMIT);
    const changed = JSON.stringify(next) !== JSON.stringify(projectTileOrder);
    if (changed) {
      projectTileOrder = next;
      writeProjectTileOrderCache(projectTileOrder);
    }
    return changed;
  }

  function getKnownProjectIds() {
    const ids = new Set();
    getProjectIdsFromFarmTiles(document).forEach((id) => ids.add(id));
    projectTileOrder.forEach((id) => ids.add(String(id)));
    const collected = Array.from(ids).slice(0, PROJECT_FETCH_LIMIT);
    return collected;
  }

  function getVisibleFarmTileCount() {
    return document.querySelectorAll("#projects .farm-tile-project").length;
  }

  function sanitizeProjectTileOrderAgainstVisibleTiles() {
    const visibleTileCount = getVisibleFarmTileCount();
    if (visibleTileCount > 0 && projectTileOrder.length > visibleTileCount) {
      projectTileOrder = projectTileOrder.slice(0, visibleTileCount);
      writeProjectTileOrderCache(projectTileOrder);
    }
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

    const streakDays = parseProjectStreakDaysFromText(html);
    const totalEarnedMatch = html.match(/Total\s*Earned:\s*([\d,]+)\s*gold/i);
    const totalEarnedGold = totalEarnedMatch
      ? Number.parseInt(String(totalEarnedMatch[1]).replace(/,/g, ""), 10)
      : 0;
    const goldPerHour = getProjectEffectiveGoldPerHour(level, { streakDays, multiplier });

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

  async function mapWithConcurrency(items, limit, mapper) {
    const list = Array.isArray(items) ? items : [];
    const concurrency = Math.max(1, Math.min(list.length || 1, Math.round(Number(limit) || 1)));
    const results = new Array(list.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < list.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(list[currentIndex], currentIndex);
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  }

  function getOpenModalElement() {
    const modals = Array.from(document.querySelectorAll(".modal-frame"));
    const visible = modals
      .slice()
      .reverse()
      .find((modal) => {
        if (!(modal instanceof HTMLElement)) {
          return false;
        }
        const rect = modal.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          return false;
        }
        const style = window.getComputedStyle(modal);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      });
    return visible || modals[0] || null;
  }

  function getProjectModalElement() {
    return Array.from(document.querySelectorAll(".modal-frame")).find((modal) => {
      const hasProjectLink = Boolean(modal.querySelector("a[href*='/projects/']"));
      const hasOwnerLink = Boolean(modal.querySelector("a[href^='/u/']"));
      const isProfileModal = Boolean(modal.querySelector("a[href='/profile']"));
      return hasProjectLink && hasOwnerLink && !isProfileModal;
    }) || null;
  }

  function getProfileModalElement() {
    return Array.from(document.querySelectorAll(".modal-frame")).find((modal) =>
      Boolean(modal.querySelector("a[href='/profile']"))
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

  function parseProjectOwnerNameFromModalElement(modal) {
    if (!modal) {
      return "";
    }
    const ownerLink = modal.querySelector("a[href^='/u/'] span") || modal.querySelector("a[href^='/u/']");
    const raw = String(ownerLink?.textContent || "").trim();
    return raw.replace(/^by\s+/i, "").trim();
  }

  function parseCurrentOwnerNameFromProfileModal(modal) {
    if (!modal) {
      return "";
    }
    const heading = Array.from(modal.querySelectorAll("h1, h2, h3")).find((node) => {
      const text = String(node.textContent || "").trim();
      return text.length > 1 && !/linked accounts|invite friends|project streaks|notification preferences|stats|my projects/i.test(text);
    });
    return String(heading?.textContent || "").trim();
  }

  function parseCurrentOwnerNameFromProfileHtml(html) {
    if (!html) {
      return "";
    }

    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const heading = Array.from(doc.querySelectorAll("h1, h2, h3")).find((node) => {
        const text = String(node.textContent || "").trim();
        return text.length > 1 && !/linked accounts|invite friends|project streaks|notification preferences|stats|my projects|back to farm/i.test(text);
      });
      return String(heading?.textContent || "").trim();
    } catch (_err) {
      return "";
    }
  }

  function parseProjectListingsFromProfileHtml(html) {
    if (!html) {
      return [];
    }

    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const seen = new Set();
      const listings = [];
      Array.from(doc.querySelectorAll("a[href*='/projects/']")).forEach((link) => {
        const href = link.getAttribute("href") || "";
        const match = href.match(/\/projects\/(\d+)/);
        const projectId = match?.[1] ? String(match[1]) : "";
        if (!projectId || seen.has(projectId)) {
          return;
        }
        seen.add(projectId);
        listings.push({
          projectId,
          title: String(link.textContent || "").trim()
        });
      });
      return listings.slice(0, PROJECT_FETCH_LIMIT);
    } catch (_err) {
      return [];
    }
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
    const ownerName = parseProjectOwnerNameFromModalElement(modal);
    return { projectId, title, ownerName, ...metrics };
  }

  async function closeAnyOpenModal() {
    if (!getOpenModalElement()) {
      return;
    }

    const backButton = Array.from(document.querySelectorAll(".modal-frame button")).find((button) =>
      /Back to farm/i.test(button.textContent || "")
    );
    if (backButton) {
      backButton.click();
      await waitFor(() => !getOpenModalElement(), 2000, 80);
      return;
    }

    const esc = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(esc);
    await waitFor(() => !getOpenModalElement(), 1500, 80);
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

  async function bootstrapCurrentOwnerNameFromHouseModal() {
    if (currentOwnerName) {
      return currentOwnerName;
    }

    const profileHtml = await fetchProfileHtml();
    const htmlOwnerName = parseCurrentOwnerNameFromProfileHtml(profileHtml);
    if (htmlOwnerName) {
      writeOwnerNameCache(htmlOwnerName);
      return currentOwnerName;
    }

    const houseArea = document.querySelector(".house-area");
    if (!(houseArea instanceof HTMLElement)) {
      return "";
    }

    if (getOpenModalElement()) {
      await closeAnyOpenModal();
    }

    houseArea.click();
    const profileModal = await waitFor(() => getProfileModalElement(), 3000, 80);
    const ownerName = parseCurrentOwnerNameFromProfileModal(profileModal);
    if (ownerName) {
      writeOwnerNameCache(ownerName);
    } else {
      console.warn(`${DEBUG_PREFIX} failed to bootstrap owner name from profile`);
    }
    await closeAnyOpenModal();
    return currentOwnerName;
  }

  async function bootstrapProjectIdsFromProfileHtml() {
    const profileHtml = await fetchProfileHtml();
    const listings = parseProjectListingsFromProfileHtml(profileHtml);
    if (!listings.length) {
      return [];
    }

    const ids = [];
    let changedTitles = false;
    const mergedTitles = { ...projectTitleById };
    listings.forEach((listing) => {
      ids.push(String(listing.projectId));
      if (listing.title && mergedTitles[String(listing.projectId)] !== listing.title) {
        mergedTitles[String(listing.projectId)] = listing.title;
        changedTitles = true;
      }
    });
    if (changedTitles) {
      projectTitleById = mergedTitles;
    }
    replaceKnownProjectIds(ids);
    return ids;
  }

  async function harvestProjectMetricsFromFarmTiles() {
    if (harvestInFlight) {
      return [];
    }
    harvestInFlight = true;

    try {
      await bootstrapCurrentOwnerNameFromHouseModal();

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
    if (hiddenHarvestRequestPromise) {
      return hiddenHarvestRequestPromise;
    }
    if (Date.now() < hiddenHarvestDisabledUntil) {
      return Promise.resolve([]);
    }

    hiddenHarvestRequestPromise = new Promise((resolve) => {
      if (!isExtensionContextValid() || typeof chrome?.runtime?.sendMessage !== "function") {
        hiddenHarvestDisabledUntil = Date.now() + HIDDEN_HARVEST_FAILURE_BACKOFF_MS;
        resolve([]);
        return;
      }

      try {
        chrome.runtime.sendMessage({ type: "macondo-utils-run-hidden-harvest" }, (response) => {
          try {
            if (chrome.runtime.lastError) {
              hiddenHarvestDisabledUntil = Date.now() + HIDDEN_HARVEST_FAILURE_BACKOFF_MS;
              resolve([]);
              return;
            }
          } catch (_err) {
            hiddenHarvestDisabledUntil = Date.now() + HIDDEN_HARVEST_FAILURE_BACKOFF_MS;
            resolve([]);
            return;
          }
          if (!response?.ok || !Array.isArray(response.metrics)) {
            hiddenHarvestDisabledUntil = Date.now() + HIDDEN_HARVEST_FAILURE_BACKOFF_MS;
            resolve([]);
            return;
          }
          hiddenHarvestDisabledUntil = response.metrics.length ? 0 : Date.now() + HIDDEN_HARVEST_FAILURE_BACKOFF_MS;
          resolve(response.metrics);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Extension context invalidated/i.test(message)) {
          console.warn(`${DEBUG_PREFIX} background harvest skipped because extension context was invalidated`);
          hiddenHarvestDisabledUntil = Date.now() + HIDDEN_HARVEST_FAILURE_BACKOFF_MS;
          resolve([]);
          return;
        }
        hiddenHarvestDisabledUntil = Date.now() + HIDDEN_HARVEST_FAILURE_BACKOFF_MS;
        resolve([]);
      }
    }).finally(() => {
      hiddenHarvestRequestPromise = null;
    });

    return hiddenHarvestRequestPromise;
  }

  async function bootstrapProjectIdsFromHiddenHarvestOnce(force = false) {
    const discoveredFromDom = getProjectIdsFromFarmTiles(document);
    if (discoveredFromDom.length) {
      replaceKnownProjectIds(discoveredFromDom);
      projectIdsBootstrapped = true;
      writeProjectIdBootstrapCache(true);
      return;
    }

    const visibleTileCount = getVisibleFarmTileCount();
    const discoveredFromProfile = await bootstrapProjectIdsFromProfileHtml();
    if (discoveredFromProfile.length >= Math.max(1, visibleTileCount)) {
      projectIdsBootstrapped = true;
      writeProjectIdBootstrapCache(true);
      return;
    }

    const needsInitialHarvest = !projectIdsBootstrapped && !projectTileOrder.length;
    const needsRecoveryHarvest = force || (visibleTileCount > 0 && projectTileOrder.length > 0 && visibleTileCount > projectTileOrder.length);
    if (!needsInitialHarvest && !needsRecoveryHarvest) {
      return;
    }

    const harvested = await requestBackgroundHarvest();
    if (!Array.isArray(harvested) || !harvested.length) {
      return;
    }

    applyHarvestedProjectMetrics(harvested, {
      markBootstrapped: true,
      expectedTileCount: visibleTileCount
    });
  }

  function applyHarvestedProjectMetrics(harvested, options = {}) {
    if (!Array.isArray(harvested) || !harvested.length) {
      return null;
    }

    const markBootstrapped = options?.markBootstrapped !== false;
    let weightedRateSum = 0;
    let totalHours = 0;
    const harvestedIds = [];
    const mergedTitles = { ...projectTitleById };
    const mergedMeta = { ...projectMetaById };
    const titlesBefore = JSON.stringify(projectTitleById);
    const metaBefore = JSON.stringify(projectMetaById);
    const expectedTileCount = Math.max(0, Math.round(Number(options?.expectedTileCount) || 0));

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

    const hasCompleteHarvestOrder = harvestedIds.length > 0 && (!expectedTileCount || harvestedIds.length >= expectedTileCount);

    if (hasCompleteHarvestOrder) {
      projectTileOrder = harvestedIds;
      writeProjectTileOrderCache(projectTileOrder);
      if (markBootstrapped) {
        projectIdsBootstrapped = true;
        writeProjectIdBootstrapCache(true);
      }
    }

    const titlesAfter = JSON.stringify(mergedTitles);
    const metaAfter = JSON.stringify(mergedMeta);
    const changedTitles = titlesBefore !== titlesAfter;
    const changedMeta = metaBefore !== metaAfter;

    if (changedTitles) {
      projectTitleById = mergedTitles;
    }
    if (changedMeta) {
      projectMetaById = mergedMeta;
    }
    if (changedTitles || changedMeta) {
      queueProjectGroundLabelsSync();
      recordProjectMetricsSnapshot(mergedMeta).catch(() => {
      });
    }

    const recomputed = applyEffectiveGoldPerHourFromMeta(mergedMeta, harvestedIds)
      || (totalHours > 0 && weightedRateSum > 0
        ? { effectiveGoldPerHour: weightedRateSum / totalHours, totalHours, projectIds: harvestedIds }
        : null);

    if (recomputed) {
      effectiveGoldPerHour = recomputed.effectiveGoldPerHour;
      writeCache({
        timestamp: Date.now(),
        effectiveGoldPerHour,
        totalHours: recomputed.totalHours,
        projectIds: recomputed.projectIds
      });
    }

    return {
      effectiveGoldPerHour: recomputed?.effectiveGoldPerHour || null,
      totalHours: recomputed?.totalHours || 0,
      projectIds: harvestedIds
    };
  }

  async function fetchProjectApi(projectId) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, { credentials: "include" });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  async function fetchProfileHtml() {
    try {
      const response = await fetch("/profile", { credentials: "include" });
      if (!response.ok) {
        return null;
      }
      return await response.text();
    } catch (_err) {
      return null;
    }
  }

  async function fetchProfileStreaks() {
    try {
      const response = await fetch("/api/profile/streaks", { credentials: "include" });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  async function fetchStreakCalendar(month) {
    try {
      const response = await fetch(`/api/streaks/calendar?month=${encodeURIComponent(month)}`, { credentials: "include" });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (_err) {
      return null;
    }
  }

  function getYearMonthParts(date) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1
    };
  }

  function formatYearMonth(parts) {
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }

  function getPreviousYearMonth(parts) {
    if (parts.month === 1) {
      return { year: parts.year - 1, month: 12 };
    }
    return { year: parts.year, month: parts.month - 1 };
  }

  function getProjectGoldPerHourForLevel(level) {
    const numericLevel = Number.parseInt(String(level || ""), 10);
    return PROJECT_HOURLY_RATE[numericLevel] || null;
  }

  function parseProjectStreakDaysFromText(text) {
    const streakMatch = String(text || "").match(/(\d+)\s*[- ]\s*d(?:ay|ays)?(?:\s+project)?\s*streak/i)
      || String(text || "").match(/(\d+)\s*d(?:ay|ays)?\s*streak/i);
    return streakMatch ? Number.parseInt(streakMatch[1], 10) : 0;
  }

  function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateDdMmYy(dateLike) {
    const raw = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (!(raw instanceof Date) || Number.isNaN(raw.getTime())) {
      return "";
    }
    const day = String(raw.getDate()).padStart(2, "0");
    const month = String(raw.getMonth() + 1).padStart(2, "0");
    const year = String(raw.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  }

  function getStreakMultiplier(streakDays) {
    const normalizedDays = Number.isFinite(Number(streakDays)) ? Math.max(0, Math.round(Number(streakDays))) : 0;
    return 1 + (normalizedDays / 100);
  }

  function getProjectEffectiveGoldPerHour(level, options = {}) {
    const baseGoldPerHour = getProjectGoldPerHourForLevel(level);
    if (!Number.isFinite(baseGoldPerHour) || baseGoldPerHour <= 0) {
      return null;
    }
    const streakDays = Number(options?.streakDays);
    if (Number.isFinite(streakDays)) {
      return baseGoldPerHour * getStreakMultiplier(streakDays);
    }
    const multiplier = Number(options?.multiplier);
    if (Number.isFinite(multiplier) && multiplier > 0) {
      return baseGoldPerHour * multiplier;
    }
    return baseGoldPerHour;
  }

  function normalizeHackatimeProjectName(value) {
    return String(value || "").trim().toLowerCase();
  }

  function getHackatimeProjectKeys(value) {
    const normalized = normalizeHackatimeProjectName(value);
    if (!normalized) {
      return [];
    }
    const compact = normalized.replace(/[\s_-]+/g, "");
    return compact && compact !== normalized ? [normalized, compact] : [normalized];
  }

  function getLinkedHackatimeProjects(project) {
    const arrays = [project?.hackatime_projects, project?.hackatimeProjects, project?.hackatime_project_names];
    return arrays.find((linked) => Array.isArray(linked) && linked.length) || [];
  }

  function getLinkedHackatimeProjectName(linkedProject) {
    if (typeof linkedProject === "string") {
      return linkedProject;
    }
    return linkedProject?.name || linkedProject?.project || linkedProject?.project_name || "";
  }

  function getFirstFiniteNumber(source, keys) {
    for (const key of keys) {
      if (source?.[key] === null || source?.[key] === undefined || source?.[key] === "") {
        continue;
      }
      const value = Number(source?.[key]);
      if (Number.isFinite(value)) {
        return value;
      }
    }
    return null;
  }

  function getHackatimeProjectSeconds(project) {
    return Math.max(0, getFirstFiniteNumber(project, ["total_seconds_in_window", "total_seconds", "seconds"]) || 0);
  }

  function getProjectHoursFromHackatimeLinks(project, secondsByName, fallbackHours = 0) {
    const linkedProjects = getLinkedHackatimeProjects(project);
    let totalSeconds = 0;
    linkedProjects.forEach((linkedProject) => {
      const keys = getHackatimeProjectKeys(getLinkedHackatimeProjectName(linkedProject));
      if (!keys.length) {
        return;
      }
      totalSeconds += Number(keys.map((key) => secondsByName?.get(key) || 0).find((seconds) => seconds > 0) || 0);
    });
    if (totalSeconds > 0) {
      return totalSeconds / 3600;
    }
    return Number.isFinite(Number(fallbackHours)) && Number(fallbackHours) > 0 ? Number(fallbackHours) : 0;
  }

  function getRoundedHoursForEstCoins(hours) {
    return Number.isFinite(Number(hours)) && Number(hours) > 0 ? Math.max(0, Math.round(Number(hours))) : 0;
  }

  function getEstimatedUnshippedHours(project, totalHours) {
    const currentHours = Number.isFinite(Number(totalHours)) && Number(totalHours) > 0 ? Number(totalHours) : 0;
    const previousShippedHours = Math.max(0, getFirstFiniteNumber(project, ["previousShippedHackatimeHours", "previous_shipped_hackatime_hours"]) || 0);
    const unshippedJournalHours = Math.max(0, getFirstFiniteNumber(project, ["unshippedJournalHours", "unshipped_journal_hours"]) || 0);
    if (previousShippedHours > 0 && currentHours > 0 && currentHours < previousShippedHours) {
      return currentHours + unshippedJournalHours;
    }
    return Math.max(0, currentHours - previousShippedHours + unshippedJournalHours);
  }

  function buildProjectMetaFromApi(project, fallbackMeta, secondsByName) {
    if (!project || typeof project !== "object") {
      return fallbackMeta || null;
    }

    const title = String(project.name || fallbackMeta?.title || "").trim();
    const level = Number.isFinite(Number(project.level))
      ? Math.min(4, Math.max(1, Math.round(Number(project.level))))
      : (Number.isFinite(Number(fallbackMeta?.level)) ? Math.min(4, Math.max(1, Math.round(Number(fallbackMeta.level)))) : null);
    const streakDays = Number.isFinite(Number(project.project_streak_days))
      ? Math.max(0, Math.round(Number(project.project_streak_days)))
      : Math.max(0, Math.round(Number(fallbackMeta?.streakDays) || 0));
    const hours = getProjectHoursFromHackatimeLinks(project, secondsByName, fallbackMeta?.hours);
    const fallbackTotalEarnedGold = Number.isFinite(Number(fallbackMeta?.totalEarnedGold))
      ? Math.max(0, Math.round(Number(fallbackMeta.totalEarnedGold)))
      : 0;
    const goldPerHour = getProjectEffectiveGoldPerHour(level, { streakDays });
    const estimatedUnshippedHours = getEstimatedUnshippedHours(project, hours);
    const roundedHours = getRoundedHoursForEstCoins(estimatedUnshippedHours);
    const estCoins = roundedHours > 0 && goldPerHour
      ? Math.max(0, Math.round(roundedHours * goldPerHour))
      : Math.max(0, Math.round(Number(fallbackMeta?.futureCoins ?? fallbackMeta?.estCoins) || 0));
    const futureCoins = estCoins;

    return {
      title,
      hours,
      streakDays,
      estCoins,
      totalEarnedGold: fallbackTotalEarnedGold,
      futureCoins,
      goldPerHour: Number.isFinite(goldPerHour) ? goldPerHour : null,
      level
    };
  }

  function buildStreakHoverData(profileStreaks, streakCalendar) {
    const safeProfile = profileStreaks && typeof profileStreaks === "object" ? profileStreaks : {};
    const safeCalendar = streakCalendar && typeof streakCalendar === "object" ? streakCalendar : {};
    const todayIso = getLocalDateKey();
    const calendarDays = Array.isArray(safeCalendar.days)
      ? safeCalendar.days.map((day) => ({
          date: String(day?.day || "").trim(),
          minutes: Math.max(0, Math.round(Number(day?.seconds_logged || 0) / 60)),
          lockedIn: ["active", "frozen", "review_protected"].includes(String(day?.status || "")),
          status: String(day?.status || "pending")
        })).filter((day) => day.date)
      : [];
    const todayEntry = calendarDays.find((day) => day.date === todayIso) || null;
    const projects = Array.isArray(safeProfile.projects)
      ? safeProfile.projects.map((project) => ({
          title: String(project?.name || "").trim(),
          streakDays: Math.max(0, Math.round(Number(project?.project_streak_days || 0))),
          workedToday: Boolean(project?.worked_today),
          autoUseStreakFreezes: project?.auto_use_streak_freezes !== false
        })).filter((project) => project.title)
      : [];
    return {
      projects,
      streakFreezesRemaining: Math.max(0, Math.round(Number(safeProfile.streak_freezes_remaining || 0))),
      todayMinutes: todayEntry?.minutes || 0,
      todayLockedIn: Boolean(safeProfile.worked_today || todayEntry?.lockedIn),
      calendarDays
    };
  }

  function mergeStreakCalendars(calendars) {
    const mergedDays = [];
    const seen = new Set();
    (Array.isArray(calendars) ? calendars : []).forEach((calendar) => {
      if (!calendar || !Array.isArray(calendar.days)) {
        return;
      }
      calendar.days.forEach((day) => {
        const key = String(day?.day || "").trim();
        if (!key || seen.has(key)) {
          return;
        }
        seen.add(key);
        mergedDays.push(day);
      });
    });
    mergedDays.sort((a, b) => String(a?.day || "").localeCompare(String(b?.day || "")));
    return {
      month: calendars.find((calendar) => calendar?.month)?.month || "",
      timezone: calendars.find((calendar) => calendar?.timezone)?.timezone || "",
      days: mergedDays
    };
  }

  function renderDashboardStreakProgress(data, button) {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const palette = getStreakThemePalette();
    const minutes = Math.max(0, Math.round(Number(data?.todayMinutes) || 0));
    const ratio = Math.max(0, Math.min(1, minutes / 60));
    const progressText = data?.todayLockedIn ? "locked in" : `${Math.min(minutes, 60)}/60m`;
    let progress = button.querySelector(".mu-streak-progress");
    if (!progress) {
      progress = document.createElement("div");
      progress.className = "mu-streak-progress";
      progress.innerHTML = "<div class='mu-streak-progress-bar'></div><div class='mu-streak-progress-label'></div>";
      progress.style.display = "flex";
      progress.style.flexDirection = "column";
      progress.style.gap = "4px";
      progress.style.minWidth = "56px";
      const count = button.querySelector("span.text-xs, span.text-sm, span.text-base") || button.lastElementChild;
      if (count instanceof HTMLElement) {
        count.insertAdjacentElement("afterend", progress);
      } else {
        button.appendChild(progress);
      }
    }
    const bar = progress.querySelector(".mu-streak-progress-bar");
    const label = progress.querySelector(".mu-streak-progress-label");
    if (bar instanceof HTMLElement) {
      const pct = Math.max(0, Math.min(100, ratio * 100));
      bar.style.width = "56px";
      bar.style.height = "6px";
      bar.style.setProperty("border", `1px solid ${palette.progressBorder}`, "important");
      bar.style.setProperty("background-color", palette.progressTrack, "important");
      bar.style.setProperty("background-image", `linear-gradient(90deg, ${palette.progressFill} 0 ${pct}%, ${palette.progressTrack} ${pct}% 100%)`, "important");
      bar.style.backgroundRepeat = "no-repeat";
      bar.style.backgroundSize = "100% 100%";
    }
    if (label instanceof HTMLElement) {
      label.textContent = progressText;
      label.style.fontSize = "10px";
      label.style.lineHeight = "1";
      label.style.fontWeight = "800";
      label.style.color = palette.muted;
      label.style.textTransform = "uppercase";
      label.style.letterSpacing = "0.04em";
    }
  }

  function buildRecentActivitySparkline(recentDays, palette = getStreakThemePalette()) {
    const days = Array.isArray(recentDays) ? recentDays : [];
    if (!days.length) {
      return "";
    }

    function roundUpChartMinutes(value) {
      const minutes = Math.max(60, Math.round(Number(value) || 0));
      if (minutes <= 60) {
        return 60;
      }
      if (minutes <= 180) {
        return Math.ceil(minutes / 30) * 30;
      }
      return Math.ceil(minutes / 60) * 60;
    }

    const width = 300;
    const height = 104;
    const axisLeft = 36;
    const axisRight = 10;
    const top = 12;
    const bottom = 64;
    const plottedMaxMinutes = Math.max(60, ...days.map((day) => Math.max(0, Number(day?.minutes) || 0)));
    const chartMaxMinutes = roundUpChartMinutes(plottedMaxMinutes);
    const usableWidth = Math.max(1, width - axisLeft - axisRight);
    const stepX = days.length > 1 ? usableWidth / (days.length - 1) : 0;
    const points = days.map((day, index) => {
      const minutes = Math.max(0, Number(day?.minutes) || 0);
      const x = axisLeft + stepX * index;
      const ratio = minutes / chartMaxMinutes;
      const y = bottom - ratio * (bottom - top);
      return { x, y, minutes, day };
    });
    const linePoints = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
    const targetY = bottom - (60 / chartMaxMinutes) * (bottom - top);
    const maxLabel = formatHours(chartMaxMinutes / 60);
    const midLabel = formatHours((chartMaxMinutes / 2) / 60);
    const zeroLabel = "0m";
    const middleIndex = Math.floor((points.length - 1) / 2);
    const axisTickIndexes = Array.from(new Set([
      0,
      Math.floor((points.length - 1) * 0.25),
      middleIndex,
      Math.floor((points.length - 1) * 0.75),
      points.length - 1
    ])).filter((index) => index >= 0 && index < points.length);

    function formatAxisDateLabel(dateStr) {
      if (!dateStr) {
        return "";
      }
      try {
        const [year, month, day] = String(dateStr).split("-").map((part) => Number(part));
        const date = new Date(year, (month || 1) - 1, day || 1);
        return formatDateDdMmYy(date);
      } catch (_err) {
        return String(dateStr);
      }
    }

    const circles = points.map((point) => {
      const status = String(point.day?.status || "pending");
      const fill = status === "active"
        ? palette.active
        : status === "frozen"
          ? palette.frozen
          : status === "review_protected" || status === "review"
            ? palette.review
            : status === "partial"
              ? palette.partial
              : palette.inactive;
      const stroke = status === "active"
        ? palette.activeStroke
        : status === "frozen"
          ? palette.frozenStroke
          : status === "review_protected" || status === "review"
            ? palette.reviewStroke
            : status === "partial"
              ? palette.partialStroke
              : palette.inactiveStroke;
      return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4" fill="${fill}" stroke="${stroke}" stroke-width="1.5"><title>${escapeHtml(`${point.day.date}: ${point.minutes} min`)}</title></circle>`;
    }).join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="96" role="img" aria-label="Recent activity line chart">
        <line x1="${axisLeft}" y1="${top}" x2="${axisLeft}" y2="${bottom}" stroke="${palette.chartAxis}" stroke-width="1.2"></line>
        <line x1="${axisLeft}" y1="${bottom}" x2="${width - axisRight}" y2="${bottom}" stroke="${palette.chartAxis}" stroke-width="1.2"></line>
        <line x1="${axisLeft - 4}" y1="${top}" x2="${axisLeft}" y2="${top}" stroke="${palette.chartAxis}" stroke-width="1"></line>
        <line x1="${axisLeft - 4}" y1="${((top + bottom) / 2).toFixed(1)}" x2="${axisLeft}" y2="${((top + bottom) / 2).toFixed(1)}" stroke="${palette.chartAxis}" stroke-width="1"></line>
        <line x1="${axisLeft - 4}" y1="${bottom}" x2="${axisLeft}" y2="${bottom}" stroke="${palette.chartAxis}" stroke-width="1"></line>
        ${axisTickIndexes.map((index, tickIndex) => {
          const point = points[index];
          const stroke = tickIndex === 0 || tickIndex === axisTickIndexes.length - 1 ? palette.chartAxis : palette.rule;
          return `<line x1="${point.x.toFixed(1)}" y1="${bottom}" x2="${point.x.toFixed(1)}" y2="${bottom + 4}" stroke="${stroke}" stroke-width="1"></line>`;
        }).join("")}
        <text x="${axisLeft - 6}" y="${top + 3}" text-anchor="end" font-size="10" font-weight="800" fill="${palette.chartAxisStrong}">${escapeHtml(maxLabel)}</text>
        <text x="${axisLeft - 6}" y="${((top + bottom) / 2) + 3}" text-anchor="end" font-size="10" font-weight="800" fill="${palette.muted}">${escapeHtml(midLabel)}</text>
        <text x="${axisLeft - 6}" y="${bottom + 3}" text-anchor="end" font-size="10" font-weight="800" fill="${palette.muted}">${escapeHtml(zeroLabel)}</text>
        <line x1="${axisLeft}" y1="${targetY.toFixed(1)}" x2="${width - axisRight}" y2="${targetY.toFixed(1)}" stroke="${palette.chartTarget}" stroke-width="1.5" stroke-dasharray="4 4"></line>
        <polyline points="${linePoints}" fill="none" stroke="${palette.chartLine}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></polyline>
        ${circles}
        ${axisTickIndexes.map((index, tickIndex) => {
          const point = points[index];
          const anchor = tickIndex === 0 ? "start" : tickIndex === axisTickIndexes.length - 1 ? "end" : "middle";
          const fill = tickIndex === 0 || tickIndex === axisTickIndexes.length - 1 ? palette.subtext : palette.muted;
          return `<text x="${point.x.toFixed(1)}" y="${height - 8}" text-anchor="${anchor}" font-size="10" font-weight="800" fill="${fill}">${escapeHtml(formatAxisDateLabel(point.day?.date))}</text>`;
        }).join("")}
        <text x="${width - axisRight}" y="${Math.max(10, targetY - 4).toFixed(1)}" text-anchor="end" font-size="10" font-weight="800" fill="${palette.chartAxisStrong}">60m target</text>
      </svg>
    `;
  }

  function buildRecentActivityBars(recentDays, palette = getStreakThemePalette()) {
    const days = Array.isArray(recentDays) ? recentDays.slice(-14) : [];
    if (!days.length) {
      return "";
    }
    const maxMinutes = Math.max(60, ...days.map((day) => Math.max(0, Number(day?.minutes) || 0)));
    const midMinutes = Math.round(maxMinutes / 2);
    const firstDate = formatDateDdMmYy(days[0]?.date || "");
    const middleDate = formatDateDdMmYy(days[Math.floor((days.length - 1) / 2)]?.date || "");
    const lastDate = formatDateDdMmYy(days[days.length - 1]?.date || "");
    const bars = days.map((day) => {
      const minutes = Math.max(0, Number(day?.minutes) || 0);
      const ratio = Math.max(0.12, Math.min(1, minutes / maxMinutes));
      const status = String(day?.status || "pending");
      const tooltip = escapeHtml(`${day?.date || ""}: ${minutes}m`);
      const fill = status === "active"
        ? palette.active
        : status === "frozen"
          ? palette.frozen
          : status === "review_protected" || status === "review"
            ? palette.review
            : status === "partial"
              ? palette.partial
              : palette.inactive;
      return `<div style="flex:1 1 0; display:flex; align-items:flex-end; justify-content:center; min-width:0; cursor:help;" title="${tooltip}"><div style="width:100%; max-width:18px; height:${Math.round(ratio * 84)}px; background:${fill}; border:1px solid ${palette.activeStroke}; box-sizing:border-box;"></div></div>`;
    }).join("");
    return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="font-size:11px; line-height:1rem; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:${palette.subtext};">Last 14 days</div>
        <div style="display:grid; grid-template-columns:32px 1fr; column-gap:8px; align-items:stretch;">
          <div style="display:flex; flex-direction:column; justify-content:space-between; align-items:flex-end; font-size:9px; line-height:1; font-weight:800; color:${palette.muted}; padding:0 0 18px;">
            <span>${escapeHtml(formatHours(maxMinutes / 60))}</span>
            <span>${escapeHtml(formatHours(midMinutes / 60))}</span>
            <span>0m</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="position:relative; display:flex; align-items:flex-end; gap:4px; height:88px; padding:2px 0 0; border-left:1px solid ${palette.chartAxis}; border-bottom:1px solid ${palette.chartAxis};">${bars}</div>
            <div style="display:flex; justify-content:space-between; font-size:9px; line-height:1; font-weight:800; color:${palette.muted}; padding-left:2px;">
              <span>${escapeHtml(firstDate)}</span>
              <span>${escapeHtml(middleDate)}</span>
              <span>${escapeHtml(lastDate)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function getDashboardStreakButton() {
    return Array.from(document.querySelectorAll("button[title], button[aria-label]")).find((button) => {
      const text = `${button.getAttribute("title") || ""} ${button.getAttribute("aria-label") || ""}`;
      return /streak/i.test(text) && button.querySelector("svg");
    }) || null;
  }

  function hideNativeStreakHover() {
    Array.from(document.querySelectorAll("div, button")).forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }
      const text = String(node.textContent || "").toLowerCase();
      if (!text.includes("last 14 days") || !text.includes("view streak details")) {
        return;
      }
      const nativeHover = node.closest("[class*='absolute'][class*='top-full'][class*='left-0'][class*='z-50']") || node;
      if (nativeHover instanceof HTMLElement) {
        nativeHover.style.setProperty("display", "none", "important");
        nativeHover.setAttribute("data-mu-hidden-native-streak-hover", "true");
      }
    });
  }

  function ensureStreakHoverCard() {
    let card = document.getElementById(STREAK_HOVER_CARD_ID);
    if (!card) {
      card = document.createElement("div");
      card.id = STREAK_HOVER_CARD_ID;
      card.style.minWidth = "280px";
      card.style.maxWidth = "360px";
      card.style.borderRadius = "2px";
      card.style.pointerEvents = "auto";
      card.hidden = true;
      document.body.appendChild(card);
      card.addEventListener("mouseenter", () => {
        if (streakHoverCardHideTimer) {
          clearTimeout(streakHoverCardHideTimer);
          streakHoverCardHideTimer = null;
        }
      });
      card.addEventListener("mouseleave", () => hideStreakHoverCard());
    }
    const palette = getStreakThemePalette();
    card.style.background = palette.cardBg;
    card.style.border = `3px solid ${palette.cardBorder}`;
    card.style.boxShadow = palette.cardShadow;
    card.style.color = palette.text;
    return card;
  }

  function hideStreakHoverCard(immediate = false) {
    const card = document.getElementById(STREAK_HOVER_CARD_ID);
    if (!card) {
      return;
    }
    if (streakHoverCardHideTimer) {
      clearTimeout(streakHoverCardHideTimer);
      streakHoverCardHideTimer = null;
    }
    const hide = () => {
      card.hidden = true;
    };
    if (immediate) {
      hide();
      return;
    }
    streakHoverCardHideTimer = window.setTimeout(hide, 120);
  }

  function renderStreakHoverCard(data) {
    const card = ensureStreakHoverCard();
    const palette = getStreakThemePalette();
    const items = Array.isArray(data?.projects) ? data.projects : [];
    const streakFreezesRemaining = Math.max(0, Math.round(Number(data?.streakFreezesRemaining) || 0));
    const recentDays = Array.isArray(data?.calendarDays)
      ? data.calendarDays.filter((day) => day && day.status !== "pending").slice(-14)
      : [];
    const averageRecentMinutes = recentDays.length
      ? Math.round(recentDays.reduce((sum, day) => sum + (Number(day?.minutes) || 0), 0) / recentDays.length)
      : 0;
    const todayMinutes = Math.max(0, Math.round(Number(data?.todayMinutes) || 0));
    const activityBars = buildRecentActivityBars(recentDays, palette);
    const flameIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;flex-shrink:0;color:${palette.active};" aria-hidden="true"><path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"></path></svg>`;
    const freezeIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0;color:${palette.freezeText};" aria-hidden="true"><path d="m10 20-1.25-2.5L6 18"></path><path d="M10 4 8.75 6.5 6 6"></path><path d="m14 20 1.25-2.5L18 18"></path><path d="m14 4 1.25 2.5L18 6"></path><path d="m17 21-3-6h-4"></path><path d="m17 3-3 6 1.5 3"></path><path d="M2 12h6.5L10 9"></path><path d="m20 10-1.5 2 1.5 2"></path><path d="M22 12h-6.5L14 15"></path><path d="m4 10 1.5 2L4 14"></path><path d="m7 21 3-6-1.5-3"></path><path d="m7 3 3 6h4"></path></svg>`;
    card.innerHTML = items.length || streakFreezesRemaining > 0
      ? `
        <div style="padding:16px 16px 14px; display:flex; flex-direction:column; gap:14px;">
          <div style="padding-bottom:12px; border-bottom:2px solid ${palette.cardBorder};">
            <div style="font-size:12px; line-height:1rem; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; color:${palette.text};">Project streaks</div>
          </div>
          <div style="display:flex; align-items:flex-start; gap:12px; flex-wrap:wrap; padding-bottom:12px; border-bottom:2px solid ${palette.rule};">
            <div style="display:flex; align-items:center; gap:8px; padding:8px 12px; background:${palette.freezeBg}; border:2px solid ${palette.freezeBorder}; color:${palette.freezeText};">
              ${freezeIcon}
              <span style="font-size:22px; line-height:1; font-weight:900;">${streakFreezesRemaining}</span>
              <span style="font-size:13px; line-height:1rem; font-weight:700;">streak freezes</span>
            </div>
            <div style="display:flex; align-items:stretch; gap:8px; flex:1 1 220px; min-width:220px;">
              <div style="flex:1 1 0; padding:8px 10px; border:2px solid ${palette.panelBorder}; background:${palette.panelBg};">
                <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:${palette.muted}; font-weight:800;">Avg daily</div>
                <div style="margin-top:4px; font-size:18px; line-height:1; font-weight:900; color:${palette.text};">${formatHours(averageRecentMinutes / 60)}</div>
              </div>
              <div style="flex:1 1 0; padding:8px 10px; border:2px solid ${palette.panelBorder}; background:${palette.panelBg};">
                <div style="font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:${palette.muted}; font-weight:800;">Today</div>
                <div style="margin-top:4px; font-size:18px; line-height:1; font-weight:900; color:${palette.text};">${formatHours(todayMinutes / 60)}</div>
              </div>
            </div>
          </div>
          ${activityBars ? `
            <div style="display:flex; flex-direction:column; gap:8px; padding-bottom:12px; border-bottom:2px solid ${palette.rule};">
              ${activityBars}
            </div>
          ` : ""}
          <div style="display:flex; flex-direction:column; gap:6px;">
          ${items.map((item) => `
            <div style="display:flex; align-items:center; gap:12px; padding:8px 12px; background:${palette.panelBg}; border:2px solid ${palette.panelBorder};">
              ${flameIcon}
              <span style="flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:14px; line-height:1.25; font-weight:700; color:${palette.text};">${escapeHtml(item.title)}</span>
              <span style="flex-shrink:0; font-size:24px; line-height:1; font-weight:900; color:${palette.text};">${Math.max(0, Math.round(Number(item.streakDays) || 0))}</span>
              <span style="flex-shrink:0; font-size:12px; line-height:1rem; color:${palette.muted};">days</span>
            </div>
          `).join("")}
          </div>
        </div>
      `
      : `
        <div style="padding:16px; display:flex; flex-direction:column; gap:10px;">
          <div style="padding-bottom:12px; border-bottom:2px solid ${palette.cardBorder}; font-size:12px; line-height:1rem; font-weight:900; text-transform:uppercase; letter-spacing:0.08em; color:${palette.text};">Project streaks</div>
          <div style="font-size:13px; color:${palette.subtext};">No streak data found.</div>
        </div>
      `;
    return card;
  }

  function positionStreakHoverCard(button, card) {
    if (!(button instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      return;
    }
    card.hidden = false;
    card.style.position = "fixed";
    card.style.zIndex = "9999";
    const rect = button.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const left = Math.max(12, Math.min(window.innerWidth - cardRect.width - 12, rect.left + rect.width / 2 - cardRect.width / 2));
    const top = Math.min(window.innerHeight - cardRect.height - 12, rect.bottom + 10);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(Math.max(12, top))}px`;
  }

  async function getStreakHoverData() {
    const now = new Date();
    const currentMonth = formatYearMonth(getYearMonthParts(now));
    const previousMonth = formatYearMonth(getPreviousYearMonth(getYearMonthParts(now)));
    const cacheKey = `${currentMonth}|${previousMonth}|${getLocalDateKey(now)}`;
    if (streakHoverData && typeof streakHoverData === "object" && streakHoverDataCacheKey === cacheKey) {
      return streakHoverData;
    }
    if (streakHoverDataPromise) {
      return streakHoverDataPromise;
    }
    streakHoverDataPromise = (async () => {
      const [profileStreaks, currentCalendar, previousCalendar] = await Promise.all([
        fetchProfileStreaks(),
        fetchStreakCalendar(currentMonth),
        fetchStreakCalendar(previousMonth)
      ]);
      const parsed = buildStreakHoverData(profileStreaks, mergeStreakCalendars([previousCalendar, currentCalendar]));
      streakHoverData = parsed;
      streakHoverDataCacheKey = cacheKey;
      return parsed;
    })();
    try {
      return await streakHoverDataPromise;
    } finally {
      streakHoverDataPromise = null;
    }
  }

  function ensureStreakHoverInteraction() {
    const button = getDashboardStreakButton();
    if (!(button instanceof HTMLElement) || button.dataset.muStreakHoverBound === "true") {
      return;
    }
    button.dataset.muStreakHoverBound = "true";
    button.style.cursor = "default";
    hideNativeStreakHover();
    getStreakHoverData().then((data) => renderDashboardStreakProgress(data, button)).catch(() => {});
    button.addEventListener("mouseenter", async () => {
      if (streakHoverCardHideTimer) {
        clearTimeout(streakHoverCardHideTimer);
        streakHoverCardHideTimer = null;
      }
      const data = await getStreakHoverData();
      renderDashboardStreakProgress(data, button);
      const card = renderStreakHoverCard(data);
      positionStreakHoverCard(button, card);
    });
    button.addEventListener("mouseleave", () => hideStreakHoverCard());
    button.addEventListener("focus", async () => {
      const data = await getStreakHoverData();
      renderDashboardStreakProgress(data, button);
      const card = renderStreakHoverCard(data);
      positionStreakHoverCard(button, card);
    });
    button.addEventListener("blur", () => hideStreakHoverCard());
  }

  function maybeInterceptStreakButtonClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button") || null;
    if (!button || button !== getDashboardStreakButton()) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function applyEffectiveGoldPerHourFromMeta(metaById, projectIds) {
    const ids = Array.isArray(projectIds) ? projectIds : [];
    let weightedRateSum = 0;
    let totalHours = 0;

    ids.forEach((projectId) => {
      const meta = metaById?.[String(projectId)];
      const hours = Number(meta?.hours);
      const goldPerHour = Number(meta?.goldPerHour);
      if (!Number.isFinite(hours) || hours <= 0 || !Number.isFinite(goldPerHour) || goldPerHour <= 0) {
        return;
      }
      weightedRateSum += hours * goldPerHour;
      totalHours += hours;
    });

    if (totalHours <= 0 || weightedRateSum <= 0) {
      return null;
    }

    return {
      effectiveGoldPerHour: weightedRateSum / totalHours,
      totalHours,
      projectIds: ids.map((id) => String(id))
    };
  }

  function applyEffectiveRateResult(result) {
    if (!result || !Number.isFinite(result.effectiveGoldPerHour) || result.effectiveGoldPerHour <= 0) {
      return false;
    }
    effectiveGoldPerHour = result.effectiveGoldPerHour;
    writeCache({
      timestamp: Date.now(),
      effectiveGoldPerHour: result.effectiveGoldPerHour,
      totalHours: result.totalHours,
      projectIds: result.projectIds
    });
    updateDashboardAverageRateRow();
    updateShopCardHours(getShopModalElement() || document);
    scheduleShopModalUiRefresh();
    queueGoalsMiniRender();
    refreshGoalOrderStatus();
    return true;
  }

  function seedCreatedProjectCache(createdProject, payload, optionalPayload) {
    const projectIdNum = Number(createdProject?.id);
    if (!Number.isFinite(projectIdNum) || projectIdNum <= 0) {
      return;
    }

    const projectId = String(projectIdNum);
    const nextOrder = projectTileOrder.includes(projectId)
      ? projectTileOrder
      : [...projectTileOrder, projectId].slice(0, PROJECT_FETCH_LIMIT);
    projectTileOrder = nextOrder;
    writeProjectTileOrderCache(projectTileOrder);
    projectIdsBootstrapped = true;
    writeProjectIdBootstrapCache(true);

    const title = String(createdProject?.name || payload?.name || "").trim();
    const level = createdProject?.level ?? payload?.level;
    const goldPerHour = getProjectEffectiveGoldPerHour(level, { streakDays: 0 });
    if (title) {
      projectTitleById[projectId] = title;
    }
    projectMetaById[projectId] = {
      title,
      hours: 0,
      streakDays: 0,
      level: Number.isFinite(Number(level)) ? Math.min(4, Math.max(1, Math.round(Number(level)))) : null,
      estCoins: 0,
      totalEarnedGold: 0,
      futureCoins: 0,
      goldPerHour: Number.isFinite(goldPerHour) ? goldPerHour : null,
      hackatimeProjects: Array.isArray(optionalPayload?.hackatimeProjects) ? optionalPayload.hackatimeProjects.slice() : []
    };
    recordProjectMetricsSnapshot(projectMetaById).catch(() => {
    });
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
      const cachedOwnerName = normalizeOwnerName(parsed.ownerName);
      if (!cachedOwnerName) {
        return null;
      }
      if (normalizeOwnerName(currentOwnerName) && cachedOwnerName !== normalizeOwnerName(currentOwnerName)) {
        return null;
      }
      if (Date.now() - Number(parsed.timestamp || 0) > PROJECT_RATE_CACHE_TTL_MS) {
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
    localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify({
      ...payload,
      ownerName: currentOwnerName || ""
    }));
  }

  function readHackatimeProjectsCache() {
    const raw = localStorage.getItem(HACKATIME_PROJECTS_CACHE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return [];
      }
      if (Date.now() - Number(parsed.timestamp || 0) > HACKATIME_PROJECTS_CACHE_TTL_MS) {
        return [];
      }
      if (Number(parsed.windowDays || 0) !== HACKATIME_PROJECTS_WINDOW_DAYS) {
        return [];
      }
      const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
      return projects
        .map((project) => ({
          name: String(project?.name || "").trim(),
          seconds: Number(project?.seconds || 0)
        }))
        .filter((project) => project.name && Number.isFinite(project.seconds) && project.seconds > 0);
    } catch (_err) {
      return [];
    }
  }

  function writeHackatimeProjectsCache(projects) {
    const normalized = Array.isArray(projects)
      ? projects
        .map((project) => ({
          name: String(project?.name || "").trim(),
          seconds: Number(project?.seconds || 0)
        }))
        .filter((project) => project.name && Number.isFinite(project.seconds) && project.seconds > 0)
      : [];
    localStorage.setItem(HACKATIME_PROJECTS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      windowDays: HACKATIME_PROJECTS_WINDOW_DAYS,
      projects: normalized
    }));
  }

  function readProjectLabelPrefsCache() {
    const raw = localStorage.getItem(PROJECT_LABEL_PREFS_CACHE_KEY);
    if (!raw) {
      return {
        showHours: true,
        showStreak: true,
        showEstCoins: true,
        showGoalsHud: true,
        hudSize: "medium",
        goalsViewMode: "actual",
        goalsProgressMode: "cumulative",
        showHudGoalsStat: true,
        showHudProgressStat: true,
        showHudRemainingStat: true,
        showHudEtaStat: true,
        theme: "default"
      };
    }
    try {
      const parsed = JSON.parse(raw);
      return {
        showHours: parsed?.showHours !== false,
        showStreak: parsed?.showStreak !== false,
        showEstCoins: parsed?.showEstCoins !== false,
        showGoalsHud: parsed?.showGoalsHud !== false,
        hudSize: normalizeHudSize(parsed?.hudSize),
        goalsViewMode: parsed?.goalsViewMode === "projected" ? "projected" : "actual",
        goalsProgressMode: normalizeGoalsProgressMode(parsed?.goalsProgressMode),
        showHudGoalsStat: parsed?.showHudGoalsStat !== false,
        showHudProgressStat: parsed?.showHudProgressStat !== false,
        showHudRemainingStat: parsed?.showHudRemainingStat !== false,
        showHudEtaStat: parsed?.showHudEtaStat !== false,
        theme: normalizeTheme(parsed?.theme)
      };
    } catch (_err) {
      return {
        showHours: true,
        showStreak: true,
        showEstCoins: true,
        showGoalsHud: true,
        hudSize: "medium",
        goalsViewMode: "actual",
        goalsProgressMode: "cumulative",
        showHudGoalsStat: true,
        showHudProgressStat: true,
        showHudRemainingStat: true,
        showHudEtaStat: true,
        theme: "default"
      };
    }
  }

  function writeProjectLabelPrefsCache(prefs) {
    localStorage.setItem(PROJECT_LABEL_PREFS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      showHours: prefs.showHours !== false,
      showStreak: prefs.showStreak !== false,
      showEstCoins: prefs.showEstCoins !== false,
      showGoalsHud: prefs.showGoalsHud !== false,
      hudSize: normalizeHudSize(prefs.hudSize),
      goalsViewMode: prefs.goalsViewMode === "projected" ? "projected" : "actual",
      goalsProgressMode: normalizeGoalsProgressMode(prefs.goalsProgressMode),
      showHudGoalsStat: prefs.showHudGoalsStat !== false,
      showHudProgressStat: prefs.showHudProgressStat !== false,
      showHudRemainingStat: prefs.showHudRemainingStat !== false,
      showHudEtaStat: prefs.showHudEtaStat !== false,
      theme: normalizeTheme(prefs.theme)
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

  function normalizeGoal(raw) {
    if (!raw || typeof raw !== "object") {
      return null;
    }
    const name = String(raw.name || "").trim();
    const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1));
    const unitGold = Math.max(0, Math.round(Number(raw.unitGold) || 0));
    const itemIdNum = Number(raw.itemId);
    const itemId = Number.isFinite(itemIdNum) && itemIdNum > 0 ? itemIdNum : null;
    if (!name || unitGold <= 0) {
      return null;
    }
    return {
      id: String(raw.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
      itemId,
      name,
      quantity,
      unitGold,
      imageUrl: String(raw.imageUrl || "").trim(),
      createdAt: Number(raw.createdAt) || Date.now()
    };
  }

  function getTelemetryApi() {
    return typeof window !== "undefined" ? window.muTelemetry || null : null;
  }

  function enqueueTelemetry(eventType, payload) {
    const api = getTelemetryApi();
    if (!api) return Promise.resolve(false);
    try {
      return Promise.resolve(api.enqueue(eventType, payload || {}));
    } catch {
      return Promise.resolve(false);
    }
  }

  function handleTelemetryPrefChange(key, checked) {
    const api = getTelemetryApi();
    if (!api) return;
    const current = api.getPrefs ? api.getPrefs() : {};
    const next = { ...current, [key]: Boolean(checked) };
    if (key === "enabled" && !next.enabled) {
      next.activity = false;
      next.goals = false;
      next.shop = false;
      next.projects = false;
      next.theme = false;
      next.errors = false;
    } else if (key === "enabled" && next.enabled) {
      next.activity = true;
      next.goals = true;
      next.shop = true;
      next.projects = true;
      next.theme = true;
      next.errors = true;
    }
    if (api.setPrefs) {
      api.setPrefs(next).then(() => {
        refreshProjectLabelSettingsPanel();
        if ((key === "enabled" && next.enabled) || (key === "projects" && checked)) {
          if (Object.keys(projectMetaById || {}).length) {
            recordProjectMetricsSnapshot(projectMetaById, true).catch(() => {
            });
          }
        }
      });
    }
  }

  function refreshProjectLabelSettingsPanel() {
    const root = document.getElementById(PROJECT_LABEL_SETTINGS_ID);
    if (!(root instanceof HTMLElement)) return;
    const panel = root.querySelector(".mu-label-settings-panel");
    if (!(panel instanceof HTMLElement)) return;
    syncTelemetryPrefInputs(panel);
  }

  function syncTelemetryPrefInputs(panel) {
    if (!(panel instanceof HTMLElement)) return;
    const api = getTelemetryApi();
    const prefs = api && api.getPrefs ? api.getPrefs() : {};
    const masterEnabled = prefs.enabled === true;
    Array.from(panel.querySelectorAll("input[type='checkbox'][data-telemetry-key]"))
      .forEach((node) => {
        const input = node;
        const key = input.dataset.telemetryKey;
        if (!key) return;
        const value = prefs[key];
        if (key === "enabled") {
          input.checked = masterEnabled;
          input.disabled = false;
        } else {
          input.checked = value === true;
          input.disabled = !masterEnabled;
        }
        const row = input.closest(".mu-label-settings-row");
        if (row instanceof HTMLElement) {
          row.classList.toggle("mu-telemetry-disabled", input.disabled);
        }
      });
  }

  function recordGoalEvent(type, goal) {
    if (!goal) return;
    const payload = {
      goal_id: goal.itemId ? String(goal.itemId) : goal.id,
      name: goal.name,
    };
    if (type === "goal_qty_changed") {
      payload.quantity = Math.max(0, Math.round(Number(goal.quantity) || 0));
    }
    enqueueTelemetry(type, payload);
  }

  function recordShopInteractEvent(candidate) {
    if (!candidate) return;
    const payload = {
      item_id: candidate.itemId ? String(candidate.itemId) : (candidate.name || "unknown"),
      name: candidate.name,
      gold: Math.max(0, Math.round(Number(candidate.unitGold) || 0)),
    };
    enqueueTelemetry("shop_card_interact", payload);
  }

  function recordThemePresetEvent(preset) {
    if (preset !== "default" && preset !== "dark") return;
    enqueueTelemetry("theme_preset_changed", { preset });
  }

  function recordSessionStart() {
    const path = String(window.location?.pathname || "/");
    enqueueTelemetry("session_start", { path });
  }

  function recordOnboardingCompleted(flowVersion) {
    enqueueTelemetry("onboarding_completed", { flow_version: String(flowVersion || "unknown") });
  }

  function recordErrorTelemetry(kind, message) {
    enqueueTelemetry("error_reported", {
      kind: String(kind || "generic").slice(0, 80),
      message: String(message || "").slice(0, 500),
    });
  }

  function medianFromSortedNumbers(values) {
    const list = Array.isArray(values)
      ? values.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
      : [];
    if (!list.length) {
      return 0;
    }
    const mid = Math.floor(list.length / 2);
    if (list.length % 2 === 1) {
      return list[mid];
    }
    return (list[mid - 1] + list[mid]) / 2;
  }

  function buildProjectMetricsSnapshot(metaById) {
    const entries = Object.values(metaById || {}).filter(Boolean);
    if (!entries.length) {
      return null;
    }

    const levelCounts = new Map();
    const streakCounts = new Map();
    const levelValues = [];
    const streakValues = [];

    entries.forEach((meta) => {
      const level = Number.isFinite(Number(meta.level)) ? Math.min(4, Math.max(1, Math.round(Number(meta.level)))) : null;
      const streakDays = Number.isFinite(Number(meta.streakDays)) ? Math.max(0, Math.round(Number(meta.streakDays))) : null;
      if (level !== null) {
        levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
        levelValues.push(level);
      }
      if (streakDays !== null) {
        streakCounts.set(streakDays, (streakCounts.get(streakDays) || 0) + 1);
        streakValues.push(streakDays);
      }
    });

    if (!levelValues.length && !streakValues.length) {
      return null;
    }

    return {
      project_count: entries.length,
      median_level: medianFromSortedNumbers(levelValues),
      median_streak_days: medianFromSortedNumbers(streakValues),
      level_counts: Array.from(levelCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([level, count]) => ({ level, count })),
      streak_counts: Array.from(streakCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([streak_days, count]) => ({ streak_days, count })),
    };
  }

  async function recordProjectMetricsSnapshot(metaById, force = false) {
    const snapshot = buildProjectMetricsSnapshot(metaById);
    if (!snapshot) {
      return false;
    }
    const serialized = JSON.stringify(snapshot);
    const previous = String(localStorage.getItem(PROJECT_METRICS_SNAPSHOT_CACHE_KEY) || "");
    if (!force && previous === serialized) {
      return false;
    }
    const enqueued = await enqueueTelemetry("project_metrics_snapshot", snapshot);
    if (enqueued) {
      localStorage.setItem(PROJECT_METRICS_SNAPSHOT_CACHE_KEY, serialized);
    }
    return enqueued;
  }

  function readGoalsCache() {
    const raw = localStorage.getItem(PROJECT_GOALS_CACHE_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      const goals = Array.isArray(parsed?.goals) ? parsed.goals : [];
      return goals.map(normalizeGoal).filter(Boolean);
    } catch (_err) {
      return [];
    }
  }

  function writeGoalsCache(goals) {
    const normalized = Array.isArray(goals) ? goals.map(normalizeGoal).filter(Boolean) : [];
    localStorage.setItem(PROJECT_GOALS_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      goals: normalized
    }));
  }

  function readGoalOrderSyncCache() {
    const raw = localStorage.getItem(PROJECT_GOALS_ORDER_SYNC_CACHE_KEY);
    if (!raw) {
      return { itemIds: [], timestamp: 0 };
    }
    try {
      const parsed = JSON.parse(raw);
      const itemIds = Array.isArray(parsed?.itemIds)
        ? parsed.itemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
        : [];
      return {
        itemIds,
        timestamp: Number(parsed?.timestamp) || 0
      };
    } catch (_err) {
      return { itemIds: [], timestamp: 0 };
    }
  }

  function writeGoalOrderSyncCache(itemIds) {
    const normalized = Array.isArray(itemIds)
      ? itemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      : [];
    localStorage.setItem(PROJECT_GOALS_ORDER_SYNC_CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      itemIds: normalized
    }));
  }

  function buildProjectMeta(title, metrics) {
    if (!metrics || typeof metrics !== "object") {
      return null;
    }
    const safeTitle = String(title || "").trim();
    const hours = Number(metrics.hours);
    const streakDays = Number.isFinite(metrics.streakDays) ? Math.max(0, Math.round(metrics.streakDays)) : 0;
    const level = Number.isFinite(metrics.level) ? Math.min(4, Math.max(1, Math.round(metrics.level))) : null;
    const estCoins = Number.isFinite(metrics.estCoins)
      ? Math.max(0, Math.round(metrics.estCoins))
      : Number.isFinite(metrics.goldPerHour) ? Math.max(0, Math.round(hours * Number(metrics.goldPerHour))) : 0;
    const totalEarnedGold = Number.isFinite(metrics.totalEarnedGold)
      ? Math.max(0, Math.round(metrics.totalEarnedGold))
      : 0;
    const futureCoins = Math.max(0, estCoins - totalEarnedGold);
    if (!safeTitle && level === null && hours <= 0 && streakDays <= 0) {
      return null;
    }
    return {
      title: safeTitle,
      hours: Number.isFinite(hours) && hours > 0 ? hours : 0,
      streakDays,
      level,
      estCoins,
      totalEarnedGold,
      futureCoins,
      goldPerHour: Number.isFinite(metrics.goldPerHour) ? Number(metrics.goldPerHour) : null
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
      if (!Array.isArray(parsed.order)) {
        return [];
      }
      return parsed.order.map((id) => String(id));
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

  function getLabelPlacementOffsets(placement) {
    if (placement === "top") {
      return LABEL_PLACEMENT_OFFSETS.top;
    }
    if (placement === "left") {
      return LABEL_PLACEMENT_OFFSETS.left;
    }
    if (placement === "right") {
      return LABEL_PLACEMENT_OFFSETS.right;
    }
    return LABEL_PLACEMENT_OFFSETS.bottom;
  }

  function getLabelPlacementTilt(placement) {
    if (placement === "top") {
      return LABEL_PLACEMENT_TILTS.top;
    }
    if (placement === "left") {
      return LABEL_PLACEMENT_TILTS.left;
    }
    if (placement === "right") {
      return LABEL_PLACEMENT_TILTS.right;
    }
    return LABEL_PLACEMENT_TILTS.bottom;
  }

  function getTileLabelCandidate(tileModel, placement) {
    const baseAnchor = placement === "bottom"
      ? { x: tileModel.left + tileModel.width * 0.62, y: tileModel.top + tileModel.height + 9 }
      : placement === "top"
        ? { x: tileModel.left + tileModel.width * 0.58, y: tileModel.top - 9 }
        : placement === "right"
          ? { x: tileModel.left + tileModel.width + 10, y: tileModel.top + tileModel.height * 0.64 }
          : { x: tileModel.left - 10, y: tileModel.top + tileModel.height * 0.64 };
    const offsets = getLabelPlacementOffsets(placement);
    const anchor = {
      x: baseAnchor.x + offsets.x,
      y: baseAnchor.y + offsets.y
    };

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

    syncFarmThemeTargets();

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

  function ensureProjectLabelSettingsPanelOpen() {
    const root = document.getElementById(PROJECT_LABEL_SETTINGS_ID);
    const button = root?.querySelector(".mu-label-settings-btn");
    const panel = root?.querySelector(".mu-label-settings-panel");
    if (!(button instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) {
      return false;
    }
    if (panel.hidden) {
      button.click();
    } else {
      positionProjectLabelSettingsPanel(button, panel);
      renderGoalSettingsPanel(panel);
    }
    return true;
  }

  function positionProjectLabelSettingsPanel(button, panel) {
    if (!(button instanceof HTMLElement) || !(panel instanceof HTMLElement)) {
      return;
    }
    const rect = button.getBoundingClientRect();
    const panelWidth = 260;
    const left = Math.max(12, Math.min(window.innerWidth - panelWidth - 12, rect.right - panelWidth));
    panel.style.position = "fixed";
    panel.style.top = `${Math.round(rect.bottom + 8)}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.right = "auto";
  }

  function renderGoalSettingsPanel(panel) {
    if (!(panel instanceof HTMLElement)) {
      return;
    }
    panel.querySelectorAll("input[data-key]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      const key = String(input.dataset.key || "");
      if (!key || !(key in projectLabelPrefs)) {
        return;
      }
      input.checked = projectLabelPrefs[key] !== false;
    });
    const themeSelect = panel.querySelector("select[data-theme-key='theme']");
    if (themeSelect instanceof HTMLSelectElement) {
      themeSelect.value = normalizeTheme(projectLabelPrefs.theme);
    }
    const hudSizeSelect = panel.querySelector("select[data-hud-key='hudSize']");
    if (hudSizeSelect instanceof HTMLSelectElement) {
      hudSizeSelect.value = normalizeHudSize(projectLabelPrefs.hudSize);
    }
  }

  function adjustGoalQuantity(goalId, delta) {
    const id = String(goalId || "");
    const amount = Math.round(Number(delta) || 0);
    if (!id || !amount) {
      return;
    }
    const idx = projectGoals.findIndex((goal) => goal.id === id);
    if (idx < 0) {
      return;
    }
    const current = projectGoals[idx];
    projectGoals[idx] = {
      ...current,
      quantity: Math.max(1, (Number(current.quantity) || 1) + amount)
    };
    writeGoalsCache(projectGoals);
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel instanceof HTMLElement && !panel.hidden) {
      renderGoalSettingsPanel(panel);
    }
    syncAllShopCardGoalControls(getShopModalElement() || document);
    scheduleShopModalUiRefresh();
    queueGoalsMiniRender();
    recordGoalEvent("goal_qty_changed", projectGoals[idx]);
  }

  function removeGoalById(goalId) {
    const id = String(goalId || "");
    if (!id) {
      return;
    }
    const removed = projectGoals.find((goal) => goal.id === id);
    const nextGoals = projectGoals.filter((goal) => goal.id !== id);
    if (nextGoals.length === projectGoals.length) {
      return;
    }
    projectGoals = nextGoals;
    writeGoalsCache(projectGoals);
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel instanceof HTMLElement && !panel.hidden) {
      renderGoalSettingsPanel(panel);
    }
    syncAllShopCardGoalControls(getShopModalElement() || document);
    scheduleShopModalUiRefresh();
    queueGoalsMiniRender();
    recordGoalEvent("goal_removed", removed);
  }

  function reorderGoal(dragId, targetId) {
    const fromIndex = projectGoals.findIndex((goal) => goal.id === dragId);
    if (fromIndex < 0) {
      return;
    }
    const nextGoals = projectGoals.slice();
    const [movedGoal] = nextGoals.splice(fromIndex, 1);
    if (!movedGoal) {
      return;
    }
    if (!targetId) {
      nextGoals.push(movedGoal);
    } else {
      const targetIndex = nextGoals.findIndex((goal) => goal.id === targetId);
      if (targetIndex < 0) {
        nextGoals.push(movedGoal);
      } else {
        nextGoals.splice(targetIndex, 0, movedGoal);
      }
    }
    projectGoals = nextGoals;
    writeGoalsCache(projectGoals);
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel instanceof HTMLElement && !panel.hidden) {
      renderGoalSettingsPanel(panel);
    }
    syncAllShopCardGoalControls(getShopModalElement() || document);
    scheduleShopModalUiRefresh();
    queueGoalsMiniRender();
  }

  function handleGoalActionElement(action) {
    if (!(action instanceof HTMLElement)) {
      return false;
    }
    const removeId = String(action.getAttribute("data-goal-remove") || "");
    if (removeId) {
      removeGoalById(removeId);
      return true;
    }
    const goalId = String(action.getAttribute("data-goal-id") || "");
    const delta = Number(action.getAttribute("data-goal-qty-adjust") || "0");
    if (!goalId || !delta) {
      return false;
    }
    if (delta < 0) {
      const goal = projectGoals.find((entry) => entry.id === goalId);
      if (goal && (Number(goal.quantity) || 1) <= 1) {
        removeGoalById(goalId);
        return true;
      }
    }
    adjustGoalQuantity(goalId, delta);
    return true;
  }

  function handleGoalsModeToggle(action) {
    if (!(action instanceof HTMLElement)) {
      return false;
    }
    const mode = String(action.getAttribute("data-goals-mode") || "").toLowerCase();
    if (mode !== "actual" && mode !== "projected") {
      return false;
    }
    if (goalsViewMode === mode) {
      updateInjectedGoalsViewModeState();
      if (isShopModalOpen()) {
        renderGoalsMiniBox();
      }
      return true;
    }
    goalsViewMode = mode;
    projectLabelPrefs = {
      ...projectLabelPrefs,
      goalsViewMode: mode
    };
    writeProjectLabelPrefsCache(projectLabelPrefs);
    updateInjectedGoalsViewModeState();
    if (isShopModalOpen()) {
      renderGoalsMiniBox();
    } else {
      queueGoalsMiniRender();
    }
    return true;
  }

  function handleGoalsProgressModeToggle(action) {
    if (!(action instanceof HTMLElement)) {
      return false;
    }
    const mode = normalizeGoalsProgressMode(action.getAttribute("data-goal-progress-mode") || "");
    if (goalsProgressMode === mode) {
      if (isShopModalOpen()) {
        renderGoalsMiniBox();
      }
      return true;
    }
    goalsProgressMode = mode;
    projectLabelPrefs = {
      ...projectLabelPrefs,
      goalsProgressMode: mode
    };
    writeProjectLabelPrefsCache(projectLabelPrefs);
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel instanceof HTMLElement && !panel.hidden) {
      renderGoalSettingsPanel(panel);
    }
    if (isShopModalOpen()) {
      renderGoalsMiniBox();
    } else {
      queueGoalsMiniRender();
    }
    return true;
  }

  function ensureProjectLabelSettingsButton() {
    if (!isDashboardPage()) {
      const existing = document.getElementById(PROJECT_LABEL_SETTINGS_ID);
      if (existing) {
        existing.remove();
      }
      const fallback = document.getElementById("macondo-utils-settings-fallback-mount");
      if (fallback) {
        fallback.remove();
      }
      return;
    }

    let root = document.getElementById(PROJECT_LABEL_SETTINGS_ID);
    let target = document.querySelector(SETTINGS_BUTTON_TARGET_SELECTOR);
    if (!(target instanceof HTMLElement)) {
      let fallback = document.getElementById("macondo-utils-settings-fallback-mount");
      if (!(fallback instanceof HTMLElement)) {
        fallback = document.createElement("div");
        fallback.id = "macondo-utils-settings-fallback-mount";
        fallback.style.position = "fixed";
        fallback.style.top = "16px";
        fallback.style.right = "16px";
        fallback.style.zIndex = "2147483000";
        fallback.style.pointerEvents = "auto";
        document.body.appendChild(fallback);
      }
      target = fallback;
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
        "<div class='mu-label-settings-heading'>Project labels</div>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showHours' checked /> <span>Show time</span></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showStreak' checked /> <span>Show streak</span></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showEstCoins' checked /> <span>Show est coins</span></label>",
        "<div class='mu-label-settings-heading'>Theme</div>",
        "<label class='mu-label-settings-row mu-theme-select-row'><span>Preset</span> <select data-theme-key='theme' class='mu-theme-select'><option value='default'>Default</option><option value='dark'>Dark Mode</option></select></label>",
        "<div class='mu-goals-settings'>",
        "<div class='mu-label-settings-heading'>Dashboard</div>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showGoalsHud' checked /> <span>Show HUD in dashboard</span></label>",
        "<label class='mu-label-settings-row mu-theme-select-row'><span>HUD size</span> <select data-hud-key='hudSize' class='mu-theme-select'><option value='small'>Small</option><option value='medium'>Medium</option><option value='high'>High</option></select></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showHudGoalsStat' checked /> <span>Show goals box</span></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showHudProgressStat' checked /> <span>Show progress box</span></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showHudRemainingStat' checked /> <span>Show remaining box</span></label>",
        "<label class='mu-label-settings-row'><input type='checkbox' data-key='showHudEtaStat' checked /> <span>Show ETA box</span></label>",
        "<div class='mu-telemetry-section'>",
        "<div class='mu-label-settings-heading'>Anonymous telemetry (opt-in)</div>",
        "<p class='mu-telemetry-blurb'>Help us understand which features are useful. Anonymous counters only. No account data, no page content, no project titles.</p>",
        "<label class='mu-label-settings-row mu-telemetry-master'><input type='checkbox' data-telemetry-key='enabled' /> <span>Share anonymous usage stats</span></label>",
        "<label class='mu-label-settings-row mu-telemetry-sub'><input type='checkbox' data-telemetry-key='activity' /> <span>Activity status (heartbeat)</span></label>",
        "<label class='mu-label-settings-row mu-telemetry-sub'><input type='checkbox' data-telemetry-key='goals' /> <span>Goal items I star &amp; change</span></label>",
        "<label class='mu-label-settings-row mu-telemetry-sub'><input type='checkbox' data-telemetry-key='shop' /> <span>Shop items I interact with</span></label>",
        "<label class='mu-label-settings-row mu-telemetry-sub'><input type='checkbox' data-telemetry-key='projects' /> <span>Project levels &amp; streaks</span></label>",
        "<label class='mu-label-settings-row mu-telemetry-sub'><input type='checkbox' data-telemetry-key='theme' /> <span>Theme preset changes</span></label>",
        "<label class='mu-label-settings-row mu-telemetry-sub'><input type='checkbox' data-telemetry-key='errors' /> <span>Errors only</span></label>",
        "<a class='mu-telemetry-privacy-link' href='https://macondoutils.hridya.tech/privacy' target='_blank' rel='noreferrer'>Read the privacy policy</a>",
        "</div>",
        "<button type='button' class='mu-onboarding-launch-btn' data-open-onboarding='true'>Open feature walkthrough</button>",
        "</div>"
      ].join("");

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        panel.hidden = !panel.hidden;
        if (!panel.hidden) {
          positionProjectLabelSettingsPanel(button, panel);
          renderGoalSettingsPanel(panel);
        }
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
        if (key === "showGoalsHud" || key.startsWith("showHud")) {
          queueGoalsMiniRender();
        }
      });

      panel.addEventListener("change", (event) => {
        const select = event.target instanceof HTMLSelectElement ? event.target : null;
        const key = select?.dataset?.themeKey;
        if (!(select instanceof HTMLSelectElement) || key !== "theme") {
          return;
        }
        const nextTheme = normalizeTheme(select.value);
        if (normalizeTheme(projectLabelPrefs.theme) === nextTheme) {
          return;
        }
        projectLabelPrefs = {
          ...projectLabelPrefs,
          theme: nextTheme
        };
        writeProjectLabelPrefsCache(projectLabelPrefs);
        applySelectedTheme();
        recordThemePresetEvent(nextTheme);
      });

      panel.addEventListener("change", (event) => {
        const select = event.target instanceof HTMLSelectElement ? event.target : null;
        const key = select?.dataset?.hudKey;
        if (!(select instanceof HTMLSelectElement) || key !== "hudSize") {
          return;
        }
        const nextHudSize = normalizeHudSize(select.value);
        if (normalizeHudSize(projectLabelPrefs.hudSize) === nextHudSize) {
          return;
        }
        projectLabelPrefs = {
          ...projectLabelPrefs,
          hudSize: nextHudSize
        };
        writeProjectLabelPrefsCache(projectLabelPrefs);
        queueGoalsMiniRender();
      });

      panel.addEventListener("change", (event) => {
        const input = event.target instanceof HTMLInputElement ? event.target : null;
        const key = input?.dataset?.telemetryKey;
        if (!input || !key) {
          return;
        }
        handleTelemetryPrefChange(key, input.checked);
      });

      panel.addEventListener("click", (event) => {
        const targetNode = event.target instanceof HTMLElement ? event.target : null;
        if (!targetNode) {
          return;
        }
        const progressModeToggle = targetNode.closest("[data-goal-progress-mode]");
        if (progressModeToggle instanceof HTMLElement) {
          handleGoalsProgressModeToggle(progressModeToggle);
          return;
        }
        if (targetNode.closest("[data-open-onboarding]")) {
          restartOnboarding();
          panel.hidden = true;
          return;
        }
        const removeButton = targetNode.closest("[data-goal-remove]");
        if (removeButton instanceof HTMLElement) {
          handleGoalActionElement(removeButton);
          return;
        }
        const qtyAdjust = targetNode.closest("[data-goal-qty-adjust][data-goal-id]");
        if (qtyAdjust instanceof HTMLElement) {
          handleGoalActionElement(qtyAdjust);
        }
      });

      panel.addEventListener("dragstart", (event) => {
        const targetNode = event.target instanceof HTMLElement ? event.target.closest("[data-goal-drag-id]") : null;
        if (!(targetNode instanceof HTMLElement)) {
          return;
        }
        draggedGoalId = String(targetNode.getAttribute("data-goal-drag-id") || "");
        if (!draggedGoalId) {
          return;
        }
        draggedGoalPreviewNode = targetNode;
        targetNode.classList.add("dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", draggedGoalId);
        }
      });

      panel.addEventListener("dragover", (event) => {
        const goalListNode = panel.querySelector(".mu-goals-list");
        const targetNode = event.target instanceof HTMLElement ? event.target.closest("[data-goal-drag-id], .mu-goals-list") : null;
        if (!(goalListNode instanceof HTMLElement) || !(targetNode instanceof HTMLElement) || !draggedGoalId) {
          return;
        }
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "move";
        }
        previewDraggedGoalPlacement(goalListNode, targetNode, event.clientY);
      });

      panel.addEventListener("drop", (event) => {
        const dragId = event.dataTransfer?.getData("text/plain") || draggedGoalId;
        const goalListNode = panel.querySelector(".mu-goals-list");
        if (!(goalListNode instanceof HTMLElement) || !dragId) {
          return;
        }
        event.preventDefault();
        persistGoalOrderFromContainer(goalListNode);
        draggedGoalId = "";
        draggedGoalPreviewNode = null;
      });

      panel.addEventListener("dragend", () => {
        draggedGoalId = "";
        draggedGoalPreviewNode = null;
        clearDraggedGoalClasses(panel);
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
    syncTelemetryPrefInputs(panel);
    const themeSelect = panel.querySelector("select[data-theme-key='theme']");
    if (themeSelect instanceof HTMLSelectElement) {
      themeSelect.value = normalizeTheme(projectLabelPrefs.theme);
    }

    if (!panel.hidden) {
      const button = root.querySelector(".mu-label-settings-btn");
      if (button instanceof HTMLElement) {
        positionProjectLabelSettingsPanel(button, panel);
      }
      renderGoalSettingsPanel(panel);
    }
  }

  function queueEnsureProjectLabelSettingsButton() {
    if (settingsButtonQueued) {
      return;
    }
    settingsButtonQueued = true;
    requestAnimationFrame(() => {
      settingsButtonQueued = false;
      ensureProjectLabelSettingsButton();
    });
  }

  function syncProjectGroundLabels() {
    const projectsRoot = document.getElementById("projects");
    if (!projectsRoot) {
      lastProjectLabelsSignature = "";
      return;
    }

    const layer = ensureProjectLabelLayer();
    if (!layer) {
      return;
    }

    withObserverSuppressed(() => {
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
        : getProjectIdsFromFarmTiles(projectsRoot);
      const hasValidatedFallbackOrder = fallbackOrder.length === tiles.length && tiles.length > 0;

      const tileModels = [];
      const seen = new Set();
      tiles.forEach((tile, index) => {
        const tileId = tile.dataset.muTileId || `tile-${index}`;
        tile.dataset.muTileId = tileId;
        seen.add(tileId);

        if (!tile.getAttribute("data-mu-project-id") && hasValidatedFallbackOrder && fallbackOrder[index]) {
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
        const metaLines = formatLabelMetaLines(getProjectMetaFromTile(tile));

        tileModels.push({
          tile,
          tileId,
          rawTitle,
          lines: splitProjectLabelLines(rawTitle),
          metaLines,
          left,
          top,
          width: tileWidth,
          height: tileHeight,
          centerX: left + tileWidth / 2,
          centerY: top + tileHeight / 2
        });
      });

      const nextSignature = JSON.stringify(tileModels.map((tileModel) => ({
        tileId: tileModel.tileId,
        projectId: String(tileModel.tile.getAttribute("data-mu-project-id") || ""),
        rawTitle: tileModel.rawTitle,
        metaLines: tileModel.metaLines,
        left: tileModel.left,
        top: tileModel.top,
        width: tileModel.width,
        height: tileModel.height
      })));
      const hasAllExistingLabels = existing.size === tileModels.length
        && tileModels.every((tileModel) => existing.has(tileModel.tileId));

      if (nextSignature === lastProjectLabelsSignature && hasAllExistingLabels) {
        return;
      }

      const layerRect = layer.getBoundingClientRect();

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

        tileModel.metaLines.forEach((metaText) => {
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
          const tilt = getLabelPlacementTilt(chosenPlacement.placement);
          inner.style.transform = chosenPlacement.placement === "left" || chosenPlacement.placement === "right"
            ? `rotate(${Math.round(-14 + tilt)}deg)`
            : `rotate(${Math.round(-24 + tilt)}deg)`;
          placedLabelRects.push(chosenPlacement.rect);
        }
        label.style.visibility = "";
        });

      existing.forEach((node, id) => {
        if (!seen.has(id)) {
          node.remove();
        }
      });

      lastProjectLabelsSignature = nextSignature;
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

      if (createdProject) {
        seedCreatedProjectCache(createdProject, payload, optionalPayload);
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
    const since = new Date(Date.now() - HACKATIME_PROJECTS_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    try {
      const response = await fetch(`/api/hackatime/projects?since=${since}`, {
        method: "GET",
        credentials: "include"
      });
      if (!response.ok) {
        return readHackatimeProjectsCache();
      }
      const data = await response.json();
      if (!Array.isArray(data?.projects)) {
        return readHackatimeProjectsCache();
      }
      const projects = data.projects
        .filter((project) => typeof project?.name === "string" && project.name.trim().length > 0)
        .sort((a, b) => getHackatimeProjectSeconds(b) - getHackatimeProjectSeconds(a))
        .map((project) => ({
          name: project.name.trim(),
          seconds: getHackatimeProjectSeconds(project)
        }))
        .filter((project) => Number.isFinite(project.seconds) && project.seconds > 0);
      writeHackatimeProjectsCache(projects);
      return projects;
    } catch (_err) {
      return readHackatimeProjectsCache();
    }
  }

  function buildHackatimeSecondsByName(projects) {
    const secondsByName = new Map();
    (Array.isArray(projects) ? projects : []).forEach((project) => {
      const keys = getHackatimeProjectKeys(project?.name);
      const seconds = Number(project?.seconds || 0);
      if (!keys.length || !Number.isFinite(seconds) || seconds <= 0) {
        return;
      }
      keys.forEach((key) => secondsByName.set(key, seconds));
    });
    return secondsByName;
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

  async function refreshProjectLabelMeta(force = false) {
    const now = Date.now();
    if (projectMetaRefreshInFlight || (!force && now - lastProjectMetaRefreshAt < PROJECT_LABEL_META_REFRESH_MS)) {
      return;
    }
    projectMetaRefreshInFlight = true;

    try {
      await bootstrapProjectIdsFromHiddenHarvestOnce();
      const discoveredFromDom = getProjectIdsFromFarmTiles(document);
      if (discoveredFromDom.length) {
        replaceKnownProjectIds(discoveredFromDom);
      }
      const projectIds = getKnownProjectIds();
      if (!projectIds.length) {
        lastProjectMetaRefreshAt = now;
        return;
      }

      const secondsByName = buildHackatimeSecondsByName(await fetchHackatimeProjects());

      const mergedTitles = { ...projectTitleById };
      const mergedMeta = { ...projectMetaById };

      const fetchedProjects = await mapWithConcurrency(projectIds, 8, async (projectId) => {
        try {
          const project = await fetchProjectApi(projectId);
          return { projectId, project };
        } catch (_err) {
          return { projectId, project: null };
        }
      });

      fetchedProjects.forEach(({ projectId, project }) => {
        if (!project) {
          return;
        }
        const title = String(project.name || "").trim();
        if (title) {
          mergedTitles[String(projectId)] = title;
        }
        const meta = buildProjectMetaFromApi(project, mergedMeta[String(projectId)] || null, secondsByName);
        if (meta) {
          mergedMeta[String(projectId)] = meta;
        }
      });

      const titlesBefore = JSON.stringify(projectTitleById);
      const titlesAfter = JSON.stringify(mergedTitles);
      const metaBefore = JSON.stringify(projectMetaById);
      const metaAfter = JSON.stringify(mergedMeta);
      const recomputed = applyEffectiveGoldPerHourFromMeta(mergedMeta, projectIds);

      if (titlesBefore !== titlesAfter) {
        projectTitleById = mergedTitles;
      }
      if (metaBefore !== metaAfter) {
        projectMetaById = mergedMeta;
      }
      if (recomputed) {
        applyEffectiveRateResult(recomputed);
      }
      if (titlesBefore !== titlesAfter || metaBefore !== metaAfter) {
        queueProjectGroundLabelsSync();
        recordProjectMetricsSnapshot(mergedMeta).catch(() => {
        });
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

  function formatEtaHours(hours) {
    if (!Number.isFinite(hours) || hours <= 0) {
      return "0m";
    }
    return formatHours(hours);
  }

  function persistGoalOrderFromContainer(container) {
    if (!(container instanceof HTMLElement)) {
      return;
    }
    const orderedIds = Array.from(container.querySelectorAll("[data-goal-drag-id]"))
      .map((node) => String(node.getAttribute("data-goal-drag-id") || ""))
      .filter(Boolean);
    if (!orderedIds.length || orderedIds.length !== projectGoals.length) {
      return;
    }
    const goalById = new Map(projectGoals.map((goal) => [goal.id, goal]));
    const nextGoals = orderedIds.map((id) => goalById.get(id)).filter(Boolean);
    if (nextGoals.length !== projectGoals.length) {
      return;
    }
    projectGoals = nextGoals;
    writeGoalsCache(projectGoals);
    syncAllShopCardGoalControls(getShopModalElement() || document);
    scheduleShopModalUiRefresh();
    queueGoalsMiniRender();
  }

  function previewDraggedGoalPlacement(container, targetNode, clientY) {
    if (!(container instanceof HTMLElement) || !(targetNode instanceof HTMLElement) || !(draggedGoalPreviewNode instanceof HTMLElement)) {
      return;
    }
    if (targetNode === draggedGoalPreviewNode) {
      return;
    }
    if (targetNode.matches("[data-goal-drag-id]")) {
      const rect = targetNode.getBoundingClientRect();
      const insertBefore = clientY < rect.top + rect.height / 2;
      if (insertBefore) {
        container.insertBefore(draggedGoalPreviewNode, targetNode);
      } else {
        container.insertBefore(draggedGoalPreviewNode, targetNode.nextSibling);
      }
      return;
    }
    container.appendChild(draggedGoalPreviewNode);
  }

  function clearDraggedGoalClasses(root) {
    if (!(root instanceof HTMLElement)) {
      return;
    }
    root.querySelectorAll(".dragging").forEach((node) => node.classList.remove("dragging"));
  }

  function readOnboardingState() {
    const raw = localStorage.getItem(ONBOARDING_STATE_KEY);
    if (!raw) {
      return { version: ONBOARDING_VERSION, step: 0, completed: false, dismissed: false };
    }
    try {
      const parsed = JSON.parse(raw);
      if (String(parsed?.version || "") !== ONBOARDING_VERSION) {
        return { version: ONBOARDING_VERSION, step: 0, completed: false, dismissed: false };
      }
      return {
        version: ONBOARDING_VERSION,
        step: Math.max(0, Math.round(Number(parsed?.step) || 0)),
        completed: parsed?.completed === true,
        dismissed: parsed?.dismissed === true
      };
    } catch (_err) {
      return { version: ONBOARDING_VERSION, step: 0, completed: false, dismissed: false };
    }
  }

  function writeOnboardingState(state) {
    localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify({
      version: String(state?.version || ONBOARDING_VERSION),
      step: Math.max(0, Math.round(Number(state?.step) || 0)),
      completed: state?.completed === true,
      dismissed: state?.dismissed === true,
      timestamp: Date.now()
    }));
  }

  function getCurrentMacondoView() {
    if (isShopModalOpen()) {
      return "shop";
    }
    if (window.location.pathname.startsWith("/shop")) {
      return "shop";
    }
    if (window.location.pathname.startsWith("/dashboard") || window.location.pathname === "/") {
      return "dashboard";
    }
    if (document.getElementById("projects") || getDashboardStreakButton()) {
      return "dashboard";
    }
    return "other";
  }

  function isDashboardPage() {
    const pathname = String(window.location.pathname || "").replace(/\/+$/, "") || "/";
    return pathname === "/dashboard";
  }

  function getOnboardingFlow() {
    const flows = {
      "0.1.0": [
      {
        id: "welcome",
        view: "dashboard",
        title: "Welcome to Macondo Utils",
        body: "You are set up. Macondo Utils adds a few small upgrades around Macondo so the useful information is easier to see and act on. Let’s do a quick walkthrough.",
        target: null,
        allowUntargeted: true
      },
      {
        id: "streak",
        view: "dashboard",
        title: "Streak details open right here",
        body: "The streak panel opens in place so you can see streak freezes, today’s time, average daily time, and recent activity without leaving the page.",
        target: () => getDashboardStreakButton()
      },
      {
        id: "shop-estimates",
        view: "shop",
        title: "Shop estimates use your real rate",
        body: "This little time hint is calculated from your weighted effective gold per hour, so the estimate reflects your actual projects instead of a generic default.",
        target: () => findShopEstimateNode()
      },
      {
        id: "shop-star",
        view: "shop",
        title: "Star an item to turn it into a goal",
        body: "This star is the start of the goals flow. We will pin one item so you can immediately see the queue, progress modes, and drag-to-reorder HUD.",
        target: () => findShopStarButton()
      },
      {
        id: "shop-goals",
        view: "shop",
        title: "Your goals queue lives here",
        body: "Starred items land in this HUD so you can track progress without leaving the farm.",
        target: () => findNativeWishlistRoot() || document.getElementById(GOALS_HUD_ID)
      },
      {
        id: "shop-goal-modes",
        view: "shop",
        title: "These toggles change the view",
        body: "Switch between actual and projected progress, then flip between cumulative and individual goal tracking here.",
        target: () => document.getElementById("macondo-utils-goals-native-view-mode") || document.querySelector(`#${GOALS_HUD_ID} .mu-goals-mini-controls-row`)
      },
      {
        id: "settings",
        view: "dashboard",
        title: "Settings live here",
        body: "These toggles control labels and HUD visibility. You can always reopen the walkthrough from here.",
        target: () => document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`)
      },
      {
        id: "labels",
        view: "dashboard",
        title: "Project labels are on the farm now",
        body: "Each project tile can show time, streak, and estimated coins without opening anything.",
        target: () => document.querySelector(`#${PROJECT_LABEL_LAYER_ID} .mu-ground-label`)
      },
      {
        id: "telemetry",
        view: "dashboard",
        title: "Share anonymous stats?",
        body: "Optional. If you turn this on, Macondo Utils sends a tiny anonymous heartbeat and the names of goal items you star. We use it to count active users and learn which features matter. No account data, no page content, no project titles. You can change this any time.",
        target: () => document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-telemetry-master`),
        primaryAction: "enable",
        primaryLabel: "Turn on stats"
      }
      ]
    };
    const fallbackVersion = Object.keys(flows).sort().at(-1) || ONBOARDING_VERSION;
    return {
      version: ONBOARDING_VERSION,
      steps: flows[ONBOARDING_VERSION] || flows[fallbackVersion] || []
    };
  }

  function clearOnboardingTarget() {
    onboardingTargetNode = null;
  }

  function setOnboardingTarget(node) {
    if (node instanceof HTMLElement) {
      onboardingTargetNode = node;
      return;
    }
    onboardingTargetNode = null;
  }

  function getOnboardingRectForElement(node, padding = 12) {
    if (!(node instanceof HTMLElement)) {
      return null;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    return {
      left: Math.max(8, rect.left - padding),
      top: Math.max(8, rect.top - padding),
      width: Math.min(window.innerWidth - 16, rect.width + padding * 2),
      height: Math.min(window.innerHeight - 16, rect.height + padding * 2),
      rotate: 0
    };
  }

  function getOnboardingUnionRect(nodes, padding = 16, rotate = 0) {
    const rects = (Array.isArray(nodes) ? nodes : []).map((node) => node instanceof HTMLElement ? node.getBoundingClientRect() : null).filter((rect) => rect && rect.width > 0 && rect.height > 0);
    if (!rects.length) {
      return null;
    }
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return {
      left: Math.max(8, left - padding),
      top: Math.max(8, top - padding),
      width: Math.min(window.innerWidth - 16, (right - left) + padding * 2),
      height: Math.min(window.innerHeight - 16, (bottom - top) + padding * 2),
      rotate
    };
  }

  function findShopEstimateNode() {
    const cards = Array.from(document.querySelectorAll(SHOP_CARD_SELECTOR));
    for (const card of cards) {
      const hoursSpan = Array.from(card.querySelectorAll("span"))
        .find((span) => /[>›]\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|m|h)\b/i.test(span.textContent || ""));
      if (hoursSpan instanceof HTMLElement && /Calculated with .* effective gold\/hour/i.test(String(hoursSpan.getAttribute("title") || ""))) {
        return hoursSpan;
      }
    }
    return null;
  }

  function findShopStarButton() {
    return Array.from(document.querySelectorAll(`${SHOP_CARD_SELECTOR} button[aria-label*='Star']`)).find((node) => node instanceof HTMLButtonElement) || null;
  }

  function findShopModalTrigger() {
    return document.querySelector(".donkey-area") || null;
  }

  function getShopModalElement() {
    const modal = getOpenModalElement();
    if (!(modal instanceof HTMLElement)) {
      return null;
    }
    const hasShopCards = Boolean(modal.querySelector(SHOP_CARD_SELECTOR));
    const hasProjectLinks = Boolean(modal.querySelector("a[href*='/projects/']"));
    if (hasShopCards && !hasProjectLinks) {
      return modal;
    }
    return null;
  }

  function isShopModalOpen() {
    return Boolean(getShopModalElement());
  }

  function openShopModalFromDashboard() {
    const trigger = findShopModalTrigger();
    if (trigger instanceof HTMLElement) {
      trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    }
    return false;
  }

  function closeShopModalToDashboard() {
    const modal = getShopModalElement();
    const buttonScope = modal || document;
    const backButton = Array.from(buttonScope.querySelectorAll("button")).find((button) =>
      /Back to farm/i.test(button.textContent || "")
    );
    if (backButton instanceof HTMLButtonElement) {
      backButton.click();
      return true;
    }
    return false;
  }

  function buildOnboardingSpotlightRects(step, target) {
    if (!step) {
      return [];
    }
    if (step.id === "labels") {
      const labels = Array.from(document.querySelectorAll(`#${PROJECT_LABEL_LAYER_ID} .mu-ground-label`)).slice(0, 3);
      const union = getOnboardingUnionRect(labels, 14, -2);
      return union ? [union] : [];
    }
    if (step.id === "streak") {
      const union = getOnboardingUnionRect([
        getDashboardStreakButton(),
        document.getElementById(STREAK_HOVER_CARD_ID)
      ], 10, 0);
      return union ? [union] : [];
    }
    if (step.id === "shop-goals") {
      const hud = findNativeWishlistRoot() || document.getElementById(GOALS_HUD_ID);
      const union = getOnboardingUnionRect([hud], 14, 0);
      return union ? [union] : [];
    }
    if (step.id === "shop-estimates") {
      const estimateNode = findShopEstimateNode();
      const cardRect = getOnboardingRectForElement(estimateNode?.closest(SHOP_CARD_SELECTOR), 14);
      if (cardRect) {
        return [cardRect];
      }
    }
    if (step.id === "shop-goal-modes") {
      const controlsRect = getOnboardingRectForElement(document.getElementById("macondo-utils-goals-native-view-mode") || document.querySelector(`#${GOALS_HUD_ID} .mu-goals-mini-controls-row`), 10);
      return controlsRect ? [controlsRect] : [];
    }
    if (step.id === "settings") {
      const panelRect = getOnboardingRectForElement(document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`), 10);
      return panelRect ? [panelRect] : [];
    }
    const targetRect = getOnboardingRectForElement(target, 12);
    return targetRect ? [targetRect] : [];
  }

  function renderOnboardingSpotlights(root, step, target) {
    const layer = root.querySelector(".mu-onboarding-spotlights");
    if (!(layer instanceof HTMLElement)) {
      return;
    }
    const rects = buildOnboardingSpotlightRects(step, target);
    root.classList.toggle("has-spotlight", rects.length > 0);
    layer.innerHTML = rects.map((rect) => `
      <div class="mu-onboarding-spotlight" style="left:${Math.round(rect.left)}px;top:${Math.round(rect.top)}px;width:${Math.round(rect.width)}px;height:${Math.round(rect.height)}px;transform:rotate(${rect.rotate || 0}deg);"></div>
    `).join("");
  }

  function forceOnboardingCardStyles(card) {
    card.style.setProperty("all", "initial", "important");
    card.style.setProperty("position", "fixed", "important");
    card.style.setProperty("z-index", "2147483647", "important");
    card.style.setProperty("background", "#fbeecd", "important");
    card.style.setProperty("border", "3px solid #6f4f2b", "important");
    card.style.setProperty("color", "#5a3e23", "important");
    card.style.setProperty("padding", "18px 18px 16px", "important");
    card.style.setProperty("width", "min(360px, calc(100vw - 32px))", "important");
    card.style.setProperty("box-shadow", "0 18px 36px rgba(44, 26, 10, 0.22)", "important");
    card.style.setProperty("font-family", "Trebuchet MS, Gill Sans, Arial, sans-serif", "important");
    card.style.setProperty("line-height", "1.4", "important");
    card.style.setProperty("box-sizing", "border-box", "important");
    card.style.setProperty("display", "block", "important");
    card.style.setProperty("visibility", "visible", "important");
    card.style.setProperty("opacity", "1", "important");
  }

  function maybePrimeOnboardingStep(step) {
    if (!step) {
      return;
    }
    if (step.id !== "streak") {
      hideStreakHoverCard(true);
    }
    if (step.id === "streak") {
      const button = getDashboardStreakButton();
      if (button instanceof HTMLElement) {
        getStreakHoverData().then((data) => {
          renderDashboardStreakProgress(data, button);
          const card = renderStreakHoverCard(data);
          card.hidden = false;
          positionStreakHoverCard(button, card);
          queueOnboardingRender();
        }).catch(() => {});
      }
    }
    if (step.id === "shop-star" && !onboardingAutoStarDone) {
      const goalsHud = findNativeWishlistRoot() || document.getElementById(GOALS_HUD_ID);
      const button = findShopStarButton();
      if (!goalsHud && button instanceof HTMLButtonElement && /(^|\s)Star\b/i.test(String(button.getAttribute("aria-label") || button.title || ""))) {
        onboardingAutoStarDone = true;
        button.click();
        queueOnboardingRender();
      }
    }
    if (step.id === "shop-estimates" || step.id === "shop-star" || step.id === "shop-goals" || step.id === "shop-goal-modes") {
      if (!isShopModalOpen()) {
        openShopModalFromDashboard();
      }
    }
    if (step.id === "settings") {
      if (isShopModalOpen()) {
        closeShopModalToDashboard();
      }
      ensureProjectLabelSettingsPanelOpen();
    } else {
      closeProjectLabelSettingsPanel();
    }
  }

  function removeOnboardingUi() {
    clearOnboardingTarget();
    const root = document.getElementById(ONBOARDING_ROOT_ID);
    if (root) {
      root.remove();
    }
  }

  function setOnboardingStep(step) {
    const state = readOnboardingState();
    writeOnboardingState({ ...state, step, completed: false, dismissed: false });
    queueOnboardingRender();
  }

  function completeOnboarding() {
    const state = readOnboardingState();
    writeOnboardingState({ ...state, completed: true, dismissed: false });
    closeProjectLabelSettingsPanel();
    removeOnboardingUi();
    recordOnboardingCompleted(state.version || "unknown");
  }

  function dismissOnboarding() {
    const state = readOnboardingState();
    writeOnboardingState({ ...state, dismissed: true });
    closeProjectLabelSettingsPanel();
    removeOnboardingUi();
  }

  function restartOnboarding() {
    writeOnboardingState({ step: 0, completed: false, dismissed: false });
    queueOnboardingRender();
  }

  function runOnboardingAction(action) {
    const { steps } = getOnboardingFlow();
    const state = readOnboardingState();
    const nextStep = Math.max(0, Math.min(steps.length - 1, state.step || 0));
    if (action === "skip") {
      dismissOnboarding();
      return;
    }
    if (action === "back") {
      setOnboardingStep(Math.max(0, nextStep - 1));
      return;
    }
    if (action === "next") {
      if (nextStep >= steps.length - 1) {
        completeOnboarding();
        return;
      }
      setOnboardingStep(nextStep + 1);
      return;
    }
    if (action === "goto-dashboard") {
      writeOnboardingState({ ...state, step: nextStep, completed: false, dismissed: false });
      window.location.assign("/dashboard");
      return;
    }
    if (action === "goto-shop") {
      writeOnboardingState({ ...state, step: nextStep, completed: false, dismissed: false });
      window.location.assign("/shop");
    }
    if (action === "enable") {
      handleTelemetryPrefChange("enabled", true);
      setOnboardingStep(nextStep + 1);
    }
  }

  function ensureOnboardingRoot() {
    let root = document.getElementById(ONBOARDING_ROOT_ID);
    if (root) {
      return root;
    }
    root = document.createElement("div");
    root.id = ONBOARDING_ROOT_ID;
    root.style.setProperty("position", "fixed", "important");
    root.style.setProperty("inset", "0", "important");
    root.style.setProperty("z-index", "2147483647", "important");
    root.style.setProperty("display", "block", "important");
    root.style.setProperty("visibility", "visible", "important");
    root.style.setProperty("opacity", "1", "important");
    root.style.setProperty("pointer-events", "auto", "important");
    root.addEventListener("pointerdown", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-onboarding-action]") : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      runOnboardingAction(String(target.getAttribute("data-onboarding-action") || ""));
    });
    root.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-onboarding-action]") : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const action = String(target.getAttribute("data-onboarding-action") || "");
      runOnboardingAction(action);
    });
    document.body.appendChild(root);
    return root;
  }

  function renderOnboarding() {
    const state = readOnboardingState();
    if (state.completed || state.dismissed) {
      removeOnboardingUi();
      return;
    }
    const { steps } = getOnboardingFlow();
    const stepIndex = Math.max(0, Math.min(steps.length - 1, state.step || 0));
    const step = steps[stepIndex];
    const root = ensureOnboardingRoot();
    maybePrimeOnboardingStep(step);
    const currentView = getCurrentMacondoView();
    const onCorrectView = currentView === step.view;
    const target = onCorrectView && typeof step.target === "function" ? step.target() : null;
    const needsNavigation = step.view === "shop" ? currentView !== "shop" : currentView !== "dashboard";
    const primaryAction = needsNavigation
      ? (step.view === "shop" ? "goto-shop" : "goto-dashboard")
      : "next";
    const primaryLabel = needsNavigation
      ? (step.view === "shop" ? "Open Shop" : "Open Dashboard")
      : (stepIndex >= steps.length - 1 ? "Finish" : "Next");
    const note = needsNavigation
      ? `This step lives on the ${step.view} page.`
      : step.allowUntargeted === true
        ? ""
        : target
          ? ""
          : "Waiting for this feature to appear...";
    root.innerHTML = `
      <div class="mu-onboarding-backdrop"></div>
      <div class="mu-onboarding-spotlights"></div>
      <div class="mu-onboarding-stage">
        <div class="mu-onboarding-card">
          <div class="mu-onboarding-eyebrow">Macondo Utils</div>
          <div class="mu-onboarding-progress">Step ${stepIndex + 1} of ${steps.length}</div>
          <h3 class="mu-onboarding-title">${escapeHtml(step.title)}</h3>
          <p class="mu-onboarding-body">${escapeHtml(step.body)}</p>
          ${note ? `<div class="mu-onboarding-note">${escapeHtml(note)}</div>` : ""}
          <div class="mu-onboarding-actions">
            <button type="button" class="mu-onboarding-btn ghost" data-onboarding-action="skip">Skip Tour</button>
            <div class="mu-onboarding-actions-right">
              ${stepIndex > 0 ? `<button type="button" class="mu-onboarding-btn ghost" data-onboarding-action="back">Back</button>` : ""}
              <button type="button" class="mu-onboarding-btn" data-onboarding-action="${primaryAction}">${escapeHtml(primaryLabel)}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const stage = root.querySelector(".mu-onboarding-stage");
    const card = root.querySelector(".mu-onboarding-card");
    if (!(stage instanceof HTMLElement) || !(card instanceof HTMLElement)) {
      clearOnboardingTarget();
      return;
    }
    forceOnboardingCardStyles(card);
    root.querySelectorAll("[data-onboarding-action]").forEach((node) => {
      if (!(node instanceof HTMLButtonElement)) {
        return;
      }
      node.onpointerdown = (event) => {
        event.preventDefault();
        event.stopPropagation();
        runOnboardingAction(String(node.getAttribute("data-onboarding-action") || ""));
      };
      node.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        runOnboardingAction(String(node.getAttribute("data-onboarding-action") || ""));
      };
    });
    if (target instanceof HTMLElement && !needsNavigation) {
      setOnboardingTarget(target);
      renderOnboardingSpotlights(root, step, target);
      stage.classList.add("floating");
      card.style.setProperty("position", "fixed", "important");
      const rect = target.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const gap = 16;
      let left = rect.right + gap;
      if (left + cardRect.width > window.innerWidth - 16) {
        left = rect.left - cardRect.width - gap;
      }
      if (left < 16) {
        left = Math.max(16, Math.min(window.innerWidth - cardRect.width - 16, rect.left));
      }
      let top = rect.top;
      if (top + cardRect.height > window.innerHeight - 16) {
        top = window.innerHeight - cardRect.height - 16;
      }
      if (top < 16) {
        top = 16;
      }
      card.style.setProperty("left", `${Math.round(left)}px`, "important");
      card.style.setProperty("top", `${Math.round(top)}px`, "important");
      card.style.setProperty("transform", "none", "important");
      if (typeof target.scrollIntoView === "function") {
        const isOutsideViewport = rect.top < 32 || rect.bottom > window.innerHeight - 32;
        if (isOutsideViewport) {
          target.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
        }
      }
      return;
    }
    clearOnboardingTarget();
    renderOnboardingSpotlights(root, step, target);
    stage.classList.remove("floating");
    card.style.setProperty("position", "fixed", "important");
    card.style.setProperty("left", "50%", "important");
    card.style.setProperty("top", "50%", "important");
    card.style.setProperty("transform", "translate(-50%, -50%)", "important");
    card.style.setProperty("display", "block", "important");
    card.style.setProperty("visibility", "visible", "important");
    card.style.setProperty("opacity", "1", "important");
  }

  function queueOnboardingRender() {
    if (onboardingQueued) {
      return;
    }
    onboardingQueued = true;
    requestAnimationFrame(() => {
      onboardingQueued = false;
      renderOnboarding();
    });
  }

  function getProjectedExtras() {
    const projectedCoins = Object.values(projectMetaById || {}).reduce((sum, meta) => {
      const coins = Number(meta?.futureCoins);
      return sum + (Number.isFinite(coins) && coins > 0 ? coins : 0);
    }, 0);
    const rate = effectiveGoldPerHour || 0;
    const projectedHours = rate > 0 ? projectedCoins / rate : 0;
    return {
      coins: Math.max(0, Math.round(projectedCoins)),
      hours: Math.max(0, projectedHours)
    };
  }

  function parseCurrentGoldFromHeader() {
    const moneyImages = Array.from(document.querySelectorAll("img[src*='money']"));
    for (const moneyImg of moneyImages) {
      const container = moneyImg.closest("div");
      const textNode = container
        ? Array.from(container.querySelectorAll("span")).find((span) => /\d/.test(span.textContent || ""))
        : null;
      const value = parseFloatSafe(textNode?.textContent || container?.textContent || "");
      if (Number.isFinite(value) && value >= 0) {
        return Math.round(value);
      }
    }
    return 0;
  }

  function findGoalsHudMount() {
    function isVisibleElement(node) {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return false;
      }
      return true;
    }

    function findCurrencyRow(root) {
      if (!(root instanceof Element)) {
        return null;
      }
      const rows = Array.from(root.querySelectorAll("div")).filter((node) => {
        if (root === document && node.closest(".modal-frame")) {
          return false;
        }
        const text = String(node.textContent || "").toLowerCase();
        return text.includes("your gold")
          && text.includes("your starfruit")
          && node.querySelector("img[src*='money']")
          && node.querySelector("img[src*='starfruit']");
      });
      const visibleRows = rows.filter((node) => isVisibleElement(node));
      if (!visibleRows.length) {
        return rows[0] || null;
      }
      visibleRows.sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const areaA = ar.width * ar.height;
        const areaB = br.width * br.height;
        return areaA - areaB;
      });
      return visibleRows[0] || null;
    }

    function findDashboardRateFooter(anchorRow) {
      const mount = anchorRow?.parentElement;
      if (!(mount instanceof HTMLElement)) {
        return null;
      }
      return Array.from(mount.children).find((node) => {
        if (!(node instanceof HTMLElement) || node === anchorRow) {
          return false;
        }
        const text = String(node.textContent || "").toLowerCase();
        return text.includes("on average you earn about") && text.includes("gold per hour");
      }) || null;
    }

    const currencyRow = findCurrencyRow(document);
    if (currencyRow && currencyRow.parentElement) {
      const panel = currencyRow.parentElement;
      return {
        mount: panel.parentElement || panel,
        afterNode: panel,
        mode: "currency-row"
      };
    }

    const topOverlays = Array.from(document.querySelectorAll("[class*='absolute'][class*='top-0'][class*='left-0'][class*='right-0']")).filter((node) => !node.closest(".modal-frame"));
    const topOverlay = topOverlays.find((node) => isVisibleElement(node)) || topOverlays[0] || null;
    const topRow = topOverlay?.querySelector("[class*='justify-between']");
    if (topOverlay) {
      return {
        mount: topOverlay,
        afterNode: topRow || null,
        mode: "top-overlay"
      };
    }

    return null;
  }

  function findNativeWishlistRoot() {
    const modal = getShopModalElement();
    if (!(modal instanceof HTMLElement)) {
      return null;
    }
    const candidates = Array.from(modal.querySelectorAll("div")).filter((node) => {
      if (!(node instanceof HTMLElement) || node.id === GOALS_HUD_ID || node.id === GOALS_NATIVE_EXTRA_ID) {
        return false;
      }
      const text = String(node.textContent || "").toLowerCase();
      const hasWishlistLabel = text.includes("your wishlist") || text.includes("starred");
      const hasSummary = text.includes("total cost") || text.includes("affordable now");
      const hasControls = Boolean(
        node.querySelector("button[aria-label*='Increase quantity']")
        || node.querySelector("button[aria-label*='Decrease quantity']")
        || node.querySelector("button[aria-label*='Remove from wishlist']")
      );
      const hasWishlistHeader = text.includes("your wishlist") || /\d+\s+starred/i.test(text);
      return hasWishlistLabel && (hasSummary || hasControls || hasWishlistHeader);
    });
    candidates.sort((a, b) => {
      const aText = String(a.textContent || "").toLowerCase();
      const bText = String(b.textContent || "").toLowerCase();
      const aHasSummary = aText.includes("total cost") || aText.includes("affordable now");
      const bHasSummary = bText.includes("total cost") || bText.includes("affordable now");
      if (aHasSummary !== bHasSummary) {
        return aHasSummary ? -1 : 1;
      }
      const aHasControls = Boolean(
        a.querySelector("button[aria-label*='Increase quantity']")
        || a.querySelector("button[aria-label*='Decrease quantity']")
        || a.querySelector("button[aria-label*='Remove from wishlist']")
      );
      const bHasControls = Boolean(
        b.querySelector("button[aria-label*='Increase quantity']")
        || b.querySelector("button[aria-label*='Decrease quantity']")
        || b.querySelector("button[aria-label*='Remove from wishlist']")
      );
      if (aHasControls !== bHasControls) {
        return aHasControls ? -1 : 1;
      }
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
    return candidates[0] || null;
  }

  function restoreNativeWishlistIfNeeded() {
    const extra = document.getElementById(GOALS_NATIVE_EXTRA_ID);
    if (extra) {
      extra.remove();
    }
    document.querySelectorAll("#macondo-utils-goals-native-view-mode").forEach((node) => node.remove());
    document.querySelectorAll("#macondo-utils-goals-native-stats").forEach((node) => node.remove());
    document.querySelectorAll("#macondo-utils-goals-native-mode-wrap").forEach((node) => {
      if (!(node instanceof HTMLElement)) {
        node.remove();
        return;
      }
      const progressModeGroup = Array.from(node.children).find((child) => {
        return child instanceof HTMLElement && child.id !== "macondo-utils-goals-native-view-mode";
      });
      const headerRow = node.parentElement;
      if (progressModeGroup instanceof HTMLElement && headerRow instanceof HTMLElement) {
        headerRow.appendChild(progressModeGroup);
      }
      node.remove();
    });
    const root = findNativeWishlistRoot();
    if (root instanceof HTMLElement) {
      root.removeAttribute("data-mu-goals-patched");
    }
  }

  function findNativeWishlistSummaryBox(root) {
    if (!(root instanceof HTMLElement)) {
      return null;
    }
    const candidates = Array.from(root.querySelectorAll("div")).filter((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const text = String(node.textContent || "").toLowerCase();
      return text.includes("total cost")
        && (text.includes("afford") || text.includes("wishlist"))
        && Boolean(node.querySelector("img[src*='money']"));
    });
    candidates.sort((a, b) => {
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
    return candidates[0] || null;
  }

  function getNativeWishlistCount(root, fallbackCount) {
    if (!(root instanceof HTMLElement)) {
      return fallbackCount;
    }
    const starredMatch = String(root.textContent || "").match(/(\d+)\s+starred/i);
    if (starredMatch?.[1]) {
      const starredCount = Number.parseInt(starredMatch[1], 10);
      if (Number.isFinite(starredCount) && starredCount >= 0) {
        return starredCount;
      }
    }
    const cards = Array.from(root.querySelectorAll("[draggable='true']")).filter((card) => {
      if (!(card instanceof HTMLElement) || card.closest("#macondo-utils-goals-native-stats")) {
        return false;
      }
      return Boolean(card.querySelector("img[src*='money']"));
    });
    return cards.length || fallbackCount;
  }

  function getNativeWishlistTotalCost(summaryBox, fallbackTotal) {
    if (!(summaryBox instanceof HTMLElement)) {
      return fallbackTotal;
    }
    const moneyNode = Array.from(summaryBox.querySelectorAll("span, div")).find((node) => {
      if (!(node instanceof HTMLElement) || node.closest("#macondo-utils-goals-native-stats")) {
        return false;
      }
      return Boolean(node.querySelector("img[src*='money']")) && /\d/.test(String(node.textContent || ""));
    });
    const parsedTotal = parseFloatSafe(moneyNode?.textContent || "");
    return Number.isFinite(parsedTotal) && parsedTotal >= 0 ? Math.round(parsedTotal) : fallbackTotal;
  }

  function findDashboardAverageRateRow() {
    return Array.from(document.querySelectorAll("div")).find((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const text = String(node.textContent || "").toLowerCase();
      return text.includes("on average you earn about") && text.includes("gold per hour of shipped work");
    }) || null;
  }

  function updateDashboardAverageRateRow() {
    if (!isDashboardPage()) {
      return;
    }
    if (!Number.isFinite(effectiveGoldPerHour) || effectiveGoldPerHour <= 0) {
      return;
    }
    const row = findDashboardAverageRateRow();
    if (!(row instanceof HTMLElement)) {
      return;
    }
    const textNode = Array.from(row.querySelectorAll("span")).find((span) => /on average you earn about/i.test(span.textContent || ""));
    if (!(textNode instanceof HTMLElement)) {
      return;
    }
    const nextText = `On average you earn about ${Math.round(effectiveGoldPerHour)} gold per hour of shipped work.`;
    if (textNode.textContent !== nextText) {
      withObserverSuppressed(() => {
        textNode.textContent = nextText;
      });
    }
  }

  function queueGoalsMiniRender() {
    if (goalsMiniQueued) {
      return;
    }
    goalsMiniQueued = true;
    requestAnimationFrame(() => {
      goalsMiniQueued = false;
      renderGoalsMiniBox();
    });
  }

  function scheduleGoalsMiniRetry(delay = 120) {
    if (goalsMiniRetryTimer) {
      clearTimeout(goalsMiniRetryTimer);
    }
    goalsMiniRetryTimer = window.setTimeout(() => {
      goalsMiniRetryTimer = null;
      queueGoalsMiniRender();
    }, delay);
  }

  function disconnectShopModalObserver() {
    if (shopModalObserver) {
      shopModalObserver.disconnect();
      shopModalObserver = null;
    }
    shopModalObservedRoot = null;
  }

  function refreshShopModalUi() {
    const modal = getShopModalElement();
    if (!(modal instanceof HTMLElement)) {
      disconnectShopModalObserver();
      restoreNativeWishlistIfNeeded();
      return;
    }
    syncGoalsFromShopDom(modal);
    updateShopCardHours(modal);
    collapseShopFilterChips(modal);
    renderGoalsMiniBox();
  }

  function runShopModalReadyProbe() {
    shopModalReadyProbeTimer = null;
    shopModalReadyProbeAttempts += 1;

    const modal = getShopModalElement();
    if (modal instanceof HTMLElement) {
      if (shopModalObservedRoot !== modal) {
        ensureShopModalObserver();
      }
      refreshShopModalUi();
      if (document.getElementById("macondo-utils-goals-native-view-mode")) {
        return;
      }
    }

    if (shopModalReadyProbeAttempts < 24) {
      shopModalReadyProbeTimer = window.setTimeout(runShopModalReadyProbe, 90);
    }
  }

  function startShopModalReadyProbe() {
    shopModalReadyProbeAttempts = 0;
    if (shopModalReadyProbeTimer) {
      clearTimeout(shopModalReadyProbeTimer);
    }
    shopModalReadyProbeTimer = window.setTimeout(runShopModalReadyProbe, 0);
  }

  function scheduleShopModalUiRefresh() {
    if (shopModalUiQueued) {
      return;
    }
    shopModalUiQueued = true;
    requestAnimationFrame(() => {
      shopModalUiQueued = false;
      refreshShopModalUi();
    });
  }

  function ensureShopModalObserver() {
    const modal = getShopModalElement();
    if (!(modal instanceof HTMLElement)) {
      disconnectShopModalObserver();
      return false;
    }
    if (shopModalObservedRoot === modal) {
      return true;
    }
    disconnectShopModalObserver();
    shopModalObservedRoot = modal;
    shopModalObserver = new MutationObserver((records) => {
      if (suppressedObserverMutations > 0 || areMutationsOnlyFromExtensionUi(records)) {
        return;
      }
      scheduleShopModalUiRefresh();
    });
    shopModalObserver.observe(modal, {
      attributes: true,
      attributeFilter: ["aria-label", "title", "class", "data-flip-id"],
      childList: true,
      subtree: true,
    });
    scheduleShopModalUiRefresh();
    return true;
  }

  function shouldRefreshGoalsFromMutations(records) {
    if (!projectGoals.length || !Array.isArray(records) || !records.length) {
      return false;
    }

    const isRelevantNode = (node) => {
      if (!(node instanceof Element)) {
        return false;
      }
      if (node.closest(`#${GOALS_HUD_ID}, #${GOALS_NATIVE_EXTRA_ID}`)) {
        return false;
      }
      if (nodeTouchesShopUi(node) || nodeTouchesDashboardChrome(node)) {
        return true;
      }
      const text = String(node.textContent || "").toLowerCase();
      return text.includes("your gold") || text.includes("your starfruit");
    };

    return records.some((record) => {
      const target = record.target instanceof Element ? record.target : null;
      if (target && target.closest(`#${GOALS_HUD_ID}, #${GOALS_NATIVE_EXTRA_ID}`)) {
        return false;
      }
      if (isRelevantNode(target)) {
        return true;
      }
      return Array.from(record.addedNodes || []).some((node) => isRelevantNode(node))
        || Array.from(record.removedNodes || []).some((node) => isRelevantNode(node));
    });
  }

  function isExtensionManagedNode(node) {
    if (!(node instanceof Element)) {
      return false;
    }
    return Boolean(node.closest(`#${PROJECT_LABEL_LAYER_ID}, #${PROJECT_LABEL_SETTINGS_ID}, #${ONBOARDING_ROOT_ID}, #${STREAK_HOVER_CARD_ID}, #${GOALS_HUD_ID}, #${GOALS_NATIVE_EXTRA_ID}, #macondo-utils-goals-native-mode-wrap, #macondo-utils-goals-native-view-mode, #macondo-utils-goals-native-stats`));
  }

  function areMutationsOnlyFromExtensionUi(records) {
    if (!Array.isArray(records) || !records.length) {
      return false;
    }
    return records.every((record) => {
      if (!isExtensionManagedNode(record.target)) {
        return false;
      }
      const addedOk = Array.from(record.addedNodes || []).every((node) => !(node instanceof Element) || isExtensionManagedNode(node));
      if (!addedOk) {
        return false;
      }
      return Array.from(record.removedNodes || []).every((node) => !(node instanceof Element) || isExtensionManagedNode(node));
    });
  }

  function areMutationsHandledByShopObserver(records) {
    if (!(shopModalObservedRoot instanceof HTMLElement) || !Array.isArray(records) || !records.length) {
      return false;
    }
    return records.every((record) => {
      const nodes = [];
      if (record.target instanceof Element) {
        nodes.push(record.target);
      }
      Array.from(record.addedNodes || []).forEach((node) => {
        if (node instanceof Element) {
          nodes.push(node);
        }
      });
      Array.from(record.removedNodes || []).forEach((node) => {
        if (node instanceof Element) {
          nodes.push(node);
        }
      });
      return nodes.length > 0 && nodes.every((node) => node === shopModalObservedRoot || shopModalObservedRoot.contains(node));
    });
  }

  function handleShopModalOpenIntent(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".donkey-area")) {
      startShopModalReadyProbe();
    }
  }

  function handleShopStarToggleClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const button = target.closest("button[aria-label*='Star'], button[aria-label*='Unstar']");
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }
    const candidate = getGoalCandidateFromCard(findShopCardRoot(button));
    if (!candidate) {
      return;
    }
    const label = String(button.getAttribute("aria-label") || button.title || "").toLowerCase();
    if (label.includes("unstar")) {
      removeGoalByItemOrName(candidate);
    } else if (label.includes("star")) {
      upsertGoal(candidate);
      scheduleShopModalUiRefresh();
    }
    recordShopInteractEvent(candidate);
  }

  function handleGoalsMiniActionClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const action = target.closest(`#${GOALS_HUD_ID} [data-goal-qty-adjust][data-goal-id], #${GOALS_HUD_ID} [data-goal-remove], #${GOALS_NATIVE_EXTRA_ID} [data-goal-qty-adjust][data-goal-id], #${GOALS_NATIVE_EXTRA_ID} [data-goal-remove]`);
    if (!(action instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    handleGoalActionElement(action);
  }

  function findShopCardRoot(node) {
    if (!(node instanceof Element)) {
      return null;
    }
    const card = node.closest(SHOP_CARD_SELECTOR);
    if (!(card instanceof HTMLElement)) {
      return null;
    }
    const heading = card.querySelector("h2, h3, h4");
    const starButton = card.querySelector("button[aria-label*='Star'], button[aria-label*='Unstar']");
    const priceNode = Array.from(card.querySelectorAll("span")).find((span) => span.querySelector("img[src*='money']"));
    const buyButton = card.querySelector("button[class*='ds-btn-primary'], button[class*='ds-btn-ghost']");
    if (!(heading instanceof HTMLElement) || !(starButton instanceof HTMLElement) || (!(priceNode instanceof HTMLElement) && !(buyButton instanceof HTMLElement))) {
      return null;
    }
    return card;
  }

  function getShopCardGoldAmount(card) {
    if (!(card instanceof Element)) {
      return 0;
    }
    const goldSpan = Array.from(card.querySelectorAll("span")).find((span) => span.querySelector("img[src*='money']"));
    const goldFromSpan = parseFloatSafe(goldSpan?.textContent || "") || 0;
    if (goldFromSpan > 0) {
      return Math.round(goldFromSpan);
    }
    const buyButton = card.querySelector("button[class*='ds-btn-primary'], button[class*='ds-btn-ghost']");
    const goldFromButton = parseFloatSafe(String(buyButton?.textContent || "")) || 0;
    return goldFromButton > 0 ? Math.round(goldFromButton) : 0;
  }

  function parseShopCard(card) {
    if (!(card instanceof Element)) {
      return null;
    }
    const title = String(card.querySelector("h2, h3, h4")?.textContent || "").trim();
    const unitGold = Math.max(0, getShopCardGoldAmount(card));
    const imageUrl = String(card.querySelector("img[alt]")?.getAttribute("src") || "");
    const itemIdMatch = String(card.getAttribute("data-flip-id") || "").match(/(\d+)/);
    const itemId = itemIdMatch?.[1] ? Number(itemIdMatch[1]) : null;
    const starButton = card.querySelector("button[aria-label*='Star'], button[aria-label*='Unstar']");
    const buyButton = card.querySelector("button[class*='ds-btn-primary'], button[class*='ds-btn-ghost']");
    if (!title || unitGold <= 0 || !(starButton instanceof HTMLElement) || !(buyButton instanceof HTMLElement)) {
      return null;
    }
    return {
      itemId,
      name: title,
      unitGold,
      quantity: 1,
      imageUrl,
      starButton,
      actionsHost: starButton.parentElement instanceof HTMLElement ? starButton.parentElement : card,
    };
  }

  function getShopItemsFromCards() {
    const items = [];
    const seen = new Set();
    const cards = Array.from(document.querySelectorAll(SHOP_CARD_SELECTOR));
    cards.forEach((card) => {
      const parsed = parseShopCard(findShopCardRoot(card));
      if (!parsed) {
        return;
      }
      const key = `${parsed.itemId || "x"}-${parsed.name}-${parsed.unitGold}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      items.push({
        id: parsed.itemId,
        name: parsed.name,
        unitGold: parsed.unitGold,
        imageUrl: parsed.imageUrl,
      });
    });
    return items;
  }

  function getGoalCandidateFromCard(card) {
    const parsed = parseShopCard(findShopCardRoot(card));
    return parsed ? {
      itemId: parsed.itemId,
      name: parsed.name,
      unitGold: parsed.unitGold,
      quantity: 1,
      imageUrl: parsed.imageUrl,
    } : null;
  }

  function getGoalForCandidate(candidate) {
    if (!candidate) {
      return null;
    }
    return projectGoals.find((goal) => goalMatchesCandidate(goal, candidate)) || null;
  }

  function goalMatchesCandidate(goal, candidate) {
    if (!goal || !candidate) {
      return false;
    }
    if (candidate.itemId && goal.itemId) {
      return candidate.itemId === goal.itemId;
    }
    return goal.name.toLowerCase() === String(candidate.name || "").trim().toLowerCase();
  }

  function getGoalIndexForCandidate(goals, candidate) {
    return (Array.isArray(goals) ? goals : []).findIndex((goal) => goalMatchesCandidate(goal, candidate));
  }

  function getNativeWishlistGoalCandidates(root) {
    if (!(root instanceof HTMLElement)) {
      return [];
    }
    return Array.from(root.querySelectorAll("[draggable='true']")).map((card) => {
      if (!(card instanceof HTMLElement) || !card.querySelector("button[aria-label*='Remove from wishlist']")) {
        return null;
      }
      const itemImg = Array.from(card.querySelectorAll("img[alt]")).find((img) => !String(img.getAttribute("src") || "").includes("/images/icons/money"));
      const name = String(itemImg?.getAttribute("alt") || "").trim();
      const unitGold = Math.max(0, getShopCardGoldAmount(card));
      const quantityGroup = card.querySelector("button[aria-label*='Increase quantity']")?.parentElement;
      const quantity = Math.max(1, Math.round(parseFloatSafe(quantityGroup?.textContent || "") || 1));
      if (!name || unitGold <= 0) {
        return null;
      }
      return {
        itemId: null,
        name,
        unitGold,
        quantity,
        imageUrl: String(itemImg?.getAttribute("src") || "")
      };
    }).filter(Boolean);
  }

  function syncGoalsFromShopDom(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    const nextGoals = projectGoals.slice();
    let changed = false;

    function applyCandidate(candidate, shouldExist, syncQuantity = false) {
      const normalized = normalizeGoal(candidate);
      if (!normalized) {
        return;
      }
      const index = getGoalIndexForCandidate(nextGoals, normalized);
      if (!shouldExist) {
        if (index >= 0) {
          nextGoals.splice(index, 1);
          changed = true;
        }
        return;
      }
      if (index < 0) {
        nextGoals.push(normalized);
        changed = true;
        return;
      }
      const current = nextGoals[index];
      const updated = {
        ...current,
        itemId: current.itemId || normalized.itemId,
        name: normalized.name || current.name,
        unitGold: normalized.unitGold,
        quantity: syncQuantity ? normalized.quantity : current.quantity,
        imageUrl: normalized.imageUrl || current.imageUrl
      };
      if (JSON.stringify(updated) !== JSON.stringify(current)) {
        nextGoals[index] = updated;
        changed = true;
      }
    }

    scope.querySelectorAll(SHOP_CARD_SELECTOR).forEach((card) => {
      const parsed = parseShopCard(findShopCardRoot(card));
      if (!parsed) {
        return;
      }
      const candidate = {
        itemId: parsed.itemId,
        name: parsed.name,
        unitGold: parsed.unitGold,
        quantity: 1,
        imageUrl: parsed.imageUrl
      };
      const label = String(parsed.starButton.getAttribute("aria-label") || parsed.starButton.title || "").toLowerCase();
      if (label.includes("unstar")) {
        applyCandidate(candidate, true, false);
      } else if (label.includes("star")) {
        applyCandidate(candidate, false, false);
      }
    });

    getNativeWishlistGoalCandidates(findNativeWishlistRoot()).forEach((candidate) => applyCandidate(candidate, true, true));

    if (!changed) {
      return false;
    }
    projectGoals = nextGoals;
    writeGoalsCache(projectGoals);
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel instanceof HTMLElement && !panel.hidden) {
      renderGoalSettingsPanel(panel);
    }
    queueGoalsMiniRender();
    return true;
  }

  function renderShopCardGoalControls(card) {
    const cardRoot = findShopCardRoot(card);
    if (!(cardRoot instanceof Element)) {
      return;
    }
    const parsed = parseShopCard(cardRoot);
    if (!parsed) {
      return;
    }
    const candidate = {
      itemId: parsed.itemId,
      name: parsed.name,
      unitGold: parsed.unitGold,
      quantity: 1,
      imageUrl: parsed.imageUrl,
    };

    const goal = getGoalForCandidate(candidate);
    const existingControls = cardRoot.querySelector(".mu-shop-goal-controls");
    if (!goal) {
      if (existingControls) {
        withObserverSuppressed(() => {
          existingControls.remove();
        });
      }
      return;
    }

    const qty = Math.max(1, Number(goal.quantity) || 1);
    const controlsHost = parsed.actionsHost;
    let controls = existingControls;
    if (!controls) {
      withObserverSuppressed(() => {
        controls = document.createElement("div");
        controls.className = "mu-shop-goal-controls";
        if (parsed.starButton.nextSibling) {
          parsed.starButton.parentElement?.insertBefore(controls, parsed.starButton.nextSibling);
        } else {
          controlsHost.appendChild(controls);
        }
      });
    }
    controls.classList.add("mu-shop-goal-controls-star");
    const nextMarkup = `
      <button type='button' class='mu-shop-goal-btn' data-goal-card-adjust='-1' data-goal-card-item='${candidate.itemId || ""}'>-</button>
      <span class='mu-shop-goal-qty'>x${qty}</span>
      <button type='button' class='mu-shop-goal-btn' data-goal-card-adjust='1' data-goal-card-item='${candidate.itemId || ""}'>+</button>
    `;
    if (controls.innerHTML !== nextMarkup) {
      withObserverSuppressed(() => {
        controls.innerHTML = nextMarkup;
      });
    }
    controls.dataset.goalCardItem = candidate.itemId ? String(candidate.itemId) : "";
    controls.dataset.goalCardName = candidate.name;
    controls.dataset.goalCardGold = String(candidate.unitGold);
    controls.dataset.goalCardImage = candidate.imageUrl || "";
  }

  function updateShopCardIncludesRate(card, computedHours) {
    if (!(card instanceof Element) || !Number.isFinite(computedHours) || computedHours <= 0) {
      return;
    }
    const includesNode = Array.from(card.querySelectorAll("span"))
      .find((span) => /includes\s*\$/i.test(span.textContent || ""));
    if (!(includesNode instanceof HTMLElement)) {
      return;
    }
    if (!includesNode.dataset.muIncludesBaseText) {
      includesNode.dataset.muIncludesBaseText = String(includesNode.textContent || "").trim();
    }
    const baseText = includesNode.dataset.muIncludesBaseText || String(includesNode.textContent || "").trim();
    const valueMatch = baseText.match(/includes\s*\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)/i);
    if (!valueMatch?.[1]) {
      return;
    }
    const includesValue = Number.parseFloat(valueMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(includesValue) || includesValue <= 0) {
      return;
    }
    const usdPerHour = includesValue / computedHours;
    if (!Number.isFinite(usdPerHour) || usdPerHour <= 0) {
      return;
    }
    const nextText = `${baseText} • $${usdPerHour.toFixed(2)}/hr`;
    const nextTitle = `Includes value divided by time needed (${formatHours(computedHours)})`;
    if (includesNode.textContent !== nextText || includesNode.title !== nextTitle) {
      withObserverSuppressed(() => {
        includesNode.textContent = nextText;
        includesNode.title = nextTitle;
      });
    }
  }

  function findShopCardEtaSpan(card) {
    if (!(card instanceof Element)) {
      return null;
    }
    return Array.from(card.querySelectorAll("span")).find((span) => {
      if (!(span instanceof HTMLElement) || !span.querySelector("svg")) {
        return false;
      }
      const text = String(span.textContent || "").toLowerCase();
      return text.includes("afford")
        || /(?:^|\s)[>~]?\s*\d+(?:\.\d+)?\s*(?:hours?|hrs?|minutes?|mins?|m|h)\b/i.test(text);
    }) || null;
  }

  function findShopCardMetaRow(card) {
    if (!(card instanceof Element)) {
      return null;
    }
    const priceSpan = Array.from(card.querySelectorAll("span")).find((span) => span.querySelector("img[src*='money']"));
    return priceSpan?.closest("div") instanceof HTMLElement ? priceSpan.closest("div") : null;
  }

  function upsertShopCardEtaSpan(card, text, title) {
    if (!(card instanceof Element)) {
      return null;
    }
    let hoursSpan = findShopCardEtaSpan(card);
    const nextHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg> ${escapeHtml(text)}`;
    if (!(hoursSpan instanceof HTMLElement)) {
      const metaRow = findShopCardMetaRow(card);
      const priceSpan = Array.from(metaRow?.children || []).find((node) => node instanceof HTMLElement && node.querySelector("img[src*='money']"));
      if (!(metaRow instanceof HTMLElement)) {
        return null;
      }
      withObserverSuppressed(() => {
        hoursSpan = document.createElement("span");
        hoursSpan.className = "flex items-center gap-1 font-bold text-ds-brown/70";
        hoursSpan.innerHTML = nextHtml;
        hoursSpan.title = title;
        if (priceSpan instanceof HTMLElement) {
          metaRow.insertBefore(hoursSpan, priceSpan);
        } else {
          metaRow.appendChild(hoursSpan);
        }
      });
      return hoursSpan;
    }
    if (hoursSpan.innerHTML !== nextHtml || hoursSpan.title !== title || hoursSpan.className !== "flex items-center gap-1 font-bold text-ds-brown/70") {
      withObserverSuppressed(() => {
        hoursSpan.className = "flex items-center gap-1 font-bold text-ds-brown/70";
        hoursSpan.innerHTML = nextHtml;
        hoursSpan.title = title;
      });
    }
    return hoursSpan;
  }

  function syncAllShopCardGoalControls(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll(SHOP_CARD_SELECTOR).forEach((card) => renderShopCardGoalControls(card));
  }

  function handleShopCardGoalActionClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
      return;
    }
    const action = target.closest("[data-goal-card-adjust][data-goal-card-item]");
    if (!(action instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const cardItemId = Number(action.getAttribute("data-goal-card-item") || "0");
    const controls = action.closest(".mu-shop-goal-controls");
    const candidate = {
      itemId: Number.isFinite(cardItemId) && cardItemId > 0 ? cardItemId : null,
      name: String(controls?.getAttribute("data-goal-card-name") || ""),
      unitGold: Number(controls?.getAttribute("data-goal-card-gold") || "0"),
      quantity: 1,
      imageUrl: String(controls?.getAttribute("data-goal-card-image") || "")
    };
    const goal = getGoalForCandidate(candidate);
    const delta = Number(action.getAttribute("data-goal-card-adjust") || "0");
    if (delta > 0) {
      if (goal) {
        adjustGoalQuantity(goal.id, 1);
      } else {
        upsertGoal(candidate);
      }
      return;
    }
    if (!goal) {
      return;
    }
    if ((Number(goal.quantity) || 1) <= 1) {
      removeGoalById(goal.id);
      return;
    }
    adjustGoalQuantity(goal.id, -1);
  }

  function upsertGoal(goalInput) {
    const normalized = normalizeGoal(goalInput);
    if (!normalized) {
      return;
    }
    const existingIndex = projectGoals.findIndex((goal) => {
      if (normalized.itemId && goal.itemId) {
        return goal.itemId === normalized.itemId;
      }
      return goal.name.toLowerCase() === normalized.name.toLowerCase();
    });
    let wasAdded = false;
    if (existingIndex >= 0) {
      projectGoals[existingIndex] = {
        ...projectGoals[existingIndex],
        unitGold: normalized.unitGold,
        imageUrl: normalized.imageUrl || projectGoals[existingIndex].imageUrl
      };
    } else {
      projectGoals.push(normalized);
      wasAdded = true;
    }
    writeGoalsCache(projectGoals);
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel instanceof HTMLElement && !panel.hidden) {
      renderGoalSettingsPanel(panel);
    }
    syncAllShopCardGoalControls(getShopModalElement() || document);
    scheduleShopModalUiRefresh();
    queueGoalsMiniRender();
    if (wasAdded) {
      recordGoalEvent("goal_added", normalized);
    }
  }

  function removeGoalByItemOrName(goalInput) {
    const itemId = Number(goalInput?.itemId);
    const name = String(goalInput?.name || "").trim().toLowerCase();
    const removed = projectGoals.find((goal) => {
      if (Number.isFinite(itemId) && itemId > 0 && goal.itemId) {
        return goal.itemId === itemId;
      }
      if (name) {
        return goal.name.toLowerCase() === name;
      }
      return false;
    });
    const next = projectGoals.filter((goal) => {
      if (Number.isFinite(itemId) && itemId > 0 && goal.itemId) {
        return goal.itemId !== itemId;
      }
      if (name) {
        return goal.name.toLowerCase() !== name;
      }
      return true;
    });
    if (next.length === projectGoals.length) {
      return;
    }
    projectGoals = next;
    writeGoalsCache(projectGoals);
    const panel = document.querySelector(`#${PROJECT_LABEL_SETTINGS_ID} .mu-label-settings-panel`);
    if (panel instanceof HTMLElement && !panel.hidden) {
      renderGoalSettingsPanel(panel);
    }
    syncAllShopCardGoalControls(getShopModalElement() || document);
    scheduleShopModalUiRefresh();
    queueGoalsMiniRender();
    recordGoalEvent("goal_removed", removed);
  }

  function pruneCompletedGoalsByOrders() {
    // Historical orders do not map cleanly to current goal intent or quantity.
    // Avoid destructive auto-pruning until purchase reconciliation is quantity-aware.
    return false;
  }

  async function refreshGoalOrderStatus() {
    if (goalOrderSyncInFlight) {
      return;
    } 
    if (!projectGoals.some((goal) => goal.itemId)) {
      return;
    }
    const now = Date.now();
    if (now - lastGoalOrderSyncAt < PROJECT_GOALS_ORDER_SYNC_MS) {
      return;
    }
    goalOrderSyncInFlight = true;
    try {
      const response = await fetch("/api/shop/my-orders", { credentials: "include" });
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const itemIds = Array.isArray(payload)
        ? payload
          .map((entry) => Number(entry?.order?.item_id || entry?.item?.id))
          .filter((id) => Number.isFinite(id) && id > 0)
        : [];
      goalOrderedItemIds = new Set(itemIds);
      lastGoalOrderSyncAt = Date.now();
      writeGoalOrderSyncCache(itemIds);
      if (pruneCompletedGoalsByOrders()) {
        ensureProjectLabelSettingsButton();
      }
      renderGoalsMiniBox();
    } catch (_err) {
      return;
    } finally {
      goalOrderSyncInFlight = false;
    }
  }

  function bindGoalsBoxInteractions(box) {
    if (!(box instanceof HTMLElement)) {
      return;
    }

    box.onclick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) {
        return;
      }
      const action = target.closest("[data-goal-qty-adjust][data-goal-id], [data-goal-remove]");
      if (!(action instanceof HTMLElement)) {
        const modeToggle = target.closest("[data-goals-mode]");
        if (modeToggle instanceof HTMLElement) {
          event.preventDefault();
          event.stopPropagation();
          handleGoalsModeToggle(modeToggle);
          return;
        }
        const progressModeToggle = target.closest("[data-goal-progress-mode]");
        if (progressModeToggle instanceof HTMLElement) {
          event.preventDefault();
          event.stopPropagation();
          handleGoalsProgressModeToggle(progressModeToggle);
        }
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleGoalActionElement(action);
    };

    const hasList = box.querySelector(".mu-goals-mini-list") instanceof HTMLElement;
    if (!hasList) {
      box.ondragstart = null;
      box.ondragover = null;
      box.ondrop = null;
      box.ondragend = null;
      return;
    }

    box.ondragstart = (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-goal-drag-id]") : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      draggedGoalId = String(target.getAttribute("data-goal-drag-id") || "");
      if (!draggedGoalId) {
        return;
      }
      draggedGoalPreviewNode = target;
      target.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedGoalId);
      }
    };

    box.ondragover = (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-goal-drag-id], .mu-goals-mini-list") : null;
      if (!(target instanceof HTMLElement) || !draggedGoalId) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      const list = box.querySelector(".mu-goals-mini-list");
      if (list instanceof HTMLElement) {
        previewDraggedGoalPlacement(list, target, event.clientY);
      }
    };

    box.ondrop = (event) => {
      const dragId = event.dataTransfer?.getData("text/plain") || draggedGoalId;
      const list = box.querySelector(".mu-goals-mini-list");
      if (!(list instanceof HTMLElement) || !dragId) {
        return;
      }
      event.preventDefault();
      persistGoalOrderFromContainer(list);
      draggedGoalId = "";
      draggedGoalPreviewNode = null;
    };

    box.ondragend = () => {
      draggedGoalId = "";
      draggedGoalPreviewNode = null;
      clearDraggedGoalClasses(box);
    };
  }

  function bindInjectedGoalsViewModeButtons(root) {
    if (!(root instanceof HTMLElement)) {
      return;
    }
    root.querySelectorAll("[data-goals-mode]").forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      button.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        handleGoalsModeToggle(button);
      };
    });
  }

  function getInjectedGoalsViewModeClass(mode) {
    const isActive = goalsViewMode === mode;
    return `px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${isActive ? "bg-ds-brown text-ds-cream" : "text-ds-brown/70 hover:bg-ds-brown/10"}`;
  }

  function updateInjectedGoalsViewModeState(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    scope.querySelectorAll("#macondo-utils-goals-native-view-mode [data-goals-mode]").forEach((button) => {
      if (!(button instanceof HTMLElement)) {
        return;
      }
      const mode = String(button.getAttribute("data-goals-mode") || "").toLowerCase();
      if (mode === "actual" || mode === "projected") {
        button.className = getInjectedGoalsViewModeClass(mode);
      }
    });
  }

  function handleInjectedGoalsViewModeClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("#macondo-utils-goals-native-view-mode [data-goals-mode]");
    if (!(button instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    handleGoalsModeToggle(button);
  }

  function renderGoalsMiniBox() {
    const shopModalOpen = isShopModalOpen();
    const nativeWishlistRoot = shopModalOpen ? findNativeWishlistRoot() : null;
    const existingHud = document.getElementById(GOALS_HUD_ID);
    const existingNativeExtra = document.getElementById(GOALS_NATIVE_EXTRA_ID);
    const nativeWishlistItemCount = nativeWishlistRoot instanceof HTMLElement ? getNativeWishlistCount(nativeWishlistRoot, 0) : 0;
    const shouldShowGoalsUi = projectLabelPrefs.showGoalsHud !== false && (projectGoals.length > 0 || (shopModalOpen && nativeWishlistItemCount > 0));

    if (shopModalOpen && !nativeWishlistRoot) {
      scheduleGoalsMiniRetry();
    }

    if (!isDashboardPage() && !nativeWishlistRoot) {
      if (existingHud) {
        existingHud.remove();
      }
      if (existingNativeExtra) {
        existingNativeExtra.remove();
      }
      lastGoalsMiniSignature = "";
      return;
    }

    if (!shouldShowGoalsUi) {
      if (existingHud) {
        existingHud.remove();
      }
      restoreNativeWishlistIfNeeded();
      lastGoalsMiniSignature = "";
      return;
    }

    const currentGold = parseCurrentGoldFromHeader();
    const projected = getProjectedExtras();
    const projectedCoins = goalsViewMode === "projected" ? projected.coins : 0;
    const displayGold = currentGold + projectedCoins;
    const rate = effectiveGoldPerHour || 0;
    const sorted = projectGoals.slice();
    const totalTargetGold = sorted.reduce((sum, goal) => sum + (goal.unitGold * goal.quantity), 0);
    const totalProgressGold = Math.max(0, displayGold);
    const totalRemainingGold = Math.max(0, totalTargetGold - totalProgressGold);
    const boundedProgressGold = Math.max(0, Math.min(totalProgressGold, totalTargetGold));
    const totalProgressPct = totalTargetGold > 0
      ? Math.max(0, Math.min(100, Math.round((boundedProgressGold / totalTargetGold) * 100)))
      : 0;
    const boundedActualGold = Math.max(0, Math.min(currentGold, totalTargetGold));
    const actualProgressPct = totalTargetGold > 0
      ? Math.max(0, Math.min(100, Math.round((boundedActualGold / totalTargetGold) * 100)))
      : 0;
    const projectedSegmentPct = Math.max(0, totalProgressPct - actualProgressPct);
    const totalEta = formatEtaHours(rate > 0 ? totalRemainingGold / rate : 0);
    const moneyIcon = `<img src="/images/icons/money.webp" class="w-3.5 h-3.5 object-contain" alt="">`;
    const clockIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3 shrink-0" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>`;
    const starIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 fill-ds-brown text-ds-brown shrink-0" aria-hidden="true"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path></svg>`;
    const gripIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5 shrink-0 text-ds-brown/35 cursor-grab active:cursor-grabbing" title="Drag to reorder"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;
    const closeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>`;
    const plusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>`;
    const minusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3 h-3" aria-hidden="true"><path d="M5 12h14"></path></svg>`;

    let cumulativeTargetGold = 0;
    const rows = sorted.slice(0, 6).map((goal) => {
      const targetGold = goal.unitGold * goal.quantity;
      const cumulativeBeforeGold = cumulativeTargetGold;
      cumulativeTargetGold += targetGold;
      const availableForThisGold = Math.max(0, displayGold - cumulativeBeforeGold);
      const cumulativeRemainingGold = Math.max(0, cumulativeTargetGold - displayGold);
      const cumulativeProgressGold = Math.max(0, Math.min(targetGold, availableForThisGold));
      const individualProgressGold = Math.max(0, Math.min(targetGold, displayGold));
      const progressGold = goalsProgressMode === "cumulative" ? cumulativeProgressGold : individualProgressGold;
      const rowRemainingGold = Math.max(0, targetGold - progressGold);
      const pct = targetGold > 0 ? Math.max(0, Math.min(100, Math.round((progressGold / targetGold) * 100))) : 0;
      const etaRemainingGold = goalsProgressMode === "cumulative" ? cumulativeRemainingGold : rowRemainingGold;
      const hours = formatEtaHours(rate > 0 ? etaRemainingGold / rate : 0);
      const thumb = goal.imageUrl
        ? `<img src='${escapeHtml(goal.imageUrl)}' alt='${escapeHtml(goal.name)}' class='w-full h-full object-contain p-1' draggable='false'>`
        : "";
      return `
        <div class='mu-goals-card flex flex-col gap-2 border-[2px] border-ds-brown/20 bg-white/45 p-2.5 transition-opacity' draggable='true' data-goal-drag-id='${escapeHtml(goal.id)}'>
          <div class='flex items-start gap-2'>
            ${gripIcon}
            <div class='w-10 h-10 shrink-0 bg-[#ecd2ae] flex items-center justify-center overflow-hidden'>${thumb}</div>
            <div class='flex-1 min-w-0'>
              <div class='flex items-start justify-between gap-1'>
                <span class='mu-goals-card-name font-bold text-ds-brown text-sm leading-tight' style='display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%;'>${escapeHtml(goal.name)}</span>
                <button type='button' class='-mt-0.5 -mr-0.5 shrink-0 p-0.5 text-ds-brown/50 hover:text-ds-danger transition-colors' data-goal-remove='${escapeHtml(goal.id)}' aria-label='Remove from wishlist'>${closeIcon}</button>
              </div>
              <span class='mt-0.5 flex items-center gap-1 text-xs font-bold text-ds-brown'>${moneyIcon} ${formatCompactGold(targetGold)}</span>
            </div>
          </div>
          <div class='h-2 bg-ds-brown/15 overflow-hidden'><div class='h-full transition-[width] duration-500 bg-ds-brown' style='width:${pct}%;'></div></div>
          <div class='flex items-center justify-between gap-2'>
            <span class='flex items-center gap-1 min-w-0 truncate text-[11px] font-bold text-ds-brown/60'>${clockIcon} ${hours} in order</span>
            <div class='flex items-center gap-1 shrink-0'>
              <button type='button' class='p-1 border-[2px] border-ds-brown/25 text-ds-brown hover:bg-ds-brown/10 disabled:opacity-40' data-goal-qty-adjust='-1' data-goal-id='${escapeHtml(goal.id)}' ${goal.quantity <= 1 ? "disabled" : ""} aria-label='Decrease quantity'>${minusIcon}</button>
              <span class='min-w-[1.5rem] text-center text-xs font-bold text-ds-brown'>${goal.quantity}</span>
              <button type='button' class='p-1 border-[2px] border-ds-brown/25 text-ds-brown hover:bg-ds-brown/10' data-goal-qty-adjust='1' data-goal-id='${escapeHtml(goal.id)}' aria-label='Increase quantity'>${plusIcon}</button>
            </div>
          </div>
        </div>
      `;
    }).join("");
    const dashboardMarkup = `
        <div class='mu-goals-mini-title-row flex items-center justify-between gap-3 flex-wrap'>
          <div class='flex items-center gap-2'>
            ${starIcon}
            <span class='text-lg font-bold text-ds-brown'>Your wishlist</span>
            <span class='text-xs font-bold text-ds-brown/55 uppercase tracking-wide'>${sorted.length} starred</span>
          </div>
          <div class='text-lg font-bold text-ds-brown'>${totalProgressPct}%</div>
        </div>
        <div class='mu-goals-mini-controls-row mt-3 flex items-center justify-between gap-3 flex-wrap'>
          <div class='flex items-center border-[2px] border-ds-brown/30'>
            <button type='button' class='px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${goalsViewMode === "actual" ? "bg-ds-brown text-ds-cream" : "text-ds-brown/70 hover:bg-ds-brown/10"}' data-goals-mode='actual'>Actual</button>
            <button type='button' class='px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${goalsViewMode === "projected" ? "bg-ds-brown text-ds-cream" : "text-ds-brown/70 hover:bg-ds-brown/10"}' data-goals-mode='projected'>Projected</button>
          </div>
          <div class='flex items-center border-[2px] border-ds-brown/30'>
            <button type='button' class='px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${goalsProgressMode === "cumulative" ? "bg-ds-brown text-ds-cream" : "text-ds-brown/70 hover:bg-ds-brown/10"}' data-goal-progress-mode='cumulative'>All together</button>
            <button type='button' class='px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${goalsProgressMode === "individual" ? "bg-ds-brown text-ds-cream" : "text-ds-brown/70 hover:bg-ds-brown/10"}' data-goal-progress-mode='individual'>Per item</button>
          </div>
        </div>
        <div class='mt-4'>
          <div class='mu-goals-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mu-goals-mini-list' data-goals-list>
            ${rows}
          </div>
          <div class='mt-3 border-[2px] border-ds-brown/25 bg-ds-brown/5 p-3 flex flex-col gap-2'>
            <div class='flex items-center justify-between text-sm font-bold text-ds-brown'>
              <span>Total cost</span>
              <span class='flex items-center gap-1'>${moneyIcon} ${formatCompactGold(totalTargetGold)}</span>
            </div>
            <div class='overflow-hidden' style='position:relative; height:10px; background:rgba(111, 79, 43, 0.14); border:1px solid rgba(111, 79, 43, 0.16);'>
              <div class='transition-[width] duration-500' style='height:100%; width:${actualProgressPct}%; background:rgba(111, 79, 43, 0.42);'></div>
              <div class='transition-[width,left] duration-500' style='position:absolute; top:0; bottom:0; left:${actualProgressPct}%; width:${projectedSegmentPct}%; background:${goalsViewMode === "projected" ? "rgb(111, 79, 43)" : "transparent"};'></div>
            </div>
            <div class='grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-bold text-ds-brown/65'>
              ${projectLabelPrefs.showHudGoalsStat !== false ? `<div>Goals: ${sorted.length}</div>` : ""}
              ${projectLabelPrefs.showHudProgressStat !== false ? `<div>Progress: ${formatCompactGold(totalProgressGold)}/${formatCompactGold(totalTargetGold)}</div>` : ""}
              ${projectLabelPrefs.showHudRemainingStat !== false ? `<div>Remaining: ${formatCompactGold(totalRemainingGold)}</div>` : ""}
              ${projectLabelPrefs.showHudEtaStat !== false ? `<div>ETA: ${totalEta}</div>` : ""}
            </div>
          </div>
        </div>
    `;
    const dashboardSignature = JSON.stringify({
      mode: "dashboard",
      goalsViewMode,
      goalsProgressMode,
      goals: sorted.map((goal) => ({
        id: goal.id,
        quantity: goal.quantity,
        unitGold: goal.unitGold,
        imageUrl: goal.imageUrl,
        name: goal.name
      })),
      currentGold,
      totalProgressPct,
      actualProgressPct,
      projectedSegmentPct,
      totalTargetGold,
      totalRemainingGold,
      totalEta,
      rows
    });

    if (isDashboardPage()) {
      const mountInfo = findGoalsHudMount();
      if (mountInfo?.mount) {
        const { mount, afterNode, mode } = mountInfo;
        let hudBox = existingHud;
        if (!(hudBox instanceof HTMLElement)) {
          withObserverSuppressed(() => {
            hudBox = document.createElement("div");
            hudBox.id = GOALS_HUD_ID;
            hudBox.className = "mu-goals-native-shell";
            if (afterNode && afterNode.parentElement === mount) {
              afterNode.insertAdjacentElement("afterend", hudBox);
            } else {
              mount.appendChild(hudBox);
            }
          });
        } else if (afterNode && hudBox.previousElementSibling !== afterNode) {
          withObserverSuppressed(() => {
            afterNode.insertAdjacentElement("afterend", hudBox);
          });
        } else if (hudBox.parentElement !== mount) {
          withObserverSuppressed(() => {
            mount.appendChild(hudBox);
          });
        }
        if (hudBox instanceof HTMLElement) {
          if (hudBox.getAttribute("data-mode") !== mode) {
            withObserverSuppressed(() => {
              hudBox.setAttribute("data-mode", mode);
            });
          }
          const hudSize = normalizeHudSize(projectLabelPrefs.hudSize);
          if (hudBox.getAttribute("data-hud-size") !== hudSize) {
            withObserverSuppressed(() => {
              hudBox.setAttribute("data-hud-size", hudSize);
            });
          }
          if (hudBox.className !== "mu-goals-native-shell") {
            withObserverSuppressed(() => {
              hudBox.className = "mu-goals-native-shell";
            });
          }
          if (lastGoalsMiniSignature !== dashboardSignature || hudBox.innerHTML !== dashboardMarkup) {
            withObserverSuppressed(() => {
              hudBox.innerHTML = dashboardMarkup;
            });
            lastGoalsMiniSignature = dashboardSignature;
          }
          bindGoalsBoxInteractions(hudBox);
        }
      }
    } else if (existingHud) {
      existingHud.remove();
      lastGoalsMiniSignature = "";
    }

    if (existingNativeExtra) {
      existingNativeExtra.remove();
    }
    if (!(nativeWishlistRoot instanceof HTMLElement)) {
      return;
    }

    const progressModeGroup = Array.from(nativeWishlistRoot.querySelectorAll("div")).find((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const directButtons = Array.from(node.children).filter((child) => child instanceof HTMLButtonElement);
      if (directButtons.length !== 2) {
        return false;
      }
      const text = directButtons.map((button) => String(button.textContent || "").trim().toLowerCase());
      return text.includes("all together") && text.includes("per item");
    }) || null;
    const controlsRow = progressModeGroup?.parentElement instanceof HTMLElement ? progressModeGroup.parentElement : null;
    const summaryBox = findNativeWishlistSummaryBox(nativeWishlistRoot);
    let nativePartsMissing = false;
    if (controlsRow instanceof HTMLElement) {
      let modeWrap = nativeWishlistRoot.querySelector("#macondo-utils-goals-native-mode-wrap");
      let viewModeGroup = nativeWishlistRoot.querySelector("#macondo-utils-goals-native-view-mode");
      const nextControlsMarkup = `
        <button type='button' class='${getInjectedGoalsViewModeClass("actual")}' data-goals-mode='actual'>Actual</button>
        <button type='button' class='${getInjectedGoalsViewModeClass("projected")}' data-goals-mode='projected'>Projected</button>
      `;
      if (!(modeWrap instanceof HTMLElement)) {
        withObserverSuppressed(() => {
          modeWrap = document.createElement("div");
          modeWrap.id = "macondo-utils-goals-native-mode-wrap";
          modeWrap.className = "ml-auto flex items-center gap-2 flex-wrap";
          if (progressModeGroup instanceof HTMLElement) {
            controlsRow.appendChild(modeWrap);
            modeWrap.appendChild(progressModeGroup);
          } else {
            controlsRow.appendChild(modeWrap);
          }
        });
      } else if (progressModeGroup instanceof HTMLElement && progressModeGroup.parentElement !== modeWrap) {
        withObserverSuppressed(() => {
          modeWrap.appendChild(progressModeGroup);
        });
      }
      if (!(viewModeGroup instanceof HTMLElement)) {
        withObserverSuppressed(() => {
          viewModeGroup = document.createElement("div");
          viewModeGroup.id = "macondo-utils-goals-native-view-mode";
          viewModeGroup.className = "flex items-center border-[2px] border-ds-brown/30";
          if (modeWrap instanceof HTMLElement) {
            modeWrap.insertBefore(viewModeGroup, modeWrap.firstChild || null);
          }
        });
      } else if (modeWrap instanceof HTMLElement && viewModeGroup.parentElement !== modeWrap) {
        withObserverSuppressed(() => {
          modeWrap.insertBefore(viewModeGroup, modeWrap.firstChild || null);
        });
      }
      if (viewModeGroup instanceof HTMLElement && viewModeGroup.innerHTML !== nextControlsMarkup) {
        withObserverSuppressed(() => {
          viewModeGroup.innerHTML = nextControlsMarkup;
        });
      }
      bindInjectedGoalsViewModeButtons(viewModeGroup);
      updateInjectedGoalsViewModeState(viewModeGroup);
    } else {
      nativePartsMissing = true;
    }

    if (summaryBox instanceof HTMLElement) {
      let statsBox = nativeWishlistRoot.querySelector("#macondo-utils-goals-native-stats");
      const nativeGoalCount = getNativeWishlistCount(nativeWishlistRoot, sorted.length);
      const nativeTargetGold = getNativeWishlistTotalCost(summaryBox, totalTargetGold);
      const nativeProgressGold = Math.max(0, displayGold);
      const nativeRemainingGold = Math.max(0, nativeTargetGold - nativeProgressGold);
      const nativeEta = formatEtaHours(rate > 0 ? nativeRemainingGold / rate : 0);
      const statsMarkup = `
        <div class='grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-bold text-ds-brown/65'>
          ${projectLabelPrefs.showHudGoalsStat !== false ? `<div>Goals: ${nativeGoalCount}</div>` : ""}
          ${projectLabelPrefs.showHudProgressStat !== false ? `<div>Progress: ${formatCompactGold(nativeProgressGold)}/${formatCompactGold(nativeTargetGold)}</div>` : ""}
          ${projectLabelPrefs.showHudRemainingStat !== false ? `<div>Remaining: ${formatCompactGold(nativeRemainingGold)}</div>` : ""}
          ${projectLabelPrefs.showHudEtaStat !== false ? `<div>ETA: ${nativeEta}</div>` : ""}
        </div>
      `;
      if (!(statsBox instanceof HTMLElement)) {
        withObserverSuppressed(() => {
          statsBox = document.createElement("div");
          statsBox.id = "macondo-utils-goals-native-stats";
          statsBox.className = "mt-3";
          summaryBox.appendChild(statsBox);
        });
      }
      if (statsBox instanceof HTMLElement && statsBox.innerHTML !== statsMarkup) {
        withObserverSuppressed(() => {
          statsBox.innerHTML = statsMarkup;
        });
      }
    } else {
      nativePartsMissing = true;
    }

    nativeWishlistRoot.setAttribute("data-mu-goals-patched", "true");
    bindGoalsBoxInteractions(nativeWishlistRoot);
    if (nativePartsMissing) {
      scheduleGoalsMiniRetry(180);
    }
  }

  function updateShopCardHours(root = document) {
    const goldPerHour = effectiveGoldPerHour || getCurrentGoldPerHourFromModal();
    const scope = root instanceof Element || root instanceof Document ? root : document;
    const currentGold = parseCurrentGoldFromHeader();
    if (!goldPerHour) {
      scope.querySelectorAll(SHOP_CARD_SELECTOR).forEach((card) => renderShopCardGoalControls(card));
      return;
    }

    const cards = scope.querySelectorAll(SHOP_CARD_SELECTOR);
    let updatedCount = 0;
    cards.forEach((card) => {
      renderShopCardGoalControls(card);
      const goldAmount = getShopCardGoldAmount(card);
      if (!goldAmount || goldAmount <= 0) {
        return;
      }

      const computedHours = goldAmount / goldPerHour;
      if (!Number.isFinite(computedHours) || computedHours <= 0) {
        return;
      }

      const remainingGold = Math.max(0, goldAmount - currentGold);
      const nextHoursText = remainingGold > 0
        ? `${formatHours(computedHours)} (~${formatHours(remainingGold / goldPerHour)} needed)`
        : formatHours(computedHours);
      const nextHoursTitle = `Calculated with ${goldPerHour.toFixed(2)} effective gold/hour`;
      upsertShopCardEtaSpan(card, nextHoursText, nextHoursTitle);
      updateShopCardIncludesRate(card, computedHours);
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
      if (cached && (!Number.isFinite(effectiveGoldPerHour) || effectiveGoldPerHour <= 0)) {
        effectiveGoldPerHour = cached.effectiveGoldPerHour;
        updateDashboardAverageRateRow();
        if (pendingRender) {
          pendingRender = false;
          updateShopCardHours(getShopModalElement() || document);
        }
        scheduleShopModalUiRefresh();
        queueGoalsMiniRender();
        refreshGoalOrderStatus();
      }

      let computed = applyEffectiveGoldPerHourFromMeta(projectMetaById, getKnownProjectIds());
      if (!computed) {
        await refreshProjectLabelMeta(true);
        computed = applyEffectiveGoldPerHourFromMeta(projectMetaById, getKnownProjectIds());
      }
      if (!computed) {
        return;
      }

      applyEffectiveRateResult(computed);
    } finally {
      refreshInFlight = false;
    }
  }

  function refreshProjectLabelMetaSafely(force = false) {
    refreshProjectLabelMeta(force).catch(() => {
    });
  }

  function refreshEffectiveRateSafely() {
    refreshEffectiveRate().catch(() => {
    });
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
      refreshEffectiveRateSafely();
    }, delayMs);
  }

  function scheduleRender() {
    pendingRender = true;
    requestAnimationFrame(() => {
      if (!pendingRender) {
        return;
      }
      pendingRender = false;
      updateShopCardHours(getShopModalElement() || document);
    });
  }

  function collapseShopFilterChips(root = document) {
    const scope = root instanceof Element || root instanceof Document ? root : document;
    const rows = Array.from(scope.querySelectorAll("div")).filter((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const buttons = Array.from(node.children).filter((child) => child instanceof HTMLButtonElement);
      if (buttons.length < 8) {
        return false;
      }
      const text = buttons.map((button) => String(button.textContent || "").trim().toLowerCase());
      return text.includes("all") && text.includes("other") && (text.includes("tech") || text.includes("food") || text.includes("gaming"));
    });
    rows.forEach((row) => {
      const buttons = Array.from(row.children).filter((child) => child instanceof HTMLButtonElement);
      const existingToggle = row.querySelector("[data-mu-chip-toggle='true']");
      if (existingToggle instanceof HTMLElement) {
        existingToggle.remove();
      }
      buttons.forEach((button) => {
        if (button instanceof HTMLElement) {
          button.style.removeProperty("display");
        }
      });
      const visibleCount = 8;
      if (buttons.length <= visibleCount) {
        return;
      }
      const expanded = row.getAttribute("data-mu-chip-expanded") === "true";
      buttons.forEach((button, index) => {
        if (index >= visibleCount && !expanded) {
          button.style.setProperty("display", "none", "important");
        }
      });
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.setAttribute("data-mu-chip-toggle", "true");
      toggle.textContent = expanded ? "Less" : "...";
      toggle.className = buttons[0].className;
      toggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        row.setAttribute("data-mu-chip-expanded", expanded ? "false" : "true");
        collapseShopFilterChips(scope);
      });
      row.appendChild(toggle);
    });
  }

  const observer = new MutationObserver((records) => {
    if (suppressedObserverMutations > 0) {
      return;
    }
    if (areMutationsOnlyFromExtensionUi(records)) {
      return;
    }
    if (areMutationsHandledByShopObserver(records)) {
      return;
    }
    const work = summarizeMutationWork(records);
    if (work.shop) {
      startShopModalReadyProbe();
      ensureShopModalObserver();
    } else if (!isShopModalOpen()) {
      disconnectShopModalObserver();
    }
    if (work.project) {
      queueProjectGroundLabelsSync();
    }
    if (work.project || work.chrome) {
      queueEnsureProjectLabelSettingsButton();
    }
    if (work.chrome) {
      updateDashboardAverageRateRow();
      ensureStreakHoverInteraction();
    }
    if (work.goals && shouldRefreshGoalsFromMutations(records)) {
      queueGoalsMiniRender();
    }
    if (work.onboarding) {
      queueOnboardingRender();
    }
    if (work.refresh && hasProjectContextOnPage()) {
      scheduleRefresh("dom-mutation-project-context");
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  if (isExtensionContextValid() && typeof chrome?.runtime?.onMessage?.addListener === "function") {
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Extension context invalidated/i.test(message)) {
        console.warn(`${DEBUG_PREFIX} message listener was not attached because extension context was invalidated`);
      }
    }
  }

  if (IS_HARVEST_TAB) {
    return;
  }

  currentOwnerName = readOwnerNameCache();
  projectTitleById = {};
  projectMetaById = {};
  projectLabelPrefs = readProjectLabelPrefsCache();
  applySelectedTheme();
  goalsViewMode = projectLabelPrefs.goalsViewMode === "projected" ? "projected" : "actual";
  goalsProgressMode = normalizeGoalsProgressMode(projectLabelPrefs.goalsProgressMode);
  projectGoals = readGoalsCache();
  projectTileOrder = readProjectTileOrderCache();
  projectIdsBootstrapped = readProjectIdBootstrapCache();
  {
    const goalSyncCached = readGoalOrderSyncCache();
    goalOrderedItemIds = new Set(goalSyncCached.itemIds);
    lastGoalOrderSyncAt = goalSyncCached.timestamp || 0;
  }
  if (!projectTileOrder.length) {
    projectTileOrder = getProjectIdsFromFarmTiles(document);
  }
  sanitizeProjectTileOrderAgainstVisibleTiles();
  if (projectTileOrder.length) {
    projectIdsBootstrapped = true;
    writeProjectIdBootstrapCache(true);
  }

  document.addEventListener("pointerdown", trackCreateTilePointerDown, true);
  document.addEventListener("pointerdown", handleShopModalOpenIntent, true);
  document.addEventListener("pointermove", trackCreateTilePointerMove, true);
  document.addEventListener("pointerup", trackCreateTilePointerUp, true);
  document.addEventListener("pointercancel", trackCreateTilePointerUp, true);
  document.addEventListener("click", handleShopModalOpenIntent, true);
  document.addEventListener("click", maybeInterceptCreateTileClick, true);
  document.addEventListener("click", maybeInterceptStreakButtonClick, true);
  document.addEventListener("click", handleInjectedGoalsViewModeClick, true);
  document.addEventListener("click", handleShopStarToggleClick, true);
  document.addEventListener("click", handleShopCardGoalActionClick, true);
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !target.closest(`#${PROJECT_LABEL_SETTINGS_ID}`)) {
      closeProjectLabelSettingsPanel();
    }
  });
  window.addEventListener("resize", queueProjectGroundLabelsSync);
  window.addEventListener("resize", queueGoalsMiniRender);
  window.addEventListener("resize", queueOnboardingRender);
  window.addEventListener("resize", () => hideStreakHoverCard(true));
  window.addEventListener("scroll", queueOnboardingRender, true);
  window.addEventListener("scroll", () => hideStreakHoverCard(true), true);
  window.addEventListener("resize", () => {
    const root = document.getElementById(PROJECT_LABEL_SETTINGS_ID);
    const panel = root?.querySelector(".mu-label-settings-panel");
    const button = root?.querySelector(".mu-label-settings-btn");
    if (panel instanceof HTMLElement && !panel.hidden && button instanceof HTMLElement) {
      positionProjectLabelSettingsPanel(button, panel);
    }
  });

  updateShopCardHours();
  collapseShopFilterChips();
  ensureShopModalObserver();
  startShopModalReadyProbe();
  queueProjectGroundLabelsSync();
  ensureProjectLabelSettingsButton();
  ensureStreakHoverInteraction();
  queueGoalsMiniRender();
  queueOnboardingRender();
  refreshProjectLabelMetaSafely();
  refreshEffectiveRateSafely();
  refreshGoalOrderStatus();
  recordSessionStart();
  window.addEventListener("pagehide", () => {
    const api = getTelemetryApi();
    if (api && typeof api.flush === "function") {
      try { api.flush(); } catch { /* ignore */ }
    }
  });
  window.addEventListener("beforeunload", () => {
    const api = getTelemetryApi();
    if (api && typeof api.flush === "function") {
      try { api.flush(); } catch { /* ignore */ }
    }
  });
  setInterval(() => {
    refreshProjectLabelMetaSafely();
  }, PROJECT_LABEL_META_REFRESH_MS);
  setInterval(() => {
    refreshGoalOrderStatus();
  }, PROJECT_GOALS_ORDER_SYNC_MS);
  setTimeout(function scheduleMidnightRefresh() {
    refreshProjectLabelMetaSafely(true);
    setTimeout(scheduleMidnightRefresh, msUntilNextLocalMidnight());
  }, msUntilNextLocalMidnight());

  window.addEventListener("focus", () => {
    ensureShopModalObserver();
    startShopModalReadyProbe();
    refreshProjectLabelMetaSafely();
    refreshEffectiveRateSafely();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      ensureShopModalObserver();
      startShopModalReadyProbe();
      refreshProjectLabelMetaSafely();
      refreshEffectiveRateSafely();
    } else {
      disconnectShopModalObserver();
    }
  });
  window.addEventListener("load", () => {
    ensureShopModalObserver();
    startShopModalReadyProbe();
    refreshProjectLabelMetaSafely();
    refreshEffectiveRateSafely();
  });
  console.log(`${DEBUG_PREFIX} content script loaded`);
})();
