/* ============================================================
   СоСед — клиентская логика
   ============================================================ */
const API = '/api';
let token       = localStorage.getItem('sosed_token') || null;
let currentUser = JSON.parse(localStorage.getItem('sosed_user') || 'null');
let myRequests  = [];   // мои запросы контактов (исходящие)

const val = id => document.getElementById(id).value.trim();
function authHeaders(){ return token ? {'Authorization':'Bearer '+token} : {}; }
async function api(path, opts={}){
  const res = await fetch(API+path,{
    cache:'no-store',
    ...opts,
    headers:{'Content-Type':'application/json',...authHeaders(),...(opts.headers||{})}
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'Ошибка запроса');
  return data;
}

/* ============ ОФОРМЛЕНИЕ / ХЕЛПЕРЫ ============ */
const GRADS = [
  'linear-gradient(135deg,#EE5230,#F6943B)','linear-gradient(135deg,#2F7D5B,#5BB089)',
  'linear-gradient(135deg,#7A5BD6,#B08BE8)','linear-gradient(135deg,#1E88C7,#5BC0EB)',
  'linear-gradient(135deg,#D6A23B,#F6C453)','linear-gradient(135deg,#C7457A,#E88BB0)',
  'linear-gradient(135deg,#3B7DD6,#5B9BE8)','linear-gradient(135deg,#D65B3B,#E8985B)'
];
const CITIES   = ['Москва','Санкт-Петербург','Новосибирск','Екатеринбург','Казань','Нижний Новгород','Краснодар','Самара','Ростов-на-Дону','Уфа','Воронеж','Сочи','Владивосток'];
const lookLabel= {flatmate:'Ищу соседа в квартиру',room:'Ищу комнату',apartment:'Снимем квартиру вместе'};
const closeSvg = '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="#241D17" stroke-width="2.2" stroke-linecap="round"/></svg>';

const fmt      = n=>Number(n).toLocaleString('ru-RU');
const initials = n=>String(n).trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const gradFor  = id=>GRADS[Math.abs(Number(String(id).replace(/\D/g,'').slice(-6))||0)%GRADS.length];

function chipsOf(p){
  const c=[];
  c.push(p.smoking?{e:'🚬',t:'Курит'}:{e:'🚭',t:'Не курит'});
  if(p.pets==='cat') c.push({e:'🐱',t:'Кошка'});
  else if(p.pets==='dog') c.push({e:'🐶',t:'Собака'});
  else c.push({e:'🌿',t:'Без животных'});
  c.push(p.cleanliness==='high'?{e:'✨',t:'Чистюля'}:p.cleanliness==='medium'?{e:'🧹',t:'Порядок'}:{e:'🛋️',t:'Без фанатизма'});
  c.push(p.schedule==='early'?{e:'🌅',t:'Жаворонок'}:p.schedule==='night'?{e:'🌙',t:'Сова'}:{e:'🔄',t:'Гибкий'});
  return c;
}
function extraChips(p){
  const c=[];
  c.push(p.guests==='often'?{e:'🎉',t:'Любит гостей'}:p.guests==='sometimes'?{e:'👥',t:'Гости иногда'}:{e:'🤫',t:'Без гостей'});
  c.push(p.noise==='lively'?{e:'🔊',t:'Живая атмосфера'}:p.noise==='moderate'?{e:'🎧',t:'Умеренно'}:{e:'🔇',t:'Тишина'});
  return c;
}

/* ============ СОСТОЯНИЕ / ФИЛЬТРЫ ============ */
let people = [];
const BUDGET_MAX=150000;
let state  = {city:'',budget:BUDGET_MAX,gender:'any',smoking:'any',pets:'any',cleanliness:'any',schedule:'any'};

function passesHard(p){
  if(state.city&&p.city!==state.city) return false;
  if(state.budget<BUDGET_MAX && Number(p.budget)>state.budget) return false;
  if(state.gender!=='any'&&p.gender!==state.gender) return false;
  return true;
}
function compat(p){
  let total=0,matched=0;
  if(state.smoking!=='any'){total+=25;if((state.smoking==='no'&&!p.smoking)||(state.smoking==='yes'&&p.smoking))matched+=25;}
  if(state.pets!=='any'){total+=20;if((state.pets==='none'&&p.pets==='none')||(state.pets==='ok'&&p.pets!=='none'))matched+=20;}
  if(state.cleanliness!=='any'){total+=30;if(state.cleanliness===p.cleanliness)matched+=30;else matched+=12;}
  if(state.schedule!=='any'){total+=25;if(state.schedule===p.schedule||p.schedule==='flexible')matched+=25;else matched+=8;}
  const base=p.base||80;
  let score=total===0?base:Math.round(base*0.35+(matched/total*100)*0.65);
  return Math.max(52,Math.min(99,score));
}

async function loadListings(){
  try{people=await api('/listings');}
  catch{people=[];}
  render();
  loadStats();
}

async function loadStats(){
  try{
    const s=await api('/stats');
    const set=(id,v,bold)=>{const el=document.getElementById(id);if(el)el.innerHTML=bold?`<b>${fmt(v)}</b>`:fmt(v);};
    set('statListings',s.listings,true);
    set('statMatches',s.matches,false);
    set('statCities',s.cities,false);
  }catch{}
}

/* ============ ЗАПРОСЫ КОНТАКТОВ ============ */
async function loadMyRequests(){
  if(!token) return;
  try{
    const data=await api('/contacts/notifications');
    myRequests=data.outgoing||[];
    renderNotifBadge(data.badgeCount||0);
  }catch{myRequests=[];}
}

function getRequestStatus(listingId){
  const r=myRequests.find(r=>String(r.listingId)===String(listingId));
  if(!r) return null;
  return r; // {status:'pending'|'shared', contactInfo, id}
}

async function requestContact(listingId, ownerName){
  if(!token){toast('🔒','Войдите чтобы запросить контакты');openAuth('login');return;}
  try{
    await api('/contacts/request',{method:'POST',body:JSON.stringify({listingId})});
    await loadMyRequests();
    toast('📨',`Запрос отправлен — ${ownerName} получит уведомление`);
    // перерисовать модалку если открыта
    const openCard=people.find(p=>String(p.id)===String(listingId));
    if(openCard) openModal(String(listingId));
  }catch(e){toast('⚠️',e.message);}
}

async function markSeen(requestId){
  try{await api('/contacts/'+requestId+'/seen',{method:'POST'});}catch{}
  await loadMyRequests();
}

/* ============ УВЕДОМЛЕНИЯ (КОЛОКОЛЬЧИК) ============ */
function renderNotifBadge(count){
  const el=document.getElementById('notifBell');
  if(!el) return;
  el.innerHTML=`🔔${count>0?`<span class="notif-badge">${count}</span>`:''}`;
  el.style.display='inline-flex';
}

async function openNotifications(){
  const modal=document.getElementById('notifModal');
  modal.innerHTML=`<div class="notif-loading">Загрузка...</div>`;
  openOverlay('notifOverlay');
  try{
    const data=await api('/contacts/notifications');
    const {incoming=[],outgoing=[]}=data;

    // --- входящие запросы (ко мне как владельцу анкеты) ---
    const inHtml=incoming.length===0
      ?'<div class="notif-empty">Входящих запросов нет</div>'
      :incoming.map(r=>{
        if(r.status==='pending') return `
          <div class="notif-row pending" id="nr-${r.id}">
            <div class="notif-ava">${initials(r.fromUserName)}</div>
            <div class="notif-info">
              <div class="notif-title"><b>${r.fromUserName}</b> хочет ваши контакты</div>
              <div class="notif-sub">по вашей анкете · ${new Date(r.createdAt).toLocaleDateString('ru-RU')}</div>
              <div class="notif-share-form" id="sf-${r.id}" style="display:none">
                <input class="notif-input" id="ci-${r.id}" type="text" placeholder="Телефон, Telegram, ВКонтакте...">
                <button class="btn btn-primary" style="padding:9px 16px;font-size:13px" onclick="submitShare('${r.id}')">Отправить</button>
              </div>
            </div>
            <div class="notif-actions">
              <button class="btn-share" onclick="toggleShareForm('${r.id}')">Поделиться</button>
              <button class="btn-decline" onclick="declineRequest('${r.id}')">Отклонить</button>
            </div>
          </div>`;
        if(r.status==='shared') return `
          <div class="notif-row shared">
            <div class="notif-ava shared">${initials(r.fromUserName)}</div>
            <div class="notif-info">
              <div class="notif-title">✅ Поделились с <b>${r.fromUserName}</b></div>
              <div class="notif-sub">Контакт: ${r.contactInfo}</div>
            </div>
          </div>`;
        return '';
      }).join('');

    // --- мои исходящие запросы ---
    const outHtml=outgoing.length===0
      ?'<div class="notif-empty">Вы ещё никого не запрашивали</div>'
      :outgoing.map(r=>{
        if(r.status==='pending') return `
          <div class="notif-row">
            <div class="notif-ava pending-out">⏳</div>
            <div class="notif-info">
              <div class="notif-title">Запрос к <b>${r.listingName}</b> (${r.listingCity})</div>
              <div class="notif-sub">Ожидание ответа...</div>
            </div>
            <button class="btn-decline" onclick="declineRequest('${r.id}')">Отменить</button>
          </div>`;
        if(r.status==='shared') return `
          <div class="notif-row ${!r.requesterSeen?'new-notif':''}">
            <div class="notif-ava shared">✅</div>
            <div class="notif-info">
              <div class="notif-title"><b>${r.listingName}</b> поделился контактом!</div>
              <div class="notif-contact">${r.contactInfo}</div>
            </div>
            ${!r.requesterSeen?`<button class="btn-seen" onclick="markSeen('${r.id}');openNotifications()">Понятно</button>`:''}
          </div>`;
        return '';
      }).join('');

    modal.innerHTML=`
      <button class="m-close" onclick="closeNotif()">${closeSvg}</button>
      <div class="notif-head"><h3>🔔 Уведомления</h3></div>
      <div class="notif-body">
        <div class="notif-section"><h4>Входящие запросы</h4>${inHtml}</div>
        <div class="notif-section"><h4>Мои запросы</h4>${outHtml}</div>
      </div>`;
  }catch(e){
    modal.innerHTML=`<div class="notif-loading">Ошибка загрузки</div>`;
  }
}

function toggleShareForm(id){
  const form=document.getElementById('sf-'+id);
  if(!form) return;
  const open=form.style.display==='none';
  form.style.display=open?'flex':'none';
  if(open) document.getElementById('ci-'+id).focus();
}
async function submitShare(id){
  const contactInfo=document.getElementById('ci-'+id).value.trim();
  if(!contactInfo){toast('⚠️','Введите ваш контакт');return;}
  try{
    await api('/contacts/'+id+'/share',{method:'POST',body:JSON.stringify({contactInfo})});
    toast('✅','Контакт отправлен!');
    await loadMyRequests();
    loadStats();
    openNotifications();
  }catch(e){toast('⚠️',e.message);}
}
async function declineRequest(id){
  try{
    await api('/contacts/'+id,{method:'DELETE'});
    await loadMyRequests();
    openNotifications();
    toast('🗑️','Запрос удалён');
  }catch(e){toast('⚠️',e.message);}
}

function closeNotif(){closeOverlay('notifOverlay');}
function closeShare(){closeOverlay('shareOverlay');}

/* ============ РЕНДЕР КАТАЛОГА ============ */
function render(){
  const grid=document.getElementById('grid');
  const isAdmin=currentUser&&currentUser.role==='admin';
  let list=people.filter(passesHard).map(p=>({...p,score:compat(p)}));
  const sort=document.getElementById('sortSel').value;
  if(sort==='match') list.sort((a,b)=>b.score-a.score);
  else if(sort==='budget-asc') list.sort((a,b)=>a.budget-b.budget);
  else if(sort==='budget-desc') list.sort((a,b)=>b.budget-a.budget);
  else if(sort==='age-asc') list.sort((a,b)=>a.age-b.age);
  const n=list.length;
  document.getElementById('count').textContent=n;
  const w=n%10===1&&n%100!==11?'анкета':(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?'анкеты':'анкет';
  document.getElementById('countWord').textContent=w;
  if(n===0){
    grid.innerHTML=`<div class="empty"><div class="em">🔍</div><h4>Совпадений не найдено</h4><p>Попробуйте смягчить фильтры.</p><button class="btn btn-primary" onclick="resetFilters()">Сбросить фильтры</button></div>`;
    return;
  }
  grid.innerHTML=list.map(p=>{
    const ch=chipsOf(p).slice(0,4).map(c=>`<span class="tag">${c.e} ${c.t}</span>`).join('');
    const ver=p.verified?`<svg class="verified" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 1.8 3 .2.9 2.9 2.3 1.9-1 2.8 1 2.8-2.3 1.9-.9 2.9-3 .2L12 22l-2.4-1.8-3-.2-.9-2.9L3.4 15l1-2.8-1-2.8 2.3-1.9.9-2.9 3-.2z" fill="#2F7D5B"/><path d="m8.5 12 2.3 2.3 4.7-4.7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`:'';
    const del=isAdmin?`<button class="c-del" title="Удалить" onclick="event.stopPropagation();adminDeleteListing('${p.id}')"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5h6v2m-1 0v12H10V7" stroke="#CF3D1C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`:'';
    return `<div class="card ${isAdmin?'admin':''}" data-id="${p.id}" onclick="openModal('${p.id}')">
      ${del}
      <div class="c-match"><span class="d"></span>${p.score}% совпадение</div>
      <span class="c-looking">📍 ${lookLabel[p.looking]||'Ищет соседа'}</span>
      <div class="c-top">
        <div class="c-ava" style="background:${gradFor(p.id)}">${initials(p.name)}</div>
        <div class="c-id"><div class="nm">${p.name}, ${p.age} ${ver}</div><div class="oc">${p.occ}</div></div>
      </div>
      <div class="c-loc"><svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="2"/></svg>${p.city}, ${p.district}</div>
      <div class="c-tags">${ch}</div>
      <div class="c-foot">
        <div class="c-budget"><div class="v">${fmt(p.budget)} ₽</div><div class="l">в месяц</div></div>
        <div class="c-more">Подробнее <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      </div>
    </div>`;
  }).join('');
}

/* ============ КАРТОЧКА ПРОФИЛЯ ============ */
function openModal(id){
  const p=people.find(x=>String(x.id)===String(id)); if(!p) return;
  const score=compat(p);
  const allTags=[...chipsOf(p),...extraChips(p)].map(c=>`<span class="tag">${c.e} ${c.t}</span>`).join('');
  const ver=p.verified?`<svg class="verified" style="width:20px;height:20px" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 1.8 3 .2.9 2.9 2.3 1.9-1 2.8 1 2.8-2.3 1.9-.9 2.9-3 .2L12 22l-2.4-1.8-3-.2-.9-2.9L3.4 15l1-2.8-1-2.8 2.3-1.9.9-2.9 3-.2z" fill="#2F7D5B"/><path d="m8.5 12 2.3 2.3 4.7-4.7" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`:'';

  // --- кнопка запроса контакта ---
  let actionBtn='';
  if(!token){
    actionBtn=`<button class="btn btn-primary btn-block" onclick="openAuth('login')">📱 Войдите чтобы запросить контакты</button>`;
  } else if(currentUser&&p.ownerId===currentUser.id){
    actionBtn=`<div class="own-listing">Это ваша анкета</div>`;
  } else if(!p.ownerId){
    actionBtn=`<div class="own-listing">Демо-анкета — контакты недоступны</div>`;
  } else {
    const req=getRequestStatus(p.id);
    if(!req){
      actionBtn=`<button class="btn btn-primary btn-block" onclick="requestContact('${p.id}','${p.name}')">📱 Запросить контакты</button>`;
    } else if(req.status==='pending'){
      actionBtn=`<div class="own-listing">⏳ Запрос отправлен — ожидание ответа...</div>`;
    } else if(req.status==='shared'){
      actionBtn=`<div class="contact-received">✅ Контакт получен:<b>${req.contactInfo}</b></div>`;
    }
  }

  document.getElementById('modal').innerHTML=`
    <button class="m-close" onclick="closeModal()">${closeSvg}</button>
    <div class="m-hero">
      <div class="m-ava" style="background:${gradFor(p.id)}">${initials(p.name)}</div>
      <div class="m-id"><div class="nm">${p.name}, ${p.age} ${ver}</div><div class="oc">${p.occ}</div><span class="lk">📍 ${lookLabel[p.looking]||'Ищет соседа'}</span></div>
      <div class="ring" style="--p:${score}"><i><span class="rp">${score}%</span><span class="rl">совпадение</span></i></div>
    </div>
    <div class="m-body">
      <div class="m-stats">
        <div class="m-stat"><div class="l">Бюджет</div><div class="v bud">${fmt(p.budget)} ₽/мес</div></div>
        <div class="m-stat"><div class="l">Локация</div><div class="v">${p.city}, ${p.district}</div></div>
        <div class="m-stat"><div class="l">Заселение</div><div class="v">📅 ${p.moveIn||'по договорённости'}</div></div>
        <div class="m-stat"><div class="l">Статус</div><div class="v">${p.verified?'✅ Подтверждён':'⏳ На проверке'}</div></div>
      </div>
      <div class="m-block"><h5>О человеке</h5><div class="m-about">${p.about}</div></div>
      <div class="m-block"><h5>Привычки и образ жизни</h5><div class="m-tags">${allTags}</div></div>
      <div class="m-actions">${actionBtn}</div>
    </div>`;
  openOverlay('overlay');
}

/* ============ УПРАВЛЕНИЕ ОВЕРЛЕЯМИ ============ */
function openOverlay(id){document.getElementById(id).classList.add('open');document.body.style.overflow='hidden';}
function closeOverlay(id){document.getElementById(id).classList.remove('open');document.body.style.overflow='';}
function closeModal(){closeOverlay('overlay');}
function closeAuth(){closeOverlay('authOverlay');}
function closeAdmin(){closeOverlay('adminOverlay');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeAuth();closeAdmin();closeNotif();closeShare();}});

/* ============ ФИЛЬТРЫ ============ */
document.querySelectorAll('.filters .seg').forEach(seg=>{
  seg.addEventListener('click',e=>{
    const btn=e.target.closest('button'); if(!btn) return;
    seg.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    state[seg.dataset.filter]=btn.dataset.val;
    render();
  });
});
const range=document.getElementById('budgetRange');
range.addEventListener('input',()=>{
  state.budget=+range.value;
  document.getElementById('budgetVal').textContent=fmt(state.budget)+' ₽';
  render();
});
function resetFilters(){
  state={city:'',budget:BUDGET_MAX,gender:'any',smoking:'any',pets:'any',cleanliness:'any',schedule:'any'};
  document.querySelectorAll('.filters .seg').forEach(seg=>seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.val==='any')));
  range.value=BUDGET_MAX;
  document.getElementById('budgetVal').textContent=fmt(BUDGET_MAX)+' ₽';
  document.querySelectorAll('.city-chip').forEach(c=>c.classList.toggle('active',c.dataset.city===''));
  render();
}
function buildCities(){
  const box=document.getElementById('cityChips');
  const all=[{city:'',label:'Все города'},...CITIES.map(c=>({city:c,label:c}))];
  box.innerHTML=all.map((c,i)=>`<button class="city-chip ${i===0?'active':''}" data-city="${c.city}" onclick="setCity('${c.city}',this)">${c.label}</button>`).join('');
}
function setCity(city,el){
  state.city=city;
  document.querySelectorAll('.city-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  render();
}
function heroSearch(){
  const c=document.getElementById('heroCity').value;
  const b=+document.getElementById('heroBudget').value;
  state.city=c;state.budget=b;
  range.value=b;document.getElementById('budgetVal').textContent=fmt(b)+' ₽';
  document.querySelectorAll('.city-chip').forEach(x=>x.classList.toggle('active',x.dataset.city===c));
  render();
  document.getElementById('search').scrollIntoView({behavior:'smooth'});
}

/* ============ ФОРМА АНКЕТЫ ============ */
async function submitForm(){
  if(!token){toast('🔒','Сначала войдите в аккаунт');openAuth('login');return;}
  const name=val('fName'),age=+document.getElementById('fAge').value;
  const city=document.getElementById('fCity').value,budget=+document.getElementById('fBudget').value;
  if(!name||!age||!city||!budget){toast('⚠️','Заполните имя, возраст, город и бюджет');return;}
  const payload={name,age,city,budget,district:val('fDistrict'),gender:document.getElementById('fGender').value,
    schedule:document.getElementById('fSchedule').value,smoking:document.getElementById('fSmoking').value==='true',
    pets:document.getElementById('fPets').value,
    cleanliness:document.getElementById('fCleanliness').value,
    looking:document.getElementById('fLooking').value,
    about:val('fAbout'),occ:'Пользователь'};
  try{
    const res=await api('/listings',{method:'POST',body:JSON.stringify(payload)});
    const newId=res.listing&&res.listing.id;
    toast('🎉','Анкета опубликована!');
    resetFilters();
    await loadListings();
    document.getElementById('search').scrollIntoView({behavior:'smooth'});
    ['fName','fAge','fCity','fDistrict','fBudget','fAbout'].forEach(id=>document.getElementById(id).value='');
    setTimeout(()=>{
      const el=document.querySelector(`.card[data-id="${newId}"]`);
      if(el){
        el.scrollIntoView({behavior:'smooth',block:'center'});
        el.style.transition='box-shadow .3s, transform .3s';
        el.style.boxShadow='0 0 0 3px var(--coral), 0 12px 32px rgba(238,82,48,.3)';
        el.style.transform='translateY(-4px)';
        setTimeout(()=>{el.style.boxShadow='';el.style.transform='';},2600);
      }
    },450);
  }catch(e){toast('⚠️',e.message);}
}

/* ============ АВТОРИЗАЦИЯ ============ */
function renderNav(){
  const el=document.getElementById('navAuth');
  if(currentUser){
    const adminBtn=currentUser.role==='admin'?`<a class="btn btn-ghost" onclick="openAdmin()">🛡️ Админ</a>`:'';
    el.innerHTML=`
      <button id="notifBell" class="notif-bell" onclick="openNotifications()" style="display:none">🔔</button>
      <div class="nav-user">
        <span class="greet">Привет, ${currentUser.name}</span>
        <span class="role-badge ${currentUser.role}">${currentUser.role==='admin'?'админ':'польз.'}</span>
      </div>
      ${adminBtn}
      <a class="btn btn-primary" onclick="logout()">Выйти</a>`;
    loadMyRequests();
    clearInterval(window._notifInterval);
    window._notifInterval=setInterval(loadMyRequests,30000);
  }else{
    el.innerHTML=`<a class="btn btn-ghost" onclick="openAuth('login')">Войти</a><a class="btn btn-primary" onclick="openAuth('reg')">Регистрация</a>`;
    clearInterval(window._notifInterval);
  }
}
function openAuth(tab){switchTab(tab||'login');openOverlay('authOverlay');}
function switchTab(t){
  const L=t==='login';
  document.getElementById('tabLogin').classList.toggle('on',L);
  document.getElementById('tabReg').classList.toggle('on',!L);
  document.getElementById('paneLogin').style.display=L?'flex':'none';
  document.getElementById('paneReg').style.display=L?'none':'flex';
}
let regRole='user';
function setRole(r,el){
  regRole=r;
  el.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  document.getElementById('adminCodeField').style.display=r==='admin'?'flex':'none';
}
async function doRegister(){
  const name=val('rgName'),email=val('rgEmail');
  const password=document.getElementById('rgPass').value;
  const password2=document.getElementById('rgPass2').value;
  if(!name||!email){toast('⚠️','Заполните имя и почту');return;}
  if(!password||password.length<6){toast('⚠️','Пароль должен быть не менее 6 символов');return;}
  if(password!==password2){toast('⚠️','Пароли не совпадают');return;}
  const code=val('rgCode');
  try{
    await api('/register',{method:'POST',body:JSON.stringify({name,email,password,role:regRole,adminCode:code})});
    toast('✅','Регистрация успешна! Войдите в аккаунт');
    document.getElementById('liEmail').value=email;
    document.getElementById('liPass').value='';
    switchTab('login');
  }catch(e){toast('⚠️',e.message);}
}
async function doLogin(){
  const email=val('liEmail'),password=document.getElementById('liPass').value;
  if(!email||!password){toast('⚠️','Введите почту и пароль');return;}
  try{
    const r=await api('/login',{method:'POST',body:JSON.stringify({email,password})});
    token=r.token;currentUser=r.user;
    localStorage.setItem('sosed_token',token);
    localStorage.setItem('sosed_user',JSON.stringify(currentUser));
    renderNav();closeAuth();await loadListings();
    toast('👋','Добро пожаловать, '+currentUser.name+'!');
  }catch(e){toast('⚠️',e.message);}
}
function logout(){
  token=null;currentUser=null;myRequests=[];
  localStorage.removeItem('sosed_token');localStorage.removeItem('sosed_user');
  clearInterval(window._notifInterval);
  renderNav();render();toast('👋','Вы вышли из аккаунта');
}

/* ============ АДМИН-ПАНЕЛЬ ============ */
function isAdminOpen(){return document.getElementById('adminOverlay').classList.contains('open');}
async function openAdmin(){
  try{
    const[listings,users]=await Promise.all([api('/listings'),api('/users')]);
    const lRows=listings.map(l=>`
      <div class="admin-row">
        <div class="ava" style="background:${gradFor(l.id)}">${initials(l.name)}</div>
        <div class="info"><div class="nm">${l.name}, ${l.age}</div><div class="meta">${l.city}, ${l.district} · ${fmt(l.budget)} ₽/мес</div></div>
        <button class="del-btn" onclick="adminDeleteListing('${l.id}')">Удалить</button>
      </div>`).join('')||'<div class="meta">Анкет пока нет</div>';
    const uRows=users.map(u=>`
      <div class="admin-row">
        <div class="ava" style="background:${u.role==='admin'?'var(--coral)':'var(--sage)'}">${initials(u.name)}</div>
        <div class="info"><div class="nm">${u.name} <span class="role-badge ${u.role}">${u.role==='admin'?'админ':'польз.'}</span></div><div class="meta">📧 ${u.email}</div><div class="meta">🔑 ${u.password||'—'}</div></div>
        ${u.id===currentUser.id?'<span class="meta">это вы</span>':`<button class="del-btn" onclick="adminDeleteUser('${u.id}')">Удалить</button>`}
      </div>`).join('')||'<div class="meta">Пользователей пока нет</div>';
    document.getElementById('adminModal').innerHTML=`
      <button class="m-close" onclick="closeAdmin()">${closeSvg}</button>
      <div class="admin-head">
        <h3>🛡️ Админ-панель</h3>
        <div class="admin-stats">
          <div class="admin-stat"><div class="v">${listings.length}</div><div class="l">анкет</div></div>
          <div class="admin-stat"><div class="v">${users.length}</div><div class="l">пользователей</div></div>
          <div class="admin-stat"><div class="v">${users.filter(u=>u.role==='admin').length}</div><div class="l">админов</div></div>
        </div>
      </div>
      <div class="admin-body">
        <div class="admin-section"><h4>Анкеты соседей</h4>${lRows}</div>
        <div class="admin-section"><h4>Пользователи (почта видна только вам)</h4>${uRows}</div>
      </div>`;
    openOverlay('adminOverlay');
  }catch(e){toast('⚠️',e.message);}
}
async function adminDeleteListing(id){
  if(!confirm('Удалить эту анкету?')) return;
  try{await api('/listings/'+id,{method:'DELETE'});toast('🗑️','Анкета удалена');await loadListings();if(isAdminOpen())openAdmin();}
  catch(e){toast('⚠️',e.message);}
}
async function adminDeleteUser(id){
  if(!confirm('Удалить пользователя?')) return;
  try{await api('/users/'+id,{method:'DELETE'});toast('🗑️','Пользователь удалён');if(isAdminOpen())openAdmin();}
  catch(e){toast('⚠️',e.message);}
}

/* ============ TOAST ============ */
let toastTimer;
function toast(em,msg){
  document.querySelector('#toast .em').textContent=em;
  document.getElementById('toastMsg').textContent=msg;
  const t=document.getElementById('toast');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
}

/* ============ МОБИЛЬНЫЙ ТОГГЛ ФИЛЬТРОВ ============ */
function initMobileFilters(){
  const sidebar=document.getElementById('filters');if(!sidebar) return;
  const inner=document.createElement('div');inner.className='filters-inner';
  while(sidebar.firstChild) inner.appendChild(sidebar.firstChild);
  sidebar.appendChild(inner);
  const btn=document.createElement('button');
  btn.className='filter-mob-toggle';
  btn.innerHTML='<span>🎛️ Фильтры</span><span class="arr">▼</span>';
  sidebar.insertBefore(btn,inner);
  let open=window.innerWidth>=981;
  function update(){inner.style.maxHeight=open?inner.scrollHeight+'px':'0';inner.classList.toggle('hidden',!open);btn.classList.toggle('open',open);}
  update();
  btn.addEventListener('click',()=>{open=!open;update();});
  window.addEventListener('resize',()=>{if(window.innerWidth>=981)open=true;update();});
}

/* ============ REVEAL ON SCROLL ============ */
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:.12});

/* ============ ИНИЦИАЛИЗАЦИЯ ============ */
renderNav();
buildCities();
loadListings();
initMobileFilters();
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
