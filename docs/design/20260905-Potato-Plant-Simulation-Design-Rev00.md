# Potato-Plant-Simulation

## Purpose and boundary

Independent browser-based potato-processing automation simulation prepared by Sajeevan Veeriah for technical review. Farm Frites Dooen is the public reference context, not a claimed customer deployment, approved design, measured digital twin or source of confidential engineering. No PLC, plant, SAP, MES, OPC UA, MQTT or other external operational connection will be made. Every site-specific numerical model input is an editable simulation assumption. No installer work is included.

## Public context

Farm Frites' factory update describes up to 250,000 tonnes of raw potatoes annually, 24/7 operation, frozen fries and potato specialities, on-site wastewater treatment and commissioning planned for early 2027. Do not confuse raw annual intake with finished output or nameplate hourly throughput. The assumed 30,000 kg/h demonstration line is not an asserted Dooen specification.

## Architecture

Retain the historical OIA source without deploying its generic dashboard as the new simulator. Build the new `simulator/` application into the repository's existing GitHub Pages destination. The dependency-free simulation engine is the single source of state for material movement, time, equipment, PI control, alarms, quality, warehouse, maintenance and integration emulation. A fixed one-second integrator and journal support deterministic replay and validated import. Browser UI code does not invent metrics or duplicate domain rules.

## System boundary and connected behaviour

Material route: receipt and release -> intake -> wash/destone -> steam peel -> optical sort -> cut/shred -> blanch -> dewater/dry -> optional coating/mix -> optional form -> par-fry -> cool -> IQF -> foreign-body inspection -> weigh/pack -> palletise -> cold store -> quality release -> dispatch. Parallel water, thermal energy, refrigeration, compressed air, oil, packaging and wastewater balances are connected to flow. FIFO parcels carry raw-lot, order, recipe, component masses, temperature and persistent quality reasons.

Supervisory states: STOPPED, STARTING, RUNNING, HELD, DRAINING, TRIPPED and CLEANING. Fault acknowledgement does not remove causes. Trip reset does not restart. Role selection is explicitly a simulation feature, not authentication. Gateway and ERP outages are emulated; controller behaviour and store-and-forward can be compared without accessing any network.

## Experience design

Use a white/graphite technical canvas with restrained olive/green material flow, amber hold and red trip accents. Reserve colour for semantics. A folded material ribbon and independently selectable equipment form the primary plant view. The inspector ties equipment condition to control variables, inventory and fault consequences. Secondary workspaces cover control/IO, production, quality/genealogy, utilities/wastewater, maintenance/sanitation, alarms/history, integration and engineering reference. A persistent simulation transport distinguishes wall-clock playback from the simulated clock. A read-only time lens reconstructs prior state and never changes the present silently.

This is a bespoke implementation, not a universal-novelty claim. Engineering geometry and charts are deterministic SVG/HTML rather than generated plant photography. Native labelled controls and tables provide accessible equivalents. No Farm Frites logo or unverified vendor branding is used.

## Acceptance and release plan

1. Create domain tests before implementation, observe a failing CI run, implement the catalogue and engine, repair all domain failures. Validate every recipe, seeded replay, mass/component/water/COD balance, residence time, finite ranges, trip and cleaning guards, queue backpressure, quality disposition and integration idempotency.
2. Implement the responsive process canvas, inspector and every workspace against the same engine. All controls have a domain action, explicit disabled reason, or navigational result. No placeholder modules.
3. Run browser tests against the built app: every route, start/hold/drain/trip recovery, two fault states, controls, role restrictions, filtering, report/run/CSV export, import, replay, reset, themes, keyboard, 200 percent zoom, mobile, contrast and reduced motion. Keep errors visible to the test harness.
4. Use reviewed repository automation for tests and deployment. The current local container/Python routes returned infrastructure ClientError before any local command executed; CI is the execution route, not a fabricated local run.
5. Only merge a tested commit. Recheck the resulting main commit and actual public deployment. Match a build revision in the live application and rerun browser tests on the deployed site. No email is sent.

## Preservation and rollback

The source baseline is commit b1f5781f3ee05e12d5d59bf44a6b70e8dd3e7fce. The task branch is saj/potato-plant-simulation-20260905. Preserve unrelated repositories, the portfolio, existing releases and Git history. Following the explicit potato-only correction, retire the water web suite and desktop source from the current tree. Replace former entry points with redirects; remove this project's old cached assets and automatically navigate cached clients to the potato plant. Rollback is a reviewed revert of the simulation merge and re-deployment of the prior web build; no force-push or history rewrite.

## Verification limits

Functional tests establish the implemented model's declared behaviour, not validated food-safety limits, calibrated physics, equipment selection, site safety certification or complete equivalence to Dooen. Documentation must identify lumped thermal models, illustrative recipe windows, emulated roles/connectivity and the retained finite history. Reviewers can export assumptions, state, genealogy and reproducible run data for further analysis.

