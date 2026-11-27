#!/usr/bin/env bash
set -euo pipefail
if [[ $# != 2 ]]; then
  printf 'Usage: %s <K-Housing git checkout> <new staging directory>\n' "$0" >&2
  exit 2
fi

apt_root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
housing_ref=103c044ede1102bea8326d58d60ca153a4182997
housing_repo=$(git -C "$1" rev-parse --show-toplevel)
mkdir "$2"
staging=$(cd "$2" && pwd)

git -C "$apt_root" archive HEAD | tar -x -C "$staging"
mkdir "$staging/market-src"
git -C "$housing_repo" archive "$housing_ref" -- \
  src server.ts index.html vite.config.ts tsconfig.json package.json package-lock.json data/redevelopment scripts/collector_job.ts scripts/collect_molit_readonly.ts |
  tar -x -C "$staging/market-src"
patch --batch --forward -p1 -d "$staging/market-src" -i "$apt_root/ops/khousing-market.patch"
test -s "$staging/market-src/src/data/complexFootprints.json"

python3 - "$staging/Dockerfile" <<'PY'
from pathlib import Path
import sys

file = Path(sys.argv[1])
dockerfile = file.read_text()
dockerfile = dockerfile.replace('RUN npm run build && npm prune --omit=dev',
    'RUN VITE_APT_UNIFIED_HOUSING=true npm run build && npm prune --omit=dev', 1)
market = """FROM node:22-bookworm-slim AS market
WORKDIR /market
COPY market-src/package.json market-src/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY market-src/ .
RUN npx vite build --base=/market/ && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/server.cjs && npx esbuild scripts/collector_job.ts --bundle --platform=node --format=cjs --packages=external --outfile=dist/collector.cjs && npm prune --omit=dev

"""
dockerfile = market + dockerfile
dockerfile = dockerfile.replace('COPY --from=build /app/public ./public', '''COPY --from=build /app/public ./public
COPY --from=market /market/dist ./market/dist
COPY --from=market /market/node_modules ./market/node_modules
COPY --from=market /market/data/redevelopment ./market/data/redevelopment''')
file.write_text(dockerfile)
PY

# The staged directory comes from clean Git archives. Explicit ignore rules keep tracked map
# and other JSON assets even when a repository's .gitignore excludes their filename.
printf '.git\n.github\n' > "$staging/.gcloudignore"
printf '.git\n.github\n' > "$staging/.dockerignore"
printf 'Prepared unified Docker context at %s\n' "$staging"
