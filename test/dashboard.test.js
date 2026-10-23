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
