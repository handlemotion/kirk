#!/usr/bin/env bash
# Decides which CI jobs a change needs. Writes key=value lines to
# $GITHUB_OUTPUT.
#
# Pull requests are diffed against the first parent of the merge commit that
# actions/checkout makes. That parent is the base branch tip. Every other
# event runs everything.
#
# Docs-only changes run nothing. iOS-only changes skip the tests, the E2E job
# and the desktop UI build.
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"

emit() {
  printf '%s=%s\n' "$1" "$2" >>"$out"
  echo "$1=$2"
}

e2e_script=false
if node -e 'process.exit(require("./package.json").scripts?.e2e ? 0 : 1)'; then
  e2e_script=true
fi
emit e2e_script "$e2e_script"

if [ "${EVENT_NAME:-}" != "pull_request" ]; then
  emit check true
  emit test true
  emit bundle true
  emit e2e true
  exit 0
fi

check=false test=false bundle=false e2e=false
while IFS= read -r file; do
  case "$file" in
    *.md | docs/* | LICENSE* | .github/dependabot.yml | .github/CODEOWNERS | .github/ISSUE_TEMPLATE/* | .github/PULL_REQUEST_TEMPLATE*)
      continue
      ;;
    apps/ios/*)
      check=true bundle=true
      ;;
    scripts/*)
      check=true
      ;;
    *)
      # apps/desktop, packages, convex and the root config.
      check=true test=true bundle=true e2e=true
      ;;
  esac
done < <(git diff --name-only HEAD^1 HEAD)

emit check "$check"
emit test "$test"
emit bundle "$bundle"
emit e2e "$e2e"
