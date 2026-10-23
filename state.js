(function(root){
 const Analytics=typeof module!=='undefined'&&module.exports?require('./analytics'):root.TeamspaceAnalytics;
 function isDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'0001-01-01'||value>'9999-12-31')return false;
  const parsed=new Date(value+'T12:00:00Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
 }
 function isTime(value){return typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);}
 function records(items){return Array.isArray(items)&&items.every(item=>item&&typeof item.id==='string'&&Object.values(item).every(value=>typeof value==='string'));}
 function valid(state){
  if(!state||!['people','tasks','activities'].every(key=>records(state[key]))||!state.people.every(p=>p.name)||!state.tasks.every(t=>t.title)||!state.activities.every(a=>a.title))return false;
  if(['people','tasks','activities'].some(key=>new Set(state[key].map(row=>row.id)).size!==state[key].length))return false;
  if(state.tasks.some(t=>t.completedDate&&!isDay(t.completedDate)))return false;
  if(Analytics&&Analytics.dependencyError(state))return false;
  for(const key of ['timeEntries','capacityHistory'])if(state[key]!==undefined&&(!records(state[key])||new Set(state[key].map(row=>row.id)).size!==state[key].length))return false;
  if(state.timeEntries?.some(entry=>!entry.person||!isDay(entry.date)||!/^\d+$/.test(entry.minutes)||Number(entry.minutes)<1||Number(entry.minutes)>1440))return false;
  if(state.timeEntries){const totals=new Map();for(const entry of state.timeEntries){const key=JSON.stringify([entry.person,entry.date]);totals.set(key,(totals.get(key)||0)+Number(entry.minutes));if(totals.get(key)>1440)return false;}}
  if(state.capacityHistory&&(state.capacityHistory.some(h=>!h.person||!isDay(h.date)||!['Available','Balanced','At capacity'].includes(h.capacity))||new Set(state.capacityHistory.map(h=>JSON.stringify([h.person,h.date]))).size!==state.capacityHistory.length))return false;
  if(state.notepad!==undefined&&(typeof state.notepad!=='string'||state.notepad.length>100000))return false;
  if(state.leaves!==undefined){
   if(!records(state.leaves)||!state.leaves.every(leave=>leave.person&&isDay(leave.date)))return false;
   if(new Set(state.leaves.map(leave=>JSON.stringify([leave.date,leave.person]))).size!==state.leaves.length)return false;
  }
  return true;
 }
 const api={valid,isDay,isTime};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TeamspaceState=api;
})(globalThis);
