# Potato plant digital twin

A browser simulation of the complete potato material journey for independent Farm Frites Dooen engineering review. The plant opens at the existing root URL. Choose **Engineering workshop** in its navigation to build a packaging cell.

## Run

```sh
npm ci
npm test
npm run dev
```

`npm run build` creates the static GitHub Pages site in `dist/`. Standard public-repository GitHub hosted runners verify and deploy `main`. The Windows engineering workshop uses the same built site.

## Review

15 connected operations cover receiving, washing, peeling, sorting, cutting, blanching, drying, coating/forming, frying, cooling, freezing, inspection, packing and palletising. The cold store and dispatch follow quality release. Ten workspaces expose process controls, intake, production, quality and genealogy, utilities, maintenance, alarms, integrations, scenarios and model references.

The primary workspace is a selectable 3D plant with Plan, Orbit, Fit, Zoom and Focus controls. Switch overlays between equipment state, throughput, buffer inventory and temperature. The flow schematic and asset register share the same selection and process state. WebGL 2 is used where available; a vector renderer keeps the same geometry and controls usable without it. All graphics dependencies are served locally.

The example opens stopped at 40 simulated minutes. Start begins the retained campaign and clock. Stop halts motion without discarding material. Drain empties the line; Hold/Resume preserve drain intent. Select equipment, play or step the clock, or choose a scenario. Export runs before replacing them.

## Interface

Fifteen workspaces are grouped as Operate, Production, Connected systems and Study. The sidebar collapses to icons on desktop and becomes a drawer below 900 px. A fixed control dock keeps the clock, run-time progress and plant commands in reach on every workspace. Unacknowledged alarms raise a banner and a count on the top-bar bell.

Press `Ctrl K` (or `/`) to search workspaces, equipment, plant commands, scenarios and exports. Unavailable commands stay listed with the blocking reason. `Space` plays or pauses the clock, `.` and `Shift .` advance one or ten simulated minutes, `[` and `]` change playback speed, `T` switches theme and `?` lists every shortcut. Plant commands are never bound to single keys.

Theme follows the system on first visit. Theme, sidebar state, playback speed and viewer overlays are remembered per browser; the run itself is saved only on request.

## Delivery verification

`npm run test:simulation` checks the deterministic model. `npm run test:delivery` checks the build. `npm run test:migration` installs root and nested legacy cache-first workers and verifies automatic replacement without manual reload, preserving neighbouring caches and local saved data. `npm run test:simulation-ui` exercises fifteen routes, three widths, the command palette, shortcuts, persisted preferences, the navigation drawer, commands, quality/dispatch, export, roles and every retired bookmark. CI uploads screenshots and results, then repeats browser checks on the public deployment. Set `OIA_CHROMIUM` to a Chromium executable to run the browser suites without downloading Playwright's pinned build.

All old entry points redirect to the root potato application. A scoped migration worker removes only this project's old cached assets. It never caches new application responses.

## Model boundary

This is an independent illustrative simulation, not a calibrated replica or an endorsed Farm Frites control system. Operating values, equipment arrangement and records are synthetic. No real PLC or plant is connected. See `simulator/README.md` and the in-app Engineering reference for model assumptions and validation scope.

## Engineering workshop

Open the [live facility](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/index.html) to inspect warehouse operations. Select a vehicle or rack to see its current job or inventory. Open [Packaging cell](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/studio/index.html) to edit the cell, run the conveyor or take the first sensor-placement lesson.

**Part design** opens an editable cross-section beside its solid. Drag a vertex or change a dimension, inspect the resulting part and mount it on the cell bracket. **Analysis** opens the drive response lab for parameter sweeps, trace comparison, point inspection and CSV export. The [Classic workshop](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/classic.html) remains available for existing projects, commissioning and specialist exercises.

### Start a hands-on assignment

- [Dispatch operator](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/studio/facility/index.html?job=operator): read the ticket, locate the matching stock, reserve it, identify the assigned truck and reconcile the dispatch receipt. A pallet identifies one load. Its lot identifies the batch it came from.
- [Incident controller](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/studio/facility/index.html?job=incident): inspect a failed delivery, preserve the identity of the load and recover it to an available dock.
- [Miswired photoeye](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/studio/index.html?practical=wiring): predict the active terminal, observe the failed count, repair the cell and prove the fix on a changed case.
- [Build a bracket](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/studio/part/index.html?practical=bracket): predict the volume, edit the profile and depth, inspect the dimensions against the drawing and mount the verified revision.
- [Commission a drive](https://sajeevanveeriah.github.io/open-industrial-automation/workshop/studio/analysis/index.html?practical=drive): predict holding force and tune a proportional-integral controller to meet rise, recovery and overshoot limits under two loads.

The distribution floor is a synthetic facility. Its operating ledger tracks storage and vehicle loads, dock staging and dispatch. Rack, forklift, pallet truck and pallet visual meshes are derived from NVIDIA's CC BY 4.0 Physical AI SimReady Warehouse collection. The live scene uses the workshop simulation. [Sources, licence and geometry modifications](simulator/workshop/studio/facility/assets/ATTRIBUTION.md).

In Classic, open **CAD and engine workspace > Open CAD import bench**. Open the photoeye STEP assembly, inspect its 0.100 m base and use it in the packaging cell. Select a bracket and apply the measured width. Both editions convert the same self-contained STEP files locally. The part source accompanies the portable project as inert data. The model's design and runtime limits are documented in [the acceptance register](TASKS.md).

For Windows, install the per-user x64 package. To build or run from source on Windows, use the following commands from the repository root.

```powershell
npm ci
npm run build
npm ci --prefix windows
npm start --prefix windows
npm run package --prefix windows
```

The installer is written to `windows/release/`. The application loads its packaged site without a server. Use the native project controls to move a workshop project between editions. The packaging cell and original reference factory have distinct save formats.

## Third-party CAD components

The workshop distributes the unmodified occt-import-js 0.0.23 WebAssembly module as separate, replaceable files in `vendor/occt/`. Both licence texts ship with the build. The module is built from [the corresponding converter source and build instructions](https://github.com/kovacsv/occt-import-js/tree/c2148e54b456b571238d35cac037d304053d64b2) and [the corresponding OCCT kernel revision](https://github.com/Open-Cascade-SAS/OCCT/tree/d2abb6d844231cb8f29be6894440874a4700e4a5). Rebuild or replace the module independently of the workshop. The offline SQL bench packages sql.js and its licence. FreeCAD is used separately to regenerate the original teaching parts with `scripts/generate-workshop-cad.py`.

## Project handoff

Read the [project handoff](HANDOFF.md) for current work, checks and the next step.
