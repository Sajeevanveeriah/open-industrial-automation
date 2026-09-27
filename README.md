# Potato plant digital twin

A browser simulation of the complete potato material journey for independent Farm Frites Dooen engineering review. The only deployed application is the potato plant. The retired water/mixing suite and desktop installers have been removed.

## Run

```sh
npm ci
npm test
npm run dev
```

`npm run build` creates the static GitHub Pages site in `dist/`. Standard public-repository GitHub hosted runners verify and deploy `main`. No installer builds run.

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
