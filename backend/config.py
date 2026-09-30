"""Settings loaded from the `.env` file in the project root.

We read `.env` with a tiny parser instead of adding a dependency.
The OpenRouter key is read here, on the backend only. It is never sent to the browser.
"""
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

from backend import languages

# The packaged app (built with PyInstaller, see packaging/) keeps its code and content inside the app
# bundle, which is read-only and replaced on every update. The family's own files (database, logs,
# the browser window's profile, an optional .env) therefore live in a normal user folder. Running from
# the source folder works as before: everything stays next to the code.
FROZEN = bool(getattr(sys, "frozen", False))
ROOT = Path(sys._MEIPASS) if FROZEN else Path(__file__).resolve().parent.parent   # code and content
# The app's (and mascot's) name, from the one file to edit when renaming (docs/DESIGN.md section 4.7).
APP_NAME = json.loads((ROOT / "branding.json").read_text(encoding="utf-8"))["mascotName"]


PORTABLE_FOLDER = "portable-data"


def portable_dir(executable: Path, platform: str) -> Path | None:
    """Portable mode (docs/DESIGN.md section 4.6, for schools and USB sticks): a folder called
    "portable-data" next to the program makes Keybo keep everything in it instead of the user's folder.
    On a Mac the program is Keybo.app/Contents/MacOS/Keybo, so "next to it" means next to Keybo.app."""
    beside = executable.parents[3] if platform == "darwin" and len(executable.parents) > 3 else executable.parent
    folder = beside / PORTABLE_FOLDER
    return folder if folder.is_dir() else None


def _home_dir() -> Path:
    """Where the family's files live. APP_HOME overrides it (used by the tests)."""
    if os.environ.get("APP_HOME"):
        return Path(os.environ["APP_HOME"])
    if not FROZEN:
        return ROOT
    portable = portable_dir(Path(sys.executable), sys.platform)
    if portable:
        return portable
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Keybo"
    if sys.platform == "win32":
        return Path(os.environ.get("APPDATA", str(Path.home()))) / "Keybo"
    return Path.home() / ".local" / "share" / "keybo"


HOME_DIR = _home_dir()
DATA_DIR = HOME_DIR / "data"
LOG_DIR = HOME_DIR / "logs"
# The two overrides below exist for the automatic browser tests (own port, own copy of the frontend).
FRONTEND_DIR = Path(os.environ.get("APP_FRONTEND_DIR", ROOT / "frontend"))
CONTENT_DIR = ROOT / "content"

HOST = "127.0.0.1"  # Never change this: it keeps the app private to this computer.
PORT = int(os.environ.get("APP_PORT", "8765"))
# Free models (":free") from two providers, compared on Keybo's real tasks with
# scripts/try_models.py (2026-09-19): Nemotron was fastest and best in German; DeepSeek got
# the most English words and sentences through. Google's Gemma free models answered
# HTTP 429 (no capacity) at that time. Results change, so re-run the script now and then.
DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"
DEFAULT_FALLBACK_MODEL = "deepseek/deepseek-v4-flash-0731:free"


def _to_int(text: str, default: int) -> int:
    try:
        return max(0, int(text))
    except ValueError:
        return default


def _read_env_file(path: Path) -> dict:
    """Read KEY=value lines. Ignores blank lines and lines starting with #."""
    values = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


@dataclass(frozen=True)
class Settings:
    openrouter_api_key: str
    openrouter_model: str
    openrouter_fallback_model: str
    app_language: str  # a code from backend/languages.py
    parent_pin: str
    llm_mode: str  # "off" (built-in content only), "mock" (fake LLM, for development) or "live"
    daily_request_cap: int  # most OpenRouter requests per day, so a bug can never run up a bill
    db_path: Path


# The OpenRouter key may also live in the computer's own keychain (macOS Keychain, Windows Credential Manager, Linux
# Secret Service) instead of a file: scripts/set_api_key.py puts it there. There is never a built-in key: every
# family or school brings its own.
KEYCHAIN_SERVICE = "my-first-computer"
KEYCHAIN_ENTRY = "openrouter_api_key"
MISSING_KEY = ("The online helper is switched on (LLM_MODE=openrouter) but there is no OpenRouter key. Set OPENROUTER_API_KEY "
               "in .env or the environment, or run: python scripts/set_api_key.py. Until then only built-in content is used.")


def key_from_keychain() -> str:
    """The OpenRouter key from the keychain, or "" if there is none (or no keychain on this computer)."""
    try:
        import keyring
        return keyring.get_password(KEYCHAIN_SERVICE, KEYCHAIN_ENTRY) or ""
    except Exception:   # for example a Linux machine without a keychain service: the environment or .env is used
        return ""


def load_settings() -> Settings:
    """Environment variables win over the .env file, so tests can override."""
    file_values = _read_env_file(HOME_DIR / ".env")

    def get(key: str, default: str = "") -> str:
        return os.environ.get(key, file_values.get(key, default))

    language = get("APP_LANGUAGE", "en").lower()
    if not languages.is_language(language):
        language = languages.DEFAULT
    mode = get("LLM_MODE", "off").lower()
    if mode == "openrouter":   # the name docs/DESIGN.md section 4.1 uses; "live" (older .env files) means the same
        mode = "live"
    if mode not in ("off", "mock", "live"):
        mode = "off"
    # The keychain is only asked when the online helper is on, so an offline install never touches it.
    key = get("OPENROUTER_API_KEY") or (key_from_keychain() if mode == "live" else "")
    return Settings(
        openrouter_api_key=key,
        openrouter_model=get("OPENROUTER_MODEL") or DEFAULT_MODEL,
        openrouter_fallback_model=get("OPENROUTER_FALLBACK_MODEL") or DEFAULT_FALLBACK_MODEL,
        app_language=language,
        parent_pin=get("PARENT_PIN"),  # empty = the parent chooses one on first start
        llm_mode=mode,
        daily_request_cap=_to_int(get("DAILY_REQUEST_CAP", "45"), 45),
        db_path=Path(get("APP_DB_PATH", str(DATA_DIR / "app.db"))),
    )
