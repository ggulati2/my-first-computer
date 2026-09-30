"""The parent area's "Check for updates" button.

The only place besides the online helper (backend/llm/client.py) that talks to the internet, and it does so only
when a parent presses the button, never on its own. It asks GitHub for the list of Keybo releases (an anonymous
request: no account, no data about the child or this computer; GitHub sees the usual IP address of any web request).
Only a plain version number from the answer is used. The page to download from is fixed in this file.
"""
import re

import httpx

REPO = "ggulati2/my-first-computer"   # change together with the repository's name
RELEASES_API = f"https://api.github.com/repos/{REPO}/releases?per_page=10"
RELEASES_PAGE = f"https://github.com/{REPO}/releases"
TIMEOUT_SECONDS = 6.0
_TAG = re.compile(r"v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})")


def _numbers(version: str) -> tuple[int, int, int] | None:
    found = _TAG.fullmatch(version.strip())
    return tuple(int(part) for part in found.groups()) if found else None


def newest(releases) -> str | None:
    """The highest version number among published releases (pre-releases count: Keybo is below 1.0.0)."""
    if not isinstance(releases, list):
        return None
    versions = []
    for release in releases:
        if isinstance(release, dict) and not release.get("draft") and isinstance(release.get("tag_name"), str):
            numbers = _numbers(release["tag_name"])
            if numbers:
                versions.append(numbers)
    return ".".join(map(str, max(versions))) if versions else None


def check(current: str, transport: httpx.BaseTransport | None = None) -> dict:
    """Never raises. {"ok": False} if GitHub cannot be reached or answers with something unexpected."""
    try:
        with httpx.Client(timeout=TIMEOUT_SECONDS, transport=transport) as http:
            response = http.get(RELEASES_API, headers={"Accept": "application/vnd.github+json", "User-Agent": "Keybo-update-check"})
        latest = newest(response.json()) if response.status_code == 200 else None
    except (httpx.HTTPError, ValueError):
        latest = None
    if latest is None:
        return {"ok": False}
    have = _numbers(current)
    return {"ok": True, "current": current, "latest": latest, "newer": have is not None and _numbers(latest) > have,
            "page": RELEASES_PAGE}
