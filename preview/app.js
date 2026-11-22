const icons = {
  waves:'M2 9c3 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2M2 15c3 0 3-2 5-2s3 2 5 2 3-2 5-2 3 2 5 2',
  plus:'M12 5v14M5 12h14', feed:'M4 4h16v16H4zM4 9h16m-12 4h8m-8 3h5',
  calendar:'M4 6h16v14H4zM8 4v4m8-4v4M4 10h16m-12 4h1m3 0h1m3 0h1',
  profile:'M4 20a8 8 0 0 1 16 0M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  check:'m5 12 4 4L19 6', close:'m6 6 12 12M18 6 6 18', maybe:'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  next:'m9 5 7 7-7 7', prev:'m15 5-7 7 7 7', pin:'M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+icons[name]+'"/></svg>';
const pick = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const demos = [
  ['Stream','Photo-first social feed','#19604e'],
  ['Weekend','One featured plan, then a shortlist','#913e28'],
  ['Agenda','Invitations in date order','#304f9e'],
  ['Deck','One invite at a time, swipe to browse','#525d78'],
  ['Inbox','Outstanding replies up front','#852d62']
];
const friends = ['Mia Keller','Jonas Frei','Lea Rossi','Noah Meier'];
const events = [
  {id:1,title:'Lakeside walk', person:friends[0], date:'2026-11-28', time:'14:00', place:'Lake Brienz', image:'lake', alt:'A wooden pier on a turquoise Alpine lake', note:'Meet at the pier in Iseltwald. We’ll walk along the water and find somewhere warm for a drink.', guests:[friends[1],friends[2]], status:''},
  {id:2,title:'Pasta at Jonas’', person:friends[1], date:'2026-11-29', time:'19:00', place:'Jonas’ place', image:'dinner', alt:'Friends sharing a candlelit dinner', note:'I’m making fresh pasta. Bring something to drink if you like.', guests:[friends[0],friends[3]], status:''},
  {id:3,title:'Coffee & a catch-up', person:friends[2], date:'2026-12-05', time:'10:30', place:'Kreis 4, Zürich', image:'coffee', alt:'A warmly lit neighborhood café', note:'A slow Saturday at our usual spot.', guests:[friends[0],friends[1]], status:'Maybe'}
];
const statuses = [['Going','Accept','check'],['Maybe','Maybe','maybe'],['Declined','Decline','close']];
const phone = pick('phone'), screen = pick('screen'), dialog = pick('dialog');
let mode=1, tab='Feed', deck=0, filter='Pending', month=new Date(2026,10,1), day='', currentEvent=null;
let profile={name:'Alex',username:'alex',picture:'',reminders:true};
let noticeTimer;
const pretty = (date, options) => new Date(date+'T12:00:00').toLocaleDateString('en-GB',options);
const dateLabel = e => pretty(e.date,{weekday:'short',day:'numeric',month:'short'});
const sorted = () => [...events].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time));
const avatar = (name, picture='') => picture ? '<img class="avatar" alt="" src="'+esc(picture)+'">' : '<span aria-hidden="true" class="avatar">'+esc(name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase())+'</span>';
const photo = (e, cls='photo') => e.image ? '<img class="'+cls+'" src="assets/'+e.image+'.jpg" alt="'+esc(e.alt)+'">' : '';
const badge = e => '<span class="datebadge"><b>'+Number(e.date.slice(8))+'</b>'+pretty(e.date,{month:'short'})+'</span>';
const meta = e => '<div class="meta">'+icon('calendar')+dateLabel(e)+' · '+e.time+'</div>'+(e.place?'<div class="meta">'+icon('pin')+esc(e.place)+'</div>':'');
const response = e => e.status || 'Awaiting reply';
const actions = e => '<div class="actions" role="group" aria-label="RSVP for '+esc(e.title)+'">'+statuses.map(([value,label,glyph])=>'<button class="'+(!e.status&&value==='Going'?'primary':'soft')+'" data-action="rsvp" data-id="'+e.id+'" data-value="'+value+'" aria-pressed="'+(e.status===value)+'">'+icon(glyph)+label+'</button>').join('')+'</div>';
const detailsButton = (e, cls='title') => '<button class="'+cls+'" data-action="details" data-id="'+e.id+'">'+esc(e.title)+'</button>';
const row = (e, image=true, hint=response(e)) => '<button class="row" data-action="details" data-id="'+e.id+'">'+(image?photo(e,'thumb'):'')+'<span class="rowtxt"><strong>'+esc(e.title)+'</strong><small>'+esc(hint)+'</small></span>'+icon('next')+'</button>';
const poster = e => '<article class="poster">'+photo(e)+'<div>'+badge(e)+'<h3>'+esc(e.title)+'</h3>'+meta(e)+'</div></article>';
const title = (heading, subtitle) => '<h2>'+heading+'</h2>'+(subtitle?'<p class="subtitle">'+subtitle+'</p>':'');

function feed(){
  const all=sorted();
  const fresh=[...events].reverse();
  const first=[...events].reverse().find(e=>e.mine) || all[0];
  if(mode===1) return title('Your feed','Plans with the Lago crew')+fresh.sort((a,b)=>(b.id>3?1:0)-(a.id>3?1:0)||a.id-b.id).map(e=>'<article class="post"><div class="author">'+avatar(e.person)+'<span><strong>'+esc(e.person)+'</strong><small>'+ (e.mine?'Hosted by you':'Invited you')+'</small></span></div>'+photo(e)+'<div class="eventbody">'+detailsButton(e)+meta(e)+(e.mine?'<p class="muted">Your event</p>':actions(e))+'</div></article>').join('');
  if(mode===2) return title('Lago weekend', 'Make a little time for each other.')+poster(first)+'<div class="feature-details">'+detailsButton({...first,title:'Event details'},'plain')+'</div>'+(first.mine?'':actions(first))+'<h3 class="heading">Also coming up</h3>'+all.filter(e=>e!==first).map(e=>row(e,true,dateLabel(e)+' · '+response(e))).join('');
  if(mode===3) return title('Coming up','Your invitations in date order')+'<div class="timeline">'+all.map(e=>'<article class="lineitem">'+badge(e)+'<div class="timeline-event">'+row(e,false,e.time+' · '+(e.place || e.person))+(e.mine?'<p class="muted">Your event</p>':actions(e))+'</div></article>').join('')+'</div>';
  if(mode===4){
    const e=all[deck];
    return title('The next move','Swipe through your invites.')+'<div class="deck">'+poster(e)+'<div class="deckbar"><button class="icon" data-action="deck" data-step="-1" aria-label="Previous event">'+icon('prev')+'</button>'+detailsButton({...e,title:'Event details'},'plain')+'<button class="icon" data-action="deck" data-step="1" aria-label="Next event">'+icon('next')+'</button></div><div class="meta">'+(deck+1)+' of '+all.length+' · '+esc(e.person)+'</div>'+(e.mine?'<p class="muted">Your event</p>':actions(e))+'</div>';
  }
  const pending=all.filter(e=>!e.mine&&!e.status);
  const shown=filter==='Pending'?pending:all;
  return title('Invitations',pending.length?pending.length+' waiting for your reply':'You’re all caught up')+
    '<div class="segment" role="group" aria-label="Invitation filter">'+['Pending','All plans'].map(label=>'<button data-action="filter" data-value="'+label+'" aria-pressed="'+(filter===label)+'">'+label+'</button>').join('')+'</div><div class="inbox">'+(shown.length?shown.map(e=>'<article>'+row(e,true,dateLabel(e)+' · '+(e.mine?'Your event':response(e)))+(e.mine?'':actions(e))+'</article>').join(''):'<p class="muted">No invitations need a reply.</p>')+'</div>';
}

function calendar(){
  const [year,m]=[month.getFullYear(),month.getMonth()];
  const prefix=year+'-'+String(m+1).padStart(2,'0')+'-';
  const all=sorted().filter(e=>e.date.startsWith(prefix));
  const range=Array.from({length:new Date(year,m+1,0).getDate()},(_,i)=>{
    const date=prefix+String(i+1).padStart(2,'0');
    const total=all.filter(e=>e.date===date).length;
    return '<button class="'+(total?'has-event':'')+'" data-action="day" data-value="'+date+'" aria-pressed="'+(day===date)+'" aria-label="'+pretty(date,{day:'numeric',month:'long'})+(total?', '+total+(total===1?' event':' events'):'')+'">'+(i+1)+'</button>';
  });
  const visible=day?all.filter(e=>e.date===day):all;
  return title('Calendar','All your Lago plans and invitations')+'<div class="calhead"><h3>'+month.toLocaleDateString('en-GB',{month:'long',year:'numeric'})+'</h3><button class="icon" data-action="month" data-step="-1" aria-label="Previous month">'+icon('prev')+'</button><button class="icon" data-action="month" data-step="1" aria-label="Next month">'+icon('next')+'</button></div><div class="calendar">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<span>'+d+'</span>').join('')+'<span></span>'.repeat((month.getDay()+6)%7)+range.join('')+'</div><h3 class="heading">'+(day?pretty(day,{weekday:'long',day:'numeric',month:'short'}):'This month')+'</h3>'+(visible.length?visible.map(e=>row(e,true,dateLabel(e)+' · '+(e.mine?'Your event':response(e)))).join(''):'<p class="muted">No events '+(day?'on this date.':'this month.')+'</p>');
}
function profileScreen(){
  return title('Profile','Your Lago account')+'<div class="profilehead">'+avatar(profile.name,profile.picture)+'<div><strong>'+esc(profile.name)+'</strong><div class="muted">@'+esc(profile.username)+'</div></div></div><form id="profile-form"><label>Profile photo<input name="photo" type="file" accept="image/*"></label><label>Display name<input name="name" value="'+esc(profile.name)+'" maxlength="35" required></label><label>Username<input name="username" value="'+esc(profile.username)+'" maxlength="24" pattern="[A-Za-z0-9_]+" title="Use letters, numbers, and underscores" required></label><h3 class="heading">Settings</h3><label class="check"><input name="reminders" type="checkbox" '+(profile.reminders?'checked':'')+'> Event reminders</label><button class="primary">Save changes</button></form>';
}
function render(){
  phone.dataset.mode=mode;
  pick('options').innerHTML=demos.map(([name,desc,color],i)=>'<button class="option" style="--dot:'+color+'" aria-pressed="'+(mode===i+1)+'" data-action="mode" data-value="'+(i+1)+'"><i></i><span><strong>'+name+'</strong><small>'+desc+'</small></span>'+icon('next')+'</button>').join('');
  pick('header').innerHTML='<div class="wordmark">'+icon('waves')+' Lago</div><button class="primary" data-action="create">'+icon('plus')+' New event</button>';
  pick('nav').innerHTML=['Feed','Calendar','Profile'].map(name=>'<button class="tab" '+(name===tab?'aria-current="page"':'')+' data-action="tab" data-value="'+name+'">'+icon(name.toLowerCase())+name+'</button>').join('');
  const top=screen.scrollTop;
  screen.innerHTML=tab==='Feed'?feed():tab==='Calendar'?calendar():profileScreen();
  screen.scrollTop=top;
}

const closeButton= '<button type="button" class="icon" data-action="close" aria-label="Close">'+icon('close')+'</button>';
function openDetails(e){
  currentEvent=e;
  dialog.innerHTML='<div class="sheethead"><h3 id="sheet-title">'+esc(e.title)+'</h3>'+closeButton+'</div>'+photo(e)+'<p class="muted">'+esc(e.person)+' · '+(e.mine?'Host':response(e))+'</p>'+meta(e)+(e.note?'<p>'+esc(e.note)+'</p>':'')+'<p class="muted">Invited · '+esc(e.guests.join(', '))+'</p>'+(e.mine?'':actions(e));
  if(!dialog.open) dialog.showModal();
}
function create(){
  currentEvent=null;
  dialog.innerHTML='<div class="sheethead"><h3 id="sheet-title">New event</h3>'+closeButton+'</div><form id="event-form"><label>Event name<input required name="title" maxlength="75" placeholder="Dinner on Saturday"></label><div class="two"><label>Date<input required name="date" type="date" value="2026-11-28"></label><label>Time<input required name="time" type="time" value="18:00"></label></div><label>Location<input name="place" maxlength="80" placeholder="Add a place"></label><label>Details<textarea name="note" rows="2" maxlength="350" placeholder="Anything friends should know?"></textarea></label><fieldset><legend>Invite friends</legend><label class="check"><input type="checkbox" data-action="everyone"> Everyone</label>'+friends.map(name=>'<label class="check"><input type="checkbox" name="guests" value="'+name+'"> '+name+'</label>').join('')+'</fieldset><div class="muted" id="invite-error" role="status"></div><button class="primary wide">Post event</button></form>';
  dialog.showModal();
}
function notify(message){
  clearTimeout(noticeTimer);
  pick('notice').textContent=message;
  noticeTimer=setTimeout(()=>{pick('notice').textContent='';},2500);
}
function moveDeck(step){
  deck=(deck+step+events.length)%events.length;
  render();
}
dialog.setAttribute('aria-labelledby','sheet-title');
dialog.addEventListener('close',()=>{currentEvent=null;});
document.addEventListener('click',event=>{
  const control=event.target.closest('button[data-action]');
  if(!control) return;
  const {action,value,id,step}=control.dataset;
  const item=events.find(e=>e.id===Number(id));
  switch(action){
    case 'mode': mode=Number(value); tab='Feed'; screen.scrollTop=0; render(); pick('options').querySelector('[aria-pressed=true]').focus({preventScroll:true}); break;
    case 'tab': tab=value; screen.scrollTop=0; render(); pick('nav').querySelector('[aria-current]').focus({preventScroll:true}); break;
    case 'rsvp':
      item.status=value;
      render();
      if(dialog.open&&currentEvent){openDetails(item);dialog.querySelector('[aria-pressed=true]').focus({preventScroll:true});}
      else {
        screen.querySelector('[data-id="'+id+'"][aria-pressed=true]')?.focus({preventScroll:true});
        notify('RSVP saved · '+value);
      }
      break;
    case 'details': openDetails(item); break;
    case 'create': create(); break;
    case 'close': dialog.close(); break;
    case 'deck': moveDeck(Number(step)); break;
    case 'filter': filter=value; render(); break;
    case 'month': month=new Date(month.getFullYear(),month.getMonth()+Number(step),1); day=''; render(); break;
    case 'day': day=day===value?'':value; render(); break;
  }
});
dialog.addEventListener('change',event=>{
  if(event.target.matches('[data-action=everyone]')){
    dialog.querySelectorAll('[name=guests]').forEach(box=>{box.checked=event.target.checked;});
  }
  if(event.target.matches('[name=guests]')){
    const boxes=[...dialog.querySelectorAll('[name=guests]')];
    const everyone=dialog.querySelector('[data-action=everyone]');
    everyone.checked=boxes.every(box=>box.checked);
    everyone.indeterminate=!everyone.checked&&boxes.some(box=>box.checked);
  }
  if(event.target.matches('input[type=checkbox]')) pick('invite-error').textContent='';
});
document.addEventListener('submit',event=>{
  event.preventDefault();
  const form=event.target,data=new FormData(form);
  if(form.id==='event-form'){
    const guests=data.getAll('guests');
    if(!guests.length){pick('invite-error').textContent='Choose at least one friend to invite.';return;}
    if(!data.get('title').trim()){form.elements.title.focus();return;}
    events.push({id:Date.now(),title:data.get('title').trim(),date:data.get('date'),time:data.get('time'),place:data.get('place'),note:data.get('note'),person:profile.name,guests,status:'',mine:true});
    dialog.close();
    tab='Feed';filter='All plans';screen.scrollTop=0;
    deck=sorted().findIndex(e=>e===events.at(-1));
    render();notify('Event posted');
  }
  if(form.id==='profile-form'){
    const photoFile=data.get('photo');
    if(!data.get('name').trim()){form.elements.name.focus();return;}
    const save=picture=>{
      profile={name:data.get('name').trim(),username:data.get('username'),picture,reminders:data.has('reminders')};
      render();notify('Profile saved');
    };
    if(photoFile.size){
      const reader=new FileReader();
      reader.onload=()=>save(reader.result);
      reader.onerror=()=>notify('Could not read photo');
      reader.readAsDataURL(photoFile);
    } else save(profile.picture);
  }
});
let swipe;
screen.addEventListener('pointerdown',event=>{
  const card=event.target.closest('.deck .poster');
  if(!card||!event.isPrimary||event.button!==0) return;
  card.setPointerCapture(event.pointerId);
  swipe={card,x:event.clientX,y:event.clientY,pointer:event.pointerId};
});
screen.addEventListener('pointermove',event=>{
  if(swipe?.pointer!==event.pointerId) return;
  const dx=event.clientX-swipe.x;
  if(Math.abs(dx)>Math.max(10,Math.abs(event.clientY-swipe.y))&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
    swipe.card.style.transform='translateX('+dx*.55+'px) rotate('+dx*.025+'deg)';
  }
});
function endSwipe(event){
  if(swipe?.pointer!==event.pointerId) return;
  const dx=event.clientX-swipe.x;
  swipe.card.style.transform='';
  if(event.type==='pointerup'&&Math.abs(dx)>48&&Math.abs(dx)>Math.abs(event.clientY-swipe.y)) moveDeck(dx<0?1:-1);
  swipe=null;
}
screen.addEventListener('pointerup',endSwipe);
screen.addEventListener('pointercancel',endSwipe);
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
render();
