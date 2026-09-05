// All engineering values below are illustrative model assumptions, not Dooen specifications.
export const VERSION = '3.0.0';
export const LIMITS = Object.freeze({maxSeconds:86400,maxCommands:3000,maxImportBytes:1500000,maxEvents:3000,historySeconds:15});
export const STAGES = [
 {id:'intake',tag:'RCV-101',name:'Intake & weigh',area:'Preparation',capacityKgH:35000,dwellS:45,bufferKg:900,kW:18,kind:'hopper',description:'Meter released raw lots onto the line. Unreleased receipts cannot feed.'},
 {id:'wash',tag:'WSH-201',name:'Wash & destone',area:'Preparation',capacityKgH:38000,dwellS:90,bufferKg:1800,kW:55,kind:'drum',description:'Separate soil and stones; wash-water demand follows actual material throughput.'},
 {id:'peel',tag:'PEL-301',name:'Steam peel',area:'Preparation',capacityKgH:37000,dwellS:45,bufferKg:1000,kW:22,kind:'vessel',description:'Aggregate steam-peeler handling and peel separation. Dwell includes handling, not just steam exposure.'},
 {id:'sort',tag:'OPT-401',name:'Optical sort',area:'Preparation',capacityKgH:36000,dwellS:30,bufferKg:800,kW:16,kind:'sorter',description:'Remove simulated defects. A high-reject fault reduces yield and increases waste.'},
 {id:'cut',tag:'CUT-501',name:'Cut / shred',area:'Preparation',capacityKgH:34000,dwellS:45,bufferKg:1000,kW:75,kind:'cutter',description:'Recipe selects strips, wedges or shreds. Trim and sliver mass are conserved as by-product.'},
 {id:'blanch',tag:'BLN-601',name:'Blanch',area:'Thermal process',capacityKgH:33000,dwellS:180,bufferKg:4200,kW:35,kind:'tank',description:'PI-controlled water temperature and timed product residence; water uptake and quality exposure are tracked.'},
 {id:'dry',tag:'DRY-701',name:'Dewater & dry',area:'Thermal process',capacityKgH:30000,dwellS:120,bufferKg:2800,kW:220,kind:'tunnel',description:'Remove a declared fraction of product water. Removed water is recorded as vapour.'},
 {id:'coat',tag:'COT-801',name:'Coat / mix',area:'Thermal process',capacityKgH:29000,dwellS:30,bufferKg:900,kW:24,kind:'drum',description:'Coated and formed recipes add a measured ingredient mass. Plain fries use the bypass.'},
 {id:'form',tag:'FRM-851',name:'Form specialities',area:'Thermal process',capacityKgH:27000,dwellS:60,bufferKg:1400,kW:45,kind:'former',description:'Formed-product recipe uses this station; other recipes pass through a one-second bypass.'},
 {id:'fry',tag:'FRY-901',name:'Par-fry',area:'Thermal process',capacityKgH:28000,dwellS:90,bufferKg:2100,kW:90,kind:'fryer',description:'PI-controlled oil bath, moisture evaporation, oil uptake and persistent thermal-quality holds.'},
 {id:'cool',tag:'COL-1001',name:'Cool & de-oil',area:'Cold chain',capacityKgH:28000,dwellS:90,bufferKg:2000,kW:180,kind:'tunnel',description:'Lumped cooling before IQF. Oil uptake is net retained oil; internal recirculation is not double-counted.'},
 {id:'freeze',tag:'FRZ-1101',name:'IQF freeze',area:'Cold chain',capacityKgH:26000,dwellS:720,bufferKg:14000,kW:200,kind:'freezer',description:'Refrigeration PI loop and product-core time constant; this is not a calibrated freezing curve.'},
 {id:'inspect',tag:'XRY-1201',name:'Foreign-body check',area:'Cold chain',capacityKgH:25000,dwellS:10,bufferKg:400,kW:8,kind:'sorter',description:'Emulated foreign-body detection and challenge test. No claim about actual Dooen inspection technology.'},
 {id:'pack',tag:'PKG-1301',name:'Weigh & pack',area:'Cold chain',capacityKgH:24000,dwellS:20,bufferKg:600,kW:70,kind:'packer',description:'Packaging-film supply gates flow. Bag and pallet counts are integer equivalents of recorded bulk mass.'},
 {id:'pallet',tag:'PAL-1401',name:'Palletise',area:'Cold chain',capacityKgH:24000,dwellS:15,bufferKg:500,kW:40,kind:'robot',description:'Create finished-lot inventory with raw-lot and order genealogy. Dispatch requires quality release.'}
].map(Object.freeze);
export const RECIPES = [
 {id:'straight',name:'Straight-cut 9 mm',cutMm:9,blanchC:82,fryC:175,freezeC:-35,freezeS:720,freezeTauS:450,coatFraction:0,formed:false,skinOn:false,bagKg:2.5,description:'Plain par-fried frozen strips; demonstration recipe.'},
 {id:'shoestring',name:'Shoestring 7 mm',cutMm:7,blanchC:80,fryC:172,freezeC:-34,freezeS:660,freezeTauS:390,coatFraction:0,formed:false,skinOn:false,bagKg:2.5,description:'Thin strips with a shorter illustrative freezing residence.'},
 {id:'wedges',name:'Skin-on wedges',cutMm:18,blanchC:85,fryC:178,freezeC:-36,freezeS:900,freezeTauS:530,coatFraction:0,formed:false,skinOn:true,bagKg:2.5,description:'Peeling bypass with longer freezing residence for thicker pieces.'},
 {id:'coated',name:'Coated fries 10 mm',cutMm:10,blanchC:83,fryC:177,freezeC:-36,freezeS:780,freezeTauS:470,coatFraction:0.035,formed:false,skinOn:false,bagKg:2.5,description:'Ingredient uptake affects yield, consumption and traceable recipe identity.'},
 {id:'formed',name:'Formed potato pieces',cutMm:5,blanchC:84,fryC:176,freezeC:-36,freezeS:840,freezeTauS:500,coatFraction:0.03,formed:true,skinOn:false,bagKg:2,description:'Shred, blanch, dewater, mix and form route, represented by aggregate stations.'}
].map(Object.freeze);
export const FAULTS = [
 {id:'estop',name:'Emergency stop',unit:'all',severity:'TRIP',effect:'Stop transport and heat demand; latch the trip until cause removal and explicit reset.'},
 {id:'power-loss',name:'Electrical supply loss',unit:'all',severity:'TRIP',effect:'Remove motive power and heating/cooling. No automatic restart on restoration.'},
 {id:'guard-open',name:'Guard circuit open',unit:'cut',severity:'TRIP',effect:'Simulated safeguarding trip; not a functional-safety implementation.'},
 {id:'fire-trip',name:'Fryer fire interlock',unit:'fry',severity:'TRIP',effect:'Latch a simulated protective shutdown and inhibit heat input.'},
 {id:'fryer-overtemp',name:'Fryer high-high temperature',unit:'fry',severity:'TRIP',effect:'Impose a thermal disturbance, trip the process and quarantine affected work in process.'},
 {id:'steam-low',name:'Low steam pressure',unit:'peel',severity:'HIGH',effect:'Reduce steam pressure and blancher heating; peeling cannot process material.'},
 {id:'water-low',name:'Wash-water supply loss',unit:'wash',severity:'HIGH',effect:'Stop fresh-water supply and wash processing; cleaning phase timers hold.'},
 {id:'air-low',name:'Low instrument air',unit:'pack',severity:'HIGH',effect:'Reduce pneumatic supply pressure and stop packing; upstream buffers fill.'},
 {id:'conveyor-jam',name:'Cutter conveyor jam',unit:'cut',severity:'HIGH',effect:'Stop the cutter flow; upstream blocking and downstream starvation propagate.'},
 {id:'pack-film',name:'Packaging film break',unit:'pack',severity:'HIGH',effect:'Stop packaging output without erasing upstream or downstream material.'},
 {id:'freezer-loss',name:'Refrigeration loss',unit:'freeze',severity:'HIGH',effect:'Remove cooling capacity; rising temperature holds feed and flags exposed product.'},
 {id:'sensor-drift',name:'Blancher sensor bias',unit:'blanch',severity:'HIGH',effect:'Add +12 deg C feedback bias; controller action changes the actual bath temperature.'},
 {id:'sorter-rejects',name:'Optical reject surge',unit:'sort',severity:'MEDIUM',effect:'Increase optical rejection from 1.5% to 20% of incoming mass.'},
 {id:'metal-detect',name:'Foreign-body challenge failure',unit:'inspect',severity:'HIGH',effect:'Mark affected product for quality hold; detector challenge cannot pass.'},
 {id:'wastewater-high',name:'Wastewater treatment outage',unit:'wash',severity:'HIGH',effect:'Stop treatment outflow. Equalisation volume rises and inhibits new feed near capacity.'},
 {id:'comms-loss',name:'Supervisory gateway outage',unit:'gateway',severity:'HIGH',effect:'Freeze gateway samples and reject supervisory writes while local control continues.'},
 {id:'erp-offline',name:'ERP interface unavailable',unit:'erp',severity:'MEDIUM',effect:'Retain events in a retryable local outbox. Replay delivery is idempotent.'},
 {id:'warehouse-warm',name:'Cold-store refrigeration loss',unit:'warehouse',severity:'HIGH',effect:'Warm stored product and quarantine remaining stock when the model limit is exceeded.'}
].map(Object.freeze);
export const CLEAN_PHASES = [
 {name:'Wet-zone pre-rinse',durationS:90,method:'Water circuit',waterM3H:18},
 {name:'Wet-zone detergent circulation',durationS:180,method:'Closed simulated circuit',waterM3H:6},
 {name:'Wet-zone final rinse',durationS:120,method:'Return conductivity check',waterM3H:18},
 {name:'Fryer dry inspection & oil filtration',durationS:120,method:'No water introduced into the oil system',waterM3H:0},
 {name:'Dry-zone clean & line clearance',durationS:120,method:'Packaging and forming inspection',waterM3H:0},
 {name:'Verification & recorded release',durationS:60,method:'Simulated acceptance, not a validated sanitation procedure',waterM3H:0}
];
export const SCENARIOS = [
 {id:'cold-start',name:'Cold start',description:'Start from empty equipment, ambient process temperatures and released example raw lots.',until:0,events:[]},
 {id:'baseline',name:'Steady production',description:'Forty simulated minutes from cold start. Inspect the connected material train.',until:2400,events:[{at:0,type:'start',payload:{}}]},
 {id:'pack-blockage',name:'Packaging bottleneck',description:'Film break at minute 40. Follow inventory growth upstream and recover without losing material.',until:3600,events:[{at:0,type:'start',payload:{}},{at:2400,type:'fault',payload:{id:'pack-film'}}]},
 {id:'steam-failure',name:'Steam interruption',description:'Loss of steam stops peeling and changes the blancher response.',until:3000,events:[{at:0,type:'start',payload:{}},{at:2400,type:'fault',payload:{id:'steam-low'}}]},
 {id:'cold-chain',name:'Cold-chain upset',description:'Refrigeration failure links thermal behaviour, feed permissives and quality holds.',until:3300,events:[{at:0,type:'start',payload:{}},{at:2400,type:'fault',payload:{id:'freezer-loss'}}]},
 {id:'sensor-bias',name:'Sensor versus process truth',description:'A biased sensor drives a real model response. Compare gateway measurement and simulated process truth.',until:3300,events:[{at:0,type:'start',payload:{}},{at:2400,type:'fault',payload:{id:'sensor-drift'}}]},
 {id:'gateway',name:'Gateway outage',description:'Supervisory samples are stale while independent local control and material flow continue.',until:3000,events:[{at:0,type:'start',payload:{}},{at:2400,type:'fault',payload:{id:'comms-loss'}}]},
 {id:'quality-hold',name:'Foreign-body hold',description:'Inspection failure produces a persistent lot hold rather than a dismissible warning.',until:3600,events:[{at:0,type:'start',payload:{}},{at:2400,type:'fault',payload:{id:'metal-detect'}}]},
 {id:'trip-recovery',name:'Latched trip',description:'Emergency stop. Remove the cause, reset and explicitly resume.',until:2500,events:[{at:0,type:'start',payload:{}},{at:2400,type:'estop',payload:{}}]},
 {id:'wastewater',name:'Wastewater constraint',description:'Treatment outage creates a hydraulic constraint that eventually limits production.',until:7200,events:[{at:0,type:'start',payload:{}},{at:2400,type:'fault',payload:{id:'wastewater-high'}}]},
 {id:'erp-recovery',name:'Store-and-forward',description:'Create an order while ERP is offline, then restore and reconcile the outbox.',until:180,events:[{at:0,type:'fault',payload:{id:'erp-offline'}},{at:0,type:'order',payload:{recipe:'straight',rawKg:5000}}]},
 {id:'complete-campaign',name:'Complete campaign',description:'Run the default raw-material campaign through the line to stopped, ready for quality disposition.',until:10800,events:[{at:0,type:'start',payload:{}}]}
];
export const SOURCES = [
 {id:'FF-01',kind:'Public site context',title:'Farm Frites - Horsham frozen potato manufacturing facility',url:'https://www.farmfrites.com/en-au/news/factory-australia/',checked:'2026-09-05',supports:'Dooen location; up to 250,000 t/year raw potatoes; 24/7 operation; frozen fries and specialities; commissioning planned early 2027. Not hourly capacity or control settings.'},
 {id:'EPA-01',kind:'Public site context',title:'EPA Victoria - development licence DL000300070',url:'https://www.epa.vic.gov.au/public-registers/permissions/DL000300070',checked:'2026-09-05',supports:'Food processing and sewage-treatment activities at Freight Terminal Road, Dooen. Model discharge figures are not licence limits.'},
 {id:'TOMRA-01',kind:'Generic process reference',title:'TOMRA - potato sorting, grading and peeling',url:'https://www.tomra.com/en-gb/food/machines/potatoes',checked:'2026-09-05',supports:'Generic potato sorting and steam-peeling process categories. Does not establish equipment supplied to Dooen.'},
 {id:'PROCESS-01',kind:'Generic process reference',title:'ODFOOD - frozen French fries processing line',url:'https://www.odfoodmachine.com/solution/frozen-french-fries-production-line/',checked:'2026-09-05',supports:'Generic wash, peel, cut, blanch, dry, par-fry, cool, freeze and pack sequence. Supplier-scale figures are not used as Dooen data.'}
];
export const ASSUMPTIONS = [
 ['Line arrangement','One aggregate line with optional coating and forming bypasses. The real line count and layout are unknown.'],
 ['Nominal raw feed','30,000 kg/h, adjustable 1,000-40,000 kg/h. This is not derived as plant nameplate capacity from annual output.'],
 ['Equipment capacities','Stage capacity and hold-up are illustrative. Each equipment inspector exposes the exact model values.'],
 ['Product physics','FIFO parcels conserve water, dry solids, retained oil and coating mass. Product-temperature models are lumped and uncalibrated.'],
 ['Control model','One-second fixed step; saturated PI with anti-windup; first-order process response and throughput-dependent disturbances. No real PLC scan or safety certification.'],
 ['Quality windows','Illustrative acceptance windows support demonstrations. They are not validated HACCP/CCP limits, food-safety advice or Farm Frites recipes.'],
 ['Traceability','All lots, growers, orders and shipments are synthetic. Persistent holds follow raw-lot and finished-lot genealogy.'],
 ['Utilities','150 m3 initial water tank; 100 m3/h maximum fresh supply; 250 m3 wastewater equalisation; 90 m3/h treatment; 92% COD removal; 65% of treated water classified as non-product recovery.'],
 ['Energy','Heat and refrigeration capacities, COP=3, motor loads and energy integration are demonstrator assumptions, not a site energy audit.'],
 ['Integration','Gateway, namespace, outbox and ERP are emulated in browser memory. No SAP, Momentum, PLC, MQTT broker or OPC UA server is connected.'],
 ['Roles','Selectable role simulation, not authentication or a security boundary. No personal data or secrets are required.'],
 ['Persistence','Explicit save/export and local browser storage. Replay imports are versioned and validated. Maximum simulated run: 24 h; 3,000 recorded commands.'],
 ['Presentation','Independent engineering study for review; not commissioned, endorsed or verified by Farm Frites.']
];

