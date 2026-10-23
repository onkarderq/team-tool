(function(root){
 const isDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T12:00:00Z').getTime())&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 function shift(day,offset){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
 const days=(end,count)=>Array.from({length:count},(_,i)=>shift(end,i-count+1));
 function dependencies(task){try{const list=JSON.parse(task.dependsOn||'[]');return Array.isArray(list)?list:[];}catch{return [];}}
 function dependencyError(state){
  const byId=new Map(state.tasks.map(t=>[t.id,t])),visited=new Set(),visiting=new Set();
  function visit(id){if(visiting.has(id))return true;if(visited.has(id))return false;visiting.add(id);for(const parent of dependencies(byId.get(id)))if(visit(parent))return true;visiting.delete(id);visited.add(id);return false;}
  for(const task of state.tasks){
   let ids;try{ids=JSON.parse(task.dependsOn||'[]');}catch{return 'Dependencies must be a list of task IDs.';}
   if(!Array.isArray(ids)||ids.length>50||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||id===task.id||!byId.has(id)))return 'A dependency is missing, duplicated, or points to the same task. Review the task dependencies.';
  }
  for(const task of state.tasks)if(visit(task.id))return 'These task dependencies form a cycle. Remove a link before saving.';
  return '';
 }
 function stampCompletion(before,after,day){
  if(after.status==='Done'&&before?.status!=='Done'){after.completedDate=after.completedDate||day;after.completedBy=after.person||'';}
  if(after.status!=='Done'&&before?.status==='Done'){after.completedDate='';after.completedBy='';}
  if(after.status==='Done'&&after.completedDate&&!after.completedBy)after.completedBy=after.person||'';
  return after;
 }
 function observeCapacity(state,day,idFactory){
  let changed=false;
  for(const person of state.people){
   const capacity=person.capacity==='Maximum'?'At capacity':person.capacity;
   if(!['Available','Balanced','At capacity'].includes(capacity))continue;
   state.capacityHistory??=[];
   const entry=state.capacityHistory.find(h=>h.person===person.id&&h.date===day);
   if(!entry){state.capacityHistory.push({id:idFactory(),person:person.id,date:day,capacity});changed=true;}
   else if(entry.capacity!==capacity){entry.capacity=capacity;changed=true;}
  }
  return changed;
 }
 function completed(state,person,from,to){return state.tasks.filter(t=>t.status==='Done'&&(t.completedBy||t.person)===person&&isDay(t.completedDate)&&t.completedDate>=from&&t.completedDate<=to);}
 function memberStats(state,person,end,count=15){
  const dates=days(end,count),from=dates[0],tasks=completed(state,person,from,end),history=(state.capacityHistory||[]).filter(h=>h.person===person&&h.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
  const leave=new Set((state.leaves||[]).filter(l=>l.person===person).map(l=>l.date));let observed=0,available=0;
  // Only dates with an actual observation count; unobserved past days remain unknown.
  for(const date of dates){const observation=history.find(h=>h.date===date);if(observation&&!leave.has(date)){observed++;if(observation.capacity==='Available')available++;}}
  const entries=(state.timeEntries||[]).filter(e=>e.person===person&&e.date>=from&&e.date<=end);
  return {person,from,to:end,completed:tasks.length,tasks,series:dates.map(date=>({date,count:tasks.filter(t=>t.completedDate===date).length})),minutes:entries.reduce((sum,e)=>sum+Number(e.minutes),0),timeEntries:entries.length,available,observed,leave:dates.filter(date=>leave.has(date)).length,unknownCompletions:state.tasks.filter(t=>t.status==='Done'&&(t.completedBy||t.person)===person&&!isDay(t.completedDate)).length};
 }
 function ranks(state,end,count=7){
  const stats=state.people.map(person=>({...memberStats(state,person.id,end,count),name:person.name})),values=stats.map(s=>s.completed),max=Math.max(0,...values),min=values.length?Math.min(...values):0;
  return stats.map(s=>({...s,tone:max===min?'neutral':s.completed===max?'high':s.completed===min?'low':'neutral'}));
 }
 function downstream(state,id){const result=new Set();function walk(parent){for(const task of state.tasks)if(dependencies(task).includes(parent)&&!result.has(task.id)){result.add(task.id);walk(task.id);}}walk(id);return [...result];}
 function leaveImpact(state,date,people){
  const ids=new Set(people||((state.leaves||[]).filter(l=>l.date===date).map(l=>l.person))),absent=new Set(ids);
  const affected=state.tasks.filter(t=>t.status!=='Done'&&ids.has(t.person)&&((t.due&&t.due<=date)||(!t.date||t.date<=date)));
  return affected.map(task=>{
   const owner=state.people.find(p=>p.id===task.person),blocked=downstream(state,task.id).map(id=>state.tasks.find(t=>t.id===id)).filter(t=>t.status!=='Done');
   const words=new Set((owner?.strengths||'').toLowerCase().split(/[,;\n]/).map(w=>w.trim()).filter(Boolean));
   const backups=state.people.filter(p=>!absent.has(p.id)&&p.id!==task.person&&p.capacity!=='At capacity'&&p.capacity!=='Maximum').map(p=>({person:p,shared:(p.strengths||'').toLowerCase().split(/[,;\n]/).filter(w=>words.has(w.trim())).length,load:state.tasks.filter(t=>t.person===p.id&&t.status!=='Done').length})).sort((a,b)=>b.shared-a.shared||a.load-b.load||a.person.name.localeCompare(b.person.name));
   return {task,owner,blocked,backups:backups.slice(0,3),reason:task.due&&task.due<=date?'Due by this leave date':'Open work assigned before this leave date'};
  });
 }
 const api={isDay,shift,days,dependencies,dependencyError,stampCompletion,observeCapacity,completed,memberStats,ranks,downstream,leaveImpact};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TeamspaceAnalytics=api;
})(globalThis);
