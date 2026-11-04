const {app, BrowserWindow, Menu, dialog, ipcMain, protocol, session} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {readBounded, projectLimit, projectText, saveAtomic, resolveAsset, convertStep, engineStatus} = require('./native.cjs');

protocol.registerSchemesAsPrivileged([{scheme:'workshop', privileges:{standard:true, secure:true, supportFetchAPI:true}}]);
app.enableSandbox();
const start = 'workshop://local/workshop/studio/facility/index.html';
const cell = 'workshop://local/workshop/studio/index.html';
const classic = 'workshop://local/workshop/classic.html';
let window;
let runtime = 'C:\\isaacsim';
let busy = false;
let pilot;
const enginePage = 'workshop://local/workshop/native/index.html';
const {Pilot} = require('./engine.cjs');

function hostAction(name, handler) {
  ipcMain.handle(name, async (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
        !['/workshop/studio/facility/index.html','/workshop/studio/index.html','/workshop/classic.html','/workshop/native/index.html'].includes(new URL(event.senderFrame.url).pathname) || !event.senderFrame.url.startsWith('workshop://local/')) throw Error('Workshop window required.');
    if (name==='engine:poll' || name==='engine:status') return handler(...args);
    if (busy) throw Error('Finish the current file operation first.');
    busy = true;
    try {return await handler(...args);} finally {busy = false;}
  });
}

async function run() {
  const site = app.isPackaged ? path.join(process.resourcesPath, 'site') : path.resolve(__dirname, '../dist');
  const converter = app.isPackaged ? path.join(process.resourcesPath, 'convert.py') : path.join(__dirname, 'convert.py');
  const projects = path.join(app.getPath('documents'), 'Industrial Workshop Projects');
  await fs.mkdir(projects, {recursive:true});
  const filters = [{name:'Workshop project',extensions:['json']}];
  const {staticOcctBindings}=require('./occt.cjs');
  let cadBindings;
  protocol.handle('workshop', async request => {
    try {
      let asset = resolveAsset(site, request.url);
      const localPage = new URL(request.url).pathname;
      if (!app.isPackaged && ['/workshop/native/index.html','/workshop/native/view.js'].includes(localPage)) asset=path.join(__dirname,'engine-ui',path.basename(localPage));
      if (!asset || request.method !== 'GET') return new Response('Forbidden', {status:403});
      const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json','.csv':'text/csv','.md':'text/plain'};
      const headers = new Headers({'Content-Type':types[path.extname(asset).toLowerCase()] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
      headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'");
      if (asset===path.join(site,'vendor','occt','occt-import-js.js')) {
        cadBindings ??= staticOcctBindings(await fs.readFile(asset));
        return new Response(cadBindings,{status:200,headers});
      }
      return new Response(await fs.readFile(asset), {status:200, headers});
    } catch { return new Response('Resource unavailable', {status:404}); }
  });
  session.defaultSession.setPermissionRequestHandler((_wc,_perm,done) => done(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*','ftp://*/*']}, (_request, done) => done({cancel:true}));
  hostAction('project:open', async () => {
    const result = await dialog.showOpenDialog(window, {title:'Open workshop project',defaultPath:projects,properties:['openFile'],filters});
    return result.canceled ? null : projectText((await readBounded(result.filePaths[0],projectLimit)).toString('utf8'));
  });
  hostAction('project:save', async text => {
    projectText(text);
    const result = await dialog.showSaveDialog(window,{title:'Save workshop project',defaultPath:path.join(projects,'Workshop.json'),filters});
    if (result.canceled) return false;
    if (path.extname(result.filePath).toLowerCase() !== '.json') throw Error('Choose a JSON project file.');
    await saveAtomic(result.filePath,text);
    return true;
  });
  hostAction('cad:step', async (tolerance = 0.2) => {
    const result = await dialog.showOpenDialog(window, {title:'Import self-contained STEP model',properties:['openFile'],filters:[{name:'STEP geometry',extensions:['step','stp']}]});
    return result.canceled ? null : convertStep(result.filePaths[0],converter,tolerance);
  });
  pilot = new Pilot(app.isPackaged ? path.join(process.resourcesPath,'engine') : path.join(__dirname,'engine'), path.join(site,'workshop/cad/assets/cell.usda'),path.join(projects,'Engine runs'));
  async function locate() {
    const selected=await dialog.showOpenDialog(window,{properties:['openDirectory'],title:'Select NVIDIA Isaac Sim workstation installation'});
    if (selected.canceled) return false;
    const status=await engineStatus(selected.filePaths[0]);
    if (!status.available) throw Error(status.detail);
    runtime=selected.filePaths[0];
    return true;
  }
  hostAction('engine:status', () => engineStatus(runtime));
  hostAction('engine:locate',locate);
  hostAction('engine:poll',()=>pilot.status());
  hostAction('engine:stop',()=>pilot.stop());
  hostAction('engine:start',async(camera=false)=>{
    if (typeof camera!=='boolean') throw Error('Camera option must be true or false.');
    if (!(await engineStatus(runtime)).available) throw Error('Locate a supported NVIDIA workstation installation before launch.');
    const consent=await dialog.showMessageBox(window,{type:'question',message:'Launch the bundled four-second pilot in NVIDIA Kit?',detail:runtime,buttons:['Cancel','Launch'],defaultId:0,cancelId:0});
    if(consent.response===1) await pilot.start(runtime,camera);
  });
  hostAction('engine:import',async()=>{
    const selected=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'Engine recording',extensions:['json']}]});
    return selected.canceled?null:pilot.compare(JSON.parse((await readBounded(selected.filePaths[0],2097152)).toString()));
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Workshop',submenu:[
      {label:'Facility overview',click:() => window.loadURL(start)},
      {label:'Cell studio',click:() => window.loadURL(cell)},
      {label:'Classic packaging workshop',click:() => window.loadURL(classic)},
      {label:'Reference plant',click:() => window.loadURL('workshop://local/index.html')},
      {type:'separator'},{role:'quit'}
    ]},
    {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'View',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
    {label:'Simulation engines',submenu:[
      {label:'External engine workspace',click:()=>window.loadURL(enginePage)},
      {label:'Check Isaac Sim installation', click:async () => {
        const status = await engineStatus(runtime);
        await dialog.showMessageBox(window,{type:'info',message:status.detail});
      }},
      {label:'Locate workstation installation',click:async () => {
        const result = await dialog.showOpenDialog(window,{properties:['openDirectory'],title:'Select Isaac Sim workstation installation'});
        if (result.canceled) return;
        const status = await engineStatus(result.filePaths[0]);
        if (status.available) runtime = result.filePaths[0];
        await dialog.showMessageBox(window,{type:'info',message:status.detail});
      }}
    ]}
  ]));
  window = new BrowserWindow({show:false,width:1280,height:850,minWidth:420,minHeight:480,backgroundColor:'#12202c',title:'Industrial Engineering Workshop',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  window.webContents.on('will-navigate',(event,url) => {if (!resolveAsset(site,url)) event.preventDefault();});
  window.webContents.on('will-attach-webview',event => event.preventDefault());
  let recoveryRoute=start;
  window.webContents.on('did-navigate',(_event,url)=>{
    const page=url.split(/[?#]/)[0];
    if([start,cell,classic].includes(page)) recoveryRoute=page;
  });
  async function initialised(url) {
    const checks={
      [start]:"document.body?.dataset.ready==='true' && !document.body.inert && document.querySelector('#facility-viewport canvas, #facility-viewport svg') && document.querySelector('#asset-select option')",
      [cell]:"document.body?.dataset.ready==='true' && !document.body.inert && document.querySelector('#viewport canvas, #viewport svg') && document.querySelector('#asset-tree')",
      [classic]:"!document.body?.inert && document.querySelector('#mode option') && document.querySelector('#place button')"
    };
    const expected=checks[url];
    const until=Date.now()+6000;
    while(!window.isDestroyed() && Date.now()<until) {
      if (window.webContents.getURL().split(/[?#]/)[0]!==url) {
        if (window.webContents.getURL().startsWith('workshop://local/')) {
          const painted=await window.webContents.executeJavaScript("Boolean(document.readyState==='complete' && document.querySelector('main') && !document.body.inert)").catch(()=>false);
          if(painted)return true;
        }
      }else if(await window.webContents.executeJavaScript('Boolean('+expected+')').catch(()=>false)) return true;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    return false;
  }
  async function openSurface(first) {
    for(const url of new Set([first,start,cell,classic])){
      try{await window.loadURL(url);}catch(error){if(error.code!=='ERR_ABORTED')continue;}
      if(await initialised(url)) return;
    }
    throw Error('The facility, cell studio and classic workshop could not initialise.');
  }
  window.webContents.on('render-process-gone',async () => {
    if (window.isDestroyed()) return;
    const answer=await dialog.showMessageBox(window,{type:'warning',message:'The workshop view stopped. Reopen it to restore the last local checkpoint.',buttons:['Reopen','Close']});
    if(answer.response){window.close();return;}
    try{await openSurface(recoveryRoute);}catch(error){await showRecovery(error);}
  });
  await openSurface(start);
  if (!app.commandLine.hasSwitch('workshop-test-hidden')) window.show();
}
async function showRecovery(error){
  console.error('Workshop startup failed:',error.message);
  if (!window || window.isDestroyed()) {app.quit();return;}
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta charset=utf-8><title>Workshop recovery</title><h1>Workshop files could not be opened</h1><p>Reinstall the Windows workshop, then reopen your saved project.</p>'));
  if (!app.commandLine.hasSwitch('workshop-test-hidden')) window.show();
}
app.whenReady().then(run).catch(showRecovery);
app.on('window-all-closed',() => app.quit());


app.on('before-quit',()=>{if (pilot?.child) pilot.child.kill();});
