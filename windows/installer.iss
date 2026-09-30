; Inno Setup recipe: turns the PyInstaller folder (dist\Keybo) into ONE installer file, Keybo-Setup.exe.
; Built in CI by .github/workflows/windows-app.yml; locally: windows\build.bat (needs Inno Setup).
; The installer needs no administrator rights: it installs for the current user only.
#define AppVersion GetEnv("APP_VERSION")

[Setup]
AppId={{6F0E5D3C-2B7A-4C1E-9D55-7A1B3F0C2E11}
AppName=Keybo
AppVersion={#AppVersion}
AppPublisher=Keybo
DefaultDirName={localappdata}\Programs\Keybo
DefaultGroupName=Keybo
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=Keybo-Setup-{#AppVersion}
SetupIconFile=app.ico
UninstallDisplayIcon={app}\Keybo.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64compatible

[Tasks]
Name: "desktopicon"; Description: "Put a Keybo icon on the desktop"; Flags: checkedonce

[Files]
Source: "..\dist\Keybo\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{userprograms}\Keybo"; Filename: "{app}\Keybo.exe"
Name: "{userdesktop}\Keybo"; Filename: "{app}\Keybo.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\Keybo.exe"; Description: "Start Keybo now"; Flags: nowait postinstall skipifsilent

; The family's data (progress, PIN, settings) is in %APPDATA%\Keybo and is deliberately NOT removed when Keybo is
; uninstalled or updated, so installing a newer version keeps everything.
