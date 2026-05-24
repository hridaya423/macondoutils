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
  const CREATE_TILE_DRAG_THRESHOLD_PX = 6;
  const CREATE_MODAL_ID = "macondo-utils-create-modal";
  const CREATE_STYLE_ID = "macondo-utils-create-style";
  let createTilePointerState = null;
  let suppressNextCreateTileClickUntil = 0;
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

  document.addEventListener("pointerdown", trackCreateTilePointerDown, true);
  document.addEventListener("pointermove", trackCreateTilePointerMove, true);
  document.addEventListener("pointerup", trackCreateTilePointerUp, true);
  document.addEventListener("pointercancel", trackCreateTilePointerUp, true);
  document.addEventListener("click", maybeInterceptCreateTileClick, true);

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
