# Potato Plant Digital Twin - Open Industrial Automation

The main website now opens the potato-processing digital-twin demonstrator: 15 connected operations from whole-potato receiving to frozen-product packing and palletising. A paused 40-minute production scenario makes the material train inspectable immediately. This is an illustrative model, not a calibrated replica of the actual Dooen plant.

Open Industrial Automation is an Apache-2.0, vendor-neutral software family for industrial automation engineering, HMI and SCADA, control intent, tags and I/O, alarms, historian, OEE, batch and MES, materials, maintenance, validation, OT cybersecurity, identity, deployment and legacy migration.

The complete suite and 15 focused products share one portable automation project model and one workspace. The legacy suite remains at `/suite/`. Installer and installer-release workflows have been removed; desktop source remains dormant.

## Verify

```bash
npm ci
npm run test
```

## Industrial boundary

This repository supplies software, schemas, tests, packaging and deployment automation. A production plant installation still requires site-specific PLC or DCS engineering, independent functional safety, qualified hardware, segmented networks, protocol configuration, FAT, SAT and commissioning.

## Licence

Apache License 2.0. See `LICENSE`.


## Potato processing simulation

Open the connected [potato plant simulation](https://sajeevanveeriah.github.io/open-industrial-automation/potato/). The model is an independent, synthetic engineering study for Dooen review, not a verified digital twin. See [model documentation](simulator/README.md).

Run domain tests with `npm run test:simulation`. The existing suite and desktop sources remain available.
