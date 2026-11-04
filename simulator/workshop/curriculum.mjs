export const depths = ['Explore', 'Foundations', 'Practitioner', 'Advanced', 'Expert Practice'];
export const modes = ['Start from Zero', 'Guided Learning', 'Free Build', 'Explore the Reference Plant', 'Commissioning', 'Incident Shift', 'Engineering Challenge', "Engineer’s Reference"];
export const chapters = [
  {
    title: 'Move and measure', question: 'When will the first carton reach the sensor?',
    chain: ['Carton at entry', 'Belt speed', 'Distance travelled', 'Front edge crosses beam'],
    example: 'At 0.25 m/s a carton front travels 1.00 m in 4.0 s. A 0.50 m move adds 2.0 s. Allow one 0.10 s scan for sampling.',
    actions: ['Place a conveyor, bracket and sensor. Inspect the conveyor and set its speed to 0.25 m/s. Set the bracket position to 1 m.', 'Wire conveyor track to bracket base, then bracket mount to sensor base. Record a 4 s prediction before adding the carton.', 'Add a carton. Step one second at a time. Inspect the event time at first detection.'],
    misconception: 'A faster display clock changes how quickly you watch. The simulated belt still moves the same distance per simulated second.',
    hint: 'Start with the distance a carton moves in one second. Four lots of 0.25 m make one metre.', test: 'travel'
  },
  {
    title: 'Mount and wire the photoeye', question: 'Where does the physical beam become a controller input?',
    chain: ['Bracket dimension', 'Beam position', 'Sensor output', 'Input terminal'],
    example: 'A bracket 100 mm wide measures 0.100 m in the workshop. The width and the distance of its mounting point from the belt entry are different quantities.',
    actions: ['Open the CAD bench. Import and measure the bracket, return and apply it to a bracket asset.', 'Place a programmable logic controller (PLC). Connect the sensor output to its I0 terminal.', 'Step while a carton crosses. Compare the measured terminal with I0, then repeat on I1.'],
    misconception: 'An energised field sensor can reach the wrong terminal. A dark program input is not proof of a broken beam.', hint: 'Trace the two ends of the wire in the connection list. Compare them with the input selected by the controller.', test: 'sensor'
  },
  {
    title: 'Count transitions', question: 'Why can one carton count several times?',
    chain: ['Input image', 'Previous value', 'Rising transition', 'Count'],
    example: 'For inputs 0, 1, 1, 1, 1, 1, 0, a level increment sees five high scans. A rising-edge increment sees one transition.',
    actions: ['Set the PLC to count each high scan. Add a carton and step across the beam.', 'Inspect consecutive scans. Identify two counts belonging to the same carton.', 'Restore a pre-crossing checkpoint or begin a new reference run. Select rising edge, repeat and compare.'],
    misconception: 'A long high input can be one wide carton. Counting every scan measures time in the beam.', hint: 'Ask whether the previous scan was low and the current scan is high.', test: 'counter'
  },
  {
    title: 'Bind the operator display', question: 'Can the operator display prove what moved?',
    chain: ['Carton', 'Photoeye', 'PLC input', 'Counter tag', 'HMI'],
    example: 'The human-machine interface (HMI) displays the count tag after a controller scan. The current Boolean input can already be low when the retained count is one.',
    actions: ['Place an HMI, connect PLC bus to HMI bus and select the count tag.', 'Add a carton and compare the display with the scan ledger.', 'Change the tag, observe the display and trace back to the sensor.'],
    misconception: 'A displayed number alone cannot establish signal quality or tag identity.', hint: 'Start at the display and follow its tag, bus, PLC input and sensor wire.', test: 'hmi'
  },
  {
    title: 'Commission the camera path', question: 'Why is the link lit while the viewing station has no video?',
    chain: ['Power over Ethernet', 'Patch lead', 'VLAN', 'IP path', 'Time and permission', 'Video'],
    example: 'Two access ports assigned to different virtual local area networks (VLANs) separate their hosts. Both physical links can remain up.',
    actions: ['Place a camera, switch and viewing station. Connect their Ethernet ports to switch p1 and p2.', 'Inspect addresses, masks, access VLANs and route permission. Compare power, link and application evidence.', 'Change one access VLAN and inspect the first failed layer. Repair it. Open the Network & IT bench for rack design and recording tests.'],
    misconception: 'An Ethernet link indicates a physical connection. The application also needs a permitted path and its service dependencies.', hint: 'Compare camera and viewer VLAN membership before changing addresses.', test: 'video'
  },
  {
    title: 'Recover the robot pick', question: 'Can the cell recover one interrupted pick exactly once?',
    chain: ['PLC request', 'Carton at target', 'Vacuum proof', 'Robot acknowledge', 'Pallet identity'],
    example: 'A failed vacuum pick should retain the waiting carton. A second unique inventory item would indicate the recovery duplicated material.',
    actions: ['Fit the robot, connect request and acknowledgement, and set a reachable target along the belt.', 'Release an order, disable vacuum, add a carton and advance to the pick. Read first-out evidence and carton identity.', 'Restore vacuum, reset the robot and advance. Check one carton on one pallet.'],
    misconception: 'Resetting a fault latch leaves the physical vacuum cause unchanged.', hint: 'Repair the cause before pressing Reset robot. Follow the same carton ID.', test: 'pallet'
  },
  {
    title: 'Reconcile the finished pallet', question: 'Did the business posting fail, or was its acknowledgement lost?',
    chain: ['Order', 'Finished pallet', 'Posting key', 'ERP commit', 'Acknowledgement'],
    example: 'A missing acknowledgement after a commit creates an uncertain delivery. Retrying the same key lets enterprise resource planning (ERP) identify the existing movement.',
    actions: ['Place the ERP endpoint and release an order. Enable acknowledgement loss before the pick.', 'Finish the pallet. Compare physical inventory, posting key and local confirmation.', 'Restore acknowledgements and retry. Check one posting and trace the same pallet back to its intake lot.'],
    misconception: 'A missing reply does not establish that the receiver rejected the transaction.', hint: 'Compare unique posting keys before and after the retry.', test: 'erp'
  },
  {
    title: 'Witness the handover', question: 'What evidence can each commissioning phase establish?',
    chain: ['Requirement', 'FAT', 'Installation', 'SAT', 'Integrated recovery', 'Handover'],
    example: 'Factory acceptance testing (FAT) can witness the supplier counter. Site acceptance testing (SAT) can verify the installed wire. End-to-end integrated testing can establish recovery of the downstream posting.',
    actions: ['At FAT record the controller result and witnesses. At SAT check installed wiring and application reachability.', 'Run the integrated vacuum and lost-acknowledgement case. State the requirement, failed observation, correction and retest in the notebook.', 'Record each phase and export the commissioning pack. Keep tester, witness and acceptance authority distinct.'],
    misconception: 'Supplier evidence cannot establish the final installed network path.', hint: 'Name the specific evidence that first becomes available after installation.', test: 'commissioning'
  },
  {
    title: 'Transfer to a new design', question: 'Will a different valid design meet the same requirement?',
    chain: ['New geometry', 'Independent prediction', 'Observed detection', 'Acceptance decision'],
    example: 'A beam at 1.50 m on a 0.25 m/s belt first sees the carton after 6.0 s. Compare with an otherwise identical 1.00 m design.',
    actions: ['Save the guided project as a named variant. Open a blank cell and construct your own layout.', 'Predict before moving material. Change the position or wiring while preserving the required behaviour.', 'Run the design, assess it and compare with your saved variant. Record your reasoning in the notebook.'],
    misconception: 'Matching the worked layout is unnecessary. The result must satisfy the requirement.', hint: 'Choose one dimension and calculate its effect while holding the belt speed fixed.', test: 'transfer'
  }
];
export const paths = [
  ['First day', 'Move and measure; mount and wire the photoeye. Save a variant and repeat from an empty cell.'],
  ['First week', 'Count transitions, bind the HMI and commission camera connectivity. Break the access VLAN and preserve the physical link evidence.'],
  ['30 days', 'Commission the rack and server dependencies. Prove allowed and prohibited flows, retention assumptions and event retrieval.'],
  ['60 days', 'Recover robot and ERP handovers with retained identities. Compare physical, supervisory and business evidence.'],
  ['90 days', 'Start with requirements, obtain FAT evidence, install, perform SAT, test integrated recovery and deliver a handover with measured tolerances.']
];
export const coaching = {
  travel: [
    'Place the belt. Add a carton. Step once and watch where its front edge moves.',
    'One 100 ms scan at 0.25 m/s moves the carton 0.025 m. Predict how many scans cover 1 m.',
    'Choose a belt speed and detection distance. Predict the arrival, then compare against the event register.',
    'A late crossing may be a downstream mount or a slower belt. Inspect the configuration and vary one quantity per trial.',
    'Choose a beam width that stays active for at least two scans at your selected speed. Explain the consequences of a narrower beam.'
  ],
  sensor: [
    'Follow the photoeye wire to its numbered input. Step until the input says HIGH.',
    'Convert 100 mm to metres. Measure the bracket separately from its position along the belt.',
    'Connect the beam to I1 and map the PLC to I1. Prove the equivalent solution with an observed input scan.',
    'The sensor detects a carton but the counter stays zero. Compare the mapped channel, the physical terminal and the sample time.',
    'Predict the detection shift for a 0.50 m mount change. Include one scan of timing tolerance in the site test.'
  ],
  counter: [
    'Watch the first scan that changes from LOW to HIGH. Count that change once.',
    'Write 0, 1, 1, 1, 1, 1, 0. Circle the first one. Compare your circle with the rising-edge instruction.',
    'Open Applied engineering, write an edge counter and install it on the controller. Test two separated cartons.',
    'Closely spaced cartons can keep the input high continuously. Check the scan record for a low gap before changing the program.',
    'Specify the minimum signal width, rearm condition and retained-count restart behaviour. Demonstrate a repeated high and a fresh rising edge.'
  ],
  hmi: [
    'Connect the display bus. Add a carton. Watch the number increase.',
    'A Boolean input has two states. A retained count is a number. Bind the screen to each tag in turn.',
    'Bind the live counter and trace it back to the terminal, beam and physical carton.',
    'A low input and a positive count can both be correct. Use the time sequence to explain why.',
    'Deliberately bind the wrong tag. Supply acceptance evidence that detects the mismatch even while both tags have the value zero.'
  ],
  video: [
    'Patch the camera and viewing station into the switch. Look for Video available.',
    'Follow power, physical link and network path in order. Predict which layers stay up after changing one port VLAN.',
    'Break the access VLAN while maintaining link. Diagnose the first failed layer and restore video.',
    'Keep local video working while isolating the recording uplink. Compare the viewing and recording paths on the Network & IT bench.',
    'Design separate management and recording flows. Prove an intended session, a forbidden session and local service during uplink loss.'
  ],
  pallet: [
    'Follow one carton to the robot. Watch for one pallet with that carton ID.',
    'A request starts work. An acknowledgement reports its completion. Locate both wires before starting.',
    'Break vacuum during pickup, read the first-out cause and restore exactly one identified carton to the pallet.',
    'Distinguish a missing acknowledgement from a vacuum failure. Identify the earliest different observation.',
    'Move the pick target and predict cycle timing. Fault a pending transfer, restore a checkpoint and prove no duplicate release.'
  ],
  erp: [
    'Release an order and make one pallet. Find the same pallet ID in the business record.',
    'A commit changes inventory. Its acknowledgement is a separate message. Observe both events.',
    'Lose the reply after the first commit, retry and reconcile one accepted movement.',
    'Compare an offline receiver with a lost acknowledgement after commit. Find evidence that separates the two cases.',
    'Set a failure boundary, document the idempotency key and prove that multiple retries preserve the count and intake lot.'
  ],
  commissioning: [
    'Choose one test. Record who carried it out and what the model showed.',
    'Identify who performs, witnesses and accepts a test. Explain which observation requires installed equipment.',
    'Record FAT, SAT and integrated evidence at the relevant model state. Keep the first failed result alongside the retest.',
    'A supplier counter passed FAT but the installed display is stale. Decide which evidence transfers and what SAT must repeat.',
    'Write a measurable requirement in the case register, allocate it, witness a failed test, correct it and obtain a reasoned handover.'
  ],
  transfer: [
    'Try a different belt length or sensor position. Watch what changes.',
    'Double the distance while keeping speed fixed. Predict the new travel time.',
    'Start empty and build a different valid design. Demonstrate its prediction, wiring and correct scan count.',
    'Compare two valid designs. Identify a fault that one tolerates and the other exposes.',
    'Defend an original design against timing, recovery and documentation requirements. Include the numerical tolerance and residual risk.'
  ]
};
