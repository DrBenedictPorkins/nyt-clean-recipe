(function () {
  "use strict";

  var app = document.getElementById("app");
  var params = new URLSearchParams(location.search);
  var id = params.get("id");
  var url = params.get("url");
  var refresh = params.get("refresh") === "1";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function has(s) {
    return typeof s === "string" && s.trim().length > 0;
  }

  function safeHttpUrl(u) {
    if (!has(u)) return null;
    try {
      var p = new URL(u);
      return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
    } catch (e) {
      return null;
    }
  }

  function cookingUrl(u) {
    if (!has(u)) return null;
    try {
      var p = new URL(u);
      return p.protocol === "https:" && p.hostname === "cooking.nytimes.com" ? p.href : null;
    } catch (e) {
      return null;
    }
  }

  (function setViewOriginal() {
    var link = document.getElementById("view-original");
    var href = cookingUrl(url);
    if (link && href) {
      link.href = href;
      link.hidden = false;
    }
  })();

  function clear() {
    while (app.firstChild) app.removeChild(app.firstChild);
  }

  function showError(msg) {
    clear();
    var box = el("div", "status");
    box.appendChild(el("p", null, msg));
    var href = safeHttpUrl(url);
    if (href) {
      var p = el("p");
      var a = el("a", null, "Open the original page");
      a.href = href;
      p.appendChild(a);
      box.appendChild(p);
    }
    app.appendChild(box);
    document.title = "Recipe unavailable | NYT Clean Recipe";
  }

  function stat(label, valueNode) {
    var d = el("div", "stat");
    d.appendChild(el("p", "stat-label", label));
    var v = el("p", "stat-value");
    if (typeof valueNode === "string") v.textContent = valueNode;
    else v.appendChild(valueNode);
    d.appendChild(v);
    return d;
  }

  function ratingNode(r) {
    var value = Number(r.value);
    var count = Number(r.count);
    var filled = Math.max(0, Math.min(5, Math.round(value)));
    var wrap = el("span");
    var stars = el("span", "stars");
    stars.setAttribute("role", "img");
    stars.setAttribute(
      "aria-label",
      filled + " out of 5 stars, " + count + " rating" + (count === 1 ? "" : "s")
    );
    for (var i = 0; i < 5; i++) {
      var g = el("span", i < filled ? "on" : "off", "★");
      g.setAttribute("aria-hidden", "true");
      stars.appendChild(g);
    }
    wrap.appendChild(stars);
    wrap.appendChild(el("span", "rating-count", " (" + count + ")"));
    return wrap;
  }

  function render(r) {
    clear();
    document.title = (has(r.name) ? r.name : "Recipe") + " | NYT Clean Recipe";

    var imgUrl = r.image && safeHttpUrl(r.image.url);
    if (imgUrl) {
      var fig = el("figure", "hero");
      var img = el("img");
      img.src = imgUrl;
      img.alt = has(r.name) ? r.name : "";
      fig.appendChild(img);
      app.appendChild(fig);
    }

    app.appendChild(el("p", "kicker", "Recipe"));
    if (has(r.name)) app.appendChild(el("h1", null, r.name));

    if (has(r.author)) {
      var by = el("p", "byline", "By ");
      by.appendChild(el("strong", null, r.author));
      app.appendChild(by);
    }
    if (r.image && has(r.image.credit)) {
      app.appendChild(el("p", "credit", r.image.credit));
    }

    var stats = el("div", "stats");
    if (has(r.totalTime)) stats.appendChild(stat("Ready In", r.totalTime));
    if (has(r.prepTime)) stats.appendChild(stat("Prep", r.prepTime));
    if (has(r.cookTime)) stats.appendChild(stat("Cook", r.cookTime));
    if (has(r.yield)) stats.appendChild(stat("Yield", r.yield));
    if (r.rating && Number(r.rating.count) > 0 && isFinite(Number(r.rating.value))) {
      stats.appendChild(stat("Rating", ratingNode(r.rating)));
    }
    if (stats.firstChild) app.appendChild(stats);

    if (has(r.description)) {
      var intro = el("div", "intro");
      r.description.split(/\n+/).forEach(function (para) {
        if (has(para)) intro.appendChild(el("p", null, para.trim()));
      });
      if (intro.firstChild) app.appendChild(intro);
    }

    var groups = (r.ingredientGroups || []).filter(function (g) {
      return g && Array.isArray(g.items) && g.items.some(has);
    });
    if (groups.length) {
      app.appendChild(el("h2", null, "Ingredients"));
      groups.forEach(function (g) {
        if (has(g.name)) app.appendChild(el("h3", null, g.name));
        var ul = el("ul", "items");
        g.items.forEach(function (it) {
          if (has(it)) ul.appendChild(el("li", null, it.trim()));
        });
        app.appendChild(ul);
      });
    }

    var steps = (r.steps || []).filter(function (s) {
      return s && has(s.text);
    });
    if (steps.length) {
      app.appendChild(el("h2", null, "Preparation"));
      var ol = null;
      var lastSection = null;
      var n = 0;
      steps.forEach(function (s, i) {
        var sec = has(s.section) ? s.section : null;
        if (i === 0 || sec !== lastSection) {
          if (sec) app.appendChild(el("h3", null, sec));
          ol = el("ol", "steps");
          app.appendChild(ol);
          lastSection = sec;
        }
        n++;
        var li = el("li");
        li.appendChild(el("span", "step-num", String(n)));
        li.appendChild(el("p", "step-text", s.text.trim()));
        ol.appendChild(li);
      });
    }

    var tips = (r.tips || []).filter(has);
    if (tips.length) {
      app.appendChild(el("h2", null, "Tips"));
      var tl = el("ul", "tips");
      tips.forEach(function (t) {
        tl.appendChild(el("li", null, t.trim()));
      });
      app.appendChild(tl);
    }

    var footer = el("footer", "footer");
    var fp = el("p", null, "Recipe text from cooking.nytimes.com. Re-formatted for personal reading. ");
    var orig = safeHttpUrl(r.url) || safeHttpUrl(url);
    if (orig) {
      var a = el("a", null, "Original recipe");
      a.href = orig;
      fp.appendChild(a);
    }
    footer.appendChild(fp);
    app.appendChild(footer);
  }

  function storageGet(key) {
    return new Promise(function (resolve) {
      try {
        chrome.storage.session.get(key, function (o) {
          if (chrome.runtime.lastError) return resolve(null);
          resolve(o && o[key] ? o[key] : null);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  function storageSet(key, val) {
    try {
      var o = {};
      o[key] = val;
      chrome.storage.session.set(o, function () {
        void chrome.runtime.lastError;
      });
    } catch (e) {}
  }

  function fetchHtml(u) {
    return new Promise(function (resolve) {
      try {
        chrome.runtime.sendMessage({ type: "fetchHtml", url: u }, function (resp) {
          if (chrome.runtime.lastError || !resp) {
            resolve({ ok: false, error: "No response from extension" });
          } else {
            resolve(resp);
          }
        });
      } catch (e) {
        resolve({ ok: false, error: String(e && e.message || e) });
      }
    });
  }

  async function main() {
    var pageUrl = safeHttpUrl(url);
    if (!pageUrl) {
      showError("No recipe address was provided.");
      return;
    }
    if (!id) id = globalThis.recipeIdFromUrl ? globalThis.recipeIdFromUrl(pageUrl) : null;
    var key = id ? "recipe:" + id : null;

    if (key && !refresh) {
      var cached = await storageGet(key);
      if (cached) {
        render(cached);
        return;
      }
    }

    var resp = await fetchHtml(pageUrl);
    if (!resp.ok || typeof resp.html !== "string") {
      showError("Could not load the recipe" + (has(resp.error) ? " (" + resp.error + ")" : "") + ".");
      return;
    }
    var recipe = null;
    try {
      var doc = new DOMParser().parseFromString(resp.html, "text/html");
      recipe = globalThis.extractRecipe(doc, pageUrl);
    } catch (e) {
      recipe = null;
    }
    if (!recipe) {
      showError("No recipe was found on that page.");
      return;
    }
    if (key) storageSet(key, recipe);
    render(recipe);
  }

  main().catch(function () {
    showError("Something went wrong loading the recipe.");
  });
})();
