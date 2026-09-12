# Potato plant simulation

Independent, synthetic engineering study for Farm Frites Dooen technical review. It is not a commissioned, endorsed, measured or validated digital twin. No connection to plant equipment or operational systems exists.

## Run

Use Node.js 24 for build and tests. `npm run build` publishes only the potato simulator at the root. All retired suite, product, demo and studio URLs, plus `/potato/`, redirect to that root. Serve `dist` with any static HTTP server. The browser runtime bundles Three.js locally and makes no external API calls. Open `/`. The initial view is a stopped 40-minute production example with a functional Start/Stop pair, with all 15 equipment illustrations tied to model inventory and flow. Cold start remains available in Scenario studio.

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

The original OIA suite and desktop sources have been removed from the current application. Historical commits and releases remain in GitHub history. A scoped worker migrates cached legacy sessions automatically, with root and nested cache-upgrade regressions in CI. GitHub Pages deployment remains behind repository verification. Rollback is a reviewed revert and redeployment, with no force-push or unrelated file deletion.

Installer workflows and the installer-dependent release workflow are removed at Saj's request. Desktop source and installer workflows are absent from the published application.


## Connected engineering expansion

Five additional workspaces expose cabinets and wiring, robotics and warehouse, ERP and maintenance, OT/IT architecture and project lifecycle. Fifteen illustrative cabinets have 90 uniquely addressed, traceable circuits. Open circuits, loss of cabinet power, overloads, PLC stop and remote-I/O loss gate actual equipment throughput. The reference PLC evaluates ten 100 ms scans per one-second material integration step. Naming profiles do not run vendor code.

Four parallel case-picking cells use an illustrative 5 kg product payload plus 1 kg tooling and a two-second cycle; one palletising cell uses 30 kg product plus 20 kg tooling and a three-second cycle. Capacity changes constrain material transfer. Gripper fault removal, manual reset and plant resume are separate actions. Two AMRs use a single aisle reservation and move full 600 kg pallet equivalents. This is task-space motion, not full robot dynamics or vendor virtual commissioning. Pallets are aggregate logistics equivalents; lot genealogy remains in the process ledger.

Purchase receipts join the conserved raw ledger in quality hold. Sales reservations require released stock and invoices require sufficient dispatch. Work-order closure requires equipment isolation and consumes a spare. Costing uses declared illustrative rates, not a full accounting package. Network fault domains gate supervisory actions, sample collection, controllers, robots and message delivery. A 500 ms communication watchdog removes outputs.

Lifecycle gates require evidence and preceding acceptance. Controlled change reopens all gates. These are simulated review records, not approvals or certifications. Engineering review JSON includes complete systems state and the in-process integration contract; wiring and cabinet BOM export as CSV. Full run export/import preserves systems commands through deterministic replay.

The new release retains limitations: no actual Dooen CAD or electrical drawings, vendor PLC/robot binaries, real OPC UA/MQTT connection, finite-element physics, microbiological validation, certified safety, durable shared backend or real financial transactions. Cabinet current is an illustrative three-phase estimate with assumed 415 V and 0.88 power factor; protective-device selection and conductor sizing are not established.
