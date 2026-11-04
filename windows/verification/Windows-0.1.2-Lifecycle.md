# Windows 0.1.2 lifecycle verification

4 November 2026. Windows 11 Home Insider Preview 10.0.26340 x64. Electron 45.2.2, Chromium 156.0.8078.80. On-screen workshop viewport 1266 × 787 CSS pixels.

| Check | Observed result |
|---|---|
| Installer | OIA-Workshop-0.1.2-Windows-x64.exe. 124321776 bytes. SHA-256 5EDDE695926DC341282F9E193336958381147EA25E53ACB438F02C354D40252B. PowerShell Get-AuthenticodeSignature returned NotSigned. |
| Isolation | Preflight found no active workshop process, existing Start menu shortcut or registered installation. Both installs used new directories. All launches used separate test profiles. |
| Upgrade | Installed original 0.1.1 (SHA-256 5106900E825D7B4A81008AABC6064F690CC10F7F92D6DB472F36527F0CFD47C3) then upgraded in place to 0.1.2. Both installers exited 0. |
| Installed bundle | Compared all 133 files in the browser build against their installed counterparts. Zero byte differences. Main workshop module SHA-256 45C9B8D875C28D99D76EB5384945404C7BCD5E00C522CA39231F8EDC5C0A4D45. Commissioning register module SHA-256 F0860ECA4522F29D22B0A2B502AE2EB1728A34C3938F16DD51CBFD0001CFDC8B. |
| Startup and commissioning header | Held each page's initialisation module while loading it in the installed renderer. Both packaging and commissioning bodies were inert and enclosed their header links. Both became active after their module was released. |
| Start menu launch | On both upgraded and clean installs, launched the installed .lnk normally with --user-data-dir as the sole argument. Windows UI Automation read Packaging workshop, Asset inspector, New blank cell, Place asset, Project cabinet and Step 1 scan. Both visible windows closed normally. Both launches created their isolated profile storage. |
| Offline and interchange | Separate installed-process run used --workshop-test-hidden with a dedicated QA profile. After Chromium offline emulation and reload, Windows created, exported and reopened transfer-belt. Microsoft Edge imported it, edited the notebook and exported. Windows reopened the browser result and recovered the new entry. Native project read/write and shared schema validation ran, with project file dialog choices supplied by the harness. |
| Native STEP and shared workspaces | The real Windows Open dialog selected the bundled photoeye STEP assembly. FreeCAD returned width 0.100 m. The offline WebAssembly CAD bench measured 0.1000 × 0.0400 × 0.0500 m. SQLite evaluated SELECT 13 * 11 AS product to 143 in one row. No renderer page errors were observed. |
| Uninstall | Upgrade-path uninstall exited 0, removing the app and shortcut. A second clean install into a different empty directory exited 0. After its successful Start menu launch, uninstall exited 0. No executable, shortcut or registration remained. The external project retained SHA-256 994E332770ED30F700E6B59516C718B101193FAFB612A130A9CD3971E15136B1 before upgrade and after both uninstalls. |
| Native tests | npm test with OIA_FREECAD_TEST=1 reported five passes, no skips or failures. Isaac Sim discovery reported no installation at the conventional Windows location. |

The screenshot records the installed renderer after cross-platform interchange. For reproduction in a Windows test account, run the following from windows with an existing disposable installation and a fresh directory assigned to the two variables.

```powershell
$env:OIA_FREECAD_TEST='1'
$env:OIA_TEST_DIRECTORY=$testDirectory
npm test
node verify.cjs "$installFolder/Industrial Engineering Workshop.exe"
./start-menu.test.ps1 -InstallFolder $installFolder -UserData "$testDirectory/shortcut-profile"
```

The network adapter stayed connected. Offline evidence covers renderer network emulation and local application resources. A fresh Windows VM, SmartScreen reputation, an abrupt OS failure, genuine Isaac execution and GPU performance were unchecked.
