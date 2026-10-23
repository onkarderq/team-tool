(function(){
 const panel=document.querySelector('#assistant-panel'),launcher=document.querySelector('#assistant-launcher'),input=document.querySelector('#assistant-command'),send=document.querySelector('#assistant-send'),messages=document.querySelector('#assistant-messages');
 let available=false,busy=false,history=[],activeDecision=null;
 function addMessage(role,text){
  const row=document.createElement('div');row.className='assistant-message '+role;
  const label=document.createElement('span');label.className='assistant-message-label';label.textContent=role==='user'?'You':'Derq assistant';
  const content=document.createElement('p');content.textContent=text;row.append(label,content);messages.append(row);messages.scrollTop=messages.scrollHeight;
  history.push({role,content:text.slice(0,2000)});history=history.slice(-8);return row;
 }
 function setBusy(value){busy=value;send.disabled=value||!available;input.disabled=value;document.querySelector('#assistant-close').disabled=value;document.querySelector('#assistant-working').hidden=!value;launcher.classList.toggle('is-working',value);}
 async function checkConnection(){
  try{
   const response=await fetch('/api/assistant/status',{cache:'no-store'});if(!response.ok)throw Error();const status=await response.json();available=status.configured===true;
   const local=status.mode==='local';
   document.querySelector('#assistant-connection').textContent=local?'Built-in commands · no API key needed':available?'AI configured · ready for commands':'AI key needed · not connected';
   document.querySelector('.assistant-launcher-label').textContent=local?'CMD':'AI';
   document.querySelector('.assistant-privacy').textContent=local?'Built-in command mode: no external AI service. Use one supported command at a time; type “help” for examples. Changes save to your shared workspace.':'Commands and workspace context go to OpenAI. Member and activity notes stay out of the AI context. Changes save to your shared workspace.';
   if(available)messages.querySelector('.assistant-setup')?.remove();
   if(!available&&!messages.querySelector('.assistant-setup')){
    const note=document.createElement('div');note.className='assistant-setup';note.textContent='AI commands need a server-side DERQ_AI_API_KEY. Add it securely to the server environment and restart. Your key is never entered in this chat.';messages.append(note);
   }
  }catch{document.querySelector('#assistant-connection').textContent='Could not connect to the assistant';available=false;}
  send.disabled=busy||!available;
 }
 function open(){panel.hidden=false;launcher.setAttribute('aria-expanded','true');input.focus();checkConnection();}
 function close(force=false){if(busy&&!force)return;panel.hidden=true;launcher.setAttribute('aria-expanded','false');launcher.focus();}
 launcher.onclick=()=>panel.hidden?open():close();document.querySelector('#assistant-close').onclick=close;
 panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!busy){event.preventDefault();close();}});
 input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(!busy&&available)document.querySelector('#assistant-form').requestSubmit();}});
 document.querySelectorAll('[data-assistant-example]').forEach(button=>button.onclick=()=>{
  const name=state.people[0]?.name||'Maya Rao',tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const prompts={member:'Add Maya Rao as a Deployment and Configuration Engineer.',leave:`Mark ${name} on leave on ${today()} and ${localDateKey(tomorrow)}.`,task:`Assign "Prepare deployment checklist" to ${name}, due ${localDateKey(tomorrow)}, high priority.`,checkin:`Schedule a one-to-one with ${name} tomorrow at 10:30 AM.`,help:'help'};
  input.value=prompts[button.dataset.assistantExample];input.focus();
 });
 function invalidateDecision(){if(activeDecision){activeDecision.querySelectorAll('button').forEach(button=>button.disabled=true);activeDecision=null;}}
 async function synchronize(){
  if(!loaded)throw Error('Wait for the workspace to load before sending commands.');
  document.querySelectorAll('[data-inline][data-dirty="true"]').forEach(control=>commitInline(control));
  await saveQueue;
  if(saveFailed)throw Error('Your workspace has unsaved changes. Export your edits and reload before using the assistant.');
 }
 function applyResponse(data,etag,version){
  const draft=document.querySelector('[data-inline][data-dirty="true"]')||document.querySelector('#editor').open||document.querySelector('#leave-editor').open;
  if(saveVersion!==version||saveFailed||draft){saveFailed=true;badge('● Unsaved changes');notice('The assistant updated the server while you were editing. Export your local edits, then reload to see the saved workspace.');return false;}
  if(!valid(data.state))throw Error('The assistant returned invalid workspace data. Reload to check the saved state.');
  state=data.state;revision=etag;render();badge('● Saved to server');notice('');return true;
 }
 function applyUI(actions){
  for(const action of actions||[]){
   if(action.kind==='navigate'){
    page=action.page;if(page==='calendar'&&TeamspaceState.isDay(action.date))calendarCursor=new Date(action.date+'T12:00:00');
    if(page==='tasks')filter={date:'',person:'',status:'',search:'',scope:''};render();
   }
   if(action.kind==='view_member'){close(true);openMember(action.id);}
   if(action.kind==='view_due'){close(true);openDueDate(action.date);}
   if(action.kind==='export_backup')document.querySelector('#export').click();
   if(action.kind==='import_backup'){
    const row=addMessage('assistant','Choose the backup file to import. The existing import confirmation will appear before records are replaced.');
    const button=document.createElement('button');button.textContent='Choose backup file';button.onclick=()=>document.querySelector('#import').click();row.append(button);
   }
  }
 }
 async function request(path,body){
  await synchronize();const version=saveVersion;
  let response;
  try{response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','If-Match':revision},body:JSON.stringify(body)});}catch{throw Error('Connection interrupted. Reload the workspace to check whether your command was saved before retrying.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'The assistant could not complete this command.');
  const adopted=applyResponse(data,response.headers.get('ETag'),version);
  const row=addMessage('assistant',data.message);
  if(data.changed===false){const tag=document.createElement('small');tag.className='assistant-result-label';tag.textContent='Workspace unchanged';row.append(tag);}
  if(data.requiresConfirmation&&adopted){
   const controls=document.createElement('div');controls.className='assistant-message-actions';
   const approve=document.createElement('button'),cancel=document.createElement('button');approve.textContent='Confirm changes';approve.className='primary';cancel.textContent='Cancel';
   controls.append(approve,cancel);row.append(controls);activeDecision=controls;
   approve.onclick=()=>run(()=>request('/api/assistant/confirm',{token:data.confirmationToken}));
   cancel.onclick=()=>{invalidateDecision();addMessage('assistant','Cancelled. No changes were applied.');};
  }
  if(data.undoToken&&adopted){const undo=document.createElement('button');undo.className='assistant-undo';undo.textContent='Undo this change';undo.onclick=()=>{undo.disabled=true;run(()=>request('/api/assistant/undo',{token:data.undoToken}));};row.append(undo);}
  if(adopted&&!data.requiresConfirmation)applyUI(data.ui);
  messages.scrollTop=messages.scrollHeight;
 }
 async function run(operation){
  if(busy)return;invalidateDecision();setBusy(true);
  try{await operation();}catch(error){addMessage('assistant',error.message||'Connection interrupted. Reload the workspace to check whether your command was saved before retrying.');}
  finally{setBusy(false);input.focus();}
 }
 document.querySelector('#assistant-form').onsubmit=event=>{
  event.preventDefault();const command=input.value.trim();if(!command||busy||!available)return;
  const prior=history.slice(-8);input.value='';addMessage('user',command);
  run(()=>request('/api/assistant',{requestId:TeamspaceIds.createId(),message:command,history:prior,today:today(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}));
 };
})();
