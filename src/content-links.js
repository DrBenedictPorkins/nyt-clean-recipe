window.addEventListener(
  "click",
  (e) => {
    if (e.button !== 0 || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const t = e.target;
    if (!t || typeof t.closest !== "function") return;
    const a = t.closest("a[href]");
    if (!a) return;
    let u;
    try {
      u = new URL(a.href, location.href);
    } catch (err) {
      return;
    }
    if (u.hostname !== "cooking.nytimes.com") return;
    const id = recipeIdFromUrl(u.href);
    if (!id) return;
    if (id === recipeIdFromUrl(location.href)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      chrome.runtime.sendMessage({ type: "openRecipe", url: u.origin + u.pathname }).catch(() => {});
    } catch (err) {
      // Extension context invalidated; nothing to do.
    }
  },
  true
);
