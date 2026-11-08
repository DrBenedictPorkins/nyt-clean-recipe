/* Shared recipe extractor. Classic script; no document/window access at load time. */
(function (root) {
  "use strict";

  function clean(s) {
    if (typeof s !== "string") return "";
    return s.replace(/\s+/g, " ").trim();
  }

  function str(v) {
    if (typeof v === "string") return clean(v) || null;
    if (typeof v === "number" && isFinite(v)) return String(v);
    return null;
  }

  function recipeIdFromUrl(url) {
    try {
      var u = new URL(String(url));
      var m = /^\/recipes\/(\d+)(?:-[^\/]*)?\/?$/.exec(u.pathname);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  function canonicalUrl(url, id) {
    try {
      var u = new URL(String(url));
      u.hash = "";
      u.search = "";
      return u.toString();
    } catch (e) {
      return id ? "https://cooking.nytimes.com/recipes/" + id : null;
    }
  }

  function hasType(node, type) {
    if (!node || typeof node !== "object") return false;
    var t = node["@type"];
    if (Array.isArray(t)) return t.indexOf(type) !== -1;
    return t === type;
  }

  function findRecipeNode(doc) {
    var scripts;
    try {
      scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    } catch (e) {
      return null;
    }
    for (var i = 0; i < scripts.length; i++) {
      var json;
      try {
        json = JSON.parse(scripts[i].textContent);
      } catch (e) {
        continue;
      }
      var queue = Array.isArray(json) ? json.slice() : [json];
      var flat = [];
      while (queue.length) {
        var n = queue.shift();
        if (Array.isArray(n)) {
          queue = n.concat(queue);
          continue;
        }
        if (!n || typeof n !== "object") continue;
        if (Array.isArray(n["@graph"])) {
          flat = flat.concat(n["@graph"]);
        }
        flat.push(n);
      }
      for (var j = 0; j < flat.length; j++) {
        if (hasType(flat[j], "Recipe")) return flat[j];
      }
    }
    return null;
  }

  function authorName(a) {
    if (!a) return null;
    if (typeof a === "string") return clean(a) || null;
    if (Array.isArray(a)) {
      var names = [];
      for (var i = 0; i < a.length; i++) {
        var n = authorName(a[i]);
        if (n) names.push(n);
      }
      return names.length ? names.join(" and ") : null;
    }
    if (typeof a === "object") return str(a.name);
    return null;
  }

  function isoToHuman(v) {
    if (typeof v !== "string") return null;
    var m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(v.trim());
    if (!m) return null;
    var days = parseInt(m[1] || "0", 10);
    var h = parseInt(m[2] || "0", 10) + days * 24;
    var min = parseInt(m[3] || "0", 10);
    var parts = [];
    if (h > 0) parts.push(h + " hr");
    if (min > 0) parts.push(min + " min");
    return parts.length ? parts.join(" ") : null;
  }

  function firstString(v) {
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) {
        var s = str(v[i]);
        if (s) return s;
      }
      return null;
    }
    return str(v);
  }

  function parseImage(img) {
    var first = img;
    if (Array.isArray(img)) {
      first = null;
      for (var i = 0; i < img.length; i++) {
        if (img[i]) { first = img[i]; break; }
      }
    }
    if (!first) return null;
    if (typeof first === "string") {
      var s = clean(first);
      return s ? { url: s, credit: null } : null;
    }
    if (typeof first === "object") {
      var url = str(first.contentUrl) || str(first.url);
      if (!url) return null;
      return { url: url, credit: str(first.creditText) };
    }
    return null;
  }

  function parseRating(r) {
    if (!r || typeof r !== "object") return null;
    var value = parseFloat(r.ratingValue);
    var count = parseInt(r.ratingCount != null ? r.ratingCount : r.reviewCount, 10);
    if (!isFinite(value) || !isFinite(count) || count <= 0) return null;
    return { value: value, count: count };
  }

  function parseSteps(ins) {
    var out = [];
    function walk(node, section) {
      if (node == null) return;
      if (typeof node === "string") {
        var t = clean(node);
        if (t) out.push({ section: section, text: t });
        return;
      }
      if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) walk(node[i], section);
        return;
      }
      if (typeof node !== "object") return;
      if (hasType(node, "HowToSection") || (node.itemListElement && !node.text)) {
        walk(node.itemListElement, str(node.name) || section);
        return;
      }
      var text = clean(typeof node.text === "string" ? node.text : (typeof node.name === "string" ? node.name : ""));
      if (text) out.push({ section: section, text: text });
    }
    walk(ins, null);
    return out;
  }

  function isHeadingMatch(el) {
    var c = el.getAttribute && el.getAttribute("class");
    return typeof c === "string" && c.indexOf("ingredientgroup_name") !== -1;
  }

  function parseIngredientGroups(doc, fallbackItems) {
    var groups = [];
    try {
      var container = doc.querySelector('[class*="ingredients_ingredients"]');
      if (container) {
        var uls = container.querySelectorAll("ul");
        for (var i = 0; i < uls.length; i++) {
          var ul = uls[i];
          var name = null;
          var sib = ul.previousElementSibling;
          while (sib) {
            if (isHeadingMatch(sib)) {
              name = clean(sib.textContent) || null;
              break;
            }
            if (sib.tagName && sib.tagName.toLowerCase() === "ul") break;
            sib = sib.previousElementSibling;
          }
          var items = [];
          var lis = ul.querySelectorAll("li");
          for (var j = 0; j < lis.length; j++) {
            var t = clean(lis[j].textContent);
            if (t) items.push(t);
          }
          if (items.length) groups.push({ name: name, items: items });
        }
      }
    } catch (e) {
      groups = [];
    }
    if (groups.length) return groups;
    if (fallbackItems.length) return [{ name: null, items: fallbackItems }];
    return [];
  }

  function parseTips(doc) {
    var tips = [];
    try {
      var els = doc.querySelectorAll('[class*="tips_tipsItem"]');
      for (var i = 0; i < els.length; i++) {
        var t = clean(els[i].textContent);
        if (t) tips.push(t);
      }
    } catch (e) {
      return [];
    }
    return tips;
  }

  function extractRecipe(doc, url) {
    if (!doc || typeof doc.querySelectorAll !== "function") return null;
    var node = findRecipeNode(doc);
    if (!node) return null;

    var id = recipeIdFromUrl(url);
    var flatIngredients = [];
    if (Array.isArray(node.recipeIngredient)) {
      for (var i = 0; i < node.recipeIngredient.length; i++) {
        var s = str(node.recipeIngredient[i]);
        if (s) flatIngredients.push(s);
      }
    }

    return {
      id: id,
      url: canonicalUrl(url, id),
      name: str(node.name),
      author: authorName(node.author),
      description: str(node.description),
      yield: firstString(node.recipeYield),
      totalTime: isoToHuman(node.totalTime),
      prepTime: isoToHuman(node.prepTime),
      cookTime: isoToHuman(node.cookTime),
      rating: parseRating(node.aggregateRating),
      image: parseImage(node.image),
      ingredientGroups: parseIngredientGroups(doc, flatIngredients),
      steps: parseSteps(node.recipeInstructions),
      tips: parseTips(doc)
    };
  }

  root.extractRecipe = extractRecipe;
  root.recipeIdFromUrl = recipeIdFromUrl;
})(globalThis);
