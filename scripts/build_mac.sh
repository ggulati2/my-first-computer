#!/bin/bash
# Builds the standalone Mac app:  scripts/build_mac.sh
# Result: dist/Keybo.app and dist/Keybo-<version>-macos-<cpu>.zip  (built for THIS Mac's processor).
# It needs Python 3.11+ and internet (once) to fetch PyInstaller; the finished app needs neither.
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(tr -d '[:space:]' < VERSION)
ARCH=$(uname -m)                                   # x86_64 (Intel) or arm64 (Apple silicon)
echo "Building Keybo $VERSION for $ARCH ..."

python3 -m venv .venv-build
# shellcheck disable=SC1091
source .venv-build/bin/activate
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt -r requirements-build.txt

rm -rf build dist
pyinstaller --noconfirm --clean --distpath dist --workpath build packaging/app.spec

ZIP="dist/Keybo-$VERSION-macos-$ARCH.zip"
ditto -c -k --keepParent dist/Keybo.app "$ZIP"       # ditto keeps the app's permissions and signature intact
echo
echo "Done:"
du -sh dist/Keybo.app | sed 's/^/  app: /'
ls -lh "$ZIP" | awk '{print "  zip: " $9 " (" $5 ")"}'
