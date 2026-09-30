"""Checks the packaged app's own window (pywebview) on this computer: used in CI after building the app.

    python scripts/check_window.py dist/Keybo/Keybo.exe          (Windows)
    python scripts/check_window.py dist/Keybo.app/Contents/MacOS/Keybo

1. Opens Keybo in the same kind of window the app uses (set up by launch.native_window) and asks the page what
   works there: the app itself, the recorded voice (Ogg Opus) before any click, and the computer's own voices.
2. Starts the real app, presses "Exit" through the parent area's API, and checks that the app quits and that it
   used its own window, not a browser.
It prints what it found and fails only on what every computer must do (the app loads, Exit quits, no browser);
sound depends on the machine (a cloud machine may have no sound card), so it is reported, not required.
"""
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

PORT = "8797"                          # each check uses its own port, so the second never meets the first one's server
URL = f"http://127.0.0.1:{PORT}"
ROOT = Path(__file__).resolve().parent.parent

PAGE_CHECK = """window.__check = null; (async () => {
  const r = { app: typeof openWorld === "function", speech: "speechSynthesis" in window };
  await new Promise((ok) => setTimeout(ok, 1500));
  const voices = r.speech ? speechSynthesis.getVoices() : [];
  r.localVoices = voices.filter((v) => v.localService).map((v) => v.lang + " " + v.name).slice(0, 8);
  r.oggOpus = new Audio().canPlayType('audio/ogg; codecs=opus');
  const first = await fetch("voice/en/index.json").then((res) => res.json()).then((index) => index.clips[0]);
  r.autoplay = await new Audio("voice/en/" + first + ".ogg").play().then(() => "played", (e) => "refused: " + e.name);
  window.__check = JSON.stringify(r);
})();"""


def use_port(port: str) -> None:
    global PORT, URL
    PORT, URL = port, f"http://127.0.0.1:{port}"


def call(path: str, body: dict | None = None, token: str = "", extra: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json", **({"X-Parent-Token": token} if token else {}), **(extra or {})}
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(URL + path, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(request, timeout=10) as answer:   # nosec B310 - a fixed local address
        return json.loads(answer.read() or b"{}")


def wait_for_server(seconds: float = 60) -> None:
    end = time.time() + seconds
    while time.time() < end:
        try:
            urllib.request.urlopen(URL, timeout=1)             # nosec B310 - a fixed local address
            return
        except Exception:
            time.sleep(0.3)
    raise SystemExit("FAIL: the app's server did not start")


def start(app: str, home: str, **extra: str) -> subprocess.Popen:
    env = {**os.environ, "APP_HOME": home, "APP_PORT": PORT, "LLM_MODE": "off", **extra}
    process = subprocess.Popen([app], env=env)
    wait_for_server()
    return process


def check_page(app: str) -> dict:
    """The page inside the window: run in this process, with the window set up exactly as launch.py does."""
    sys.path.insert(0, str(ROOT / "scripts"))
    import launch
    webview = launch.native_window()
    if webview is None:
        raise SystemExit("FAIL: this computer cannot show the app's own window (on Windows: no Edge WebView2)")
    home = tempfile.mkdtemp()
    server = start(app, home, APP_NO_BROWSER="1")
    found: dict = {}

    def probe(window) -> None:
        time.sleep(3)
        window.run_js(PAGE_CHECK)                               # run natively: the page's rules forbid eval
        for _ in range(40):
            time.sleep(0.5)
            result = window.run_js("window.__check")
            if result:
                found.update(json.loads(result))
                break
        window.destroy()

    threading.Timer(90, lambda: os._exit(3)).start()           # never hang a CI job
    window = webview.create_window("Keybo check", URL + "/", width=1000, height=700)
    webview.start(probe, window)
    server.terminate()
    server.wait(timeout=20)
    return found


def check_exit(app: str) -> dict:
    """The real app: it opens its own window, and "Exit" in the parent area quits it."""
    use_port("8798")
    home = tempfile.mkdtemp()
    process = start(app, home)
    setup_token = (Path(home) / "data" / "setup-token").read_text().strip()       # the launcher's first-run token
    call("/api/setup", {"pin": "2468", "language": "en", "daily_limit_minutes": 0}, extra={"X-Setup-Token": setup_token})
    token = call("/api/parent/verify", {"pin": "2468"})["token"]
    time.sleep(5)                                               # the window opens
    still_running = process.poll() is None
    call("/api/parent/exit", {}, token)
    try:
        process.wait(timeout=20)
        quit_cleanly = True
    except subprocess.TimeoutExpired:
        process.kill()
        quit_cleanly = False
    browser_used = (Path(home) / "data" / "browser-profile").exists()
    return {"running_before_exit": still_running, "quit_on_exit": quit_cleanly, "browser_used": browser_used}


def main() -> None:
    app = sys.argv[1]
    page = check_page(app)
    print("Page in the app window:", json.dumps(page, indent=2))
    exit_check = check_exit(app)
    print("Exit:", json.dumps(exit_check, indent=2))
    problems = [text for ok, text in [
        (page.get("app"), "the app did not load in the window"),
        (exit_check["running_before_exit"], "the app stopped before Exit was pressed"),
        (exit_check["quit_on_exit"], "the app did not quit after Exit"),
        (not exit_check["browser_used"], "the app used a browser window instead of its own window"),
    ] if not ok]
    for text in problems:
        print("FAIL:", text)
    if not problems:
        print("OK: the app's own window works here.")
    sys.stdout.flush()                                          # os._exit (the window library's threads stay) skips it
    os._exit(1 if problems else 0)


if __name__ == "__main__":
    main()
