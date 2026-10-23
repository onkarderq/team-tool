(function(){
 const panel=document.querySelector('#notepad-panel'),launcher=document.querySelector('#notepad-launcher'),input=document.querySelector('#notepad-text'),status=document.querySelector('#notepad-status');
 let dirty=false,timer;
 function refresh(){
  input.disabled=!loaded;document.querySelector('#notepad-save').disabled=!loaded;
  if(!dirty)input.value=state.notepad||'';
  document.querySelector('#notepad-count').textContent=input.value.length.toLocaleString()+' / 100,000 characters';
  const saving=dirty||document.querySelector('.local-badge').textContent==='● Saving…';
  status.textContent=!loaded?'Loading…':saveFailed?'Not saved — download a copy':saving?'Saving…':'Saved to workspace';
  status.classList.toggle('notepad-unsaved',saveFailed);status.classList.toggle('notepad-saving',saving&&!saveFailed);
 }
 function flush(){
  clearTimeout(timer);
  if(!dirty||!loaded)return;
  dirty=false;save({refresh:false});
 }
 function close(focus=true){flush();panel.hidden=true;launcher.setAttribute('aria-expanded','false');if(focus)launcher.focus();}
 function open(){
  if(window.DerqAssistant&&!DerqAssistant.close())return;
  refresh();panel.hidden=false;launcher.setAttribute('aria-expanded','true');input.focus();
 }
 launcher.onclick=()=>panel.hidden?open():close();document.querySelector('#notepad-close').onclick=()=>close();
 input.addEventListener('input',()=>{
  if(!loaded)return;
  state.notepad=input.value;dirty=true;clearTimeout(timer);badge(saveFailed?'● Unsaved changes':'● Saving…');
  timer=setTimeout(flush,450);
 });
 input.addEventListener('blur',flush);
 panel.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
  if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();flush();}
 });
 document.querySelector('#notepad-save').onclick=flush;
 document.querySelector('#notepad-download').onclick=()=>{
  const url=URL.createObjectURL(new Blob([input.value],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');
  link.href=url;link.download='derq-notepad-'+today()+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});
 window.DerqNotepad={flush,close,refresh,isDirty:()=>dirty};refresh();
})();
