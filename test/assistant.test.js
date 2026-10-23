const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync,writeFileSync,readFileSync}=require('node:fs');
const {join}=require('node:path');
const {tmpdir}=require('node:os');
const {once}=require('node:events');
const {randomUUID}=require('node:crypto');
const {applyPlan}=require('../assistant-actions');
const {planCommand,projectContext}=require('../assistant-provider');
const {createWorkspaceServer}=require('../server');
const day='2026-10-24';
const initial=()=>({people:[{id:'p1',name:'Devendra',role:'Engineer',notes:'Private existing note',legacy:'keep'}],tasks:[{id:'t1',title:'Deploy',person:'p1',date:'2026-10-23',due:day,status:'To do',priority:'Medium',createdDate:'2026-10-23',extra:'preserve'}],activities:[{id:'a1',title:'Wins',status:'Planned',notes:'Private activity notes'}],leaves:[{id:'l1',person:'p1',name:'Devendra',date:'2026-11-01'}]});
const action=(kind,id='',changes={},dates=[],page='')=>({kind,id,changes:Object.entries(changes).map(([field,value])=>({field,value})),dates,page});
const plan=(...actions)=>({message:'Plan',actions});
test('assistant creates a member and records exactly two leave dates atomically',()=>{
 const original=initial(),copy=structuredClone(original);
 const result=applyPlan(original,plan(action('create_member','maya',{name:'Maya Rao',role:'Deployment and Configuration Engineer'}),action('set_leave','maya',{},['2026-10-26','2026-10-28'])),day);
 assert.deepEqual(original,copy);
 assert.equal(result.state.people.length,2);assert.equal(result.state.people[1].role,'Deployment and Configuration Engineer');
 assert.deepEqual(result.state.leaves.filter(l=>l.person===result.state.people[1].id).map(l=>l.date),['2026-10-26','2026-10-28']);
 assert.equal(result.state.leaves[0].id,'l1');assert.equal(result.state.people[0].legacy,'keep');assert.equal(result.changed,true);
 assert.throws(()=>applyPlan(original,plan(action('create_member','new',{name:'Other'}),action('set_leave','missing',{},[day])),day));assert.deepEqual(original,copy);
});
test('assistant updates all editable record types while preserving creation and private notes',()=>{
 const original=initial();
 const result=applyPlan(original,plan(action('update_member','p1',{capacity:'Maximum',checkin:day,checkinTime:'10:30',strengths:'Mentoring',focus:'Ownership'}),action('append_member_note','p1',{notes:'New agreed action'}),action('update_task','t1',{status:'In progress',priority:'High',due:'2026-10-27'}),action('create_task','task2',{title:'Checklist',person:'p1',date:'2020-01-01'}),action('create_activity','coffee',{title:'Coffee chat',type:'Team bonding',person:'p1',date:day}),action('append_activity_note','a1',{notes:'A new win'})),day);
 assert.equal(result.state.people[0].capacity,'At capacity');assert.equal(result.state.people[0].notes,'Private existing note\nNew agreed action');
 assert.equal(result.state.tasks[0].createdDate,'2026-10-23');assert.equal(result.state.tasks[0].extra,'preserve');assert.equal(result.state.tasks[1].createdDate,day);
 assert.equal(result.state.activities[1].person,'p1');assert.equal(result.state.activities[0].notes,'Private activity notes\nA new win');
});
test('assistant refuses invalid fields, enums, missing references, dates, and duplicate members',()=>{
 for(const bad of [action('update_task','t1',{createdDate:day}),action('update_task','t1',{status:''}),action('update_member','p1',{checkinTime:'25:00'}),action('set_leave','p1',{},['2026-02-30']),action('create_task','new',{title:'Invalid owner',person:'missing'}),action('create_member','new',{name:'devendra'}),action('create_activity','new',{title:'Unknown type',type:'Invented'})])assert.throws(()=>applyPlan(initial(),plan(bad),day));
 const current=initial(),result=applyPlan(current,plan(action('set_leave','p1',{},['2026-11-01','2026-11-01'])),day);assert.equal(result.changed,false);
 const removed=applyPlan(current,plan(action('remove_leave','p1',{},['2026-11-01'])),day);assert.equal(removed.state.leaves.length,0);
});
test('delete plans flag confirmation, unassign work, and retain leave history',()=>{
 const result=applyPlan(initial(),plan(action('delete_member','p1')),day);
 assert.equal(result.destructive,true);assert.equal(result.state.people.length,0);assert.equal(result.state.tasks[0].person,'');assert.equal(result.state.leaves[0].name,'Devendra');
});
test('provider uses structured responses and never sends member/activity notes or arbitrary extra fields',async()=>{
 const previous=process.env.DERQ_AI_API_KEY;process.env.DERQ_AI_API_KEY='test-only-placeholder';
 try{
 let payload;
 const result=await planCommand({message:'Add a member',history:[],today:day,timezone:'Asia/Kolkata',state:initial()},async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');payload=JSON.parse(options.body);
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(plan(action('create_member','new',{name:'Maya'})))}]}]})};
 });
 assert.equal(result.actions[0].kind,'create_member');assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);
 const context=JSON.stringify(projectContext(initial()));assert.ok(!context.includes('Private existing note'));assert.ok(!context.includes('Private activity notes'));assert.ok(!context.includes('preserve'));
 for(const fake of [async()=>({ok:false,status:401}),async()=>({ok:true,json:async()=>({status:'incomplete'})}),async()=>({ok:true,json:async()=>({status:'completed',output:[]})}),async()=>{throw Error('network');}])await assert.rejects(()=>planCommand({message:'Hi',history:[],today:day,timezone:'Asia/Kolkata',state:initial()},fake));
 }finally{if(previous===undefined)delete process.env.DERQ_AI_API_KEY;else process.env.DERQ_AI_API_KEY=previous;}
});
async function fixture(t,planner){
 const dir=mkdtempSync(join(tmpdir(),'derq-assistant-'));writeFileSync(join(dir,'teamspace.json'),JSON.stringify(initial()));
 const server=createWorkspaceServer({dataDir:dir,assistantPlanner:planner});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});});
 const url='http://127.0.0.1:'+server.address().port;
 const read=async()=>{const r=await fetch(url+'/api/state');return {state:await r.json(),etag:r.headers.get('etag')};};
 const post=async(path,body,etag,extra={})=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json','If-Match':etag,...extra},body:JSON.stringify(body)});
 const command=(message,requestId=randomUUID())=>({requestId,message,today:day,timezone:'Asia/Kolkata',history:[]});
 return {url,read,post,command,dir};
}
test('HTTP assistant saves to disk, deduplicates request IDs, and supports a protected undo',async t=>{
 let calls=0;const f=await fixture(t,async()=>{calls++;return plan(action('create_member','new',{name:'Maya Rao',role:'Deployment Engineer'}));});
 const before=await f.read(),body=f.command('Add Maya Rao');
 const response=await f.post('/api/assistant',body,before.etag);assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.state.people.length,2);assert.ok(result.undoToken);assert.equal(JSON.parse(readFileSync(join(f.dir,'teamspace.json'),'utf8')).people.length,2);
 const replay=await f.post('/api/assistant',body,before.etag);assert.equal(replay.status,200);assert.equal((await replay.json()).state.people.length,2);assert.equal(calls,1);
 const undo=await f.post('/api/assistant/undo',{token:result.undoToken},response.headers.get('etag'));assert.equal(undo.status,200);assert.equal((await undo.json()).state.people.length,1);
});
test('HTTP deletion is only applied after confirmation and stale undo never overwrites later edits',async t=>{
 const f=await fixture(t,async()=>plan(action('delete_member','p1'))),before=await f.read();
 const previewResponse=await f.post('/api/assistant',f.command('Delete Devendra'),before.etag),preview=await previewResponse.json();
 assert.equal(preview.requiresConfirmation,true);assert.equal((await f.read()).state.people.length,1);
 const confirmed=await f.post('/api/assistant/confirm',{token:preview.confirmationToken},before.etag);assert.equal(confirmed.status,200);const saved=await confirmed.json();assert.equal(saved.state.people.length,0);
 const edited=structuredClone(saved.state);edited.activities[0].title='Newer edit';
 const manual=await f.post('/api/state',edited,confirmed.headers.get('etag'));assert.equal(manual.status,405);
 const put=await fetch(f.url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':confirmed.headers.get('etag')},body:JSON.stringify(edited)});assert.equal(put.status,200);
 const stopped=await f.post('/api/assistant/undo',{token:saved.undoToken},put.headers.get('etag'));assert.equal(stopped.status,409);assert.equal((await f.read()).state.activities[0].title,'Newer edit');
});
test('HTTP assistant rejects changes made while planning and cross-site commands',async t=>{
 let release;const gate=new Promise(resolve=>release=resolve);
 const f=await fixture(t,async()=>{await gate;return plan(action('create_member','new',{name:'Maya'}));}),before=await f.read();
 const pending=f.post('/api/assistant',f.command('Add Maya'),before.etag);
 await new Promise(resolve=>setTimeout(resolve,30));
 const next=structuredClone(before.state);next.people[0].role='Changed concurrently';
 const manual=await fetch(f.url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':before.etag},body:JSON.stringify(next)});assert.equal(manual.status,200);release();
 assert.equal((await pending).status,409);assert.equal((await f.read()).state.people.length,1);assert.equal((await f.read()).state.people[0].role,'Changed concurrently');
 assert.equal((await f.post('/api/assistant',f.command('Hi'),before.etag,{'Sec-Fetch-Site':'cross-site'})).status,403);
});
test('default production assistant executes built-in commands without a key',async t=>{
 const previous=process.env.DERQ_AI_API_KEY,previousMode=process.env.DERQ_ASSISTANT_MODE;delete process.env.DERQ_AI_API_KEY;delete process.env.DERQ_ASSISTANT_MODE;
 try{
  const f=await fixture(t),before=await f.read();
  const status=await (await fetch(f.url+'/api/assistant/status')).json();assert.deepEqual(status,{configured:true,mode:'local',model:null});
  const response=await f.post('/api/assistant',f.command('Add Maya Rao as a Deployment and Configuration Engineer'),before.etag);assert.equal(response.status,200);
  const added=await response.json(),maya=added.state.people.find(p=>p.name==='Maya Rao');assert.equal(maya.role,'Deployment and Configuration Engineer');
  const leaveResponse=await f.post('/api/assistant',f.command('Mark Maya Rao on leave on 2026-10-26 and 2026-10-28'),response.headers.get('etag'));assert.equal(leaveResponse.status,200);
  const saved=await leaveResponse.json();assert.deepEqual(saved.state.leaves.filter(l=>l.person===maya.id).map(l=>l.date),['2026-10-26','2026-10-28']);assert.equal(saved.state.people[0].legacy,'keep');
  assert.deepEqual(JSON.parse(readFileSync(join(f.dir,'teamspace.json'),'utf8')),saved.state);
  const unknown=await f.post('/api/assistant',f.command('Mark an unknown person on leave tomorrow'),leaveResponse.headers.get('etag'));assert.equal(unknown.status,200);assert.equal((await unknown.json()).changed,false);assert.deepEqual((await f.read()).state,saved.state);
 }finally{if(previous===undefined)delete process.env.DERQ_AI_API_KEY;else process.env.DERQ_AI_API_KEY=previous;if(previousMode===undefined)delete process.env.DERQ_ASSISTANT_MODE;else process.env.DERQ_ASSISTANT_MODE=previousMode;}
});
test('external AI mode is explicit and still requires a key',async t=>{
 const previous=process.env.DERQ_AI_API_KEY,previousMode=process.env.DERQ_ASSISTANT_MODE;delete process.env.DERQ_AI_API_KEY;process.env.DERQ_ASSISTANT_MODE='ai';
 try{const f=await fixture(t),before=await f.read();const status=await (await fetch(f.url+'/api/assistant/status')).json();assert.equal(status.configured,false);assert.equal(status.mode,'ai');assert.ok(!('key' in status));
 const response=await f.post('/api/assistant',f.command('Add Maya'),before.etag);assert.equal(response.status,503);assert.deepEqual((await f.read()).state,before.state);
 }finally{if(previous===undefined)delete process.env.DERQ_AI_API_KEY;else process.env.DERQ_AI_API_KEY=previous;if(previousMode===undefined)delete process.env.DERQ_ASSISTANT_MODE;else process.env.DERQ_ASSISTANT_MODE=previousMode;}
});
