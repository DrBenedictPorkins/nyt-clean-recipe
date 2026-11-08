import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "fixtures");
const force = process.argv.includes("--force");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const URLS = [
  "https://cooking.nytimes.com/recipes/778688004-meatball-guisada",
  "https://cooking.nytimes.com/recipes/1020450-indian-ish-nachos-with-cheddar-black-beans-and-chutney",
  "https://cooking.nytimes.com/recipes/1020555-lisbon-chocolate-cake",
  "https://cooking.nytimes.com/recipes/761060376-pumpkin-bread-pudding",
  "https://cooking.nytimes.com/recipes/763764896-wild-rice-salad-with-frizzled-leeks-and-peppers",
  "https://cooking.nytimes.com/recipes/769796476-deeply-roasted-cabbage-with-peanut-crunch",
  "https://cooking.nytimes.com/recipes/793197871-quick-pickled-radishes-cauliflower-and-cucumbers",
  "https://cooking.nytimes.com/recipes/793198657-roast-turkey-with-garlic-and-chiles",
  "https://cooking.nytimes.com/recipes/793383430-sweet-potato-and-cranberry-layer-cake",
];

fs.mkdirSync(dir, { recursive: true });
for (const url of URLS) {
  const id = url.match(/\/recipes\/(\d+)/)[1];
  const file = path.join(dir, id + ".html");
  if (fs.existsSync(file) && !force) { console.log("skip  " + id + " (exists)"); continue; }
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status !== 200) {
    console.error(`FAIL ${id}: HTTP ${res.status} for ${url}`);
    process.exit(1);
  }
  fs.writeFileSync(file, await res.text());
  console.log("fetch " + id);
}
