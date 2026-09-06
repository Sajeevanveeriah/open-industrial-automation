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

The September 6 redesign replaces the folded equipment cards with a spatial engineering workspace: a large, selectable Three.js plant model; orthographic plan, orbit, fit, zoom and equipment focus; equipment-state, throughput, buffer and temperature overlays; a persistent inspector; and schematic and asset-register alternatives. Fifteen recognisable machine assemblies follow a connected serpentine material route. Utility pipe geometry can be hidden independently. Product movement and equipment animation depend on model flow and playback, and respect reduced-motion preferences.

The visual system uses neutral white and graphite surfaces, a restrained blue selection accent, tabular readings, aligned form fields and compact semantic state colours. The same typography, tables, forms and control dock cover all ten workspaces. The bottom dock keeps plant commands distinct from clock controls; trip recovery retains release, reset and explicit resume as separate operations. Native numbered equipment buttons, a flow schematic and an asset table provide keyboard-readable controls alongside geometry.

The primary renderer uses WebGL 2. Browsers without it use Three.js SVGRenderer with the same scene, camera, selection and model overlays. An unrecoverable graphics failure leaves the schematic operational. Dependencies and their licence are served locally by GitHub Pages, without a CDN. Viewer nodes survive simulation refreshes; renderer resources are released when leaving the view. GPU motion is capped at 30 frames per second and vector motion at five; stopped views render on changes only.

The mesh assemblies, dimensions, relative equipment positions and utility pipe routes are illustrative geometry, not surveyed Dooen CAD. Visible particle counts illustrate movement, not mass measurement. All displayed process readings come from the existing deterministic engine. There is no universal-novelty claim, generated plant photograph, Farm Frites logo or unverified vendor branding.

Design references supplied by the user were reviewed: Insight's manufacturing twin solution, Visual Components' manufacturing twin guide, Infor's manufacturing overview, Unity's manufacturing resources, KGT's plant guide and Matterport's manufacturing guide. They informed spatial navigation and the connection between equipment geometry, process state and operational decisions. They provide no basis to claim an as-built Dooen model.

## Acceptance and release plan

1. Create domain tests before implementation, observe a failing CI run, implement the catalogue and engine, repair all domain failures. Validate every recipe, seeded replay, mass/component/water/COD balance, residence time, finite ranges, trip and cleaning guards, queue backpressure, quality disposition and integration idempotency.
2. Implement the responsive process canvas, inspector and every workspace against the same engine. All controls have a domain action, explicit disabled reason, or navigational result. No placeholder modules.
3. Run browser tests against the built app: every route, start/hold/drain/trip recovery, two fault states, controls, role restrictions, filtering, report/run/CSV export, import, replay, reset, themes, keyboard, 200 percent zoom, mobile, contrast and reduced motion. Keep errors visible to the test harness.
4. Use local source, build, delivery and deterministic model tests plus repository browser automation. The September 6 browser suite includes camera changes, all overlays, all three plant views, selection preservation, both themes, WCAG A/AA serious and critical checks, a WebGL-disabled vector run and all existing functional regressions. Keep screenshots with CI and live deployment evidence.
5. Only merge a tested commit. Recheck the resulting main commit and actual public deployment. Match a build revision in the live application and rerun browser tests on the deployed site. No email is sent.

## Preservation and rollback

The source baseline is commit b1f5781f3ee05e12d5d59bf44a6b70e8dd3e7fce. The task branch is saj/potato-plant-simulation-20260905. Preserve unrelated repositories, the portfolio, existing releases and Git history. Following the explicit potato-only correction, retire the water web suite and desktop source from the current tree. Replace former entry points with redirects; remove this project's old cached assets and automatically navigate cached clients to the potato plant. Rollback is a reviewed revert of the simulation merge and re-deployment of the prior web build; no force-push or history rewrite.

## Verification limits

Functional tests establish the implemented model's declared behaviour, not validated food-safety limits, calibrated physics, equipment selection, site safety certification or complete equivalence to Dooen. Documentation must identify lumped thermal models, illustrative recipe windows, emulated roles/connectivity and the retained finite history. Reviewers can export assumptions, state, genealogy and reproducible run data for further analysis.

