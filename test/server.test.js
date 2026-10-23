const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {once}=require('node:events');
test('serves assets, persists records across restart, rejects invalid and stale writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'teamspace-test-'));
 let child;
 async function start(){child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3197',DATA_DIR:dir}});await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('Startup failed');})]);}
 async function stop(){const ended=once(child,'exit');child.kill();await ended;}
 const url='http://127.0.0.1:3197';
 try{
 await start();
 for(const [asset,content] of [['/','Derq'],['/app.js','/api/state'],['/ids.js','getRandomValues'],['/styles.css',':root']]){const res=await fetch(url+asset);assert.equal(res.status,200);assert.ok((await res.text()).includes(content));}
 const logo=await fetch(url+'/derq-logo.png');assert.equal(logo.status,200);assert.equal(logo.headers.get('content-type'),'image/png');assert.equal(Buffer.from(await logo.arrayBuffer()).subarray(1,4).toString(),'PNG');
 assert.equal((await fetch(url+'/missing')).status,404);
 const initial=await fetch(url+'/api/state');const etag=initial.headers.get('etag');assert.deepEqual(await initial.json(),{people:[],tasks:[],activities:[]});
 const data={people:[{id:'p1',name:'Alex',strengths:'Systems thinking',notes:'Existing volume notes',customField:'Keep this legacy field'}],tasks:[{id:'t1',title:'Plan',person:'p1'}],activities:[{id:'a1',title:'Coffee'}]};
 const put=(body,tag=etag)=>fetch(url+'/api/state',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':tag},body:JSON.stringify(body)});
 assert.equal((await put({bad:true})).status,400);
 assert.equal((await put(data)).status,200);
 assert.equal((await put({people:[],tasks:[],activities:[]})).status,409);
 await stop();await start();
 const restored=await fetch(url+'/api/state');assert.deepEqual(await restored.json(),data);
 assert.equal((await put({people:[],tasks:[],activities:[]},restored.headers.get('etag'))).status,200);
 }finally{if(child&&child.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});}
});
