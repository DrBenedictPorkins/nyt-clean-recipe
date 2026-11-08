#!/usr/bin/env bash
# Build a Chrome Web Store / sideload zip in dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c 'import json;print(json.load(open("manifest.json"))["version"])')
out="dist/nyt-clean-recipe-${version}.zip"
mkdir -p dist
rm -f "$out"
zip -q -r "$out" manifest.json src viewer icons/icon16.png icons/icon48.png icons/icon128.png -x '*.DS_Store'
echo "$out"
unzip -l "$out"
