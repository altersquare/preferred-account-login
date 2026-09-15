#!/usr/bin/env bash
# Builds the Chrome Web Store upload zip:
#   preferred-account-login-v<version>.zip  (version read from manifest.json)
# Only manifest.json, icons/, and src/ are included.
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v zip >/dev/null 2>&1; then
	echo "Error: 'zip' is not installed. On Windows, use scripts/build-zip.ps1 instead." >&2
	exit 1
fi

version=$(sed -n 's/.*"version":[[:space:]]*"\([^"]*\)".*/\1/p' manifest.json | head -n 1)
if [ -z "$version" ]; then
	echo "Error: could not read version from manifest.json" >&2
	exit 1
fi

out="preferred-account-login-v${version}.zip"
rm -f "$out"
zip -r "$out" manifest.json icons src -x "*.DS_Store" -x "*.svg"
echo "Created $out"
