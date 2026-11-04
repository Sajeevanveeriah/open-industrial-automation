const {contextBridge, ipcRenderer} = require('electron');
if (['workshop://local/workshop/studio/facility/index.html','workshop://local/workshop/studio/index.html','workshop://local/workshop/classic.html','workshop://local/workshop/native/index.html'].includes(location.href.split(/[?#]/)[0])) {
  contextBridge.exposeInMainWorld('workshopHost', {
    openProject:() => ipcRenderer.invoke('project:open'),
    saveProject:text => ipcRenderer.invoke('project:save',text),
    pickStep:tolerance => ipcRenderer.invoke('cad:step',tolerance),
    pilotStatus:()=>ipcRenderer.invoke('engine:poll'),
    locatePilot:()=>ipcRenderer.invoke('engine:locate'),
    startPilot:(camera=false)=>ipcRenderer.invoke('engine:start',camera),
    stopPilot:()=>ipcRenderer.invoke('engine:stop'),
    importPilot:()=>ipcRenderer.invoke('engine:import'),
    engineStatus:() => ipcRenderer.invoke('engine:status')
  });
}
