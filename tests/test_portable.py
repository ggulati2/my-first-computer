"""Portable mode: a "portable-data" folder next to the program keeps all of Keybo's files on the USB stick."""
from pathlib import Path

from backend import config


def test_a_portable_data_folder_next_to_the_windows_program_is_used(tmp_path):
    exe = tmp_path / "Keybo" / "Keybo.exe"
    exe.parent.mkdir()
    assert config.portable_dir(exe, "win32") is None                       # no folder: the normal user folder
    (exe.parent / "portable-data").mkdir()
    assert config.portable_dir(exe, "win32") == exe.parent / "portable-data"


def test_on_a_mac_the_folder_sits_next_to_the_app(tmp_path):
    exe = tmp_path / "Keybo.app" / "Contents" / "MacOS" / "Keybo"
    exe.parent.mkdir(parents=True)
    (tmp_path / "portable-data").mkdir()
    assert config.portable_dir(exe, "darwin") == tmp_path / "portable-data"


def test_a_file_with_that_name_is_not_a_portable_folder(tmp_path):
    exe = tmp_path / "Keybo.exe"
    (tmp_path / "portable-data").write_text("")
    assert config.portable_dir(Path(exe), "win32") is None
