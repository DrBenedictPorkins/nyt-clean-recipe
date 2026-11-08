importScripts("extract.js");

const ALLOWED_HOST = "cooking.nytimes.com";

function canonicalUrl(url) {
  const u = new URL(url);
  return u.origin + u.pathname;
}

function openViewer(url, tab) {
  const id = recipeIdFromUrl(url);
  if (!id) return Promise.resolve(false);
  const viewerUrl =
    chrome.runtime.getURL("viewer/viewer.html") +
    "?id=" + encodeURIComponent(id) +
    "&url=" + encodeURIComponent(canonicalUrl(url));
  const props = { url: viewerUrl };
  if (tab) {
    props.index = tab.index + 1;
    props.openerTabId = tab.id;
  }
  return chrome.tabs.create(props).then(() => true);
}

function isAllowed(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === ALLOWED_HOST;
  } catch (e) {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false;

  if (msg.type === "openRecipe") {
    if (!isAllowed(msg.url)) {
      sendResponse({ ok: false, error: "blocked host" });
      return false;
    }
    openViewer(msg.url, sender.tab)
      .then((ok) => sendResponse({ ok }))
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }

  if (msg.type === "fetchHtml") {
    if (!isAllowed(msg.url)) {
      sendResponse({ ok: false, error: "blocked host" });
      return false;
    }
    fetch(msg.url, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          sendResponse({ ok: false, error: "HTTP " + res.status });
          return;
        }
        sendResponse({ ok: true, html: await res.text() });
      })
      .catch((e) => sendResponse({ ok: false, error: String(e && e.message || e) }));
    return true;
  }

  return false;
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.url) return;
  const id = recipeIdFromUrl(tab.url);
  if (!id) return;
  // Always let the viewer fetch the page source: the live DOM can be truncated by the sign-in wall.
  await chrome.storage.session.remove("recipe:" + id);
  try {
    await openViewer(tab.url, tab);
  } catch (e) {
    console.error("openViewer failed", e);
  }
});

// Toolbar state: enabled only on recipe pages.
function setTabState(tabId, url) {
  if (typeof tabId !== "number") return;
  const fn = url && recipeIdFromUrl(url) ? chrome.action.enable : chrome.action.disable;
  try {
    Promise.resolve(fn.call(chrome.action, tabId)).catch(() => {});
  } catch (e) {
    // Tab closed; ignore.
  }
}

async function initActionState() {
  try {
    await chrome.action.disable();
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) setTabState(t.id, t.url);
  } catch (e) {
    // Ignore.
  }
}

chrome.runtime.onInstalled.addListener(initActionState);
chrome.runtime.onStartup.addListener(initActionState);
initActionState();

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url === undefined && changeInfo.status === undefined) return;
  setTabState(tabId, changeInfo.url || (tab && tab.url));
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    setTabState(tabId, tab.url);
  } catch (e) {
    // Tab closed; ignore.
  }
});
