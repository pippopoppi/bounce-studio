#!/usr/bin/env bash
# Type-check, test, build, commit everything and push; GitHub Actions deploys dist/ to Pages.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run test
npm run build
git add -A
git commit -m "${1:-Update}" || true
git push origin main
echo "Deploying via Actions: https://github.com/pippopoppi/bounce-studio/actions — live in ~2 min at https://pippopoppi.github.io/bounce-studio/"
