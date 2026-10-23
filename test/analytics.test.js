const {test}=require('node:test');const assert=require('node:assert/strict');const A=require('../analytics');const {valid}=require('../state');const {applyPlan}=require('../assistant-actions');
const day='2026-10-24';const initial=()=>({people:[{id:'p',name:'Alex',capacity:'Available',strengths:'Deployment, Coaching'},{id:'q',name:'Maya',capacity:'Balanced',strengths:'Deployment'},{id:'r',name:'Sam',capacity:'At capacity'}],tasks:[{id:'a',title:'Prepare',person:'p',date:'2026-10-23',due:day,status:'In progress'},{id:'b',title:'Release',person:'q',date:day,status:'To do',dependsOn:'["a"]'}],activities:[]});
test('analytics counts completion dates and credits rather than assignment dates',()=>{
 const state=initial();state.tasks.push({id:'c',title:'Done today',person:'q',completedBy:'p',date:'2020-01-01',status:'Done',completedDate:day},{id:'d',title:'Legacy done',person:'p',date:day,status:'Done'},{id:'e',title:'Outside window',person:'p',status:'Done',completedDate:'2026-10-09'},{id:'f',title:'Reopened',person:'p',status:'In progress',completedDate:day});
 const stats=A.memberStats(state,'p',day,15);assert.equal(stats.completed,1);assert.equal(stats.series.length,15);assert.equal(stats.series[14].count,1);assert.equal(stats.series[0].date,'2026-10-10');assert.equal(stats.unknownCompletions,1);
});
test('completion transitions record, retain, and clear completion metadata without inventing legacy dates',()=>{
 const original={id:'t',title:'Work',person:'p',status:'In progress',custom:'keep'},done=A.stampCompletion(original,{...original,status:'Done'},day);assert.equal(done.completedDate,day);assert.equal(done.completedBy,'p');assert.equal(done.custom,'keep');
 const renamed=A.stampCompletion(done,{...done,person:'q',title:'Changed'},'2026-10-25');assert.equal(renamed.completedDate,day);assert.equal(renamed.completedBy,'p');
 const reopened=A.stampCompletion(done,{...done,status:'To do'},day);assert.equal(reopened.completedDate,'');
 const legacy={id:'legacy',status:'Done',person:'p'};assert.equal(A.stampCompletion(legacy,{...legacy,title:'Edit'},day).completedDate,undefined);
});
test('rank colors include ties and treat everyone tied as neutral',()=>{
 const state=initial();assert.ok(A.ranks(state,day).every(row=>row.tone==='neutral'));
 state.tasks.push({id:'c',title:'Done',person:'p',status:'Done',completedDate:day});const rows=A.ranks(state,day);assert.equal(rows.find(r=>r.person==='p').tone,'high');assert.ok(rows.filter(r=>r.person!=='p').every(r=>r.tone==='low'));
});
test('time and availability metrics use explicit observations and exclude leave from available days',()=>{
 const state=initial();state.timeEntries=[{id:'e',person:'p',date:day,minutes:'90'},{id:'old',person:'p',date:'2020-01-01',minutes:'600'}];state.capacityHistory=[{id:'h',person:'p',date:day,capacity:'Available'},{id:'h2',person:'p',date:'2026-10-23',capacity:'Available'}];state.leaves=[{id:'l',person:'p',date:'2026-10-23'}];
 const result=A.memberStats(state,'p',day);assert.equal(result.minutes,90);assert.equal(result.available,1);assert.equal(result.observed,1);assert.equal(result.leave,1);
 let id=0;assert.equal(A.observeCapacity(state,day,()=>String(++id)),true);assert.equal(A.observeCapacity(state,day,()=>String(++id)),false);state.people[0].capacity='Balanced';A.observeCapacity(state,day,()=>String(++id));assert.equal(state.capacityHistory.find(h=>h.person==='p'&&h.date===day).capacity,'Balanced');
});
test('dependency validation rejects cycles and dangling edges and follows downstream chains',()=>{
 const state=initial();assert.equal(valid(state),true);assert.deepEqual(A.downstream(state,'a'),['b']);
 for(const dependsOn of ['["b"]','["missing"]','["a"]','["b","b"]','not json']){const next=structuredClone(state);next.tasks[0].dependsOn=dependsOn;assert.equal(valid(next),false,dependsOn);}
});
test('leave impact follows downstream work and suggests present members outside maximum capacity',()=>{
 const state=initial();state.leaves=[{id:'l',person:'p',date:day}];const [impact]=A.leaveImpact(state,day);assert.equal(impact.task.id,'a');assert.equal(impact.blocked[0].id,'b');assert.deepEqual(impact.backups.map(b=>b.person.id),['q']);state.leaves.push({id:'l2',person:'q',date:day});assert.equal(A.leaveImpact(state,day)[0].backups.length,0);
});
test('assistant completion updates feed analytics and task deletion removes dependency links',()=>{
 const state=initial();const plan={message:'',actions:[{kind:'update_task',id:'a',changes:[{field:'status',value:'Done'}],dates:[],page:''}]};const result=applyPlan(state,plan,day);assert.equal(result.state.tasks[0].completedDate,day);assert.equal(A.memberStats(result.state,'p',day).completed,1);
 plan.actions=[{kind:'delete_task',id:'a',changes:[],dates:[],page:''}];const removed=applyPlan(state,plan,day);assert.deepEqual(A.dependencies(removed.state.tasks[0]),[]);assert.equal(valid(removed.state),true);
});
test('extended records validate time-entry limits, observation uniqueness, and completion dates',()=>{
 const state=initial();assert.equal(valid({...state,timeEntries:[{id:'e',person:'p',date:day,minutes:'1440'}]}),true);
 for(const minutes of ['0','-1','1441','1.5','x'])assert.equal(valid({...state,timeEntries:[{id:'e',person:'p',date:day,minutes}]}),false);
 assert.equal(valid({...state,timeEntries:[{id:'e',person:'p',date:day,minutes:'800'},{id:'e2',person:'p',date:day,minutes:'800'}]}),false);
 assert.equal(valid({...state,capacityHistory:[{id:'h',person:'p',date:day,capacity:'Unknown'}]}),false);
 state.tasks[0].completedDate='2026-02-30';assert.equal(valid(state),false);
});
test('a proposed leave selection replaces saved leave when evaluating backup candidates',()=>{
 const state=initial();state.leaves=[{id:'l',person:'p',date:day}];const impact=A.leaveImpact(state,day,['q']);assert.equal(impact[0].task.id,'b');assert.ok(impact[0].backups.some(b=>b.person.id==='p'));
});
