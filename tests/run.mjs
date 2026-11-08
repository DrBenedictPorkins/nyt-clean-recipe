import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const here = path.dirname(fileURLToPath(import.meta.url));
const EXTRACT = path.join(here, "..", "src", "extract.js");
const base = "https://cooking.nytimes.com/recipes/";
let failed = 0;

if (!fs.existsSync(EXTRACT)) { console.log("FAIL: " + EXTRACT + " does not exist"); process.exit(1); }
const src = fs.readFileSync(EXTRACT, "utf8");

function section(title, errs) {
  if (errs.length) { failed++; console.log("FAIL " + title); errs.forEach(e => console.log("   - " + e)); }
  else console.log("PASS " + title);
}
function mk() {
  const errs = [];
  return { errs, ok: (c, m) => { if (!c) errs.push(m); } };
}

// ---- recipeIdFromUrl unit tests (jsdom window + bare context)
const idCases = [
  [base + "778688004-meatball-guisada", "778688004"],
  [base + "1025437", "1025437"],
  [base + "778688004-x#recipe-step-1", "778688004"],
  ["https://cooking.nytimes.com/", null],
  ["https://cooking.nytimes.com/68861692-nyt-cooking/90084-best-zucchini-recipes", null],
];
function idTests(fn, label) {
  const t = mk();
  t.ok(typeof fn === "function", label + ": recipeIdFromUrl is not a function");
  if (typeof fn === "function") for (const [u, exp] of idCases) {
    let got; try { got = fn(u); } catch (e) { got = "THROW " + e.message; }
    t.ok(got === exp, `${label}: recipeIdFromUrl(${u}) = ${JSON.stringify(got)}, expected ${JSON.stringify(exp)}`);
  }
  return t.errs;
}

// bare context
{
  const t = mk(); let ctx = vm.createContext(process.env.BARE_STRICT ? {} : { URL });
  try { vm.runInContext(src, ctx); } catch (e) { t.ok(false, "bare context load threw: " + e.message); }
  t.errs.push(...idTests(ctx.recipeIdFromUrl, "bare"));
  t.ok(typeof ctx.extractRecipe === "function", "bare: extractRecipe not defined");
  section("bare context (no window/document)", t.errs);
}

// window context loader
function loadWindow(html, url) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  dom.window.eval(src);
  return dom;
}
{
  const dom = loadWindow("<html></html>", "https://cooking.nytimes.com/");
  section("recipeIdFromUrl (jsdom window)", idTests(dom.window.recipeIdFromUrl, "window"));
}

// ---- generic invariants
const KEYS = ["id","url","name","author","description","yield","totalTime","prepTime","cookTime","rating","image","ingredientGroups","steps","tips"];
function deepWalk(v, p, cb) {
  if (v === undefined) return cb(p, "undefined value");
  if (typeof v === "string") {
    if (v.includes("undefined")) cb(p, 'contains "undefined": ' + JSON.stringify(v.slice(0, 60)));
    if (v.includes("[object Object]")) cb(p, 'contains "[object Object]"');
    if (v !== v.trim()) cb(p, "not trimmed: " + JSON.stringify(v.slice(0, 60)));
    if (/\s{2,}|[\n\r\t]/.test(v)) cb(p, "whitespace run/newline: " + JSON.stringify(v.slice(0, 60)));
    return;
  }
  if (Array.isArray(v)) return v.forEach((x, i) => deepWalk(x, `${p}[${i}]`, cb));
  if (v && typeof v === "object") for (const k of Object.keys(v)) deepWalk(v[k], `${p}.${k}`, cb);
}
const TIME_RE = /^(\d+ hr)?( ?\d+ min)?$/;

function generic(r, html) {
  const t = mk();
  t.ok(r != null, "returned null/undefined");
  if (r == null) return t.errs;
  for (const k of KEYS) t.ok(k in r, "missing key " + k);
  deepWalk(r, "$", (p, m) => t.ok(false, `${p}: ${m}`));
  const groups = Array.isArray(r.ingredientGroups) ? r.ingredientGroups : [];
  t.ok(Array.isArray(r.ingredientGroups), "ingredientGroups not array");
  t.ok(groups.reduce((n, g) => n + (g.items ? g.items.length : 0), 0) > 0, "no ingredient items");
  t.ok(Array.isArray(r.steps) && r.steps.length > 0, "no steps");
  (r.steps || []).forEach((s, i) => t.ok(s && typeof s.text === "string" && s.text.length > 0, `steps[${i}].text empty`));
  t.ok(Array.isArray(r.tips), "tips not array");
  for (const k of ["totalTime", "prepTime", "cookTime"]) {
    const v = r[k];
    t.ok(v === null || (typeof v === "string" && v.length > 0 && TIME_RE.test(v)), `${k} invalid: ${JSON.stringify(v)}`);
  }
  // HowToSection present in JSON-LD -> some step has section
  let hasSection = false;
  const d = new JSDOM(html).window.document;
  for (const s of d.querySelectorAll('script[type="application/ld+json"]')) {
    if (/"@type":\s*"HowToSection"[^{}]*"name":\s*"[^"]+/.test(s.textContent) || /"name":\s*"[^"]+"[^{}]*"@type":\s*"HowToSection"/.test(s.textContent)) hasSection = true;
  }
  if (hasSection) t.ok((r.steps || []).some(s => s.section != null), "HowToSection in JSON-LD but no step has a section");
  return t.errs;
}

function pageAssertions(r) {
  const t = mk();
  if (!r) { t.ok(false, "null result"); return t.errs; }
  t.ok(r.id === "778688004", "id " + r.id);
  t.ok(r.name === "Meatball Guisada", "name " + r.name);
  t.ok(r.author === "Illyanna Maisonet", "author " + r.author);
  t.ok(r.yield === "4 to 6 servings", "yield " + r.yield);
  t.ok(r.totalTime === "1 hr", "totalTime " + r.totalTime);
  t.ok(r.prepTime === "10 min", "prepTime " + r.prepTime);
  t.ok(r.cookTime === "50 min", "cookTime " + r.cookTime);
  t.ok(r.rating && r.rating.value === 5 && r.rating.count === 55, "rating " + JSON.stringify(r.rating));
  t.ok(r.image && typeof r.image.url === "string" && r.image.url.startsWith("https://static01.nyt.com/") && r.image.url.endsWith(".jpg"), "image.url " + (r.image && r.image.url));
  t.ok(r.image && r.image.credit === "Julia Gartland for The New York Times. Food Stylist: Monica Pierini.", "image.credit " + (r.image && r.image.credit));
  const g = r.ingredientGroups || [];
  t.ok(g.length === 2, "ingredientGroups length " + g.length);
  if (g.length === 2) {
    t.ok(g[0].name === "For the sofrito (see Tip)", "group0 name " + g[0].name);
    t.ok(g[1].name === "For the stew", "group1 name " + g[1].name);
    t.ok(g[0].items.length === 5, "group0 items " + g[0].items.length);
    t.ok(g[1].items.length === 14, "group1 items " + g[1].items.length);
    t.ok(g[0].items[0] === "1 bunch cilantro", "first item " + g[0].items[0]);
    t.ok(g[0].items.length + g[1].items.length === 19, "total items");
  }
  const s = r.steps || [];
  t.ok(s.length === 6, "steps length " + s.length);
  t.ok(s.every(x => x.section === null), "not all step sections null");
  t.ok(s[0] && s[0].text.startsWith("Make the sofrito:"), "steps[0] " + (s[0] && s[0].text.slice(0, 30)));
  t.ok(Array.isArray(r.tips) && r.tips.length >= 4, "tips length " + (r.tips && r.tips.length));
  t.ok(r.tips && r.tips[0] && r.tips[0].startsWith("You’ll find most"), "tips[0] " + (r.tips && r.tips[0] && r.tips[0].slice(0, 30)));
  t.ok(r.description && r.description.length > 900, "description length " + (r.description && r.description.length));
  return t.errs;
}

// ---- fixtures
const fdir = path.join(here, "fixtures");
const files = fs.existsSync(fdir) ? fs.readdirSync(fdir).filter(f => f.endsWith(".html")).sort() : [];
if (!files.length) { console.log("No fixtures. Run: npm run fetch-fixtures"); process.exit(1); }
const fixtures = files.map(f => {
  const id = path.basename(f, ".html");
  const isPage = id === "778688004";
  return { file: path.join(fdir, f), url: base + (isPage ? "778688004-meatball-guisada" : id), isPage };
});

for (const fx of fixtures) {
  const name = path.relative(here, fx.file);
  if (!fs.existsSync(fx.file)) { section(name, ["file missing"]); continue; }
  const html = fs.readFileSync(fx.file, "utf8");
  let errs = [];
  try {
    const win = loadWindow("<html></html>", "https://cooking.nytimes.com/");
    const doc = new JSDOM(html).window.document;
    const r = win.window.extractRecipe(doc, fx.url);
    errs = generic(r, html);
    if (fx.isPage) errs.push(...pageAssertions(r));
  } catch (e) { errs.push("threw: " + (e && e.stack || e)); }
  section(name, errs);
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
