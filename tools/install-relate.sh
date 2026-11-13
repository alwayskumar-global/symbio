#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
case "$(uname -s)/$(uname -m)" in
  Darwin/arm64) platform=darwin-arm64; sha=3b2cadd7cd4ad65cc1096f91be8729a793cee01a72b4b465f2fb26be1cdeec2b ;;
  Darwin/x86_64) platform=darwin-amd64; sha=2be1b9abd0edd2e24b22d650b98155add8ef1937be110c188b7422cb69577ec0 ;;
  Linux/aarch64) platform=linux-arm64; sha=3e1f2991246afe700034595e394bd60c4c4117c4b8dc0086a955e5eea6f9eee3 ;;
  Linux/x86_64) platform=linux-amd64; sha=e77eb19eb30a9ddcc83d58e002f92653c6cb0c953ab6c4061bea5bc814dec792 ;;
  *) echo "Unsupported CLI platform" >&2; exit 1 ;;
esac
mkdir -p .tools
tmp=$(mktemp .tools/relate.XXXXXX)
trap 'rm -f "$tmp"' EXIT
curl --proto '=https' --tlsv1.2 -fsSL "https://github.com/relatedb/relate/releases/download/v1.0.0/relate-$platform" -o "$tmp"
if command -v sha256sum >/dev/null 2>&1; then
  echo "$sha  $tmp" | sha256sum -c -
else
  echo "$sha  $tmp" | shasum -a 256 -c -
fi
chmod 755 "$tmp"
mv "$tmp" .tools/relate
.tools/relate --version
