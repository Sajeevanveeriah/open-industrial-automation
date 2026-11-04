# Industrial engineering workshop requirements

## 1. The product I want

The learner is preparing for industrial IT and systems engineering at a synthetic potato-processing facility.

I want a virtual engineering workshop where I can personally design, assemble, wire, program, network, commission, operate, break, diagnose, recover and improve a factory. I want to learn the basics from zero, then use the same application for serious engineering practice.

The simulator must support two equally important starting points:

- An empty site where I make my own design decisions.
- A complete working reference factory that I can walk through, inspect, disassemble, modify, fault and rebuild.

The central acceptance condition is transfer: after completing a guided exercise, I must be able to open a blank project, solve a different version using the same tools, and prove that my design works. A learner must be able to construct valid solutions that the lesson author did not pre-script.

Deliver both:
1. A browser app accessible by URL on desktop and mobile.
2. An installable Windows 11 x64 desktop app with an offline engineering workshop, local projects, CAD import and an integrated simulation-engine workspace.

## 2. My role and priorities

Give industrial networking the greatest teaching depth. Give Corporate IT installation, commissioning and fault-finding comparable practical attention.

Priority areas include plant IT, integration, availability, traceability, infrastructure, personnel training, on-call support, and supplier, site and integrated acceptance testing. Use synthetic public teaching scenarios.

Turn those responsibilities into things I can personally do in the application. For example, I should commission a camera from mount and cable through switch, VLAN, identity, time source, recording server, storage and acceptance evidence. I should be able to investigate a missing video feed at any of those layers.

Include automation, process engineering, systems engineering, CAD, robotics, embedded systems, machine vision and AI as connected engineering disciplines. Identify confirmed role priorities separately from specialist development. Treat particular PLC brands, robot models, ERP/MES products, plant layouts, addressing schemes, recipes, operating limits and installation schedules as unknown unless supported by approved evidence.

Use original synthetic factory projects. Keep private correspondence, employment documents, real credentials, access arrangements, private employer CAD and non-public plant information out of the repository and releases.

## 3. Start from the actual repository

Read applicable repository instructions, root and simulator documentation, package manifests, source, tests, save schemas, browser deployment, cache migration and release workflows. Run the current app and baseline tests. Inspect existing plant geometry, simulation clock, equipment states, material transactions, scenarios, genealogy, alarms and exports.

Reuse working implementations. Preserve current routes, saved projects, browser deployment and existing simulator behaviour except where a verified defect or this specification requires a change. Keep legacy browser redirects working. This specification authorises a new Windows edition of the current application.

Use a shared engineering model, curriculum, assessment system and project format. Isolate native filesystem, CAD conversion, operating-system integration and external simulation processes behind small platform interfaces. Choose a suitable Windows host such as Electron or Tauri after checking its fit with offline rendering, native process control, packaging, security and CI. Make the decision promptly and prove it with a working installer.

## 4. How learning must work

Design for learners ranging from a five-year-old exploring with an adult to an experienced engineer undertaking expert practice. Use knowledge and demonstrated ability to select depth. An adult beginner should get clear language without childish presentation.

Provide five depths that can be changed at the same asset:
- Explore: direct manipulation, pictures, short instructions, one idea at a time.
- Foundations: introduce terminology, measurements, units, diagrams and simple calculations.
- Practitioner: build, configure, measure and troubleshoot independently.
- Advanced: investigate ambiguous evidence, interacting systems and competing constraints.
- Expert Practice: design a system, predict failure behaviour, validate it, defend trade-offs and hand it over.

Provide these modes:
- Start from Zero.
- Guided Learning.
- Free Build.
- Explore the Reference Plant.
- Commissioning.
- Incident Shift.
- Engineering Challenge.
- Engineer’s Reference.

Every guided lab must open as an editable Free Build project. Let me save variants, compare designs, undo design edits, checkpoint a running scenario, retry with a different seed and return to my lesson without losing state.

Build a first-day, first-week and 30/60/90-day path for my role. Include short sessions and extended practicals. Prior experience can unlock a challenge assessment; only demonstrated competence earns mastery.

For every core competency provide a motivating question, visual explanation, prediction, worked example, practical action, instrument or record to inspect, plausible wrong interpretation, assessment and feedback. Expand acronyms on first use. Reinforce basics where they are needed. A learner who selects “I don’t know yet” should receive a simpler experiment or a useful hint.

Example progression: at Explore level I connect a camera and see a picture. At Foundations I follow an Ethernet frame. At Practitioner I diagnose a wrong VLAN. At Advanced I explain why local communication survives an uplink failure. At Expert Practice I design resilient connectivity, prove intended and prohibited paths, measure restoration and produce a handover.

## 5. Build an engineering model with causal behaviour

Represent devices with stable asset IDs, typed connection points, editable parameters, state, behaviour and observable outputs. Model physical placement, power, wiring, network links, application dependencies, control logic, material flow and business records separately, then connect them explicitly.

Use an authoritative simulation timeline, deterministic event ordering and documented subsystem timing. Rendering frequency must not alter production counts or control outcomes. Define how PLC scans, sensor events, robot steps, network delays, process dynamics and business messages exchange data. For external physics engines, define synchronisation, ownership and tolerances explicitly.

Make configuration affect behaviour. Examples:
- Moving a sensor changes detection position and time.
- Wiring to the wrong input energises that input.
- A PLC edge counter behaves differently from a level-sensitive increment.
- A physically connected camera can have power and Ethernet link while its application is unreachable.
- A local controller can continue running while upstream reporting is unavailable.
- A physically completed pallet can have an unconfirmed business posting.
- Increasing belt speed can move a bottleneck downstream.

Implement pause, step, slow motion, accelerated time, deterministic fault injection, timestamped events, evidence capture, checkpoint restore and replay. Distinguish design undo, runtime rewind and importing an external recording. Preserve in-flight work across save/restore or explicitly identify operations that cannot be resumed.

Use realistic model boundaries. Display what is calculated, approximated, emulated, replayed or externally executed. Keep different fault causes distinguishable through evidence. Instruments must read the same model used by the equipment.

## 6. Build the integrated workspaces

### A. Site, mechanical engineering and CAD

Build a metre-scale site and assembly editor for rooms, work cells, cabinets, conveyors, sensors, cameras, guards, robots and utility routes. Provide floor plan, orbit, floor-level walk-through, focus, section view, isolate-part, assembly tree, dimensions, alignment, snapping and coordinate frames. Use cutaways where they explain enclosed equipment. Provide equivalent selection and navigation through a schematic and keyboard-accessible asset list.

Teach sketches, constraints, dimensions, extrude/revolve operations, brackets, assemblies, joints, tolerances, drawings and revision control. Include a parametric tool for educational brackets, mounts, guards and conveyor sections.

Deliver usable import paths for STEP/STP engineering parts and assemblies, STL meshes, glTF/GLB visual assets, URDF robot descriptions and OpenUSD specialist scenes. Document the exact supported subset per platform. Use a maintained CAD kernel or conversion tool after verifying licensing and redistribution rights. Native Windows conversion is acceptable. The browser must at least view the bundled CAD exercises, inspect dimensions, place assets and run their labs.

Provide import preview, source-unit confirmation, axis conversion, part hierarchy, orientation, materials, pivots, collision proxies, sensor frames, tessellation settings and mapping to stable plant IDs. Preserve source files. Distinguish engineering dimensions from mesh measurements. For formats without authoritative units, ask the learner and preview the resulting scale.

Include original, reproducibly generated training assets: sensor bracket, conveyor section, carton, pallet, camera mount and guarded robot cell. Include an actual STEP assembly with a known dimension, an asymmetric orientation feature, a GLB and a robot description. Test invalid files, missing references, cancellation and excessive asset size.

CAD acceptance exercise: import a bracket in mm, verify its known dimension, mount a photoeye, align it with a carton, run the belt and inspect the PLC input. Move the bracket a known distance along a constant-speed belt and compare the detection-time difference against distance divided by speed. State sample/scan tolerances.

### B. Electrical and instrumentation bench

Let me place virtual supplies, fuses, switches, relay contacts/coils, indicators, terminal strips, digital sensors, analogue transmitters, actuators, PLC I/O and drives. Let me connect supported terminals individually. Implement virtual multimeter, continuity, signal injection, loop calibration and trend instruments with documented measurement semantics.

Teach voltage, current, resistance, power, energy, AC/DC, three-phase principles, motor and drive fundamentals, sourcing/sinking I/O, 4-20 mA, RTDs, thermocouples, encoders, load cells, calibration, filtering, noise, shielding, grounding and electrical drawings. Include open circuits, wrong terminals, missing supply, stuck sensors and out-of-range signals. Distinguish a control supply, a command and actual feedback.

Keep hazardous-energy activities simulated. Optional physical extensions must be low-voltage, supervised where appropriate and clearly separate from industrial authorisation.

### C. PLC, HMI, SCADA, motion and process control

Provide an editable I/O map and executable educational subsets of Ladder and Structured Text. Document supported semantics. Include contacts/coils, Boolean expressions, comparisons, timers, counters, rising/falling edges, state machines, function blocks, analogue scaling and scan-by-scan inspection. Include syntax checking and meaningful runtime diagnostics. Do not imply vendor certification or complete IEC language support.

Let me program a conveyor, count cartons, sequence a cell, change modes, implement permissives, detect trips, reset faults and exchange a robot handshake. Make restart behaviour testable after power loss, communications loss or a retained input. Teach separation of ordinary control logic and personnel safety functions.

Build an editable HMI screen with tag bindings, display scaling, units, alarms and trends. Include historian queries, quality flags, timestamp origin, deadband, compression, polling, subscriptions, first-out events, audit trails and stale values that look plausible.

Provide tunable process models for PID, delay, disturbances, saturation, anti-windup, cascade and feed-forward. Show the learner setpoint, measured value, controller output and actual process response.

### D. Industrial networking - highest-priority workshop

Give me a blank rack, components, patch leads, device inventory and requirements. Let me build a network from scratch.

Physical layer: copper, fibre, connectors, patch panels, transceivers, PoE classes and budgets, managed switches, rack units, labels, dual supplies, UPS, cabling records, uplink capacity and installation checks. Trace both ends of a cable and distinguish power, physical link and application health.

Networking fundamentals: bits/bytes, frames/packets, bandwidth, throughput, latency, jitter, loss, MAC learning, flooding, ARP, IPv4, masks, CIDR, gateways, routing, VLAN access and trunk ports, broadcast domains, loop prevention, link aggregation, IPv6 foundations, DHCP, DNS, TCP/UDP, ports, sessions, TLS, certificates, NTP/PTP, multicast/IGMP and QoS.

Industrial architecture: cell/area zones, IT/OT boundaries, industrial DMZs, firewalls, allowlists, engineering workstations, jump hosts, vendor remote access, rings, redundant paths, failover and common-cause failures. Teach PROFINET, EtherNet/IP, Modbus TCP/RTU, OPC UA, MQTT/Sparkplug, serial gateways, APIs and message queues through documented, appropriately scoped models. Distinguish cyclic I/O, supervisory data and business transactions.

Tools: simulated ipconfig/ip, ping, traceroute, ARP/neighbour tables, DNS queries, routes, port/application checks, MAC tables, VLAN membership, counters, firewall rule hits, logs and packet inspection. Calculate output from the configured model. A capture at a host, switch mirror port and routed interface should show traffic appropriate to that observation point. Include a step-through packet view for beginners.

Incidents: unplugged cable, wrong patch, incompatible optics, exhausted PoE, overlapping subnets, duplicate address, wrong mask/gateway, missing VLAN, trunk mismatch, DHCP exhaustion, DNS failure, blocked port, expired certificate, clock drift, intermittent loss, multicast flooding, camera saturation and broken redundancy. Include cases where ping succeeds while production data remains stale.

Assessment: give me requirements and allow multiple valid address plans, topologies and configurations. Test intended connectivity, prohibited paths, capacity, time synchronisation, failover and documentation. A network diagram or command output generated independently of the underlying network state does not pass.

### E. Corporate IT, servers, CCTV and access control

Teach the basics of a computer, OS, client, server, service, database and virtual machine. Progress to a complete synthetic plant infrastructure: Windows/Linux administration concepts, virtualisation, identity and groups, roles, service accounts, certificates, DNS, storage, RAID, monitoring, logging, patching, backup, high availability and disaster recovery.

Let me deploy a simulated service, configure dependencies, grant access, break it, restore it and verify application-level operation and data integrity. Let me measure recovery time and actual data loss against RTO/RPO. Clearly label simulated host administration.

CCTV: mount and aim a camera, inspect field of view, configure resolution, frame rate and bitrate, calculate PoE, uplink bandwidth and retention, configure recording permissions and prove event retrieval. Show each assumption in storage calculations, including whether recording is continuous or event-driven.

Access control: model readers, controllers, credential permissions, doors, power dependencies, event correlation and audit trails. Include physical access commissioning, privacy and escalation to qualified personnel for life-safety or emergency-egress design.

### F. Plant operations, MES, ERP, warehouse and analytics

Build a connected potato line through intake, weighing, washing/destoning, peeling, sorting, cutting, blanching, drying, optional coating/forming, frying, cooling, freezing, inspection, packing, palletising, cold storage and dispatch. Include dependencies on water, steam, refrigeration, compressed air, electricity, cleaning and wastewater.

Model material parcels, identity, mass, yield/loss, accumulation, residence time, starvation, blocking, throughput, quality holds and utility constraints at an appropriate fidelity. Teach hygiene, HACCP principles, cold chain, inspection, release and recall. Label synthetic operating values.

Let me create production orders, assign recipes, manage material masters, map units, trace lots, handle split/merge and rework, form pallets and dispatch stock. Build an in-app SQL workspace restricted to synthetic project data, plus an interface workbench for schemas, mappings, payloads, queues, acknowledgements, retries, ordering, buffering, idempotency and reconciliation.

Teach OEE with explicit denominators and time boundaries, microstops, quality loss, changeovers, giveaway, energy/water per tonne, Pareto, SPC, FMEA, root-cause analysis, CMMS, preventive/predictive maintenance, MTBF and MTTR. Include cases where one KPI improves while actual production worsens.

### G. Robotics, NVIDIA, embedded systems, vision and AI

Build a working robot cell around a conveyor, carton, photoeyes, robot, vacuum gripper, guarded area, pallet, local controller, HMI, camera and upstream server. Let me define base/tool frames, calibrate a TCP, teach targets, change a sequence, inspect joints, exchange PLC signals and measure cycle time. Include missed picks, frame offsets, handshake delays, reach limits and collision/clearance checks at the supported fidelity.

Provide a built-in desktop/browser engine for core kinematics, sensor interaction, pick-and-place, pallet identity, documented collision approximations and playback. Include advanced lessons on dynamics, trajectories, singularities, payload/inertia, conveyor tracking, pallet patterns, AMRs, localisation, sensor fusion, ROS 2 nodes/topics/actions/services, QoS, TF, URDF, rosbag and MoveIt.

Integrate NVIDIA Isaac Sim/OpenUSD as a genuine optional high-fidelity path. Check current NVIDIA documentation, licensing and the available CAD-to-SimReady workflow. Build an OpenUSD pilot stage, robot/sensor configuration and a versioned scenario/results contract. Preserve asset IDs, SI units, frames, axes, timestamps, joint states, sensor outputs, provenance and engine version.

In the Windows app provide runtime detection, compatibility diagnostics, supported executable selection, structured launch, logs, controlled stop, result import and in-app comparison. Launch only explicitly supported executables. Never execute commands embedded in project files. If the runtime must be installed separately, explain that in the app and obtain approval before host installation.

For an RTX 4060 laptop provide a low-load pilot: one robot, one conveyor, one carton, then optionally one 640 × 480 camera. Measure frame time, real-time factor and VRAM when hardware is available. Distinguish built-in runs, imported genuine recordings and actual live Isaac execution. A generated USD file alone does not establish a successful Isaac run. Keep both apps usable without Isaac Sim.

Embedded: browser-based labs for sampling, filtering, interrupts, timing, watchdogs and communications, with optional ESP32/STM32 low-voltage bench exercises and spaces for actual user measurements.

Vision/AI: let me vary lighting, camera position, exposure, defect features and inspection timing. Compare a transparent rule-based baseline with a runnable model. Inspect images, labels, predictions, thresholds, false accepts/rejects, cost, latency, drift and rollback. Teach dataset separation by production run/time, leakage prevention, class imbalance and reproducibility. Include an optical inspection lab and a condition-monitoring lab. Keep AI advisory and separate from safety functions.

### H. Systems engineering, cybersecurity and commissioning

Teach stakeholder needs, operational concepts, boundaries, requirements, functional decomposition, interfaces, trade studies, architecture, lifecycle cost, availability, maintainability, human factors, configuration control, verification, validation and retirement.

Let me author a measurable requirement, allocate it to an asset/interface, design a test, capture evidence, record a failure, correct the design and retest. Provide editable rack schedules, network plans, I/O lists, interface documents, risk registers, test sheets, punch lists, as-builts, operator instructions and handovers. Include completed synthetic examples.

Build distinct FAT, SAT and integrated commissioning exercises. Show which supplier evidence can be obtained before delivery, what must be checked after installation, and which interfaces require the complete factory. Keep witness, tester and acceptance authority distinct.

Cover OT asset inventory, security zones, least privilege, secure vendor access, patch testing, incident triage, evidence preservation, backup integrity, recovery, management of change and rollback. Include realistic role interactions with Operations, Maintenance, Engineering, Quality, Supply Chain, Finance, vendors and global IT. Include situations where the correct response is to stop, preserve evidence and escalate. Keep diagnostics confined to synthetic networks and equipment.

## 7. Teach the foundations across all workshops

Provide a coherent route through:
- Counting, units, ratios, SI prefixes, area, volume, speed, rates, estimation and plausibility checks.
- Fractions, percentages, algebra, graphs, Boolean logic, binary, hexadecimal and addressing.
- Electricity, force, torque, motion, power, energy, heat, signals, feedback and uncertainty.
- Sampling, probability, statistics, vectors, matrices, coordinate transforms and optimisation when needed.
- Programming, debugging, Git, tests, SQL, Python, TypeScript and C/C++ through concrete engineering tasks.
- Reading floor plans, electrical schematics, P&IDs, loop drawings, network diagrams, timing diagrams, state machines and production transactions.

Use the same plant to make abstractions tangible. Teach percentages through yield, subnetting through an actual rack, coordinate transforms through a camera mount, SQL joins through a recall, and conditional logic through a carton counter.

## 8. Mandatory connected mission

Build this mission first. It is the integration test for the product.

1. Start with an empty packaging cell. Place a conveyor, select a constant speed, add cartons and predict travel time.
2. Import and measure a CAD bracket. Mount a photoeye, wire it to a simulated PLC input and inspect it with an instrument.
3. Write counter logic. Introduce a repeat-counting error, inspect consecutive PLC scans and correct the program.
4. Build an HMI count display. Trace its value through tag, PLC input, terminal and physical sensor.
5. Mount a camera, patch the rack, configure a switch and viewing station, establish the required route and verify video, time and permissions. Diagnose an injected VLAN fault despite an active link.
6. Add a robot. Teach a pick, configure the handshake, inject a vacuum failure, inspect first-out evidence, recover and prove exactly one carton reached its intended pallet.
7. Release a production order. Follow its finished pallet through MES and ERP. Drop the acknowledgement after ERP has accepted the posting. Recover idempotently, reconcile inventory and trace the pallet to its intake lot.
8. Perform supplier FAT, site SAT and an integrated failure/recovery test. Export a commissioning evidence pack and shift handover.
9. Save and reopen the project between browser and Windows. Preserve shared geometry, configuration, mapping, state, learning progress and evidence. Identify native-only assets or external runtime dependencies explicitly and support safe round-trip preservation.
10. Clone the project, create a different valid network layout or sensor position, predict the consequences and prove the assessor accepts the valid design.

Support independent chapter entry and a continuous end-to-end run. Also provide a realistic order of work for commissioning: where a mission revisits earlier phases for teaching, make that explicit, and provide an expert playthrough in lifecycle order from requirements and FAT to installation, SAT, integrated testing and operational handover.

## 9. Windows, browser, data and accessibility requirements

Windows: produce a versioned x64 installer, Start menu entry, native project open/save/import/export, clear project folder, crash recovery and offline core content. Keep user projects separate from application files. Preserve them during upgrades and by default on uninstall. Test clean installation, first launch, network-disabled launch, save/reopen, upgrade and uninstall on Windows. Report signing status honestly. Publish the tested installer with its SHA-256 checksum.

Browser: serve via the existing deployment workflow, support desktop/mobile, preserve current links and render essential workflows without external APIs. Provide keyboard navigation, touch controls, reduced motion, colour-independent status cues, accessible labels and a functional schematic alternative to WebGL.

Implement a versioned portable project package with schema validation, safe import limits, migrations, provenance and explicit handling of missing assets. Test corrupted archives, path traversal, oversized models, unexpected external references and interrupted saves. Imported files must not gain permission to launch processes or fetch external resources silently.

Include local learner profiles or equivalent isolated local progress, bookmarks, notebook, evidence snapshots, design variants, export/import and recovery. No online account should be necessary for core use.

Use UK English, SI units and clear, restrained visual design. Show source, units, assumptions and limitations where they materially affect a result. Use official public references where applicable, including Australian authorities, standards-body overviews, protocol organisations, CAD and robotics documentation, and NVIDIA. Respect source and asset licences. Keep unfinished content, filler and AI commentary out of the learner experience.

## 10. Test engineering correctness, not just interface clicks

Create independent expected results, hand-calculated examples or independently implemented reference checks for the critical models. Avoid tests that merely compare a function with its own output.

Include at least these fixed verification cases:
- Constant-speed conveyor: moving a sensor 0.50 m downstream at 0.25 m/s delays detection by 2.0 s, subject to the stated event/scan tolerance.
- Analogue input: for a linear 4-20 mA transmitter mapped to 0-100 engineering units, 4, 12 and 20 mA map to 0, 50 and 100. Test out-of-range behaviour separately.
- PLC counting: an input remaining high for five consecutive scans produces one rising-edge count. A second count requires a new rising edge.
- Network separation: two hosts in separate VLANs with no permitted Layer 3 path cannot establish the application session. A same-VLAN local flow can survive loss of an upstream routed link when its dependencies are local.
- CCTV retention: four constant 4 Mbit/s streams recorded continuously for 24 hours generate 172.8 GB of payload using decimal units, before storage, container and redundancy overhead. Let learners inspect the calculation.
- ERP delivery: if the first posting committed and its acknowledgement was lost, retrying the same idempotency key leaves exactly one accepted business posting and one inventory movement.
- CAD conversion: a known 100 mm reference dimension becomes 0.100 m in the SI simulation model and remains correct after export/import.
- Material genealogy: splitting, reworking and recombining lots preserves parentage and reconciles input, output, inventory change and explicitly recorded losses within documented tolerances.
- Time and replay: changing rendering frame rate does not change the deterministic mission result. Restoring an in-flight case does not add an extra carton, network event or posting.
- Assessment: at least two materially different valid learner designs pass, and meaningful invalid designs fail for the correct observable reasons.

Test negative cases, partial failures, concurrency or retries where applicable, simulator state, accessibility, file migration, CAD units and axes, packet visibility, event provenance, installer lifecycle and browser/Windows interchange. Test through normal learner entry points. Inspect the rendered application. Record actual hardware or emulation, resolution, project complexity and measured performance. Define numerical tolerances before judging results.

Use precise evidence categories: implemented and tested, implemented but unverified on target hardware, partially implemented, or blocked. Do not report a public URL, installer, verified GPU run, supported CAD format or completed competency unless its evidence exists.

## 11. Delivery sequence and continuity

Work in runnable increments. The total scope is large; preserve the complete specification across sessions.

Milestone 1: baseline the repository. Build both delivery targets early. Deliver an installable Windows pilot and browser pilot with an empty workshop, editable conveyor, movable sensor, executable counter, two-device network, save/reopen and one complete beginner lesson.

Milestone 2: finish the connected packaging mission, CAD bracket import, camera/rack lab, robot handshake, ERP recovery and commissioning evidence. Demonstrate at least two valid learner-built variants.

Milestone 3: deepen industrial networking, Corporate IT, servers, CCTV, access control, recovery, FAT/SAT and incident shifts. Deliver open-ended network design and troubleshooting assessments.

Milestone 4: complete the reference factory, broader engineering curriculum, production systems, robotics, embedded, vision, AI, reliability and expert capstones.

Milestone 5: finish NVIDIA/OpenUSD integration, engine diagnostics, low-load pilot and genuine runtime checks wherever suitable hardware is available. Progress independent work while external validation is pending.

Milestone 6: audit model correctness, curriculum depth, accessibility, platform parity, data migration and performance. Build the release installer on Windows, publish the artefacts and verify the deployed browser app.

Maintain a compact version-controlled matrix mapping each requirement to a working feature, learner action, assessment, platform, test and evidence. Record exact next unfinished acceptance criteria. Commit at verified working boundaries. A new Codex session must be able to continue from repository state alone. Treat a working pilot as a milestone; reserve “complete” for the full verified scope.

Use the repository’s authorised commit, push, merge, deployment and release workflows. Do not incur cloud costs, install host drivers or specialist runtimes, weaken security controls or use private company material without explicit approval. If a dependency blocks one area, complete independent work, isolate the blocker and preserve a usable build.

Final delivery must include:
- Verified live browser URL.
- Direct Windows installer URL, version, SHA-256 checksum and signing status.
- Local build/run commands for both platforms.
- How to open a blank workshop and how to launch the first beginner mission.
- How to import CAD, run the built-in robot cell, detect Isaac Sim and inspect run provenance.
- Per-platform CAD and simulation capability matrix.
- Curriculum and acceptance coverage with evidence.
- What passed, what failed, what remains unverified and the exact next action for any open item.

Begin by inspecting the repository and building the first hands-on workshop on both platforms. Continue through implementation, verification and release.