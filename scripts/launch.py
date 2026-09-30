"""Starts the server and opens Keybo in a fullscreen window.

On a Mac and on Windows that is the computer's own web view (pywebview: WebKit on a Mac, Edge WebView2 on
Windows), so no browser is needed. On Linux, or when that web view is missing, it is a Chrome or Edge window
in kiosk mode.
Used by start.command (macOS), start.sh (Linux) and start.bat (Windows).
When the parent chooses "Exit" the server stops and the window closes.
"""
import os
import shutil
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# A Windows app built without a console window has no stdout or stderr at all (they are None), and uvicorn's
# logging then crashes when it asks whether the output is a terminal. Give it a bin to write to.
for _name in ("stdout", "stderr"):
    if getattr(sys, _name) is None:
        setattr(sys, _name, open(os.devnull, "w"))

import uvicorn  # noqa: E402

from backend.config import FROZEN, HOME_DIR, HOST, PORT  # noqa: E402

# The browser window's own profile lives with the family's data (a user folder in the packaged app).
BROWSER_PROFILE = HOME_DIR / "data" / "browser-profile"

URL = f"http://{HOST}:{PORT}/"

# Browsers that can open a kiosk (fullscreen, no address bar) window.
BROWSER_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "google-chrome", "chromium", "chromium-browser", "microsoft-edge",
]


def find_browser() -> str | None:
    # APP_BROWSER=/path/to/browser chooses a browser (for example Brave or Edge, or a stand-in in tests).
    if os.environ.get("APP_BROWSER") and os.path.exists(os.environ["APP_BROWSER"]):
        return os.environ["APP_BROWSER"]
    for candidate in BROWSER_CANDIDATES:
        if os.path.isabs(candidate) and os.path.exists(candidate):
            return candidate
        if not os.path.isabs(candidate) and shutil.which(candidate):
            return shutil.which(candidate)
    return None


def who_answers() -> str | None:
    """"keybo" if Keybo's server answers on our port, "other" if some other program does, None if nobody does.
    Another program (or another user on a shared computer) could hold the port first; we must not open its page."""
    try:
        with urllib.request.urlopen(URL + "api/health", timeout=1) as reply:  # nosec B310 - URL is built from the fixed local host and port, never from input
            return "keybo" if json.load(reply).get("app") == "keybo" else "other"
    except urllib.error.HTTPError:
        return "other"
    except (OSError, ValueError, AttributeError):
        # A refused connection means nobody listens; anything that answers but is not our JSON is "other".
        return None if _port_free() else "other"


def _port_free() -> bool:
    import socket
    with socket.socket() as probe:
        probe.settimeout(0.5)
        return probe.connect_ex((HOST, PORT)) != 0


def wait_until_ready(timeout: float = 15) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        if who_answers() == "keybo":
            return True
        time.sleep(0.2)
    return False


def already_running() -> bool:
    """True if Keybo's server already answers (for example the parent double-clicked twice)."""
    return who_answers() == "keybo"


def native_window():
    """The pywebview module when this computer's own web view can show Keybo, or None (then a browser window is used).

    Windows needs Edge WebView2 (part of Windows 11, and of Windows 10 through Edge updates). Without it pywebview
    would quietly use the old Internet Explorer engine, which cannot run Keybo, so then the browser is used.
    Linux is not done yet: its web view has not been checked (downloads, printing, voice).
    """
    if sys.platform not in ("darwin", "win32") or os.environ.get("APP_NO_BROWSER"):
        return None
    try:
        import webview
        if sys.platform == "win32":
            from webview.platforms import winforms
            if not winforms.is_chromium:
                return None
            # Keybo's recorded voice may speak before the first click (the same switch the Chrome window gets below).
            os.environ.setdefault("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--autoplay-policy=no-user-gesture-required")
    except Exception:    # not installed, or its Windows parts (pythonnet, .NET) cannot load
        return None
    webview.settings["ALLOW_DOWNLOADS"] = True   # backups and the class list are saved with a Save dialog
    return webview


def open_native_window(webview) -> None:
    """Shows Keybo fullscreen in the computer's own web view. Blocks until the window is closed."""
    webview.create_window("Keybo", URL, fullscreen=True, background_color="#BFE9FF")   # Keybo's sky, no white flash
    # Private mode (the default) starts with an empty web view each time: Keybo keeps nothing there, and no old
    # copy of a screen can be shown after an update.
    webview.start()


def open_kiosk(server=None):
    """Opens Keybo in a Chrome or Edge kiosk window (or, without either, the normal browser). With `server`, closing
    the packaged app's window stops the server too. Returns the browser process, if there is one."""
    browser = find_browser()
    if browser is None:
        print("Chrome or Edge not found. Opening your normal browser instead.")
        import webbrowser
        webbrowser.open(URL)
        return None
    # Own profile folder = own browser instance, so we can close it on exit.
    process = subprocess.Popen([
        browser, f"--user-data-dir={BROWSER_PROFILE}", "--kiosk", f"--app={URL}",
        "--no-first-run", "--no-default-browser-check", "--disable-translate",
        "--autoplay-policy=no-user-gesture-required",   # Keybo's recorded voice may speak before the first click
    ])
    if FROZEN and server:
        # The packaged app has no Terminal window: when the browser window is closed, Keybo quits.
        started = time.time()

        def quit_with_browser() -> None:
            process.wait()
            if time.time() - started > 10:   # not a browser that handed over to another one and left at once
                server.should_exit = True
        threading.Thread(target=quit_with_browser, daemon=True).start()
    return process


def main() -> None:
    webview = native_window()
    if who_answers() == "other":
        print(f"Port {PORT} is used by another program, so Keybo cannot start. Close that program and try again.")
        sys.exit(1)
    if already_running():
        print("Keybo is already running. Opening it again.")
        if webview:
            open_native_window(webview)
        else:
            open_kiosk()
        return
    from backend.app import app  # imported here so a bad .env shows a clear error

    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="warning")
    server = uvicorn.Server(config)
    app.state.request_shutdown = lambda: setattr(server, "should_exit", True)

    if webview:
        # The window must be on the main thread (a Mac rule), so the server runs next to it. "Exit" in the parent
        # area closes the window; closing the window (or Cmd+Q, Alt+F4) stops the server.
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        if not wait_until_ready():
            print(f"The server did not start. See {HOME_DIR / 'logs' / 'app.log'}")
            return
        app.state.request_shutdown = lambda: [w.destroy() for w in webview.windows]
        print(f"Keybo is running at {URL}  (close it from the parent area, or close the window)")
        try:
            open_native_window(webview)
        except Exception as error:     # for example a damaged WebView2 on Windows: Keybo must still open
            print(f"The app window could not open ({error}). Using a browser window instead.")
            app.state.request_shutdown = lambda: setattr(server, "should_exit", True)
            browser_process = open_kiosk(server)
            try:
                thread.join()
            finally:
                if browser_process and browser_process.poll() is None:
                    browser_process.terminate()
            return
        server.should_exit = True
        thread.join(timeout=5)
        return

    browser_process = None

    def open_browser() -> None:
        nonlocal browser_process
        if not wait_until_ready():
            print(f"The server did not start. See {HOME_DIR / 'logs' / 'app.log'}")
            return
        if os.environ.get("APP_NO_BROWSER"):   # for tests and headless machines: run the server only
            return
        browser_process = open_kiosk(server)

    threading.Thread(target=open_browser, daemon=True).start()
    print(f"Keybo is running at {URL}  (close it from the parent area, or press Ctrl+C here)")
    try:
        server.run()
    finally:
        if browser_process and browser_process.poll() is None:
            browser_process.terminate()


if __name__ == "__main__":
    main()
