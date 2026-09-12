# Potato plant engineering reference

Date: 12 September 2026. Revision: Rev00. Maturity: browser reference model and conceptual engineering. Not for construction, commissioning real equipment or approval of food production.

## Design basis

The application follows potatoes through 15 operations: intake, washing, peeling, optical sorting, cutting, blanching, drying, coating, forming, par-frying, cooling, freezing, inspection, packing and palletising. Recipes determine whether coating and forming are relevant. Every operation retains material and passes parcels to the next buffer. Lot identity links raw receipt, recipe, campaign, finished goods, quality disposition and dispatch.

Default feed demand is 30,000 kg/h. This is a simulation assumption, not a Dooen design capacity. Machine capacities, residence times, thermal coefficients, motor loads, water use, recipe yields and control limits are maintained in `catalog.mjs` and `physics.mjs`. The model accounts for incoming product, process additions, retained material, finished product, waste and vapour. Process parameters are not validated food-safety limits.

## Drawings and schedules

| File | Purpose |
|---|---|
| 20260912-Process-Flow-Rev00.svg | Fifteen operations and utility context |
| 20260912-Power-And-Safety-Concept-Rev00.svg | Typical power, 24 V DC control and independent safety concept |
| 20260912-Cabinet-Terminal-Drawing-Rev00.svg | Packing cabinet model signals and terminals |
| 20260912-OT-IT-Architecture-Rev00.svg | Enterprise, DMZ, operations and cell-control topology |
| 20260912-Wiring-Schedule-Rev00.csv | Ninety model circuits with three naming profiles |
| 20260912-Cabinet-BOM-Rev00.csv | Model-derived cabinet component schedule |

All drawings use original editable SVG shapes and text. They depict functional concepts; they do not reproduce proprietary vendor drawings. The signal schedule is exhaustive for the implemented model, not for a physical factory. Supply returns, shields, actual connector pin numbers, cable lengths and protective-earth continuity are not represented as simulated individual conductors.

## Controllers and electrical simulation

Each of 15 cabinets contains a model breaker, 24 V DC supply, controller/I/O, drive, overload and terminal strip. Six signals per cabinet are represented: READY, PE (photoeye), OL, RUN, SPEED and TEMP. PE in the signal namespace means photoeye; protective earth is a separate concept in EL-001.

Inputs, permissives and outputs are evaluated in ten 100 ms logical scans per one-second process integration interval. Browser scheduling is not real time. No Siemens, Rockwell or robot controller binaries execute in this application.

Opening a circuit changes its value and quality. Loss of readiness, photoeye, overload, run or speed wiring blocks its equipment. Temperature-circuit loss blocks the associated thermal stage. Power loss, isolation, stopped PLC, remote-I/O outage and expired watchdog also remove equipment outputs. Process buffers propagate blocked flow upstream. Cabinet alarms identify the affected hardware.

The temperature loops remain simplified PI process controllers. Analogue raw counts, input-module resolution, current-loop compliance, ground faults, motor electromagnetic dynamics and detailed pneumatic behaviour are not modelled. Estimated three-phase motor current uses `kW * 1000 / (sqrt(3) * 415 * 0.88)`; the combined power-factor/efficiency term is an assumption. This calculation is not protection or cable sizing.

E-stop latches a plant trip. Recovery is Release E-stop, clear any other trip causes, Reset trip, then Resume. A robot gate or gripper fault separately latches the robotic cell. Remove its cause, hold the plant, reset the robot and resume. Clearing a robot cause alone does not restart the cell. Ordinary process circuit restoration can restore its automatic permissive while the line remains commanded to run; isolate and hold before simulated maintenance.

## Vendor profiles

| Profile | Reference families |
|---|---|
| Siemens | S7-1500, ET 200SP, WinCC Unified, Opcenter Execution Process, PROFINET |
| Rockwell | ControlLogix 5580, POINT I/O, FactoryTalk View, FactoryTalk ProductionCentre, EtherNet/IP |
| Enterprise / robotics | SAP S/4HANA and ABB reference robot families |
| Neutral | Generic cyclic controller, distributed I/O, SCADA, MES, ERP and Ethernet |

The selector changes platform labels and signal-address presentation. It does not emulate proprietary software semantics or verify interoperability. Dooen's actual vendor list has not been supplied. Address expressions are teaching mappings, not generated engineering projects or verified module configurations.

## Robotic handling

The case-packing reference is four parallel ABB IRB 360-6/1600 cells, each with an assumed 5 kg product load and 1 kg tool at a 2 s cycle. Aggregate theoretical capacity is 10 kg/s, or 36 t/h, before upstream limits. ABB identifies the selected variant as 6 kg payload and 1.6 m working diameter. The palletising reference is an ABB IRB 460 with assumed 30 kg product and 20 kg tool at 3 s per cycle. ABB publishes 110 kg payload and 2.4 m reach for that robot. These selections establish a concept only; payload inertia, centre of gravity, reach envelope, packaging format and collision checks remain unverified.

Task-space paths illustrate pick, grip, transfer and place. Reducing cycle rate constrains actual process capacity. Gates, gripper faults and communication loss affect material handling. Robot state and handled mass derive from the same process clock and material flow. Joint-level inverse kinematics, trajectory optimisation, conveyor vision and collision checking are outside this model.

Two AMRs share a single reserved aisle. Each complete 600 kg handling unit produces a storage mission. Travel takes an assumed 45 s. Charging begins below 20% battery and ends at 95%. Four outstanding pallets block the palletiser. E-stop freezes travel. Partial pallets remain at the line. Storage missions are physical handling records; quality approval is separate.

## MES, ERP and maintenance

Purchases create raw receipts in quality hold. Sales demand can create one linked production campaign using a declared 70% planning yield. Actual process yield comes from the parcel model. Production, sampling, detector challenge, quality release, recall and dispatch remain controlled workflows. Reservations require released stock; invoicing requires dispatched quantity. These are simulated transactions and do not reach a business account.

Costing uses raw potatoes at AUD 0.30/kg, electricity at AUD 0.25/kWh, thermal energy at AUD 0.08/kWh and film at AUD 3/kg. Labour, tax, depreciation, finance, overheads and actual site tariffs are excluded. Editable purchase and sales prices belong to their transaction records and are not a calibrated cost accounting system.

Work orders require isolated equipment before completion. Completion consumes a spare assembly, repairs its simulated wiring and overload and resets wear. Isolation remains applied. Existing sanitation phases, consumables and maintenance records share the process state.

## OT/IT and integration boundary

ERP, MES, historian, DMZ, SCADA, PLC, remote I/O and robot nodes can be disconnected independently. Enterprise and DMZ outages defer outbox delivery; retries retain message IDs to prevent duplicate delivery. SCADA outage rejects supervisory commands while E-stop remains available. Historian outage suspends sample collection. PLC/remote-I/O failure blocks outputs; latency above 500 ms expires the watchdog.

The exported review includes an `oia.reference/1` contract: tag, value, unit, quality and simulation time. Commands use a validated, timestamped journal. A future adapter must authenticate operators, validate commands server-side, preserve idempotency, distinguish observed from commanded state and fail safely on stale data. The current browser does not open OPC UA, MQTT, PROFINET or EtherNet/IP connections.

GitHub Pages serves static browser assets. Saving is per-browser local storage; JSON export/import provides portable deterministic runs. Simulated roles are not authentication. Persistent multi-user sessions and real vendor runtimes require a separate authorised service and are not included.

## Lifecycle and acceptance

Ten sequential review gates cover commercial definition, site/approvals, design, procurement/FAT, mechanical completion, cold commissioning, wet commissioning, validation, launch and improvement. A gate requires a review note and acceptance of its predecessor. Controlled changes reopen the gates. A clicked gate is not an engineering sign-off, statutory approval or food-safety validation.

Before a physical design could be used, obtain actual equipment specifications, surveyed layout, utility availability, electrical fault levels, environmental conditions, hygiene zones, food hazard analysis, operating requirements and applicable regulatory approvals. Independent engineering would then establish conductor/protection sizing, enclosure ratings, thermal management, machinery safety, hygienic design and validated process limits.

Acceptance tests for this software cover conservation, Start/Stop/restart, E-stop recovery, wiring faults, PLC/network loss, robot gates, capacity constraints, warehouse reservations, purchase idempotency, lifecycle prerequisites and deterministic replay. Browser tests exercise visible controls and exports at desktop and narrow viewport sizes. Test results must be taken from the exact released commit, not inferred from this document.

## Primary reference register

Retrieved 12 September 2026. Product pages are undated unless stated. Public product facts inform reference selection; none is evidence of equipment installed at Dooen.

- ABB IRB 360 variants: https://www.abb.com/global/en/areas/robotics/products/robots/delta-robots/irb-360
- ABB IRB 460 payload and reach: https://www.abb.com/global/en/areas/robotics/products/robots/articulated-robots/medium-robots/irb-460
- Siemens controller simulation boundary: https://developer.siemens.com/s7-plcsim-advanced/overview.html
- SAP manufacturing planning: https://www.sap.com/australia/products/scm/manufacturing-for-planning-and-scheduling.html
- FSANZ food safety standards and premises/equipment guidance, page updated 30 September 2025: https://www.foodstandards.gov.au/business/food-safety
- GitHub Pages static hosting: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
