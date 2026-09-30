"""The first-run setup token.

Until a PIN exists, /api/setup lets whoever calls it choose the PIN. On a computer shared with other people
(a school, a family PC) another program could do that before the parent does. So the launcher (scripts/launch.py)
makes a random token when it starts Keybo and gives it only to its own window, as part of the page address
(#setup=...), which is never sent over the network. /api/setup then needs it. The token is also kept in a file only
the user can read, so a second double-click on the Keybo icon can open the same setup.

It is used only when the launcher started the server. Starting the server by hand (uvicorn, the tests) does not
ask for a token. Once a PIN exists the token is deleted.
"""
import os
import secrets

from backend.config import DATA_DIR

ENV = "APP_SETUP_TOKEN"
FILE = DATA_DIR / "setup-token"


def issue() -> str:
    """Make a new token for this start: in the environment (what the server checks) and in a private file."""
    token = secrets.token_urlsafe(16)
    os.environ[ENV] = token
    FILE.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="ascii") as file:
        file.write(token)
    return token


def read() -> str:
    """The token of the Keybo that is running, or "" if there is none (setup is done)."""
    try:
        return FILE.read_text(encoding="ascii").strip()
    except OSError:
        return ""


def expected() -> str:
    return os.environ.get(ENV, "")


def clear() -> None:
    os.environ.pop(ENV, None)
    try:
        FILE.unlink()
    except OSError:
        pass
