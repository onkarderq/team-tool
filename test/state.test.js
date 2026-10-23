const {test}=require('node:test');
const assert=require('node:assert/strict');
const {valid,isDay,isTime}=require('../state');
test('validation accepts legacy workspaces and round-trips optional leave records',()=>{
 const legacy={people:[{id:'p1',name:'Alex',extra:'preserve'}],tasks:[],activities:[]};
 assert.equal(valid(legacy),true);assert.equal('leaves' in legacy,false);
 const extended={...legacy,leaves:[{id:'l1',date:'2024-02-29',person:'p1',name:'Alex',extra:'preserve'}]};
 assert.equal(valid(extended),true);
 for(const leaves of [null,{},[{id:'l1',date:'2026-02-29',person:'p1'}],[{id:'l1',date:'2026-10-24',person:''}],[{id:'l1',date:'2026-10-24',person:'p1'}, {id:'l2',date:'2026-10-24',person:'p1'}]])assert.equal(valid({...legacy,leaves}),false);
});
test('dates and times use valid calendar days and 24-hour local clock values',()=>{
 assert.equal(isDay('2024-02-29'),true);assert.equal(isDay('2026-02-29'),false);assert.equal(isDay('0000-01-01'),false);
 for(const time of ['00:00','09:30','23:59'])assert.equal(isTime(time),true);
 for(const time of ['24:00','9:30','12:60',''])assert.equal(isTime(time),false);
});
