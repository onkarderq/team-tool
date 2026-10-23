const {randomUUID,createHash}=require('node:crypto');
const {isDay}=require('./state');
const {applyPlan,AssistantError}=require('./assistant-actions');
const {planCommand,model}=require('./assistant-provider');
function createAssistantRouter({read,persist,revision,planner=planCommand,configured=()=>Boolean(process.env.DERQ_AI_API_KEY)}){
 const pending=new Map(),undos=new Map(),requests=new Map();let busy=false,windowStart=0,used=0;
 const ttl=10*60*1000;
 const clean=()=>{for(const map of [pending,undos,requests])for(const [key,value] of map)if(value.expires<Date.now())map.delete(key);};
 function lightweight({state,etag,...result}){return result;}
 function snapshot(result){const state=read();return {...result,state,etag:revision(state)};}
 function commit(before,result){
  if(!result.changed)return snapshot({message:result.message,ui:result.ui,changed:false});
  persist(result.state);undos.clear();const token=randomUUID();
  undos.set(token,{before,after:revision(result.state),expires:Date.now()+ttl});
  return snapshot({message:result.message,ui:result.ui,changed:true,undoToken:token});
 }
 function assertRevision(req,state){if(req.headers['if-match']!==revision(state))throw new AssistantError('The workspace changed. Reload it before retrying this command; nothing was overwritten.',409);}
 async function body(req){
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>24000)throw new AssistantError('Keep assistant requests under 24 KB.',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AssistantError('Send a valid JSON request.');}
 }
 return async function assistantRoute(req,res,url){
  const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');if(data.etag)res.setHeader('ETag',data.etag);res.end(JSON.stringify(data));};
  try{
   clean();
   if(url==='/api/assistant/status'&&req.method==='GET')return reply(200,{configured:configured(),model:model()});
   if(req.method!=='POST')return reply(405,{error:'Use POST for assistant commands.'});
   if(req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'Cross-site assistant requests are not allowed.'});
   if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON required.'});
   const input=await body(req);
   if(!input||typeof input!=='object')throw new AssistantError('Invalid request.');
   if(url==='/api/assistant/confirm'){
    const item=pending.get(input.token);if(!item)throw new AssistantError('This confirmation expired. Send the command again.',409);
    const current=read();
    if(item.result)return reply(200,snapshot(item.result));
    assertRevision(req,current);if(revision(current)!==item.base)throw new AssistantError('The workspace changed since this preview. Send the command again.',409);
    const saved=commit(current,item.plan);item.result=lightweight(saved);item.plan=null;return reply(200,saved);
   }
   if(url==='/api/assistant/undo'){
    const item=undos.get(input.token);if(!item||item.used)throw new AssistantError('This undo is no longer available.',409);
    const current=read();assertRevision(req,current);
    if(revision(current)!==item.after)throw new AssistantError('There are newer edits. Undo was stopped to preserve them.',409);
    persist(item.before);undos.clear();return reply(200,snapshot({message:'Undid the assistant’s last change.',ui:[],changed:true}));
   }
   if(url!=='/api/assistant')return reply(404,{error:'Unknown assistant endpoint.'});
   if(typeof input.requestId!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(input.requestId)||typeof input.message!=='string'||!input.message.trim()||input.message.length>4000||!isDay(input.today)||typeof input.timezone!=='string'||input.timezone.length>100)throw new AssistantError('Provide a command, request ID, local date, and timezone.');
   try{new Intl.DateTimeFormat('en',{timeZone:input.timezone});}catch{throw new AssistantError('Choose a valid local timezone.');}
   const history=input.history||[];
   if(!Array.isArray(history)||history.length>10||history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>2000))throw new AssistantError('Conversation history is too long or invalid.');
   const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex');
   const prior=requests.get(input.requestId);
   if(prior){if(prior.fingerprint!==fingerprint)throw new AssistantError('This request ID was already used for a different command.',409);return reply(200,snapshot(prior.result));}
   if(!configured())throw new AssistantError('AI is not configured. Add DERQ_AI_API_KEY securely to the server environment and restart the app.',503);
   if(busy)throw new AssistantError('The assistant is handling another command. Try again in a moment.',429);
   if(Date.now()-windowStart>60000){windowStart=Date.now();used=0;}if(used>=20)throw new AssistantError('Assistant limit reached. Wait a minute before sending another command.',429);
   const before=read();assertRevision(req,before);const base=revision(before);let plan;
   busy=true;used++;
   try{plan=await planner({message:input.message.trim(),history,today:input.today,timezone:input.timezone,state:before});}finally{busy=false;}
   if(revision(read())!==base)throw new AssistantError('The workspace changed while the assistant was thinking. Send your command again; nothing was overwritten.',409);
   const result=applyPlan(before,plan,input.today);let output;
   if(result.destructive&&result.changed){
    const token=randomUUID();pending.set(token,{base,plan:result,expires:Date.now()+ttl});
    output={message:'Please confirm these changes:\n'+result.summaries.join('\n'),requiresConfirmation:true,confirmationToken:token,ui:[]};
   }else output=commit(before,result);
   requests.set(input.requestId,{fingerprint,result:lightweight(output),expires:Date.now()+ttl});
   while(requests.size>100)requests.delete(requests.keys().next().value);
   while(pending.size>10)pending.delete(pending.keys().next().value);
   while(undos.size>1)undos.delete(undos.keys().next().value);
   return reply(200,snapshot(output));
  }catch(error){reply(error instanceof AssistantError?error.status:500,{error:error instanceof AssistantError?error.message:'The assistant could not finish. Reload the workspace to check its saved state before retrying.'});}
 };
}
module.exports={createAssistantRouter};
