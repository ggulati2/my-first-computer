"""The "Copy diagnostics" text in the parent area's Data tab.

A parent can paste it into a bug report. It holds the version, the system and the last lines of the log, and
nothing about the child: no names, no progress, no settings values. Folder paths are shortened so the computer's
user name does not travel with it. The parent sees the whole text before sharing it.
"""
import platform
import sys
from pathlib import Path

from backend.config import APP_NAME, FROZEN, HOME_DIR, LOG_DIR, ROOT

LOG_LINES = 60
LOG_TAIL_BYTES = 64 * 1024   # never read a whole large log just for its end


def version() -> str:
    try:
        return (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    except OSError:
        return "unknown"


def _hide_paths(text: str) -> str:
    """Replace the family folder and the user's home folder, longest first, so no user name is left."""
    for folder, label in ((HOME_DIR, "<keybo-folder>"), (Path.home(), "<home>")):
        text = text.replace(str(folder), label)
    return text


def log_tail() -> str:
    path = LOG_DIR / "app.log"
    try:
        with open(path, "rb") as file:
            file.seek(0, 2)
            file.seek(max(0, file.tell() - LOG_TAIL_BYTES))
            lines = file.read().decode("utf-8", errors="replace").splitlines()
    except OSError:
        return "(no log yet)"
    return "\n".join(lines[-LOG_LINES:]) or "(log is empty)"


def report(llm_status: dict, profile_count: int, language: str) -> str:
    head = [
        f"{APP_NAME} {version()}  ({'packaged app' if FROZEN else 'from source'})",
        f"System: {platform.system()} {platform.release()} ({platform.machine()}), Python {sys.version.split()[0]}",
        f"Language: {language}   Children: {profile_count}",
        f"Online helper: mode {llm_status['mode']}, key set {llm_status['key_set']}, consent {llm_status['consent']}, "
        f"last error '{llm_status['last_error']}', requests today {llm_status['requests']}/{llm_status['cap']}",
        "",
        f"Last lines of the log (up to {LOG_LINES}):",
    ]
    return _hide_paths("\n".join(head) + "\n" + log_tail()) + "\n"
