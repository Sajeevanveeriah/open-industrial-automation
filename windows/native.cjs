const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {execFile} = require('node:child_process');
const projectLimit = 8 * 1024 * 1024;
const stepLimit = 2 * 1024 * 1024;

async function readBounded(file, limit) {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > limit) throw Error('File is empty or exceeds the import limit.');
    const data = Buffer.alloc(stat.size + 1);
    let size = 0;
    while (size < data.length) {
      const part = await handle.read(data, size, data.length - size, null);
      if (!part.bytesRead) break;
      size += part.bytesRead;
    }
    if (size !== stat.size) throw Error('File changed during import.');
    return data.subarray(0, size);
  } finally { await handle.close(); }
}

function projectText(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value) > projectLimit) throw Error('Project exceeds the 8 MiB limit.');
  const project = JSON.parse(value);
  if (!project || typeof project !== 'object' || Array.isArray(project)) throw Error('Expected a project object.');
  return value;
}

async function saveAtomic(file, text) {
  projectText(text);
  const staging = path.join(path.dirname(file), '.workshop-' + randomUUID() + '.part');
  const handle = await fs.open(staging, 'wx');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally { await handle.close(); }
  await fs.rename(staging, file);
}

function resolveAsset(site, url) {
  const request = new URL(url);
  if (request.protocol !== 'workshop:' || request.host !== 'local' || request.username || request.password) return null;
  const relative = decodeURIComponent(request.pathname).replace(/^\//, '');
  if (relative.includes('\\') || relative.includes(':') || relative.includes('\0') || relative.split('/').includes('..')) return null;
  const file = path.resolve(site, relative.endsWith('/') || !relative ? relative + 'index.html' : relative);
  return file.startsWith(path.resolve(site) + path.sep) ? file : null;
}

async function freecadPython() {
  for (const base of [path.join(process.env.LOCALAPPDATA, 'Programs'), process.env.ProgramFiles]) {
    const dirs = await fs.readdir(base, {withFileTypes:true}).catch(() => []);
    for (const dir of dirs.filter(d => d.isDirectory() && /^FreeCAD 1\.\d+(\.\d+)?$/i.test(d.name)).reverse()) {
      const bin = path.join(base, dir.name, 'bin');
      if (await fs.stat(path.join(bin, 'FreeCAD.pyd')).then(s => s.isFile()).catch(() => false)) return path.join(bin, 'python.exe');
    }
  }
  throw Error('FreeCAD 1.x was not found in the standard Windows installation folders.');
}

async function convertStep(file, converter, toleranceMM = 0.2) {
  if (!/\.(stp|step)$/i.test(file)) throw Error('Select a STEP or STP file.');
  if (!Number.isFinite(toleranceMM) || toleranceMM < 0.05 || toleranceMM > 2) throw Error('Use a tessellation tolerance from 0.05 to 2 mm.');
  const source = await readBounded(file, stepLimit);
  const step = source.toString('latin1');
  if (!/^\s*ISO-10303-21;/i.test(step) || /(?:REFERENCE\s*;|ANCHOR\s*;|EXTERNAL_SOURCE\s*\(|DOCUMENT_FILE\s*\()/i.test(step)) throw Error('Expected a self-contained STEP part or assembly.');
  const python = await freecadPython();
  const child = execFile(python, ['-I', converter, String(toleranceMM)], {windowsHide:true, timeout:30000, maxBuffer:8*1024*1024, encoding:'utf8'});
  const result = new Promise((resolve, reject) => {
    let output = '', errors = '', bytes = 0;
    child.stdout.on('data', data => {
      bytes += Buffer.byteLength(data);
      if (bytes > 8*1024*1024) child.kill();
      else output += data;
    });
    child.stderr.on('data', data => { errors = (errors + data).slice(-1000); });
    child.once('error', reject);
    child.once('close', code => {
      if (code !== 0) reject(Error('FreeCAD could not convert this model. ' + errors));
      else {
        try { resolve(JSON.parse(output.slice(output.lastIndexOf('OIA_MESH=') + 9).trim())); }
        catch { reject(Error('No usable mesh was returned by FreeCAD.')); }
      }
    });
  });
  child.stdin.on('error', () => {});
  child.stdin.end(source);
  return {...await result, name:path.basename(file), sourceBase64:source.toString('base64')};
}

let adapterQuery;
function adapterDetails(){
  if(!adapterQuery)adapterQuery=new Promise(resolve=>{
    const exe=path.join(process.env.SystemRoot || 'C:\\Windows','System32','nvidia-smi.exe');
    execFile(exe,['--query-gpu=memory.total,driver_version,name','--format=csv,noheader,nounits'],{timeout:4000,windowsHide:true,encoding:'utf8'},(err,stdout)=>{
      if(err) return resolve(' GPU inventory unavailable.');
      const rows=stdout.trim().split(/\r?\n/).map(line=>line.split(',').map(s=>s.trim())).filter(r=>r.length>=3&&/^\d+$/.test(r[0]));
      resolve(rows.map(([memory,driver,...name])=>' '+name.join(', ')+' · '+memory+' MiB · driver '+driver+(Number(memory)*1048576<16e9?' · below the 16 GB listed memory for the 6.2 pilot target.':'.')).join(''));
    });
  });
  return adapterQuery;
}
async function engineStatus(root = 'C:\\isaacsim') {
  const hardware=await adapterDetails();
  const markers = ['isaac-sim.bat', 'kit/kit.exe'];
  for (const marker of markers) {
    if (!await fs.stat(path.join(root, marker)).then(s => s.isFile()).catch(() => false)) return {available:false, detail:'Isaac Sim workstation runtime was not found at ' + root + '. The built-in engine is available offline.'+hardware};
  }
  return {available:true, detail:'Isaac Sim workstation files detected at ' + root + '. Live engine compatibility requires a separate run.'+hardware};
}

module.exports = {readBounded, projectText, projectLimit, saveAtomic, resolveAsset, convertStep, engineStatus};
