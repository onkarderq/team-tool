(function(root){
 const R=typeof module!=='undefined'&&module.exports?require('./reconcile'):root.TeamspaceReconcile;
 function create({store,fetchRemote,putRemote,validate,onChange=()=>{},onAdopt=()=>{},canAdopt=()=>true,online=()=>true}){
  let base,local,etag='',status='loading',error='',conflicts=[],review=null,busy=null,version=0,storageError='',writes=Promise.resolve(),cachePending=0;
  const pending=()=>!!local&&!R.equal(base,local);
  const info=()=>({status,error,conflicts,pending:pending(),etag,storageError,cachePending,state:R.copy(local)});
  const emit=()=>onChange(info());
  function persist(){cachePending++;const snapshot={base:R.copy(base),local:R.copy(local),etag,pending:pending(),updatedAt:Date.now()};writes=writes.then(()=>store.write(snapshot)).then(()=>{storageError='';},()=>{storageError='Device storage is unavailable. Export your edits before closing this page.';}).finally(()=>{cachePending--;emit();});return writes;}
  function adopt(value){local=R.copy(value);onAdopt(R.copy(local),etag);}
  async function load(){
   let cached;try{cached=await store.read();}catch{storageError='Device storage is unavailable. Offline reload will not be available.';}
   if(cached&&(!validate(cached.base)||!validate(cached.local)))cached=null;
   let remote;try{if(online())remote=await fetchRemote();}catch{}
   if(cached?.pending){base=R.copy(cached.base);local=R.copy(cached.local);etag=cached.etag;status=remote?'pending':'offline';}
   else if(remote){base=R.copy(remote.state);local=R.copy(remote.state);etag=remote.etag;status='saved';}
   else if(cached){base=R.copy(cached.base);local=R.copy(cached.local);etag=cached.etag;status='offline';}
   else throw Error('Connect once to load this workspace before editing offline.');
   await persist();emit();return info();
  }
  function stage(value){if(!validate(value))throw Error('These changes are invalid. Review the task dependencies and dates.');local=R.copy(value);version++;status=online()?'saving':'offline';error='';conflicts=[];review=null;persist();emit();}
  async function execute(choices){
   if(!local)return info();
   if(!online()){status='offline';emit();return info();}
   if(!pending()&&status==='saved')return info();
   if(!canAdopt()){status=pending()?'pending':status;error='Finish or close open editors before reconciling server changes.';emit();return info();}
   let supplied=choices;
   for(let attempt=0;attempt<5;attempt++){
    await writes;let remote;
    try{remote=await fetchRemote();}catch(e){status=e.network===false?'paused':'offline';error=e.message;emit();return info();}
    if(supplied&&(!review||!R.equal(review.remote,remote.state)||!R.equal(review.local,local))){supplied=null;error='The workspace changed during review. Please review the latest choices.';}
    const merged=R.merge(base,local,remote.state,supplied||{});supplied=null;
    if(merged.conflicts.length){status='conflict';conflicts=merged.conflicts;review={remote:R.copy(remote.state),local:R.copy(local)};emit();return info();}
    if(!validate(merged.state)){status='rejected';error='The combined changes would create invalid relationships or a dependency cycle. Review your offline tasks and dependency links, then retry. Your draft is preserved.';emit();return info();}
    if(!canAdopt()){status='pending';error='Finish or close open editors before reconciling server changes.';emit();return info();}
    if(R.equal(merged.state,remote.state)){base=R.copy(remote.state);etag=remote.etag;adopt(merged.state);status='saved';error='';conflicts=[];review=null;await persist();emit();return info();}
    const sentLocal=R.copy(local),sentVersion=version;status='saving';emit();let response;
    try{response=await putRemote(merged.state,remote.etag);}catch(e){if(e.status===409)continue;status=e.network===false?'paused':'offline';error=e.message;emit();return info();}
    // An editor opened while the request was running. Keep the original merge base
    // and the cached draft until that editor closes; the next pass is idempotent.
    if(!canAdopt()){status='pending';error='Finish or close open editors before reconciling server changes.';await persist();emit();return info();}
    const rebased=version===sentVersion?{state:merged.state,conflicts:[]}:R.merge(sentLocal,local,merged.state);
    if(rebased.conflicts.length){base=sentLocal;status='pending';await persist();emit();continue;}
    base=R.copy(merged.state);etag=response.etag;adopt(rebased.state);conflicts=[];review=null;error='';await persist();
    if(!pending()){status='saved';emit();return info();}
   }
   status='pending';error='Changes are still arriving. Your draft is saved on this device; retry shortly.';emit();return info();
  }
  function flush(choices){if(busy)return busy;busy=execute(choices).finally(()=>{busy=null;});return busy;}
  async function refresh(){if(status==='saved')status='pending';return flush();}
  async function recover(snapshot){if(!validate(snapshot.base)||!validate(snapshot.local))throw Error('This saved draft is invalid.');await writes;base=R.copy(snapshot.base);etag=snapshot.etag;adopt(snapshot.local);status='pending';version++;await persist();emit();return info();}
  function accept(value,tag){if(!validate(value))throw Error('Invalid server workspace.');base=R.copy(value);local=R.copy(value);etag=tag;status='saved';error='';conflicts=[];review=null;persist();emit();}
  return {load,stage,flush,refresh,recover,accept,info,persisted:()=>writes};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={create};else root.TeamspaceSync={create};
})(globalThis);
