(function(root){
 const collections=['people','tasks','activities','leaves','timeEntries','capacityHistory'];
 const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
 function canonical(value){if(value===undefined)return 'undefined';if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';return JSON.stringify(value);}
 const equal=(a,b)=>canonical(a)===canonical(b);
 const set=(object,key,value)=>Object.defineProperty(object,key,{value,enumerable:true,configurable:true,writable:true});
 const get=(object,key)=>object&&Object.hasOwn(object,key)?object[key]:undefined;
 function merge(base,local,remote,choices={}){
  const conflicts=[];
  function choose(path,b,l,r,label){
   if(equal(l,r))return copy(l);if(equal(l,b))return copy(r);if(equal(r,b))return copy(l);
   const id=JSON.stringify(path),choice=choices[id];
   if(choice!=='local'&&choice!=='remote')conflicts.push({id,path,label,base:copy(b),local:copy(l),remote:copy(r)});
   return copy(choice==='remote'?r:l);
  }
  const output={};
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
   if(!collections.includes(key)){const value=choose([key],get(base,key),get(local,key),get(remote,key),key==='notepad'?'Workspace notepad':key);if(value!==undefined)set(output,key,value);continue;}
   const semantic=['leaves','capacityHistory'].includes(key),keyOf=row=>semantic?JSON.stringify([row.person,row.date]):row.id;
   const index=list=>new Map((list||[]).map(row=>[keyOf(row),row])),b=index(base[key]),l=index(local[key]),r=index(remote[key]),rows=[];
   for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])){
    let before=b.get(id),left=l.get(id),right=r.get(id);
    if(semantic){const chosenId=before?.id||right?.id||left?.id;before=before&&{...before,id:chosenId};left=left&&{...left,id:chosenId};right=right&&{...right,id:chosenId};}
    const label=(left||right||before)?.name||(left||right||before)?.title||`${key} ${id}`;
    if(!left||!right){const value=choose([key,id],before,left,right,label+' (record deletion)');if(value!==undefined)rows.push(value);continue;}
    const row={};for(const field of new Set([...Object.keys(before||{}),...Object.keys(left),...Object.keys(right)])){
     const value=choose([key,id,field],get(before,field),get(left,field),get(right,field),label+' · '+field);if(value!==undefined)set(row,field,value);
    }rows.push(row);
   }
   if(rows.length||base[key]!==undefined||local[key]!==undefined||remote[key]!==undefined)output[key]=rows;
  }
  // A newly created assignment can reference a member deleted in another session.
  const mergedPeople=new Set(output.people.map(person=>person.id));
  for(const group of ['tasks','activities'])for(const item of output[group]||[]){
   if(!item.person||mergedPeople.has(item.person))continue;
   const person=(local.people||[]).find(p=>p.id===item.person)||(base.people||[]).find(p=>p.id===item.person);if(!person)continue;
   const id=JSON.stringify(['missing-person',group,item.id]),choice=choices[id];
   if(!['local','remote'].includes(choice))conflicts.push({id,path:['missing-person',group,item.id],label:`${item.title}: ${person.name} was removed in another session`,base:person.name,local:'Restore '+person.name+' and keep the assignment',remote:'Keep the removal and unassign this work'});
   if(choice==='local'&&!output.people.some(p=>p.id===person.id))output.people.push(copy(person));else if(choice==='remote')item.person='';
  }
  const analytics=typeof module!=='undefined'&&module.exports?require('./analytics'):root.TeamspaceAnalytics;
  const graphError=analytics.dependencyError(output);
  if(graphError){
   const id=JSON.stringify(['task-relationships']),choice=choices[id];
   const describe=state=>state.tasks.map(t=>({task:t.title,dependsOn:analytics.dependencies(t).map(parent=>state.tasks.find(p=>p.id===parent)?.title||parent)}));
   if(!['local','remote'].includes(choice))conflicts.push({id,path:['task-relationships'],label:graphError+' Choose a consistent set of relationships. Local relationships may restore required prerequisite tasks.',base:describe(base),local:describe(local),remote:describe(remote)});
   else{
    const source=choice==='local'?local:remote,sourceTasks=new Map(source.tasks.map(t=>[t.id,t]));
    const restore=id=>{if(output.tasks.some(t=>t.id===id))return;const task=sourceTasks.get(id);if(task){output.tasks.push(copy(task));analytics.dependencies(task).forEach(restore);}};
    for(const task of [...output.tasks]){const parentIds=sourceTasks.has(task.id)?analytics.dependencies(sourceTasks.get(task.id)):[];task.dependsOn=JSON.stringify(parentIds);parentIds.forEach(restore);}
   }
  }
  const totals=new Map();for(const entry of output.timeEntries||[]){const key=JSON.stringify([entry.person,entry.date]);totals.set(key,(totals.get(key)||0)+Number(entry.minutes));}
  for(const [key,total] of totals)if(total>1440){
   const [person,date]=JSON.parse(key),id=JSON.stringify(['time-limit',person,date]),choice=choices[id],select=state=>(state.timeEntries||[]).filter(e=>e.person===person&&e.date===date);
   if(!['local','remote'].includes(choice))conflicts.push({id,path:['time-limit',person,date],label:`Time entries for ${date} exceed 24 hours when combined. Choose the entries to keep.`,base:select(base),local:select(local),remote:select(remote)});
   else output.timeEntries=[...output.timeEntries.filter(e=>e.person!==person||e.date!==date),...copy(select(choice==='local'?local:remote))];
  }
  return {state:output,conflicts};
 }
 const api={merge,equal,copy};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TeamspaceReconcile=api;
})(globalThis);
