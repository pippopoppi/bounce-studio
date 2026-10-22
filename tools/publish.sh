#!/usr/bin/env bash
# Test, build with the repo sub-path, commit the source, push main, and publish dist/ to the gh-pages branch
# (GitHub Pages serves that branch). The Actions workflow in .github/workflows/ does the same when Actions
# is enabled for the repo; on this account it never registered, hence the branch deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run test
git add -A
git commit -m "${1:-Update}" || true
git push origin main
BASE_PATH=/bounce-studio/ npm run build
cd dist && rm -rf .git && git init -q
git config user.name "Pippo Poppi Games"; git config user.email "340152759+pippopoppi@users.noreply.github.com"
git config credential.helper '!gh auth git-credential'
touch .nojekyll && git add -A && git commit -q -m "Deploy" && git push -q -f https://github.com/pippopoppi/bounce-studio.git HEAD:gh-pages
rm -rf .git
echo "Live in ~1 min: https://pippopoppi.github.io/bounce-studio/"
