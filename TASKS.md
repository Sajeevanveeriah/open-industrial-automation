# Engineering workshop acceptance register

The [product specification](docs/design/Workshop-Requirements.md) contains the acceptance criteria. This register separates released exercises from remaining engineering work. The original root plant uses its established saved-run format. The workshop uses a separate portable version 1 project containing an origin, seed, bounded action log, learning state and inert extension records.

## Interactive studio

| Workspace | Learner action | Observable result |
|---|---|---|
| Distribution floor | Follow a vehicle, select a bay, trace a lot, place an order or interrupt a route | Position, fork/load, inventory, activity and dock state are read from one facility clock. The facility scenario is separate from packaging projects. |
| Cell studio | Select equipment in the 3D scene, orbit, edit dimensions or drag a mounting position, then run the belt | The visible carton crosses the beam at its configured position. Moving the beam 0.50 m at 0.25 m/s changes the crossing by 2.0 s. |
| Part design | Drag sketch vertices or enter dimensions, extrude or revolve, then mount a part | The solid, volume and exported mesh change. The cell shows the authored solid on its bracket and preserves the design in the portable project. |
| Drive response lab | Change a drive parameter, run a sweep, inspect a trace and export its samples | Labelled plots and CSV carry the same calculated results. |
| Classic and specialist benches | Open an existing packaging project and enter the associated bench | Prior project data, commissioning records and learner profiles remain available. |

The textured facility and teaching models support engineering practice. SimReady source meshes were simplified for the display. The distribution floor does not execute NVIDIA physics or reproduce a measured plant.

## Version 0.2.0 feature and verification map

B/W means the shared offline-capable renderer in browser and Windows. Native integration is separate. Test names below refer to files under `tests/` or `scripts/`.

| Specification | Working learner action and assessment | Platform | Verification | Model boundary or outstanding validation |
|---|---|---|---|---|
| 1-3, 9. Browser continuity | Use the legacy plant routes and the workshop in Chrome, Firefox and Safari. Reopen a saved count and import the STEP bracket in each tested browser. | B/W; legacy browser caches B | potato-delivery, potato-ui, potato-migration, workshop-webdriver | Physical phone acceptance remains open. |
| 4, 7. Depth, modes and role path | Choose a depth and mode, take a prior-learning challenge, complete two materially different calculations and retain worked evidence and source revisions. Earned packaging assessments replay from project actions. | B/W | workshop-design-lifecycle, workshop-design-ui, workshop-ui | Independent human transfer study across disciplines. |
| 5. Time, save and simulation | Bind a site measurement, DC enable, remote I/O, taught robot and supervisory gateway to one packaging clock. Stop the PLC, break reporting, restore an in-flight grasp and reconcile its pallet. | B/W | workshop-coupling, workshop-model, workshop-ui | The full reference factory has a separate clock. External simulations use recording boundaries. |
| 6A. Site and CAD | Dimension a closed profile, extrude or revolve it, revise the drawing and verify the STEP bracket. Animate a learner-defined assembly and find an interference between clear endpoint poses. | B/W; Windows also exposes a native converter | workshop-site, workshop-design-lifecycle, workshop-design-ui, workshop-cad-ui | Imported glTF is static. The site editor supports its own bounded joint timelines and convex footprints. General-purpose CAD mates and manufacturing validation are outside the tested subset. |
| 6B. Electricity | Wire relay and loop terminals, check compliance and calibrate three points. Compare phase RMS, peak, slip, loss and four field transducer responses. | B/W | workshop-electrical, workshop-applied, workshop-applied-ui | Balanced-sinusoidal drive and simplified sensor models. Physical instrument checks remain open. |
| 6C. Control and supervision | Run educational Ladder and Structured Text, compare independent function-block instances, test retained restart, author two HMI screens and prove a stale value using its quality and timestamps. | B/W | workshop-model, workshop-practice, workshop-applied, workshop-applied-ui | Educational languages and sampled historian semantics. Vendor-specific runtime conformance is unverified. |
| 6D. Networking | Build alternate ring and aggregated paths, time recovery, mirror frames, compare flooding with learned forwarding, resolve an IPv6 peer, calculate PTP error, change QoS and troubleshoot serial framing. | B/W | workshop-infrastructure, workshop-fabric, workshop-fabric-browser | Scoped forwarding and timing models. Hardware protocol conformance, full IPv6 routing and IGMP membership timers remain outside the model. |
| 6E. Corporate IT | Commission camera aim and target resolution, exclude a private area, retrieve a recording and complete its four-stage custody chain. Configure service identity, test patch rollback and recover from disk, VM and host failures. | B/W | workshop-infrastructure, workshop-fabric, workshop-servers, workshop-fabric-browser | Simulated camera optics, access control and recovery. Physical camera occlusion, privacy installation review and emergency egress need on-site validation. |
| 6F. Plant and business | Run a learner-authored recipe through the reference factory. Observe dwell, output and temperature holds, preserve recipe revision and lot identity, audit recall, recover maintenance availability and reconcile rework mass. | B/W | potato-engine, potato-systems, workshop-applied, workshop-production | Recipes, quality limits, maintenance lifecycle and operating values are synthetic. |
| 6G. Robotics | Track a moving carton, design a pallet pattern, inspect trajectory and torque, and diagnose odometry drift, QoS mismatch and cancelled navigation. A supplied synthetic ROS 2/MoveIt practical has a training URDF, SRDF and launch source. | B/W | workshop-robot, workshop-robot-ui, workshop-coupling | Actual ROS 2/MoveIt execution, physical multi-axis dynamics and external recording replay for the ROS practical remain open. |
| 6G. Embedded, vision and AI | Sample and filter timed signals, test a watchdog and enter board timing observations. Export labelled synthetic optical observations by production run, deploy a candidate and prove rollback against held-out data. | B/W | workshop-applied, workshop-practice, workshop-applied-ui | Physical ESP32/STM32 timing, real camera and bearing datasets, and field deployment remain unverified. |
| 6G, 9. External engine | Detect a separately installed workstation and inspect versioned external sample records, input hashes, geometry, timing and provenance. | W; shared built-in engine B/W | windows/native.test, windows/verify-recording | Genuine compatible Isaac Sim execution, genuine recorded output, optional camera and measured GPU performance remain open. |
| 6H. Commissioning and security | Capture distinct test roles and failed retests. Allocate requirements, isolate faults, compare independent and shared power domains, weigh lifecycle costs and complete a retirement and handover case. | B/W | workshop-design-lifecycle, workshop-design-ui, workshop-model | Stakeholders, authority and sign-off in the exercises are synthetic. |
| 8. Connected mission | Build and test an independent cell variant, diagnose its wiring and camera path, recover the same carton, reconcile one ERP movement and retain evidence across project exchange. | B/W | workshop-model, workshop-coupling, workshop-ui, windows/verify | Two independent synthetic transfer designs passed. A human learner study and ten-step physical-device observation remain open. |
| 9-11. Delivery | Launch from Pages or the Windows installer, recover a saved notebook after forced process termination and verify that interrupted atomic writes retain a complete project. | B/W | workshop-clean-windows, workshop-browsers, windows/recovery.test, windows/verify-recovery | Unsigned installer. Fresh hosted Windows Server x64 coverage and local Windows 11 coverage are distinct. Clean Windows 11 VM, physical power interruption and SmartScreen reputation remain unverified. |

## CAD capability by platform

| Input | Browser and Windows shared importer | Additional Windows route |
|---|---|---|
| STEP/STP | Open CASCADE tessellation, SI conversion from embedded units, assembly hierarchy and part isolation; 1 MiB source limit | Local FreeCAD 1.x when installed separately; see windows/README.md |
| STL | ASCII or binary triangular surface, explicit millimetre/metre/inch confirmation | Same |
| glTF/GLB | Static triangles, embedded buffers, node transforms, optional base colour. External textures, skins and animations excluded | Same |
| URDF | Self-contained box visuals at zero joint displacement, link and joint origins | Same |
| USD/USDA | Flat ASCII metre, Z-up stage of translated/scaled cubes | Separate bundled OpenUSD pilot evaluated by an optional Isaac runtime |

The original training assets are under `simulator/workshop/cad/assets/`. The bracket design is 100 mm wide; mesh bounds are estimates from tessellation. Source axes are converted into a right-handed Z-up workshop frame. The site supports oriented boxes and custom convex footprints. Swept checks report intervals that exceed their resolution bounds. The robot bench uses planar kinematics and bounded motion and torque models. The packaged Isaac contract owns its external timeline; importing a recording does not advance the packaging clock.

## Numerical acceptance

| Case | Independent expectation | Evidence |
|---|---|---|
| Moving beam | 0.50 m / 0.25 m/s = 2.00 s; allow one 0.10 s PLC scan | workshop-model |
| Analogue and counter | 4, 12 and 20 mA give 0, 50 and 100; five high scans give one edge | workshop-model, workshop-practice |
| Network and recording | Denied inter-VLAN path fails at application layer; local traffic survives upstream loss. 4 × 4 Mbit/s × 86,400 s / 8 = 172.8 GB decimal | workshop-infrastructure |
| Delivery and mass | One accepted movement after lost acknowledgement; recorded rework parents and mass residual reconcile | workshop-model, workshop-production |
| Time and CAD | Same mission from grouped scans and restored in-flight event log. STEP and GLB width 0.1000 m | workshop-model, workshop-cad-ui |
| Transfer | Distinct valid wiring, beam or network choices are assessed from simulated state. Incorrect counter logic must fail even on a coincidental final count | workshop-model, workshop-practice |

## Outstanding acceptance and required evidence

| Requirement | What closes it |
|---|---|
| Human learning transfer | A learner completes a guided lab and an independently varied blank-site challenge. Retain their prediction, portable project, measured result and observed mistakes. Synthetic tests cannot establish learning transfer in a person. |
| Physical phone | On a real handset, use touch to place, configure, save and reopen a cell and return from a specialist bench. Record the device, browser, viewport and result. |
| Physical equipment | Capture supervised low-voltage board timing or authorised instrument and camera measurements. Compare the measurements with the stated model tolerances. |
| External robot and physics engines | On a compatible separately provisioned system, execute the synthetic ROS 2/MoveIt and Isaac exercises. Preserve the engine version, scenario, target hardware, recorded samples, GPU memory and real-time factor. A generated stage or synthetic recording cannot close this check. |
| ROS recording interface | Connect the practical's native output to a tested replay interface. The current release contains the practical source. |
| Windows-specific validation | For signed distribution, use an authorised trusted code-signing identity. Test the release on a fresh Windows 11 x64 VM and measure recovery after a real OS interruption separately from the process-kill test. |

The [Safari and Firefox run](https://github.com/Sajeevanveeriah/open-industrial-automation/actions/runs/41823298001) exercised calculation, persistence, assembly, CAD transfer and rack entry. The [fresh Windows Server run](https://github.com/Sajeevanveeriah/open-industrial-automation/actions/runs/41823298078) exercised a source-built installer, offline launch, project interchange, STEP and SQL, followed by uninstall and project preservation.
