"use strict";

const BG_PREFIX = "[Macondo Utils BG]";
const HARVEST_TIMEOUT_MS = 30000;

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "macondo-utils-run-hidden-harvest") {
    return;
  }

  (async () => {
    try {
      const metrics = await runHiddenHarvest();
      sendResponse({ ok: true, metrics });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true;
});
