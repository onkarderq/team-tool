const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
test('serves application and assets; rejects unknown paths',async()=>{
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3197'}});
 try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),5000);child.once('error',reject);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});});
 for(const [url,type,content] of [['/','text/html','Teamspace'],['/app.js','text/javascript','localStorage'],['/styles.css','text/css',':root']]){const res=await fetch('http://127.0.0.1:3197'+url);assert.equal(res.status,200);assert.ok(res.headers.get('content-type').includes(type));assert.ok((await res.text()).includes(content));}
 assert.equal((await fetch('http://127.0.0.1:3197/missing')).status,404);
 }finally{child.kill();}
});
