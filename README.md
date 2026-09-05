# Potato plant simulation

Independent, synthetic engineering study for Farm Frites Dooen technical review. It is not a commissioned, endorsed, measured or validated digital twin. No connection to plant equipment or operational systems exists.

## Run

Use Node.js 24 for build and tests. `npm run build` preserves the existing OIA web suite and makes the potato simulator the root entrypoint, retains `/potato/` as an alias and moves the legacy suite to `/suite/`. Serve `dist` with any static HTTP server. The simulator has no runtime dependencies and makes no external API calls. Open `/`. The initial view is the paused 40-minute production scenario, with all 15 equipment illustrations tied to model inventory and flow. Cold start remains available in Scenario studio.

`npm run test:simulation` runs the deterministic Node domain tests. `npm run test:simulation-ui` runs the Playwright regression suite against the built app; it requires the repository's existing development dependencies and a Chromium installation. Set `OIA_BASE_URL` to test a deployment instead of the local build.

## Demonstration

1. Load **Steady production** in Scenario studio. Inspect the 15 operations and their buffers.
2. Load **Packaging bottleneck**. Observe blocked upstream buffers, remove the film-break cause, advance time and inspect recovery.
3. Load **Latched trip**. Remove the emergency-stop cause, reset the trip, then explicitly resume. Quality holds remain attached to exposed material.
4. Load **Complete campaign**. Sample the finished lot, perform the detector challenge, release the lot and record a dispatch. Recall its raw lot to trace affected stock and shipments.
5. Load **Gateway outage**. Tags become stale while local process control continues. Restore the gateway. In **Store-and-forward**, restore ERP and reconcile the outbox.
6. Export the replayable run, detailed review JSON, historian, tags and genealogy CSV. The time lens reconstructs history without changing the present.

## Connected scope

- Intake, wash/destone, steam peel, optical sort, cut/shred, blanch, dry, optional coat/mix and form, par-fry, cool, IQF, foreign-body check, pack and palletise.
- Five illustrative recipes; FIFO material parcels carrying raw lot, order, recipe, component mass, temperature and persistent quality reasons.
- Finite capacities and hold-up; downstream blocking, upstream starvation and consumable constraints.
- Three first-order PI loops with saturation, anti-windup, sensor bias and throughput disturbances.
- Water, wastewater volume, COD, oil, coating and material reconciliation; electrical and thermal integration.
- Production orders, receipt approval, sampling, detector challenge, quality disposition, dispatch and recall.
- Eighteen instructor fault types, latched protective trips, acknowledgement and explicit recovery.
- Isolated maintenance, consumable replenishment and separate wet/dry sanitation phases.
- Emulated gateway stale data, rejected supervisory writes and idempotent ERP outbox delivery.
- Ten responsive workspaces, light/dark themes, keyboard controls, explicit browser save/load and validated import.

## Calculation and model limits

The published 250,000 t/year figure describes raw potato intake. The 30,000 kg/h demonstration feed is an independent assumption. Do not infer actual hourly nameplate throughput, vendors, layout or recipes from this model.

Water, dry solids, retained oil and coating are conserved across FIFO parcels. Rejected matter is a by-product ledger; removed moisture is vapour. Finished stock includes pending, released, shipped and scrapped dispositions. All dispositions remain in total mass accounting. Floating-point reconciliation tolerance is 0.0001 kg for the overall material balance.

Process and product temperatures use lumped first-order responses, evaluated at station transfer; they are not spatial heat-transfer, microbiological or acrylamide models. The seed is retained in the run format but this version has no random disturbances. Equipment wear is an illustrative accumulation, not a predictive maintenance estimator. PI gains, residence, limits, quality acceptance and sanitation timing require independent validation.

OEE uses running/planned time, packed/ideal running output (24,000 kg/h) and unaffected/total finished mass. The start-up residence transient affects OEE and yield. An unaffected lot is not automatically quality-released.

A run is bounded to 24 simulated hours and 3,000 accepted commands. Historian samples occur every 15 seconds. The display shows the last 240 plot samples and 300 events; review export includes all retained history and up to 3,000 events. Role selection is emulated, not authentication. Browser storage is optional and is not a durable database.

## Sources and uncertainty

The in-app Engineering reference includes the public source register and all model assumptions. Farm Frites' public factory update supports location, annual raw intake, 24/7 operation, product categories, wastewater treatment and planned commissioning. Generic equipment references explain process categories only. None establishes actual Dooen control specifications or approved operating limits.

## Release and preservation

The original OIA suite and desktop sources are retained. This change builds a browser simulation, not new desktop installers. Existing installer releases have not been revalidated. GitHub Pages deployment remains behind repository verification. Rollback is a reviewed revert and redeployment, with no force-push or unrelated file deletion.

Installer workflows and the installer-dependent release workflow are removed at Saj's request. Desktop source is retained but no installers are built by CI.
