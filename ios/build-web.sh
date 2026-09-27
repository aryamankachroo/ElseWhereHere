#!/bin/sh
# Builds the Vite frontend into the app bundle's `web` folder.
# Run by the "Build Web App" phase in Xcode; expects `npm install` at the repo root.
set -eu

export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.volta/bin:$PATH"
if [ -s "$HOME/.nvm/nvm.sh" ] && ! command -v node >/dev/null 2>&1; then
  . "$HOME/.nvm/nvm.sh"
fi

REPO_ROOT="$(cd "$SRCROOT/.." && pwd)"
OUT_DIR="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/web"

if ! command -v node >/dev/null 2>&1; then
  echo "error: Node.js not found. Install it (e.g. brew install node) and rebuild."
  exit 1
fi

if [ ! -x "$REPO_ROOT/node_modules/.bin/vite" ]; then
  echo "error: Frontend dependencies missing. Run 'npm install' in $REPO_ROOT and rebuild."
  exit 1
fi

cd "$REPO_ROOT"
# Matching always uses the in-browser scorer. Grok questions and sources go to the
# FastAPI server, which holds the xAI key; 127.0.0.1 only works in the Simulator.
VITE_USE_MOCK_API=true \
VITE_ENABLE_GROK=true \
VITE_API_BASE_URL="${ELSEWHERE_API_URL:-http://127.0.0.1:8000}" \
  ./node_modules/.bin/vite build --outDir "$OUT_DIR" --emptyOutDir
