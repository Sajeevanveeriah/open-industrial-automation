# Windows x64 release verification

4 November 2026. Windows 11 Home Insider Preview 10.0.26340, 64-bit. Electron 45.2.2, Chromium 156.0.8078.80. Rendered workshop viewport 1266 × 787 CSS pixels. Native converter FreeCAD 1.1.4. NVIDIA GeForce RTX 4060 Laptop GPU with 8188 MiB, driver 621.01.

| Item | Observed result |
|---|---|
| Installer | OIA-Workshop-0.1.1-Windows-x64.exe, 124321374 bytes. SHA-256 5106900E825D7B4A81008AABC6064F690CC10F7F92D6DB472F36527F0CFD47C3. PowerShell Get-AuthenticodeSignature returned NotSigned. |
| Packaging | electron-builder 26.18.0, NSIS x64. Windows build exited 0. |
| Upgrade | Installed 0.1.0 into an empty test directory. The 0.1.1 installer upgraded that installation, exit 0. HKCU uninstall registration reported 0.1.1 and the pre-existing project hash was unchanged. |
| Web bundle identity | Frozen browser and installed resources/site/workshop/workshop.mjs both SHA-256 15FAEB24DBDD6C4159BB732F0CA55C1EC5CE49E92907E4515E649805903632BD. |
| Ordinary Start menu launch | Launched the generated .lnk without any test switches. The actual application window title was “Packaging workshop &#124; Open Industrial Automation”. Windows UI Automation read Packaging workshop, Asset inspector, New blank cell, Place asset, Project cabinet and Step 1 scan. The instance closed normally. Repeated after a clean install. |
| Offline renderer | Separate installed-process test used --workshop-test-hidden and an isolated test profile, enabled Chromium offline emulation, reloaded the workshop and waited for the initialised controls. Created a blank project and placed transfer-belt. |
| Native STEP dialog and kernel | Opened CAD and engine workspace and pressed Import STEP with FreeCAD. The test selected photoeye-assembly.step through the real Windows Open dialog. The installed application reported measured width 0.100 m. |
| Native project and cross-platform interchange | On Windows, Export project wrote the new conveyor project to disk. Open project restored it after a blank reset. Microsoft Edge opened the exported file, retained the conveyor, added a notebook entry and downloaded a second project. Windows reopened that download and displayed the new notebook entry. Native project Save/Open dialog choices were supplied by the test harness. All serialisation, native reads, writes and shared format validation executed. |
| Shared CAD and SQL | Installed offline Open CASCADE bench measured 0.1000 × 0.0400 × 0.0500 m. The SQLite worker evaluated SELECT 13 * 11 AS product and returned 143 in one row. No renderer page errors were recorded by the test. |
| Engine detection | Reported that Isaac Sim workstation was absent from the standard installation directory on this host. No specialist runtime was installed. |
| Uninstall | Upgrade-path uninstall returned 0. The application, Start menu link and HKCU registration were gone. The external project remained SHA-256 994E332770ED30F700E6B59516C718B101193FAFB612A130A9CD3971E15136B1. |
| Clean final install | After uninstall, installed 0.1.1 into a different empty directory, exit 0. Verified its bundle hash and ordinary Start menu controls. Uninstalled normally, exit 0. The executable was removed and the external project retained the same SHA-256. |

## Reproduce

Build the installer using the Windows README. An installer hash identifies a specific build; a new unsigned installer can carry different timestamps. In a Windows test account with FreeCAD and Microsoft Edge, install the prior pilot, export a project outside the installation directory, upgrade and run these commands from windows:

```powershell
$env:OIA_FREECAD_TEST='1'
npm test
node verify.cjs "$installFolder/Industrial Engineering Workshop.exe"
./start-menu.test.ps1 -InstallFolder $installFolder
```

Set $installFolder to the test installation location. The five native tests passed with zero failures or skips. The real native picker test is restricted to the bundled photoeye STEP fixture and the test application's process. The screenshot in this folder is the installed Windows renderer after the browser-to-Windows round trip. Uninstall, confirm the project checksum and repeat from a clean test installation.

## Boundaries

The initial 0.1.0 pilot showed a startup error when the test harness reloaded during first navigation. Release 0.1.1 waits for rendered controls and handles interrupted initial navigation. The verified 0.1.1 shortcut paths above used normal launch.

Offline evidence covers Chromium offline emulation and the application's network restrictions. The Windows network adapter remained connected. A fresh Windows virtual machine, forced operating system crash, SmartScreen reputation, physical robot and genuine Isaac run were not tested. The Kit launch, stop, measured performance and live result path still require a compatible separately installed workstation. The local GPU is below NVIDIA's listed 16 GB minimum for Isaac Sim 6.2.0. External recordings cannot authenticate their own provenance. The pilot evaluates USD transforms. It does not verify external rigid-body dynamics.

[Isaac Sim 6.2.0 system requirements](https://docs.isaacsim.omniverse.nvidia.com/6.2.0/installation/requirements.html) and [licence index](https://docs.isaacsim.omniverse.nvidia.com/6.2.0/common/legal.html), read 4 November 2026.
