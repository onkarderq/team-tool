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
test('availability metrics use explicit observations and exclude leave from available days',()=>{
 const state=initial();state.capacityHistory=[{id:'h',person:'p',date:day,capacity:'Available'},{id:'h2',person:'p',date:'2026-10-23',capacity:'Available'}];state.leaves=[{id:'l',person:'p',date:'2026-10-23'}];
 const result=A.memberStats(state,'p',day);assert.equal(result.available,1);assert.equal(result.observed,1);assert.equal(result.leave,1);
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
test('legacy time-entry compatibility, observation uniqueness, and completion dates remain validated',()=>{
 const state=initial();assert.equal(valid({...state,timeEntries:[{id:'e',person:'p',date:day,minutes:'1440'}]}),true);
 for(const minutes of ['0','-1','1441','1.5','x'])assert.equal(valid({...state,timeEntries:[{id:'e',person:'p',date:day,minutes}]}),false);
 assert.equal(valid({...state,timeEntries:[{id:'e',person:'p',date:day,minutes:'800'},{id:'e2',person:'p',date:day,minutes:'800'}]}),false);
 assert.equal(valid({...state,capacityHistory:[{id:'h',person:'p',date:day,capacity:'Unknown'}]}),false);
 state.tasks[0].completedDate='2026-02-30';assert.equal(valid(state),false);
});
test('a proposed leave selection replaces saved leave when evaluating backup candidates',()=>{
 const state=initial();state.leaves=[{id:'l',person:'p',date:day}];const impact=A.leaveImpact(state,day,['q']);assert.equal(impact[0].task.id,'b');assert.ok(impact[0].backups.some(b=>b.person.id==='p'));
});

test('leave totals count unique dates per member over 30 days independently of chart length',()=>{
 const state=initial();state.leaves=[
  {person:'p',date:day},{person:'p',date:A.shift(day,-29)},
  {person:'p',date:A.shift(day,-20)},{person:'p',date:A.shift(day,-20)},
  {person:'p',date:A.shift(day,-30)},{person:'p',date:A.shift(day,1)},
  {person:'q',date:day},{person:'p',date:'invalid'}
 ];
 for(const count of [7,15,60]){
  assert.equal(A.memberStats(state,'p',day,count).leave,3);
  assert.equal(A.memberStats(state,'q',day,count).leave,1);
  assert.equal(A.memberStats(state,'r',day,count).leave,0);
 }
});
test('rolling leave totals cross year boundaries and include leap days',()=>{
 for(const [end,first,excluded] of [['2027-01-10','2026-12-12','2026-12-11'],['2028-03-15','2028-02-15','2028-02-14']]){
  const state=initial();state.leaves=[{person:'p',date:first},{person:'p',date:end},{person:'p',date:excluded}];
  assert.equal(A.leaveDays(state,'p',end),2);
 }
 const state=initial();state.leaves=[{person:'p',date:'2028-02-29'},{person:'p',date:'2027-02-29'}];
 assert.equal(A.leaveDays(state,'p','2028-03-15'),1);
});

test('presentation presets use the same inclusive range for completions, charts and actual leave',()=>{
 const state=initial();state.tasks=[];state.leaves=[];
 for(let offset=0;offset<=90;offset++){
  const date=A.shift(day,-offset);state.tasks.push({id:'t'+offset,title:'Delivery',person:'p',completedBy:'p',status:'Done',completedDate:date});state.leaves.push({id:'l'+offset,person:'p',date});
 }
 state.tasks.push({id:'future',title:'Future',person:'p',status:'Done',completedDate:A.shift(day,1)},{id:'legacy',title:'Old record',person:'p',status:'Done'});
 state.leaves.push({id:'future',person:'p',date:A.shift(day,1)});
 for(const count of [1,7,15,30,45,50,60,90]){
  const report=A.presentationReport(state,day,{count}),row=report.rows.find(r=>r.person==='p');
  assert.equal(row.completed,count);assert.equal(row.leave,count);assert.equal(row.series.length,count);assert.equal(row.series[0].date,A.shift(day,1-count));assert.equal(row.series.at(-1).date,day);assert.equal(report.total,count);assert.equal(report.leave,count);
  assert.equal(report.rows.find(r=>r.person==='q').leave,0);
 }
});
test('presentation filters, rankings and stable sorts use only matching members without changing records',()=>{
 const state=initial();state.people[0].role='Engineer';state.people[1].role='Engineer';state.people[2].role='Lead';
 state.tasks.push({id:'p-done',title:'Ship',person:'p',status:'Done',completedDate:day,due:day},{id:'q-done',title:'Ship late',person:'q',status:'Done',completedDate:day,due:A.shift(day,-1)},{id:'q-done2',title:'Ship second',person:'q',status:'Done',completedDate:day},{id:'blocked',title:'Waiting',person:'r',status:'Blocked',due:A.shift(day,-1)});
 state.leaves=[{id:'l1',person:'p',date:A.shift(day,-20)},{id:'l2',person:'q',date:day}];const original=structuredClone(state);
 const report=options=>A.presentationReport(state,day,{count:30,...options});
 assert.deepEqual(report().rows.map(r=>r.person),['q','p','r']);assert.equal(report({person:'p'}).rows[0].tone,'neutral');
 assert.deepEqual(report({role:'Engineer'}).rows.map(r=>r.person),['q','p']);assert.equal(report({role:'missing'}).rows.length,0);
 for(const [focus,expected] of [['completed',['q','p']],['no-completions',['r']],['blocked',['r']],['overdue',['r']],['leave',['q','p']]])assert.deepEqual(report({focus}).rows.map(r=>r.person),expected);
 assert.deepEqual(report({sort:'fewest'}).rows.map(r=>r.person),['r','p','q']);assert.deepEqual(report({sort:'name'}).rows.map(r=>r.person),['p','q','r']);assert.deepEqual(report({sort:'leave'}).rows.map(r=>r.person),['p','q','r']);assert.deepEqual(report({sort:'overdue'}).rows.map(r=>r.person),['r','p','q']);
 assert.equal(report({person:'p'}).rows[0].onTime,1);assert.equal(report({person:'q'}).rows[0].onTime,0);assert.equal(report({person:'q'}).rows[0].datedDeadlines,1);
 assert.deepEqual(state,original);
});
test('historical presentation excludes later leave and completions while labeling current workload separately',()=>{
 const state=initial(),end=A.shift(day,-20);state.tasks.push({id:'old',title:'Earlier delivery',person:'p',status:'Done',completedDate:end},{id:'new',title:'Later delivery',person:'p',status:'Done',completedDate:day},{id:'overdue',title:'Now overdue',person:'p',status:'Blocked',due:A.shift(day,-1)});
 state.leaves=[{person:'p',date:end},{person:'p',date:day},{person:'q',date:end},{person:'p',date:end}];
 const {rows}=A.presentationReport(state,end,{count:1,today:day,person:'p'});assert.equal(rows[0].completed,1);assert.equal(rows[0].leave,1);assert.deepEqual(rows[0].leaveDates,[end]);assert.equal(rows[0].overdue,1);
 for(const count of [0,-1,367,1.5,NaN,'60'])assert.throws(()=>A.presentationReport(state,day,{count}),RangeError);
 assert.throws(()=>A.presentationReport(state,'2026-02-30'),RangeError);
});

test('period comparison uses adjacent equal windows and keeps the same filtered member cohort',()=>{
 const state=initial();state.people[0].role='Engineer';state.people[1].role='Lead';state.tasks.push({id:'new',title:'Now',person:'p',status:'Done',completedDate:day},{id:'old',title:'Before',person:'p',status:'Done',completedDate:A.shift(day,-15)},{id:'earlier',title:'Outside prior range',person:'p',status:'Done',completedDate:A.shift(day,-30)},{id:'hidden',title:'Other member',person:'q',status:'Done',completedDate:A.shift(day,-16)});
 state.leaves=[{person:'p',date:day},{person:'p',date:A.shift(day,-29)},{person:'q',date:A.shift(day,-16)}];const original=structuredClone(state);
 const report=A.periodComparison(state,day,{count:15,role:'Engineer',focus:'completed'});assert.equal(report.from,A.shift(day,-14));assert.equal(report.previous.to,A.shift(day,-15));assert.equal(report.previous.from,A.shift(day,-29));assert.equal(report.total,1);assert.equal(report.previous.total,1);assert.equal(report.leave,1);assert.equal(report.previous.leave,1);assert.deepEqual(report.previous.rows.map(r=>r.person),['p']);assert.equal(report.rows[0].previous.completed,1);assert.equal(report.completionChange.change,0);assert.deepEqual(state,original);state.people[1].role='Engineer';const cohort=A.periodComparison(state,day,{count:15,focus:'completed'});assert.deepEqual(cohort.rows.map(r=>r.person),['p']);assert.equal(cohort.previous.total,1);
});
test('comparison never invents percentage growth when the baseline is zero and supports one-day windows',()=>{
 const state=initial();state.tasks.push({id:'new',title:'Now',person:'p',status:'Done',completedDate:day});const report=A.periodComparison(state,day,{count:1,person:'p'});assert.equal(report.previous.from,A.shift(day,-1));assert.equal(report.previous.to,A.shift(day,-1));assert.equal(report.completionChange.change,1);assert.equal(report.completionChange.percent,null);
 state.tasks.push({id:'old',title:'Before',person:'p',status:'Done',completedDate:A.shift(day,-1)},{id:'old2',title:'Before again',person:'p',status:'Done',completedDate:A.shift(day,-1)});const decline=A.periodComparison(state,day,{count:1,person:'p'});assert.equal(decline.completionChange.percent,-50);assert.equal(decline.completionChange.change,-1);
});
