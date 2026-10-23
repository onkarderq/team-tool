// Calendar and header reminders share the existing workspace save/revision flow.
let calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1,12),selectedLeave='',headerReminderSignature='';
function localDateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function monthDates(year,month){
 const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7;
 return Array.from({length:42},(_,index)=>{const date=new Date(year,month,1-offset+index,12);return {key:localDateKey(date),number:date.getDate(),inMonth:date.getMonth()===month};});
}
function leaveName(leave){return state.people.find(p=>p.id===leave.person)?.name||leave.name||'Former member';}
function leaveCalendar(){
 const year=calendarCursor.getFullYear(),month=calendarCursor.getMonth(),label=calendarCursor.toLocaleDateString([],{month:'long',year:'numeric'});
 const prefix=`${year}-${String(month+1).padStart(2,'0')}`,leaves=(state.leaves||[]).filter(leave=>leave.date.startsWith(prefix));
 return `<section class="panel calendar-panel"><div class="calendar-toolbar"><div><span class="eyelabel">TEAM AVAILABILITY</span><h2>${esc(label)}</h2></div><div class="calendar-nav"><button type="button" data-calendar-shift="-1" aria-label="Previous month">←</button><button type="button" data-calendar-today="true">This month</button><button type="button" data-calendar-shift="1" aria-label="Next month">→</button></div></div><div class="calendar-summary"><span>${new Set(leaves.map(l=>l.person)).size} members taking leave</span><span>${new Set(leaves.map(l=>l.date)).size} dates with leave</span><span class="calendar-key">● Today <span>■ On leave</span></span></div><div class="calendar-weekdays" aria-hidden="true">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=>`<span>${day}</span>`).join('')}</div><div class="month-grid" role="group" aria-label="Leave calendar for ${esc(label)}">${monthDates(year,month).map(day=>{
  const items=(state.leaves||[]).filter(leave=>leave.date===day.key),names=items.map(leaveName);
  return `<button type="button" class="calendar-day ${day.inMonth?'':'outside-month'} ${day.key===today()?'is-today':''}" data-leave-date="${day.key}" aria-haspopup="dialog" aria-controls="leave-editor" aria-label="${esc(dueDateLabel(day.key))}. ${esc(names.length?'On leave: '+names.join(', '):'No leave recorded')}"><time datetime="${day.key}" class="calendar-day-number">${day.number}</time><span class="calendar-leaves">${names.map(name=>`<span class="leave-name" title="${esc(name)}">${esc(name)}</span>`).join('')}</span>${!names.length?'<span class="calendar-add" aria-hidden="true">+ Leave</span>':''}</button>`;
 }).join('')}</div><p class="calendar-help">Select a date to add or remove members on leave. Changes are shared with everyone using this workspace.</p></section>`;
}
function openLeaveDate(date){
 if(!TeamspaceState.isDay(date))return;selectedLeave=date;
 const existing=(state.leaves||[]).filter(leave=>leave.date===date);
 const options=[...state.people,...existing.filter(leave=>!state.people.some(p=>p.id===leave.person)).map(leave=>({id:leave.person,name:leaveName(leave)}))];
 document.querySelector('#leave-title').textContent='Leave · '+dueDateLabel(date);
 document.querySelector('#leave-options').innerHTML=options.length?`<p class="dialog-help">Select everyone who will be on leave. Uncheck a name to remove their leave for this date.</p><div class="leave-options">${options.map(p=>`<label class="leave-option"><input type="checkbox" name="members" value="${esc(p.id)}" ${existing.some(l=>l.person===p.id)?'checked':''}><span class="avatar">${esc(initials(p.name))}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.role||'Team member')}</small></span></label>`).join('')}</div>`:empty('Add your team first','Create team members in Team & growth, then return here to record leave.');
 if(typeof DerqLeadership!=='undefined')DerqLeadership.refreshLeavePreview();
 document.querySelector('#leave-editor').showModal();
}
function setLeaveMembers(date,ids){
 if(!loaded||!TeamspaceState.isDay(date))return false;
 const existing=(state.leaves||[]).filter(leave=>leave.date===date),unique=[...new Set(ids)];
 if(unique.some(id=>!state.people.some(p=>p.id===id)&&!existing.some(l=>l.person===id)))return false;
 if(existing.length===unique.length&&existing.every(leave=>unique.includes(leave.person)))return false;
 const retained=(state.leaves||[]).filter(leave=>leave.date!==date);
 state.leaves=[...retained,...unique.map(id=>existing.find(leave=>leave.person===id)||{id:TeamspaceIds.createId(),date,person:id,name:person(id)})];
 return true;
}
function dueTodaySummary(day=today()){
 const tasks=tasksDueOn(day),attention=tasks.filter(task=>(task.createdDate||task.date)!==day).length;
 return {tasks,attention,level:attention>2?'red':attention>0?'orange':'green'};
}
function todaysMeetings(day=today()){
 return state.people.filter(p=>p.checkin===day).sort((a,b)=>(a.checkinTime||'99:99').localeCompare(b.checkinTime||'99:99')||a.name.localeCompare(b.name));
}
function meetingTiming(member,now=new Date()){
 if(!TeamspaceState.isTime(member.checkinTime))return 'Time not set';
 const [hour,minute]=member.checkinTime.split(':').map(Number),difference=hour*60+minute-(now.getHours()*60+now.getMinutes());
 return difference<0?'Earlier today':difference===0?'Starting now':difference<=15?'Starting soon':'Today';
}
function headerReminders(){
 const meetings=todaysMeetings(),due=dueTodaySummary(),todayCount=due.tasks.length-due.attention;
 return `<button type="button" class="meeting-strip" data-today-meetings="true" aria-haspopup="dialog" aria-controls="meetings-detail" ${loaded?'':'disabled'}><span class="header-eyebrow">ONE-TO-ONES TODAY <span>${meetings.length}</span></span>${meetings.length?meetings.map(p=>`<span class="meeting-line"><strong>${esc(p.name)}</strong><time>${esc(p.checkinTime||'Set time')}</time>${['Starting soon','Starting now'].includes(meetingTiming(p))?'<span class="meeting-soon">Soon</span>':''}</span>`).join(''):'<span class="meeting-none">No one-to-ones scheduled</span>'}</button><button type="button" class="due-indicator alert-${due.level}" data-due-date="${today()}" aria-haspopup="dialog" aria-controls="due-detail" aria-label="${due.tasks.length} open tasks due today. ${due.attention} from earlier or unknown creation dates. ${due.level} alert. Tasks created today do not raise the alert." title="${due.attention} older tasks due today; ${todayCount} created today. Green: 0 older tasks. Orange: 1–2. Red: 3+." ${loaded?'':'disabled'}><span class="status-orb" aria-hidden="true"><span>${due.tasks.length}</span></span><span class="due-indicator-copy"><strong>Due today</strong><small>${due.attention?due.attention+' need attention':todayCount?'Same-day tasks only':'All clear'}</small></span></button>`;
}
function refreshHeaderReminders(){
 const html=headerReminders();if(html===headerReminderSignature)return;
 headerReminderSignature=html;document.querySelector('#header-reminders').innerHTML=html;
 if(document.querySelector('#meetings-detail').open)renderMeetings();
}
function openTodaysMeetings(){renderMeetings();document.querySelector('#meetings-detail').showModal();}
function renderMeetings(){
 const meetings=todaysMeetings();
 document.querySelector('#meetings-content').innerHTML=`<div class="due-heading"><span class="eyelabel">ONE-TO-ONE REMINDERS</span><h2 id="meetings-title">Today’s conversations</h2><p>${esc(dueDateLabel(today()))} · Times use your browser’s local timezone.</p></div>${meetings.length?`<div class="meeting-list">${meetings.map(p=>`<button type="button" data-meeting-member="${esc(p.id)}"><span class="avatar">${esc(initials(p.name))}</span><span><strong>${esc(p.name)}</strong><small>${esc(p.role||'Team member')} · ${esc(meetingTiming(p))}</small></span><time>${esc(p.checkinTime||'Time not set')}</time></button>`).join('')}</div>`:empty('No one-to-ones scheduled today','Set a member’s next check-in date and time in Team & growth.')}<button type="button" class="primary manage-checkins" data-manage-checkins="true">Manage check-ins</button>`;
}
function handlePlanningClick(button){
 const data=button.dataset;
 if(data.leaveDate){openLeaveDate(data.leaveDate);return true;}
 if(data.calendarShift){calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+Number(data.calendarShift),1,12);render();return true;}
 if(data.calendarToday){calendarCursor=new Date(new Date().getFullYear(),new Date().getMonth(),1,12);render();return true;}
 if(data.todayMeetings){openTodaysMeetings();return true;}
 if(data.meetingMember){document.querySelector('#meetings-detail').close();openMember(data.meetingMember);return true;}
 if(data.manageCheckins){document.querySelector('#meetings-detail').close();page='people';render();return true;}
 return false;
}
function inlineTime(member){
 return `<label class="inline-date-label"><span>One-to-one time</span><input class="inline-date" type="time" data-inline="checkinTime" data-kind="people" data-id="${esc(member.id)}" value="${esc(member.checkinTime||'')}" aria-label="One-to-one time for ${esc(member.name)}"></label>`;
}
