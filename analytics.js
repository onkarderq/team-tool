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
 function leaveDates(state,person,from,to){
  return [...new Set((state.leaves||[]).filter(l=>l.person===person&&isDay(l.date)&&l.date>=from&&l.date<=to).map(l=>l.date))].sort();
 }
 // Profiles keep a rolling 30-day total; presentation uses its selected period.
 function leaveDays(state,person,end){return leaveDates(state,person,shift(end,-29),end).length;}
 function memberStats(state,person,end,count=15){
  const dates=days(end,count),from=dates[0],tasks=completed(state,person,from,end),history=(state.capacityHistory||[]).filter(h=>h.person===person&&h.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
  const leave=new Set((state.leaves||[]).filter(l=>l.person===person).map(l=>l.date));let observed=0,available=0;
  // Only dates with an actual observation count; unobserved past days remain unknown.
  for(const date of dates){const observation=history.find(h=>h.date===date);if(observation&&!leave.has(date)){observed++;if(observation.capacity==='Available')available++;}}
  return {person,from,to:end,completed:tasks.length,tasks,series:dates.map(date=>({date,count:tasks.filter(t=>t.completedDate===date).length})),available,observed,leave:leaveDays(state,person,end),unknownCompletions:state.tasks.filter(t=>t.status==='Done'&&(t.completedBy||t.person)===person&&!isDay(t.completedDate)).length};
 }
 function ranks(state,end,count=7){
  const stats=state.people.map(person=>({...memberStats(state,person.id,end,count),name:person.name})),values=stats.map(s=>s.completed),max=Math.max(0,...values),min=values.length?Math.min(...values):0;
  return stats.map(s=>({...s,tone:max===min?'neutral':s.completed===max?'high':s.completed===min?'low':'neutral'}));
 }
 function presentationReport(state,end,options={}){
  const count=options.count??15;
  if(!isDay(end)||!Number.isInteger(count)||count<1||count>366)throw new RangeError('Choose a valid report date and 1–366 days.');
  const from=shift(end,1-count),currentDay=options.today||end;
  let rows=state.people.filter(p=>(!options.person||p.id===options.person)&&(!options.role||p.role===options.role)).map(p=>{
   const stats=memberStats(state,p.id,end,count),recordedLeave=leaveDates(state,p.id,from,end),open=state.tasks.filter(t=>t.person===p.id&&t.status!=='Done');
   return {...stats,name:p.name,role:p.role||'Team member',leave:recordedLeave.length,leaveDates:recordedLeave,open:open.length,blocked:open.filter(t=>t.status==='Blocked').length,overdue:open.filter(t=>isDay(t.due)&&t.due<currentDay).length,onTime:stats.tasks.filter(t=>isDay(t.due)&&t.completedDate<=t.due).length,datedDeadlines:stats.tasks.filter(t=>isDay(t.due)).length};
  });
  const focus={completed:r=>r.completed>0,'no-completions':r=>r.completed===0,blocked:r=>r.blocked>0,overdue:r=>r.overdue>0,leave:r=>r.leave>0};
  if(focus[options.focus])rows=rows.filter(focus[options.focus]);
  const counts=rows.map(r=>r.completed),max=Math.max(0,...counts),min=counts.length?Math.min(...counts):0;
  rows=rows.map(r=>({...r,tone:max===min?'neutral':r.completed===max?'high':r.completed===min?'low':'neutral'}));
  const order={most:(a,b)=>b.completed-a.completed,fewest:(a,b)=>a.completed-b.completed,name:(a,b)=>a.name.localeCompare(b.name),leave:(a,b)=>b.leave-a.leave,open:(a,b)=>b.open-a.open,overdue:(a,b)=>b.overdue-a.overdue};
  rows.sort((a,b)=>(order[options.sort]||order.most)(a,b)||a.name.localeCompare(b.name));
  return {from,to:end,count,rows,max,min,total:rows.reduce((sum,r)=>sum+r.completed,0),leave:rows.reduce((sum,r)=>sum+r.leave,0)};
 }
 function periodComparison(state,end,options={}){
  const current=presentationReport(state,end,options),previousEnd=shift(current.from,-1),prior=presentationReport(state,previousEnd,{...options,count:current.count,focus:'',today:options.today||end});
  const shown=new Set(current.rows.map(r=>r.person)),previousRows=prior.rows.filter(r=>shown.has(r.person)),byId=new Map(previousRows.map(r=>[r.person,r]));
  const delta=(value,previous)=>({value,previous,change:value-previous,percent:previous===0?null:(value-previous)/previous*100});
  const previousTotal=previousRows.reduce((sum,r)=>sum+r.completed,0),previousLeave=previousRows.reduce((sum,r)=>sum+r.leave,0);
  return {...current,rows:current.rows.map(row=>({...row,previous:byId.get(row.person),completionChange:delta(row.completed,byId.get(row.person)?.completed||0)})),previous:{from:prior.from,to:prior.to,rows:previousRows,total:previousTotal,leave:previousLeave},completionChange:delta(current.total,previousTotal),leaveChange:delta(current.leave,previousLeave)};
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
 const api={isDay,shift,days,dependencies,dependencyError,stampCompletion,observeCapacity,completed,leaveDates,leaveDays,memberStats,ranks,presentationReport,periodComparison,downstream,leaveImpact};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TeamspaceAnalytics=api;
})(globalThis);
