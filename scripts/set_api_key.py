"""Saves your own OpenRouter key in this computer's keychain, so it does not have to sit in a file.

    python scripts/set_api_key.py            asks for the key (it is not shown while you type) and saves it
    python scripts/set_api_key.py --remove   removes it again

The app reads it from there when the online helper is on (LLM_MODE=openrouter in .env) and OPENROUTER_API_KEY is not
set. It uses macOS Keychain, Windows Credential Manager or the Linux Secret Service. There is no built-in key: every
family or school uses its own, from https://openrouter.ai/keys (set a spending limit there).
"""
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import keyring  # noqa: E402

from backend.config import KEYCHAIN_ENTRY, KEYCHAIN_SERVICE  # noqa: E402


def main() -> None:
    if "--remove" in sys.argv:
        try:
            keyring.delete_password(KEYCHAIN_SERVICE, KEYCHAIN_ENTRY)
            print("The OpenRouter key was removed from this computer's keychain.")
        except keyring.errors.PasswordDeleteError:
            print("There was no OpenRouter key in this computer's keychain.")
        return
    key = getpass.getpass("Paste your OpenRouter key (it is not shown): ").strip()
    if not key:
        sys.exit("Nothing was saved.")
    if not key.startswith("sk-or-"):
        print("Note: OpenRouter keys usually start with sk-or-. Saving it anyway.")
    keyring.set_password(KEYCHAIN_SERVICE, KEYCHAIN_ENTRY, key)   # the key itself is never printed or written to a file
    print("Saved in this computer's keychain. Set LLM_MODE=openrouter in .env and switch the helper on in the parent area.")


if __name__ == "__main__":
    main()
