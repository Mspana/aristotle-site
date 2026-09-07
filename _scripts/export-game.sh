#!/usr/bin/env bash
# Export an Aristotle/Godot project to games/<slug>/ as a SINGLE-THREADED web build.
#
#   ./export-game.sh <project-dir> <slug> [godot-binary]
#
# Single-threaded is deliberate: GitHub Pages cannot send COOP/COEP, and an
# iframe is only cross-origin isolated when its TOP-LEVEL page is too, so a
# threaded build cannot work embedded in a blog post no matter where the game
# itself is hosted.
#
# The project needs, before this runs:
#   * export_presets.cfg with a "Web" preset, export_filter="all_resources"
#     and variant/thread_support=false
#   * application/boot_splash/show_image=false
#   * a gui/theme/custom_font that carries a fallback for any glyph Open Sans
#     SemiBold lacks -- the web export has NO system font fallback, so those
#     characters render as empty boxes otherwise. Every project so far has
#     needed this.
# The renderer needs nothing: main.cpp registers rendering_method.web =
# gl_compatibility, so web overrides whatever the project says.
set -euo pipefail

PROJECT="${1:?usage: export-game.sh <project-dir> <slug> [godot]}"
SLUG="${2:?usage: export-game.sh <project-dir> <slug> [godot]}"
GODOT="${3:-C:/Users/Matthew/Documents/engine/bin/godot.windows.editor.x86_64.console.exe}"
OUT="$(cd "$(dirname "$0")/../games" && pwd)/$SLUG"

# The exporter reuses .godot/exported/*.scn by mtime. Restoring a file from a
# backup can leave a source OLDER than a cache built from the edit you undid,
# and the export then silently ships the undone change. Drop the cache.
rm -rf "$PROJECT/.godot/exported"

mkdir -p "$OUT"; rm -f "$OUT"/index.*
"$GODOT" --headless --path "$PROJECT" --export-release "Web" "$OUT/index.html"

# The exporter always writes the boot splash PNG even when show_image=false
# (platform/web/export/export_plugin.cpp, "// Export splash (why?)").
rm -f "$OUT/index.png"
sed -i '/id="status-splash"/d' "$OUT/index.html"

echo "--- exported $PROJECT -> $OUT ---"
ls -la "$OUT"
