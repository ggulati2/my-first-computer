"""Bring your own OpenRouter key: from the environment or .env, or from the computer's keychain (backend/config.py).
There is no built-in key anywhere, and the keychain is only asked when the online helper is switched on."""
import sys
import types

import pytest

from backend import config


@pytest.fixture()
def keychain(monkeypatch, tmp_path):
    """A stand-in for the `keyring` library that records who asked, with no .env file in the way."""
    asked = []
    fake = types.SimpleNamespace(get_password=lambda service, entry: asked.append((service, entry)) or fake.stored, stored="sk-or-from-keychain")
    monkeypatch.setitem(sys.modules, "keyring", fake)
    monkeypatch.setattr(config, "HOME_DIR", tmp_path)
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    fake.asked = asked
    return fake


def test_the_environment_wins_and_the_keychain_is_not_asked(keychain, monkeypatch):
    monkeypatch.setenv("LLM_MODE", "openrouter")
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-from-environment")
    assert config.load_settings().openrouter_api_key == "sk-or-from-environment" and keychain.asked == []


def test_with_the_helper_on_the_keychain_key_is_used(keychain, monkeypatch):
    monkeypatch.setenv("LLM_MODE", "openrouter")
    assert config.load_settings().openrouter_api_key == "sk-or-from-keychain"
    assert keychain.asked == [(config.KEYCHAIN_SERVICE, config.KEYCHAIN_ENTRY)]


def test_an_offline_install_never_touches_the_keychain(keychain, monkeypatch):
    monkeypatch.setenv("LLM_MODE", "off")
    assert config.load_settings().openrouter_api_key == "" and keychain.asked == []


def test_a_missing_or_broken_keychain_means_no_key(keychain, monkeypatch):
    monkeypatch.setenv("LLM_MODE", "openrouter")
    keychain.get_password = lambda *args: (_ for _ in ()).throw(RuntimeError("no keychain service"))
    assert config.load_settings().openrouter_api_key == ""


def test_a_missing_key_is_explained_without_any_key(keychain, monkeypatch, capsys):
    monkeypatch.setenv("LLM_MODE", "openrouter")
    monkeypatch.setenv("APP_DB_PATH", str(config.HOME_DIR / "app.db"))
    keychain.stored = None
    from backend.app import create_app
    create_app()
    printed = capsys.readouterr().out
    assert "scripts/set_api_key.py" in printed and "OPENROUTER_API_KEY" in printed and "sk-or-" not in printed
