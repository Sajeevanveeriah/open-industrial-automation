# open-industrial-automation handoff

Develop the browser and Windows engineering workshop alongside the potato-process simulation.

## 2026-11-15 revision - Voltwyn Factory Floor Proving Ground

The plant overview and navigation link to `proving-ground/index.html`. The original plant and workshop remain available. The build copies static assets to `dist/`; the new scene imports the bundled Three.js. The service worker permits the new independent route.

- `simulator/proving-ground/model.mjs`: equipment register, fixed 8 ms simulated scan, demand and interlock logic, plant metrics, JSON frames and six isolated FAT trials.
- `scene.mjs`: selectable equipment, animated machinery and product, camera presets, custom orbit/pan/zoom and a selectable floor-plan fallback.
- `cockpit.mjs`, `cockpit.css` and `index.html`: controls, local Melbourne clock, plant KPIs, trends and a pausable console.
- Verification: `npm test` passed. Six new model test groups covered independent numerical expectations, scan ordering, physical motion, fault recovery, payload rejection and isolated FAT outcomes. Chrome rendered the four-zone view at 1440 x 940 and the narrow layout at 390 x 844. The desktop inspection observed 18.4 t/h at nominal speed and 0.0 t/h after an intake jam.
- Repeat the HTTP and browser checks using the README commands. The Pages workflow also checks the deployed commit and exercises the proving ground at its public URL. Protocol messages, process costs, temperatures and PLC scan values are simulated. No industrial hardware was used.

Claude Opus independently reviewed the simulation and cockpit. The fault injector and normal heat response use the same trip comparator. A stopped wash drum reports zero drive torque unless jammed. A paused model preserves its trend history. On clipboard permission failure, the selected frame stays paused for manual copying.

The first public deployment returned HTTP 200 and matched merge `0d0e839`. Its desktop browser check found a 404 for the browser's implicit domain-root favicon. The proving-ground page now specifies the existing repository icon at `../icon.svg`. The browser regression checks console errors as well as uncaught exceptions.

Rollback inspection: `git checkout backup-pre-3d-twin-20261115` restores the pre-change working tree at `1deec98da635b7846ec4ad0c5243f2f180119087`. Changing the local checkout does not revert a public deployment. To roll the public site back, revert the merged change on main through the normal release workflow and verify Pages.

## Work at 5 November 2026

Source baseline: [main at e196d09b](https://github.com/Sajeevanveeriah/open-industrial-automation/commit/e196d09ba7d8e7c13c532f3e324fa1d5ed4696fb). Use the linked revision to distinguish these changes from later work.

- Exercise deployed viewport modules on the public origin ([86d194b0](https://github.com/Sajeevanveeriah/open-industrial-automation/commit/86d194b0476a8a754ddae9db5d2faa27d32e7197), 05 Nov 2026).
- Enable site part IDs only after project fields initialise ([b158a70a](https://github.com/Sajeevanveeriah/open-industrial-automation/commit/b158a70ab0e34ccd96b76572bbe744e679f657c5), 05 Nov 2026).

## Resume here

Check the relevant exercise against the acceptance register in TASKS.md. The plant is illustrative. Physical commissioning and external simulator runs require independent evidence.

GitHub showed no open pull requests or issues at this revision. Check the [work queue](https://github.com/Sajeevanveeriah/open-industrial-automation/pulls) and any local changes before choosing a task.

## Files and checks

[README.md](README.md), [TASKS.md](TASKS.md), [docs/design/Workshop-Requirements.md](docs/design/Workshop-Requirements.md), [windows/README.md](windows/README.md).

Local commands declared in [package.json](package.json): `npm run test`, `npm run build`. Record the command and result against the revision tested.

Start with [.github/workflows/ci.yml](.github/workflows/ci.yml) for hosted check definitions. Confirm the run belongs to the commit under review.

At the source revision, GitHub reported pending across 3 check or status entries. [View checks](https://github.com/Sajeevanveeriah/open-industrial-automation/commit/e196d09ba7d8e7c13c532f3e324fa1d5ed4696fb/checks).

## Next handoff

When pausing, replace the dated snapshot with the active branch or revision, what changed, the checks actually run and their results, and the first unfinished action. Record any blocker or decision the next person needs. Keep private data and credentials out of this file.
