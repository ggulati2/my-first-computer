# PyInstaller recipe for the Keybo standalone apps.  Build it with:  scripts/build_mac.sh (Mac)  or  windows/build.bat (Windows).
# PyInstaller cannot build for another system: the Mac app is built on a Mac, the Windows app on Windows (in CI: windows-app.yml).
#
# The app is a normal folder of files (inside Keybo.app on the Mac, dist\Keybo on Windows): a copy of Python, Keybo's libraries, and Keybo's own
# frontend/ and content/ folders. Nothing needs to be installed on the Mac. The family's data is NOT in the
# app; it goes to ~/Library/Application Support/Keybo (see backend/config.py), so updating the app keeps it.
import sys
from pathlib import Path

ROOT = Path(SPECPATH).parent
VERSION = (ROOT / "VERSION").read_text().strip()

analysis = Analysis(
    [str(ROOT / "scripts" / "launch.py")],
    pathex=[str(ROOT)],
    datas=[(str(ROOT / "frontend"), "frontend"), (str(ROOT / "content"), "content"), (str(ROOT / "VERSION"), "."),
           (str(ROOT / "branding.json"), ".")],
    # uvicorn picks these by name at run time, so PyInstaller cannot see them by reading the code.
    hiddenimports=["backend.app", "uvicorn.logging", "uvicorn.loops.auto", "uvicorn.loops.asyncio",
                   "uvicorn.protocols.http.auto", "uvicorn.protocols.http.h11_impl",
                   "uvicorn.protocols.websockets.auto", "uvicorn.lifespan.on"],
    excludes=["tkinter", "pytest", "unittest.mock"],
)
archive = PYZ(analysis.pure)
# console=False: no black terminal window behind the app.
executable = EXE(archive, analysis.scripts, [], exclude_binaries=True, name="Keybo", console=False,
                 icon=str(ROOT / "windows" / "app.ico") if sys.platform == "win32" else None)
collected = COLLECT(executable, analysis.binaries, analysis.datas, name="Keybo")
if sys.platform == "darwin":
  app = BUNDLE(
      collected,
      name="Keybo.app",
      icon=str(ROOT / "packaging" / "app.icns"),
      bundle_identifier="io.github.ggulati2.keybo",
      version=VERSION,
      info_plist={
          "CFBundleName": "Keybo",
          "CFBundleDisplayName": "Keybo",
          "CFBundleShortVersionString": VERSION,
          "NSHighResolutionCapable": True,
          "LSMinimumSystemVersion": "10.15",
          "LSApplicationCategoryType": "public.app-category.education",
      },
  )
