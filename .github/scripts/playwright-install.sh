#!/usr/bin/env bash
# Installs the Playwright browsers listed in $E2E_BROWSERS, with the system
# packages they need. Playwright may be a dependency of the root package or of
# a workspace package such as apps/e2e, so the install runs from the package
# that .github/scripts/playwright-dir.mjs finds.
set -euo pipefail

dir=$(node .github/scripts/playwright-dir.mjs) || {
  echo "::error::No package.json depends on @playwright/test."
  exit 1
}

read -ra browsers <<<"${E2E_BROWSERS:-chromium}"
echo "Installing ${browsers[*]} from $dir"
pnpm --dir "$dir" exec playwright install --with-deps "${browsers[@]}"
