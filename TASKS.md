# Engineering workshop acceptance register

The [product specification](docs/design/Workshop-Requirements.md) contains the acceptance criteria. This register separates released exercises from remaining engineering work. The original root plant uses its established saved-run format. The workshop uses a separate portable version 1 project containing an origin, seed, bounded action log, learning state and inert extension records.

## Feature and verification map

B/W means the shared offline-capable renderer in browser and Windows. Native integration is separate. Test names below refer to files under `tests/` or `scripts/`.

| Specification | Working learner action and assessment | Platform | Verification | Remaining acceptance work |
|---|---|---|---|---|
| 1-3, 9. Browser continuity | Open the 15-workspace factory, access the workshop, operate a blank packaging cell or reference design. Older bookmarks still redirect to the plant. | B/W; legacy browser caches B | potato-delivery, potato-ui, potato-migration | Physical phone, Safari and Firefox acceptance |
| 4, 7. Depth, modes and role path | Select one of five depths and eight modes, enter any packaging chapter, predict travel, alter a design, record evidence, reopen a variant and attempt the transfer assessment. First day to 90-day pathway. | B/W | workshop-ui, workshop-model | Independent learner transfer study across disciplines; specialised curriculum depth and prior-learning challenges |
| 5. Time, save and simulation | Build with typed terminals; step or replay fixed 100 ms scans; compare two sensor positions; checkpoint an in-flight robot or unconfirmed posting. Reference plant retains its own clock. | B/W | workshop-model, potato-engine, potato-systems | Cross-bench co-simulation. Site, rack, robot and practice benches exchange project data at explicit navigation boundaries |
| 6A. Site and CAD | Place, snap, measure, isolate or section box envelopes. Inspect the bracket assembly, convert to metres, apply the width to a bracket and change the beam coordinate. | B/W; Windows also exposes a native converter | workshop-site, workshop-cad-ui, generate-workshop-cad; windows/native.test | Parametric constraint solver, revolve/sketch/drawing revision practice, arbitrary animated assemblies and richer collision geometry |
| 6B. Electricity | Wire and instrument a DC relay circuit, disconnect the common, probe a divider, trip a fuse and scale a 4-20 mA loop. | B/W | workshop-electrical, workshop-practice, workshop-model | Three-phase drive behaviour, AC meter semantics, RTDs, thermocouples, encoders and full loop-drawing exercises |
| 6C. Control and supervision | Compile educational Structured Text and Ladder; inspect scans; vary edge logic, timers, input assignment, HMI tags, PID disturbance, sampling and sequencing. Query reference historian data. | B/W | workshop-practice, workshop-model, workshop-production, potato-systems | Multi-screen HMI composition, editable function blocks, richer restart/retentivity exercises and subscription/compression semantics |
| 6D. Networking | Patch numbered ports, configure access/trunk VLANs, address plans and allowlists. Inspect paths, MAC observations, application reachability and loss of uplink with preserved local control. Emulate Modbus, OPC UA and MQTT transactions; diagnose stale values and retry acknowledgement loss. | B/W | workshop-infrastructure, workshop-model | Full packet-level flooding, IPv6, PTP, IGMP, QoS, ring and aggregation convergence, protocol-specific cyclic timing, interactive serial framing |
| 6E. Corporate IT | Commission camera/recorder access; calculate storage and PoE; create, recover and retrieve an event; test reader permissions, time, identity and dependency failures. | B/W | workshop-infrastructure | Camera optics/field-of-view acceptance and multi-host operational drills; test access-control escalation and privacy handovers |
| 6F. Plant and business | Release and trace orders through the factory, disrupt integrations, split and recombine a derived rework lot, execute a local SQL recall join and compare availability with physical output. | B/W | potato-engine, potato-systems, workshop-model, workshop-practice, workshop-production | Broader maintenance and food-safety capstones and recipe authoring |
| 6G. Robotics | Teach a planar arm, adjust base and tool, inspect joints, change elbow branch, test reach and clearance, fault vacuum, reset and prove one placement. | B/W | workshop-robot, workshop-model, workshop-ui | Multi-axis dynamics, executable ROS 2, MoveIt, mobile localisation, conveyor tracking and pallet pattern design |
| 6G. Embedded, vision and AI | Vary sampling, filtering, watchdog timing and lighting. Compare a deterministic baseline and a trained two-feature classifier across held-out synthetic runs; inspect errors, latency and cost. | B/W | workshop-practice | Physical ESP32/STM32 measurements, full image datasets, camera optics, model deployment and rollback exercises |
| 6G, 9. External engine | Open the Windows engine workspace, inspect capability, select a separate installed NVIDIA runtime, launch the fixed pilot and compare timestamped records. | W; shared built-in engine B/W | windows/native.test; windows/verify | Genuine signed-runtime execution on compatible hardware, observed frame time/VRAM and optional camera; verify against a genuine imported recording |
| 6H. Commissioning and security | Allocate a measurable requirement, version a procedure, record failed and passing tests, capture distinct tester/witness/authority, preserve symptoms and hand over documents. | B/W | workshop-model, workshop-ui; commissioning register | Broader stakeholder role-play, threat response, lifecycle cost, maintenance and retirement capstones |
| 8. Connected mission | Place and wire hardware, prove the clock and counter, configure video, recover a missed pick and duplicate delivery, register FAT/SAT/integrated outcomes, export the project and learner evidence. | B/W | workshop-model, workshop-ui, workshop-cad-ui, windows/verify | Independent human playthrough of all ten steps using both platforms and two learner-authored designs |
| 9-11. Delivery | GitHub Pages root and workshop; per-user Windows x64 NSIS package, application sandbox, local projects, bounded imports, archive-free JSON and separate local recovery. | B/W | CI and Pages workflows, Windows lifecycle evidence | Signing, clean-VM coverage and hardware validation; see release evidence |

## CAD capability by platform

| Input | Browser and Windows shared importer | Additional Windows route |
|---|---|---|
| STEP/STP | Open CASCADE tessellation, SI conversion from embedded units, assembly hierarchy and part isolation; 1 MiB source limit | Local FreeCAD 1.x when installed separately; see windows/README.md |
| STL | ASCII or binary triangular surface, explicit millimetre/metre/inch confirmation | Same |
| glTF/GLB | Static triangles, embedded buffers, node transforms, optional base colour. External textures, skins and animations excluded | Same |
| URDF | Self-contained box visuals at zero joint displacement, link and joint origins | Same |
| USD/USDA | Flat ASCII metre, Z-up stage of translated/scaled cubes | Separate bundled OpenUSD pilot evaluated by an optional Isaac runtime |

The original training assets are under `simulator/workshop/cad/assets/`. The bracket design is 100 mm wide; mesh bounds are estimates from tessellation. Source axes are converted into a right-handed Z-up workshop frame. The site uses box envelopes. The robot bench uses planar kinematics. The packaged Isaac contract owns its external timeline; importing a recording does not advance the packaging clock.

## Numerical acceptance

| Case | Independent expectation | Evidence |
|---|---|---|
| Moving beam | 0.50 m / 0.25 m/s = 2.00 s; allow one 0.10 s PLC scan | workshop-model |
| Analogue and counter | 4, 12 and 20 mA give 0, 50 and 100; five high scans give one edge | workshop-model, workshop-practice |
| Network and recording | Denied inter-VLAN path fails at application layer; local traffic survives upstream loss. 4 × 4 Mbit/s × 86,400 s / 8 = 172.8 GB decimal | workshop-infrastructure |
| Delivery and mass | One accepted movement after lost acknowledgement; recorded rework parents and mass residual reconcile | workshop-model, workshop-production |
| Time and CAD | Same mission from grouped scans and restored in-flight event log. STEP and GLB width 0.1000 m | workshop-model, workshop-cad-ui |
| Transfer | Distinct valid wiring, beam or network choices are assessed from simulated state. Incorrect counter logic must fail even on a coincidental final count | workshop-model, workshop-practice |

## Continuation

1. Keep the deployment and installed build tied to the release evidence before expanding any supported format or surface.
2. Start the next networking increment with a dual-path uplink, measured convergence, mirror-port capture and two independently authored acceptable topologies. Separate physical link, addressing, cyclic control and application checks.
3. Extend the analogue and HMI workspaces with an editable full 4-20 mA loop, historian timestamp provenance and stale-display fault. Demonstrate the same applied measurements on a new design.
4. Validate the optional NVIDIA path on supported hardware, import its genuine results into the Windows comparison workspace and record version, hardware, dimensions, time factor and VRAM.
5. Use each remaining acceptance item above as a working increment. Keep the full specification until every criterion has evidence.
