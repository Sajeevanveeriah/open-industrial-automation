# Windows engineering workshop

The Windows edition bundles the static site, Chromium and Node in an Electron host. Chromium runs the same workshop modules as the browser edition. A sandboxed preload exposes native project dialogs and optional local engineering tools. The renderer has no shell or Node API. All HTTP, HTTPS and WebSocket requests from the workshop are blocked. Local assets are served from the installed package through a private protocol with explicit MIME types.

## Start the workshop

The Windows application opens the distribution floor with a dispatch job. Select **Find matching pallet**, compare the stock with the ticket, reserve it for the correct door, identify the assigned truck and reconcile the trailer receipt. The job saves progress locally. Follow a load, inspect the plant, or open the cell studio from the overview. In the cell studio, use **New project** for a blank scene or the working reference cell. **Save project** and **Open project** use Windows file pickers. The Workshop menu opens the classic packaging workshop and the reference plant. The classic project cabinet retains its original file format and local projects.

The host checks the facility viewport, asset inventory and ready state. If the facility cannot initialise, it opens the cell studio. If the cell studio also fails, it opens the classic workshop. A renderer crash offers to reopen the most recently used facility, studio or classic surface. Profiles and projects stay outside the installed program directory.

## Build on Windows x64

From the repository root, run `npm ci` and `npm run build`. Then run:

```powershell
cd windows
npm ci
node node_modules/electron/install.js
npm test
npm start
npm run package
```

The NSIS installer is under `windows/release`. The installer runs per user and creates the **Industrial Engineering Workshop** Start menu shortcut. Choose **Export project** for native Save As and **Open project** to read a portable JSON project. The default directory is **Documents / Industrial Workshop Projects**. Upgrades and the default uninstall preserve project files. The project writer flushes a separate file in the same directory before replacing the target. A failed write before replacement leaves the prior project intact. Local workshop profiles use a separate Chromium user-data directory.

## Platform capabilities

| Action | Browser | Windows |
|---|---|---|
| Build and operate the packaging cell, save variants, assess and replay | Shared model, local storage, file picker and download | Same model and local profiles, native Open and Save As |
| Import a self-contained STEP assembly on the assembly bench | Bundled Open CASCADE WebAssembly | Same offline WebAssembly bench |
| Optional native STEP conversion from the packaging cell | Unavailable | Installed FreeCAD 1.x, topology converted to SI bounds and Z-up mesh. Solid count and original STEP bytes retained. 2 MiB source and 40,000 triangles maximum. Native conversion flattens hierarchy. |
| Other supported formats | See Assembly bench restrictions for STL, embedded glTF/GLB, fixed-pose box URDF and flat ASCII USD | Same shared import workspaces |
| Built-in robot | Shared educational kinematics | Same offline model |
| Local NVIDIA workstation inspection | Unavailable | **Simulation engines / External engine workspace**. Detects standard installation or an operator-selected installation directory. |
| External run and import | Built-in workspaces remain independent | The native workspace launches only a separately installed NVIDIA-signed Kit, its matching experience and the bundled synthetic pilot. Imports compare measurements with the local constant-speed reference. |

## External pilot

Select the NVIDIA workstation installation root if it is outside the default location. The launch checks the executable signature, limits launch arguments to a fixed native allowlist and asks the operator to launch the bundled pilot. Projects and recording files supply no executable paths, script paths or command arguments. Run data and the most recent 12,000 characters of the engine log are saved beneath **Documents / Industrial Workshop Projects / Engine runs**. Stop requests are checked at each pilot step. A runtime that does not respond is terminated after five seconds.

`engine/scenario.json` defines a four-second timeline with 241 samples, SI units and a Z-up cell frame. Kit samples an animated carton, photoeye plane and robot joint from OpenUSD. This pilot exercises transform evaluation; it does not simulate grasp dynamics, collisions or the full packaging sequence. The comparison displays distance error, beam timing, joint rotation, frame time and real-time factor. External recordings are self-declared. A locally executed result must carry the ID generated for the launched child. The pilot queries NVIDIA for Kit process VRAM at the end, leaving it unmeasured when the driver does not report per-process usage. Optional endpoint camera capture requests 640 × 480 RGB frames, saves PPM images and records pixel hashes. These native Isaac paths require a compatible workstation for execution.

NVIDIA Kit and FreeCAD are not redistributed. Their use requires a separate installation and the corresponding licences. The shared browser CAD converter retains its licence files. Read on 4 November 2026: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security/), [FreeCAD licensing](https://www.freecad.org/contributing.php), [Isaac Sim 6.2 installation](https://docs.isaacsim.omniverse.nvidia.com/6.2.0/installation/quick-install.html), [hardware requirements](https://docs.isaacsim.omniverse.nvidia.com/6.2.0/installation/requirements.html), [Kit command-line reference](https://docs.omniverse.nvidia.com/kit/docs/carbonite/latest/docs/Kernel/CommandLineOptions.html).

## Verification

`npm test` checks local file handling and external recording validation. Set `OIA_FREECAD_TEST=1` on a host with FreeCAD 1.x to include actual STEP conversion. `node verify.cjs "<installed executable>"` checks the installed application using Playwright, including offline launch, save/reopen, CAD and SQL. Native file picker choices are supplied by the test harness; normal file operations and the shared validation code execute.


## CAD to simulation-ready assets

Start with an approved original CAD part and confirm units, up-axis and part hierarchy. Convert to USD, attach materials and semantic part IDs, then define the required simulation profile. An articulated asset also needs verified pivots, joint axes and limits, a collision proxy and plausible mass and inertia. Validate the relevant profile before testing contacts or sensor performance. The bundled pilot uses named metre-scale geometry and kinematic animation; its asset has no SimReady certification. NVIDIA lists conversion, authoring and profile validation as separate stages. [NVIDIA SimReady guidance](https://docs.omniverse.nvidia.com/simready/latest/simready-faq.html), read 4 November 2026.

Run `npm run test:crash` after the web build to exercise a forced renderer crash and abrupt development-process termination in a unique local profile. Its launch uses the development Electron executable and never opens a project from the installed application's profile.

Use `node verify-jobs.cjs` with the packaged executable path to check the dispatch shift, PLC wiring and transfer case, conveyor drive commissioning, bracket measurement and mounting through the native user interface.

## Project handoff

Read the [project handoff](../HANDOFF.md) for current work, checks and the next step.
