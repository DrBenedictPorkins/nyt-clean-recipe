(function () {
  "use strict";

  var HOST_ID = "nyt-clean-recipe-host";
  if (document.getElementById(HOST_ID)) return;

  var host = null;

  function build() {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "all: initial; position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;";
    var root = host.attachShadow({ mode: "closed" });

    var style = document.createElement("style");
    style.textContent =
      "button {" +
      " all: initial; box-sizing: border-box; cursor: pointer;" +
      " background: #c8102e; color: #fff; border-radius: 999px; padding: 10px 18px;" +
      " font: bold 14px/1.2 Helvetica, Arial, sans-serif;" +
      " box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3); }" +
      "button:hover { background: #9e0c24; }" +
      "button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; box-shadow: 0 0 0 4px #c8102e; }" +
      "@media print { :host, button { display: none !important; } }";
    root.appendChild(style);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Clean recipe";
    btn.setAttribute("aria-label", "Open clean recipe in a new tab");
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        var p = chrome.runtime.sendMessage({
          type: "openRecipe",
          url: location.origin + location.pathname
        });
        if (p && typeof p.catch === "function") p.catch(function () {});
      } catch (err) {
        // Extension context invalidated; nothing to do.
      }
    });
    root.appendChild(btn);
  }

  function update() {
    var on = !!recipeIdFromUrl(location.href);
    if (on && !host) {
      build();
    }
    if (on) {
      if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
    } else if (host && host.isConnected) {
      host.remove();
    }
  }

  var lastHref = location.href;
  function check() {
    if (location.href !== lastHref) lastHref = location.href;
    update();
  }

  window.addEventListener("popstate", check);
  setInterval(check, 1000);
  update();
})();
