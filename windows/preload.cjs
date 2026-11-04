const {contextBridge, ipcRenderer} = require('electron');
if (['workshop://local/workshop/index.html','workshop://local/workshop/native/index.html'].includes(location.href.split(/[?#]/)[0])) {
  contextBridge.exposeInMainWorld('workshopHost', {
    openProject:() => ipcRenderer.invoke('project:open'),
    saveProject:text => ipcRenderer.invoke('project:save',text),
    pickStep:tolerance => ipcRenderer.invoke('cad:step',tolerance),
    pilotStatus:()=>ipcRenderer.invoke('engine:poll'),
    locatePilot:()=>ipcRenderer.invoke('engine:locate'),
    startPilot:()=>ipcRenderer.invoke('engine:start'),
    stopPilot:()=>ipcRenderer.invoke('engine:stop'),
    importPilot:()=>ipcRenderer.invoke('engine:import'),
    engineStatus:() => ipcRenderer.invoke('engine:status')
  });
}
