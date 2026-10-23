const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
function app(data){
 const elements=new Map();
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{textContent:'',innerHTML:'',showModal(){this.open=true;}});return elements.get(selector);};
 const context=vm.createContext({document:{querySelector:element,querySelectorAll:()=>[],getElementById:element,addEventListener(){}},window:{addEventListener(){}},fetch:()=>new Promise(()=>{}),setInterval(){},Intl,Date});
 vm.runInContext(readFileSync(require.resolve('../app.js'),'utf8'),context);
 context.fixture=data;vm.runInContext('state=fixture',context);
 return {run:code=>vm.runInContext(code,context),element,setFetch:fetch=>{context.fetch=fetch;}};
}
test('member profile shows active work and exactly four most recent dated assignments',()=>{
 const fixture={people:[{id:'p1',name:'Alex',strengths:'Mentoring & ownership'}],tasks:Array.from({length:6},(_,i)=>({id:'t'+i,title:'Task '+i,person:'p1',date:'2026-01-0'+(i+1),status:i===5?'Blocked':'Done'})),activities:[]};
 // Imported backups can arrive in any array order.
 fixture.tasks.reverse();
 const view=app(fixture);view.run("openMember('p1')");
 const html=view.element('#member-content').innerHTML;
 assert.ok(html.includes('Mentoring &amp; ownership'));
 const timeline=html.split('<ol class="timeline">')[1].split('</ol>')[0];
 assert.equal((timeline.match(/<li>/g)||[]).length,4);
 assert.ok(timeline.indexOf('Task 5')<timeline.indexOf('Task 4'));
 assert.ok(timeline.includes('2026-01-06'));
 assert.ok(!timeline.includes('Task 1'));
 assert.equal((html.match(/class="profile-task"/g)||[]).length,1);
 assert.equal(view.element('#member-detail').open,true);
});
test('dashboard handles empty workspaces without invented progress or people',()=>{
 const view=app({people:[],tasks:[],activities:[]});
 const html=view.run("dashboard(()=> '')");
 assert.ok(html.includes('0%'));
 assert.ok(html.includes('Add your first member'));
 assert.ok(!html.includes('NaN'));
});
test('member-provided text is escaped in cards, action queues, and profiles',()=>{
 const view=app({people:[{id:'p1',name:'<script>alert(1)</script>',strengths:'<img src=x onerror=alert(1)>'}],tasks:[{id:'t1',person:'p1',title:'<svg onload=alert(1)>',status:'Blocked',priority:'High',date:'2026-01-01'}],activities:[]});
 const html=view.run("dashboard(()=> '')");
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('<svg onload'));
 view.run("openMember('p1')");
 assert.ok(!view.element('#member-content').innerHTML.includes('<img'));
});
test('summary navigation resets old filters and selects matching assignments',()=>{
 const view=app({people:[],tasks:[],activities:[]});
 view.element('#content h1').setAttribute=()=>{};
 view.element('#content h1').focus=()=>{};
 view.element('#content h1').scrollIntoView=()=>{};
 view.run("filter={date:'2020-01-01',person:'old',status:'Done',search:'old'};openSummary('overdue')");
 assert.equal(view.run('page'),'tasks');
 assert.equal(view.run('filter.scope'),'overdue');
 assert.equal(view.run('filter.date+filter.person+filter.search+filter.status'),'');
 assert.equal(view.run("matchesTaskScope({status:'Done',due:'2000-01-01'},filter.scope)"),false);
 assert.equal(view.run("matchesTaskScope({status:'Blocked',due:'2000-01-01'},filter.scope)"),true);
 view.run("openSummary('blocked')");
 assert.equal(view.run('filter.status'),'Blocked');
 assert.equal(view.run('filter.scope'),'active');
 view.run("openSummary('active')");
 assert.equal(view.run("matchesTaskScope({status:'Done'},filter.scope)"),false);
 view.run("openSummary('active','Done')");
 assert.equal(view.run('filter.scope'),'');
 assert.equal(view.run('filter.status'),'Done');
 view.run("openSummary('people')");
 assert.equal(view.run('page'),'people');
});
test('all summary tiles and workflow stages have accessible button actions',()=>{
 const view=app({people:[],tasks:[],activities:[]});
 const html=view.run("dashboard(()=> '')");
 for(const target of ['people','active','blocked','overdue'])assert.ok(html.includes(`data-summary="${target}"`));
 for(const status of ['To do','In progress','Blocked','Done'])assert.ok(html.includes(`data-task-status="${status}"`));
 assert.ok(html.includes('No open assignments have due dates in the next seven days.'));
});
test('planning chart counts only open assignments due within its seven-day window',()=>{
 const view=app({people:[],tasks:[],activities:[]});
 view.run("state.tasks=[{id:'1',title:'Open today',status:'To do',due:today()},{id:'2',title:'Already done',status:'Done',due:today()},{id:'3',title:'Old',status:'Blocked',due:'2000-01-01'},{id:'4',title:'Undated',status:'To do'}]");
 const html=view.run('executionVisuals()');
 assert.ok(html.includes('1 scheduled'));
 assert.ok(html.includes('Today '+view.run('today()')+': 1'));
 assert.ok(!html.includes('No open assignments have due dates'));
});

test('quick edits preserve record identity, legacy fields, and unrelated data',()=>{
 const fixture={people:[{id:'p1',name:'Alex',capacity:'Balanced',notes:'Keep me',legacy:'custom'}],tasks:[{id:'t1',title:'Ship',status:'To do',due:'2026-01-01',person:'p1',outcome:'Existing impact'}],activities:[]};
 const view=app(fixture);view.run('loaded=true');
 assert.equal(view.run("applyInlineEdit('people','p1','strengths','  Mentoring & ownership  ')"),true);
 assert.equal(fixture.people[0].strengths,'Mentoring & ownership');
 assert.equal(view.run("applyInlineEdit('people','p1','capacity','At capacity')"),true);
 assert.equal(view.run("capacityLabel(state.people[0].capacity)"),'Maximum');
 assert.equal(view.run("applyInlineEdit('tasks','t1','status','In progress')"),true);
 assert.equal(view.run("applyInlineEdit('tasks','t1','due','')"),true);
 assert.equal(fixture.people[0].legacy,'custom');
 assert.equal(fixture.people[0].notes,'Keep me');
 assert.equal(fixture.tasks[0].outcome,'Existing impact');
 assert.equal(fixture.tasks[0].person,'p1');
 assert.equal(view.run("applyInlineEdit('tasks','t1','title','Overwrite')"),false);
 assert.equal(view.run("applyInlineEdit('tasks','missing','due','2026-02-01')"),false);
 for(const due of ['2026-02-30','not a date','0000-01-01'])assert.equal(view.run(`applyInlineEdit('tasks','t1','due','${due}')`),false);
 assert.equal(view.run("applyInlineEdit('tasks','t1','status','invented')"),false);
 view.run('loaded=false');
 assert.equal(view.run("applyInlineEdit('people','p1','focus','Cannot edit before load')"),false);
});
test('rapid quick edits keep the saving indicator until the final revision is stored',async()=>{
 const view=app({people:[{id:'p1',name:'Alex',capacity:'Balanced'}],tasks:[],activities:[]});
 const requests=[],releases=[];
 view.setFetch((url,options)=>{requests.push(options);return new Promise(resolve=>releases.push(resolve));});
 view.run("loaded=true;revision='first';applyInlineEdit('people','p1','capacity','At capacity');save({refresh:false});applyInlineEdit('people','p1','capacity','Available');save({refresh:false})");
 await new Promise(setImmediate);
 assert.equal(requests.length,1);
 releases[0]({ok:true,headers:{get:()=> 'second'}});
 await new Promise(setImmediate);
 assert.equal(requests.length,2);
 assert.equal(requests[1].headers['If-Match'],'second');
 assert.equal(JSON.parse(requests[1].body).people[0].capacity,'Available');
 assert.equal(view.element('.local-badge').textContent,'● Saving…');
 releases[1]({ok:true,headers:{get:()=> 'third'}});
 await view.run('saveQueue');
 assert.equal(view.element('.local-badge').textContent,'● Saved to server');
});
test('a quick-edit conflict retains local edits and never reports subsequent edits as saved',async()=>{
 const view=app({people:[{id:'p1',name:'Alex',capacity:'Balanced'}],tasks:[],activities:[]});
 let writes=0;view.setFetch(async()=>{writes++;return {ok:false,status:409};});
 view.run("loaded=true;applyInlineEdit('people','p1','capacity','At capacity');save({refresh:false})");
 await view.run('saveQueue');
 view.run("applyInlineEdit('people','p1','strengths','Local edit to export');save({refresh:false})");
 await view.run('saveQueue');
 assert.equal(writes,1);
 assert.equal(view.run('state.people[0].strengths'),'Local edit to export');
 assert.equal(view.element('.local-badge').textContent,'● Unsaved changes');
 assert.match(view.element('#notice').textContent,/Another session/);
});
test('planning date details match due dates rather than work dates and exclude completed tasks',()=>{
 const view=app({people:[{id:'p1',name:'Devendra'}],tasks:[
  {id:'due',title:'Due task <check>',person:'p1',date:'2026-10-01',due:'2026-10-28',status:'Blocked',priority:'High',outcome:'Checks pass',blocker:'Awaiting access'},
  {id:'unassigned',title:'Unassigned task',due:'2026-10-28',status:'To do'},
  {id:'wrong',title:'Different due date',date:'2026-10-28',due:'2026-10-29',status:'To do'},
  {id:'done',title:'Completed task',due:'2026-10-28',status:'Done'}
 ],activities:[]});
 view.run("openDueDate('2026-10-28')");
 assert.equal(view.element('#due-detail').open,true);
 const html=view.element('#due-content').innerHTML;
 for(const text of ['2 open assignments','Due task &lt;check&gt;','Devendra','2026-10-01','Checks pass','Awaiting access','Unassigned'])assert.ok(html.includes(text),text);
 for(const text of ['Different due date','Completed task','<check>'])assert.ok(!html.includes(text),text);
 view.run("loaded=true;applyInlineEdit('tasks','due','status','Done');renderDueDetails()");
 assert.ok(view.element('#due-content').innerHTML.includes('1 open assignment'));
 assert.ok(!view.element('#due-content').innerHTML.includes('Due task &lt;check&gt;'));
});
test('all seven planning dates are accessible buttons, including empty dates',()=>{
 const view=app({people:[],tasks:[],activities:[]});
 const html=view.run('executionVisuals()');
 const dates=[...html.matchAll(/data-due-date="(\d{4}-\d{2}-\d{2})"/g)].map(match=>match[1]);
 assert.equal(dates.length,7);assert.equal(new Set(dates).size,7);
 assert.ok(html.includes('role="group"'));
 assert.ok(html.includes('View 0 open tasks due'));
 view.run(`openDueDate('${dates[0]}')`);
 assert.ok(view.element('#due-content').innerHTML.includes('No open tasks due on this date'));
});
