import {readFile,stat,access} from 'node:fs/promises';
const required=['simulator/index.html','simulator/app.mjs','simulator/styles.css','simulator/engine.mjs','simulator/catalog.mjs','simulator/physics.mjs','simulator/equipment.mjs','simulator/spatial.mjs','simulator/sw.js','LICENSE'];
for(const path of required){if(!(await stat(path)).size)throw Error('Empty source: '+path);}
for(const path of ['web','desktop']) { let exists=false;try{await access(path);exists=true;}catch{}if(exists)throw Error('Retired application remains: '+path); }
const app=await readFile('simulator/app.mjs','utf8');
if(/Open original OIA suite|TK-101 MIX TANK/.test(app))throw Error('Legacy application link or water plant remains');
JSON.parse(await readFile('package.json','utf8'));
console.log('Source verified: potato-only application, simulation model and licence.');
