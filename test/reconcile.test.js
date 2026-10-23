const {test}=require('node:test');const assert=require('node:assert/strict');const R=require('../reconcile');const {valid}=require('../state');
const initial=()=>({people:[{id:'p',name:'Alex',role:'Engineer',strengths:'Systems',custom:'preserve'}],tasks:[{id:'t',title:'Work',person:'p',status:'To do'}],activities:[],notepad:'Original'});
test('three-way reconciliation merges independent records and fields without mutating snapshots',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.people[0].strengths='Local';remote.people[0].role='Remote';remote.tasks.push({id:'new',title:'Remote task'});local.notepad='Local note';remote.extra={nested:'keep'};
 const original=structuredClone([base,local,remote]),result=R.merge(base,local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.state.people[0].strengths,'Local');assert.equal(result.state.people[0].role,'Remote');assert.equal(result.state.people[0].custom,'preserve');assert.equal(result.state.tasks.length,2);assert.equal(result.state.notepad,'Local note');assert.deepEqual(result.state.extra,{nested:'keep'});assert.deepEqual([base,local,remote],original);
});
test('same-field and notepad edits require explicit choices',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.people[0].role='Local';remote.people[0].role='Remote';local.notepad='Offline note';remote.notepad='Server note';const review=R.merge(base,local,remote);assert.equal(review.conflicts.length,2);const choices=Object.fromEntries(review.conflicts.map(c=>[c.id,c.path[0]==='notepad'?'remote':'local']));const result=R.merge(base,local,remote,choices);assert.equal(result.conflicts.length,0);assert.equal(result.state.people[0].role,'Local');assert.equal(result.state.notepad,'Server note');
});
test('deletion versus changed record needs review; unchanged records can be deleted',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.people=[];remote.people[0].role='Changed';let result=R.merge(base,local,remote);assert.ok(result.conflicts.some(c=>c.path[0]==='people'));const choices=Object.fromEntries(result.conflicts.map(c=>[c.id,'remote']));result=R.merge(base,local,remote,choices);assert.equal(result.state.people[0].role,'Changed');
 const without=structuredClone(base);without.tasks=[];assert.equal(R.merge(base,without,base).state.tasks.length,0);
});
test('same leave and observation dates added in two sessions deduplicate by member and day',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.leaves=[{id:'l',person:'p',name:'Alex',date:'2026-10-24'}];remote.leaves=[{...local.leaves[0],id:'r'}];local.capacityHistory=[{id:'h',person:'p',date:'2026-10-24',capacity:'Available'}];remote.capacityHistory=[{...local.capacityHistory[0],id:'h2'}];const result=R.merge(base,local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.state.leaves.length,1);assert.equal(result.state.capacityHistory.length,1);assert.equal(valid(result.state),true);
});
test('new assignments to a remotely deleted member need a restore or unassign decision',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);remote.people=[];remote.tasks[0].person='';local.tasks.push({id:'new',title:'New assignment',person:'p'});const review=R.merge(base,local,remote);assert.equal(review.conflicts.length,1);assert.equal(review.conflicts[0].path[0],'missing-person');const id=review.conflicts[0].id;assert.equal(R.merge(base,local,remote,{[id]:'remote'}).state.tasks[1].person,'');assert.equal(R.merge(base,local,remote,{[id]:'local'}).state.people[0].id,'p');
});
test('independent dependency edits that form a cycle require choosing a consistent graph',()=>{
 const base=initial();base.tasks.push({id:'u',title:'Other',person:'p'});const local=structuredClone(base),remote=structuredClone(base);local.tasks[0].dependsOn='["u"]';remote.tasks[1].dependsOn='["t"]';assert.equal(valid(local),true);assert.equal(valid(remote),true);const review=R.merge(base,local,remote);assert.equal(review.conflicts.length,1);const id=review.conflicts[0].id;for(const choice of ['local','remote']){const result=R.merge(base,local,remote,{[id]:choice});assert.equal(result.conflicts.length,0);assert.equal(valid(result.state),true);}
});
test('combined time entries above a day require choosing one version of that day',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);local.timeEntries=[{id:'l',person:'p',date:'2026-10-24',minutes:'900'}];remote.timeEntries=[{id:'r',person:'p',date:'2026-10-24',minutes:'900'}];const review=R.merge(base,local,remote);assert.equal(review.conflicts.length,1);const result=R.merge(base,local,remote,{[review.conflicts[0].id]:'local'});assert.equal(result.state.timeEntries.length,1);assert.equal(valid(result.state),true);
});
test('member restoration and unassignment choices apply independently to every affected record',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);remote.people=[];remote.tasks[0].person='';local.tasks.push({id:'first',title:'First',person:'p'},{id:'second',title:'Second',person:'p'});
 const review=R.merge(base,local,remote);const choices=Object.fromEntries(review.conflicts.map(c=>[c.id,c.path[2]==='first'?'local':'remote']));const result=R.merge(base,local,remote,choices);assert.equal(result.conflicts.length,0);assert.equal(result.state.people.length,1);assert.equal(result.state.tasks.find(t=>t.id==='first').person,'p');assert.equal(result.state.tasks.find(t=>t.id==='second').person,'');
});
test('a chosen local dependency graph restores prerequisites removed in another session',()=>{
 const base=initial(),local=structuredClone(base),remote=structuredClone(base);remote.tasks=[];local.tasks.push({id:'new',title:'New dependent',person:'p',dependsOn:'["t"]'});const review=R.merge(base,local,remote);assert.equal(review.conflicts.length,1);const result=R.merge(base,local,remote,{[review.conflicts[0].id]:'local'});assert.equal(result.conflicts.length,0);assert.equal(result.state.tasks.length,2);assert.equal(valid(result.state),true);
});
test('unknown JSON fields are preserved without changing object prototypes',()=>{
 const base=initial(),local=JSON.parse(JSON.stringify(base)),remote=JSON.parse(JSON.stringify(base));Object.defineProperty(local.people[0],'__proto__',{value:'legacy text',enumerable:true});Object.defineProperty(local,'__proto__',{value:{custom:'metadata'},enumerable:true});const result=R.merge(base,local,remote);assert.equal(Object.getPrototypeOf(result.state),Object.prototype);assert.equal(Object.hasOwn(result.state,'__proto__'),true);assert.deepEqual(result.state.__proto__,{custom:'metadata'});assert.equal(result.state.people[0].__proto__,'legacy text');
});
