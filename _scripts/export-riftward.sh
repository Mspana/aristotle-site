#!/usr/bin/env bash
# Re-export little-league to games/riftward/ as a SINGLE-THREADED web build.
#
# Single-threaded is deliberate: GitHub Pages cannot send COOP/COEP, and an
# iframe is only cross-origin isolated when its TOP-LEVEL page is too, so a
# threaded build cannot work embedded in a blog post no matter where the game
# itself is hosted.
#
# Usage: ./export-riftward.sh [path-to-little-league] [path-to-aristotle-editor]
set -euo pipefail

PROJECT="${1:-C:/Users/Matthew/Documents/little-league}"
GODOT="${2:-C:/Users/Matthew/Documents/engine/bin/godot.windows.editor.x86_64.console.exe}"
OUT="$(cd "$(dirname "$0")/../games" && pwd)/riftward"

mkdir -p "$OUT"
rm -f "$OUT"/index.*

"$GODOT" --headless --path "$PROJECT" --export-release "Web" "$OUT/index.html"

# The exporter always writes the boot splash PNG even when show_image=false
# (see platform/web/export/export_plugin.cpp, "// Export splash (why?)").
# Drop it and its <img> so the browser never fetches 1.7 MB it will not show.
rm -f "$OUT/index.png"
sed -i '/id="status-splash"/d' "$OUT/index.html"

echo "--- exported to $OUT ---"
ls -la "$OUT"
