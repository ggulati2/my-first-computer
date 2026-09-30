# Building Keybo

How the downloadable apps are made (docs/DESIGN.md section 4.6). Families and schools do not need any of
this: they download a finished app from the Releases page. This page is for whoever builds a release.

## What gets built

| System | Built by | Result | Where the family's data goes |
|---|---|---|---|
| Windows | `.github/workflows/windows-app.yml` (or `windows\build.bat` on Windows) | `Keybo-Setup-<version>.exe` (installer) and a portable zip with `Keybo.exe` | `%APPDATA%\Keybo` |
| Mac, Apple silicon | `.github/workflows/mac-app.yml` | `Keybo-<version>-macos-arm64.zip` with `Keybo.app` | `~/Library/Application Support/Keybo` |
| Mac, Intel | `scripts/build_mac.sh` on an Intel Mac | `Keybo-<version>-macos-x86_64.zip` | as above |
| Linux (x86_64) | `.github/workflows/linux-app.yml` | `Keybo-<version>-linux-x86_64.tar.gz` with a `Keybo` folder | `~/.local/share/keybo` |

All of them are the same PyInstaller recipe (`packaging/app.spec`): a copy of Python, Keybo's libraries and its
`frontend/` and `content/` folders. Nothing needs to be installed, and the app works without internet. The data lives
outside the app, so installing a new version keeps every child's progress.

PyInstaller can only build for the system (and processor) it runs on, which is why each system has its own build.

## Making a release

1. Update `VERSION` and `CHANGELOG.md` on `main` (through a pull request), then push a tag with the same number, for
   example `git tag v0.2.0` and `git push origin v0.2.0`. Only the maintainer can create `v*` tags.
2. `release.yml` checks that the tag matches `VERSION` and is on `main`, runs every test, then builds the source zip and
   the Windows, Mac (Apple silicon) and Linux apps, testing each one (below).
3. Its last step runs in the protected `release` environment (it waits for the maintainer's approval): it writes
   `SHA256SUMS.txt`, adds a signed build-provenance attestation for every file, and creates a **draft** release.
4. Build the Intel Mac app by hand with `scripts/build_mac.sh` on an Intel Mac (GitHub has no Intel Mac machines),
   test it, add its zip to the draft and its checksum line to `SHA256SUMS.txt`. It has no provenance attestation,
   because it was not built on GitHub.
5. Nothing is public until you open the draft on GitHub and press "Publish release".

A test build without a release: Actions tab → pick a workflow → "Run workflow". Its files are kept for 14 days.

## How a built app is tested

- **Smoke test** (every build, in CI): `packaging/smoke_mac.sh <path to the app's program>` (Mac and Linux) or
  `windows\smoke-test.ps1`. It starts the app without a window and checks it serves Keybo, its protective headers,
  the settings, the scripts, and the built-in content.
- **The whole browser test suite against the built app** (by hand, before a release):
  `APP_BINARY=dist/Keybo.app/Contents/MacOS/Keybo python -m pytest -m browser`. The same 22 tests that play
  every level and drive the parent area then run against the app instead of the source code.

## The window

The packaged app starts Keybo's small local server and opens it in a fullscreen window. Closing the window, or "Exit"
in the parent area, quits Keybo.

- **Mac:** the Mac's own web view (`pywebview`, the engine inside Safari), so Chrome is not needed. Checked on macOS
  26 (Intel): the recordings (Ogg Opus) play, also before the first tap; the built-in voices are there (German
  "Anna"); `window.print()` opens the print dialog; saving a backup or a CSV opens a Save dialog. If `pywebview` is
  missing (for example an old source install), the Chrome or Edge window below is used instead.
- **Windows:** Windows' own web view (Edge WebView2, part of Windows 11 and of Windows 10 through Edge updates).
  Without WebView2, or if it fails to start, Keybo opens in Chrome or Edge instead (pywebview would otherwise use
  the old Internet Explorer engine, which cannot run Keybo). Recordings may play before the first click
  (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--autoplay-policy=no-user-gesture-required`); saving a backup opens the
  Windows Save dialog.
- **Linux:** Chrome or Edge in **kiosk mode** (fullscreen, no address bar); without either, the normal browser.

`scripts/check_window.py` checks the packaged app's own window after every Mac and Windows build in CI: the app
loads, recordings play before any click, the computer's voices are listed, "Exit" quits, and no browser is used.
(Printing and the Save dialog need a person; they were checked by hand on a Mac.)

Keybo's security rules forbid `eval` in the page, which `pywebview`'s own script bridge would need. Keybo does not use
the bridge (it talks to its server over HTTP), and the print hook is added natively, so nothing is lost.

## Portable mode (schools, USB sticks)

Create an empty folder called `portable-data` next to the program (next to `Keybo.exe` on Windows, next to `Keybo.app`
on a Mac). Keybo then keeps everything in that folder instead of the user's folder.

## Signing

The apps are not code-signed with paid certificates (an Apple Developer ID, a Windows code-signing certificate), so
the first start shows a warning: on a Mac "Open Anyway" in System Settings → Privacy & Security, on Windows "More info"
→ "Run anyway". The README explains both. Signing is worth doing before handing Keybo to schools, whose IT often blocks
unsigned programs.
