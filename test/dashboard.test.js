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
 return {run:code=>vm.runInContext(code,context),element};
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
