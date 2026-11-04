import {createFacility,loadFacility,saveFacility} from './facility-model.mjs';
export function openRecovery(storage){
  let profile='Learner',key='',raw=null,scenario,writable=false,issue='',view=null;
  try{
    profile=storage.getItem('oia-workshop-profile-v1')||profile;key='oia-facility-v1:'+encodeURIComponent(profile);
    raw=storage.getItem(key);
    scenario=raw===null?createFacility():loadFacility(raw);
    if(raw){const u=JSON.parse(raw).ui;if(u&&typeof u==='object')view=u;}
    writable=true;
  }catch(e){issue='Local recovery unavailable: '+e.message+'. The original entry is preserved.';scenario=createFacility();}
  return {profile,key,raw,scenario,writable,issue,view};
}
export function writeRecovery(slot,storage,scenario,ui={}){
  if(!slot.writable)return false;
  try{
    if((storage.getItem('oia-workshop-profile-v1')||'Learner')!==slot.profile||storage.getItem(slot.key)!==slot.raw)throw Error('Another view changed the active learner or saved scenario');
    const data=JSON.parse(saveFacility(scenario));data.ui=ui;const text=JSON.stringify(data);
    if(text!==slot.raw){storage.setItem(slot.key,text);slot.raw=text;}return true;
  }catch(e){slot.writable=false;slot.issue=e.message+'. Automatic recovery stopped. Export this run before choosing a recovery action.';return false;}
}
export function rearmRecovery(slot,storage){
  if(!slot.key||(storage.getItem('oia-workshop-profile-v1')||'Learner')!==slot.profile)throw Error('The original learner profile is unavailable. Export this run.');
  slot.raw=storage.getItem(slot.key);slot.writable=true;slot.issue='';
}
