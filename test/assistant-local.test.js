const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseCommand,dateValue,dateList,timeValue}=require('../assistant-local');
const {applyPlan}=require('../assistant-actions');
const today='2026-10-24';
const initial=()=>({people:[{id:'maya',name:'Maya Rao',role:'Engineer',notes:'Existing coaching note',legacy:'preserve'}],tasks:[{id:'deploy',title:'Deployment checklist',person:'maya',date:'2026-10-23',due:today,status:'To do',priority:'Medium',createdDate:'2026-10-22',extra:'preserve'}],activities:[{id:'lunch',title:'Team lunch',type:'Team bonding',status:'Planned',notes:'Existing activity note'}],leaves:[]});
const parse=(message,state=initial())=>parseCommand({message,today,state});
const execute=(message,state=initial())=>applyPlan(state,parse(message,state),today);
test('local mode handles direct member commands and polite prefixes',()=>{
 for(const message of ['Add Devendra as a Deployment and Configuration Engineer','Please kindly add member Devendra with role Deployment and Configuration Engineer']){
  const saved=execute(message).state;assert.equal(saved.people[1].name,'Devendra');assert.equal(saved.people[1].role,'Deployment and Configuration Engineer');assert.equal(saved.people[0].legacy,'preserve');
 }
 assert.equal(execute('Create member Devendra').state.people[1].capacity,'Balanced');
 assert.throws(()=>execute('Add Maya Rao as Engineer'),/already exists/);
});
test('leave commands mark only selected dates, expand explicit ranges, and remove only selected leave',()=>{
 const original=initial(),copy=structuredClone(original);
 const marked=execute('Kindly mark Maya Rao on leave on 2026-10-26 and 2026-10-28',original).state;
 assert.deepEqual(marked.leaves.map(l=>l.date),['2026-10-26','2026-10-28']);assert.deepEqual(original,copy);
 assert.equal(execute('Mark Maya Rao on leave on 2026-10-26 and 2026-10-28',marked).changed,false);
 const removed=execute('Remove leave for Maya Rao on 2026-10-26',marked).state;assert.deepEqual(removed.leaves.map(l=>l.date),['2026-10-28']);
 assert.deepEqual(execute('Add leave for Maya Rao from October 26 to October 28').state.leaves.map(l=>l.date),['2026-10-26','2026-10-27','2026-10-28']);
 assert.deepEqual(execute('Maya Rao will be off tomorrow').state.leaves.map(l=>l.date),['2026-10-25']);
 assert.equal(execute("Cancel Maya Rao's leave on 2026-10-26",marked).state.leaves.length,1);
});
test('dates and times use the supplied local day and reject ambiguous or invalid inputs',()=>{
 for(const [input,output] of [['today',today],['tomorrow','2026-10-25'],['Monday','2026-10-26'],['next Saturday','2026-10-31'],['October 28th','2026-10-28'],['28 Oct 2026','2026-10-28'],['Jan 1','2027-01-01'],['February 29 2028','2028-02-29']])assert.equal(dateValue(input,today),output);
 assert.deepEqual(dateList('October 26, 2026 and October 28, 2026',today),['2026-10-26','2026-10-28']);
 for(const input of ['2026-02-30','02/03/2026','sometime','February 29 2027'])assert.throws(()=>dateValue(input,today));
 for(const input of ['2026-10-28 to 2026-10-26','2026-01-01 through 2026-12-31'])assert.throws(()=>dateList(input,today));
 for(const [input,output] of [['10:30 AM','10:30'],['12 AM','00:00'],['12 PM','12:00'],['14:45','14:45']])assert.equal(timeValue(input),output);
 for(const input of ['10','25:00','13 PM','10:99 AM'])assert.throws(()=>timeValue(input));
});
test('local task creation and updates preserve metadata and use canonical statuses',()=>{
 const saved=execute('Assign "Prepare release" to Maya Rao, due tomorrow, high priority').state;
 const task=saved.tasks[1];assert.equal(task.person,'maya');assert.equal(task.due,'2026-10-25');assert.equal(task.priority,'High');assert.equal(task.status,'To do');assert.equal(task.createdDate,today);
 for(const [command,field,value] of [
  ['Set task "Deployment checklist" status to ongoing','status','In progress'],
  ['Change due date for task "Deployment checklist" to Monday','due','2026-10-26'],
  ['Set task "Deployment checklist" priority to low','priority','Low'],
  ['Set task "Deployment checklist" owner to unassigned','person',''],
  ['Set task "Deployment checklist" blocker to Waiting for access','blocker','Waiting for access'],
  ['Set task "Deployment checklist" outcome to Stable deployment','outcome','Stable deployment'],
  ['Set task "Deployment checklist" work date to tomorrow','date','2026-10-25'],
  ['Set task "Deployment checklist" title to Final deployment','title','Final deployment'],
  ['Mark task "Deployment checklist" as completed','status','Done']
 ]){const item=execute(command).state.tasks[0];assert.equal(item[field],value,command);assert.equal(item.extra,'preserve');assert.equal(item.createdDate,'2026-10-22');}
 const assigned=execute('Assign "Deployment checklist" to Maya Rao, due tomorrow').state;assert.equal(assigned.tasks.length,1);assert.equal(assigned.tasks[0].due,'2026-10-25');
});
test('member coaching, check-ins, and activities support direct commands',()=>{
 for(const [command,field,value] of [["Set Maya Rao's capacity to maximum",'capacity','At capacity'],['Set strengths for Maya Rao to Mentoring and troubleshooting','strengths','Mentoring and troubleshooting'],["Set Maya Rao’s growth focus to Handover",'focus','Handover'],['Set role for Maya Rao to Lead Engineer','role','Lead Engineer']])assert.equal(execute(command).state.people[0][field],value,command);
 const scheduled=execute('Schedule a one-to-one with Maya Rao tomorrow at 10:30 AM').state.people[0];assert.equal(scheduled.checkin,'2026-10-25');assert.equal(scheduled.checkinTime,'10:30');
 assert.equal(execute('Append a note for Maya Rao: Lead the next handover').state.people[0].notes,'Existing coaching note\nLead the next handover');
 const activity=execute('Plan activity "Workshop" for Maya Rao on tomorrow, type Learning').state.activities[1];assert.equal(activity.type,'Learning');assert.equal(activity.date,'2026-10-25');assert.equal(activity.person,'maya');
 assert.equal(execute('Set activity "Team lunch" status to done').state.activities[0].status,'Done');
 assert.equal(execute('Append a note for activity "Team lunch": Bring snacks').state.activities[0].notes,'Existing activity note\nBring snacks');
});
test('ambiguous members and tasks require disambiguation without changing records',()=>{
 const state=initial();state.people.push({id:'maya2',name:'Maya Singh',role:'Manager'});
 let result=execute('Mark Maya on leave tomorrow',state);assert.equal(result.changed,false);assert.match(result.message,/More than one member/);
 state.people.push({id:'maya3',name:'Maya Rao',role:'Manager'});
 result=execute('Mark Maya Rao (Manager) on leave tomorrow',state);assert.equal(result.state.leaves[0].person,'maya3');
 state.tasks.push({...state.tasks[0],id:'deploy2',person:'maya2'});
 result=execute('Set task "Deployment checklist" status to done',state);assert.equal(result.changed,false);assert.match(result.message,/More than one task/);
 result=execute('Set task "Deployment checklist" for Maya Singh status to done',state);assert.equal(result.state.tasks[1].status,'Done');assert.equal(result.state.tasks[0].status,'To do');
});
test('unsupported, incomplete, hypothetical, and invalid commands do not mutate the workspace',()=>{
 for(const command of ["Don't delete member Maya Rao",'How do I delete member Maya Rao','What if I add a member','Add member Chris; delete member Maya Rao','Mark Maya Rao on leave on 2026-02-30','Mark Maya Rao on leave','Mark Missing on leave tomorrow','Schedule a one-to-one with Maya Rao tomorrow at 10','Mark Maya Rao on leave on October 26 and garbage','Mark Maya Rao on leave on today and','Add member Maya Rao on leave tomorrow','Please do everything for me','Assign "New work" to Missing, due tomorrow','Set Maya Rao\'s capacity to impossible','Set Maya Rao\'s capacity to constructor','Set task "Deployment checklist" status to imaginary','Open constructor','Create member Chris\nDelete member Maya Rao']){
  const state=initial(),before=structuredClone(state),plan=parse(command,state);assert.equal(plan.actions.length,0,command);assert.ok(plan.message,command);assert.deepEqual(state,before,command);assert.equal(applyPlan(state,plan,today).changed,false,command);
 }
});
test('local read commands produce real navigation and keep the workspace unchanged',()=>{
 const state=initial();state.leaves.push({id:'l',person:'maya',name:'Maya Rao',date:today});
 for(const command of ['help','Who is off today','Show team members','How many team members are there','Show tasks due tomorrow',"Show Maya Rao's profile",'Open calendar','Export backup','Import backup']){
  const result=execute(command,state);assert.equal(result.changed,false,command);assert.ok(result.message,command);
 }
 assert.deepEqual(execute('Show tasks due tomorrow').ui,[{kind:'view_due',date:'2026-10-25'}]);
 assert.match(execute('Who is off today',state).message,/Maya Rao/);
 assert.match(execute('help').message,/not a general AI chatbot/);
});
test('local deletions flag confirmation and do not alter original state',()=>{
 for(const command of ['Delete member Maya Rao','Delete task "Deployment checklist"','Delete activity "Team lunch"']){const state=initial(),before=structuredClone(state);const result=execute(command,state);assert.equal(result.destructive,true);assert.equal(result.changed,true);assert.deepEqual(state,before);}
});
test('task titles containing activity are still treated as tasks',()=>{
 const state=initial();state.tasks[0].title='Review activity log';assert.equal(execute('Set task "Review activity log" status to done',state).state.tasks[0].status,'Done');
});
test('quoted titles and case-insensitive command words resolve the intended record',()=>{
 for(const title of ['Prepare for launch','Review (Draft)','Task force review']){const state=initial();state.tasks[0].title=title;assert.equal(execute(`SET TASK "${title}" STATUS TO DONE`,state).state.tasks[0].status,'Done');}
 const state=initial();state.tasks[0].title='Prepare for launch';state.tasks.push({...state.tasks[0],id:'second',person:''});
 const saved=execute('Set task "Prepare for launch" for Maya Rao status to done',state).state;assert.equal(saved.tasks[0].status,'Done');assert.equal(saved.tasks[1].status,'To do');
});
