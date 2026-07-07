/* =====================================================================
   jokenpokemon-battle-chips.js — lógica da versão "Battle Chips"
   (re-skin em moldura de celular: Joken-Dex, Loja, Eventos, Roda).
   Depende de shared/util.js e shared/cards.js (carregados antes).
===================================================================== */

const HAND_SIZE=5, SHIELDS=['antichamas','impermeavel'];
const PACK_PRICE=10, COMBO_PRICE=26, DUPE_VALUE=4, HOLO_PRICE=15;
const RIVALS=[
 {id:'r1',ic:'👶',name:'IRMÃO CAÇULA',ai:'easy',target:3,reward:15,desc:'fácil · 3 pts · 🪙15'},
 {id:'r2',ic:'🚲',name:'VIZINHO DA RUA',ai:'easy',target:5,reward:20,desc:'fácil · 5 pts · 🪙20'},
 {id:'r3',ic:'🎀',name:'MENINA DA BANCA',ai:'normal',target:5,reward:25,desc:'normal · 5 pts · 🪙25'},
 {id:'r4',ic:'🎒',name:'ZÉ DO RECREIO',ai:'normal',target:7,reward:30,desc:'normal · 7 pts · 🪙30'},
 {id:'r5',ic:'🥤',name:'TIO DA CANTINA',ai:'normal',target:7,reward:35,desc:'normal · 7 pts · 🪙35'},
 {id:'r6',ic:'🏅',name:'CAMPEÃO DA ESCOLA',ai:'hard',target:7,reward:45,desc:'difícil · 7 pts · 🪙45'},
 {id:'r7',ic:'🕶️',name:'COLECIONADOR MISTERIOSO',ai:'hard',target:9,reward:55,desc:'difícil · 9 pts · 🪙55'},
 {id:'r8',ic:'👑',name:'MESTRE DO JOKENPÔ',ai:'hard',target:10,reward:70,desc:'difícil · 10 pts · 🪙70'}
];

/* raridade (rótulo fã, baseado nos elementos oficiais do card) */
function rarity(c){
  if(c.el.some(e=>SHIELDS.includes(e)))return {t:'ULTRA RARO',c:'#c77dff'};
  if(c.el.includes('fogo')||c.el.includes('agua'))return {t:'RARO',c:'#7ee3ff'};
  return {t:'COMUM',c:'#ffd23f'};
}

/* ============ SAVE (v2, migra do v1; fallback em memória) ============ */
let save=null;
const storage={
  read(k){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch(e){return null;}},
  write(){try{localStorage.setItem('jkp_save_v2',JSON.stringify(save));}catch(e){}}
};
function newSave(){
  const owned={};const pool=COLLECTION.map(c=>c.n);
  for(let i=0;i<15;i++){const k=Math.floor(Math.random()*pool.length);owned[pool.splice(k,1)[0]]=1;}
  return {coins:20,owned,beaten:{},bestStreak:0,sound:true,xp:0,holo:{},lastSpin:''};
}
(function loadSave(){
  save=storage.read('jkp_save_v2');
  if(!save){
    const v1=storage.read('jkp_save_v1');
    save = v1 ? Object.assign(newSave(),v1,{xp:0,holo:{},lastSpin:''}) : newSave();
  }
  storage.write();
})();
const ownedCount=()=>Object.keys(save.owned).length;
const level=()=>1+Math.floor(save.xp/100);
function gainXp(n){
  const before=level();save.xp+=n;storage.write();
  if(level()>before){sfx.fanfare();toastLevel();}
  refreshHUD();
}
function toastLevel(){
  const t=document.createElement('div');
  t.style.cssText='position:absolute;left:50%;top:80px;transform:translateX(-50%);z-index:200;font-family:Bungee;font-size:.8rem;color:#7ae582;text-shadow:0 0 12px rgba(122,229,130,.8);animation:pop .5s ease;';
  t.textContent=`⬆ NÍVEL ${level()}!`;
  $('app').appendChild(t);setTimeout(()=>t.remove(),1800);
}

/* ============ SOM sintetizado ============ */
let actx=null;
function ac(){
  if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}
  if(actx&&actx.state==='suspended')actx.resume();
  return actx;
}
document.addEventListener('pointerdown',()=>ac(),{once:true});
function tone(f,d=0.12,type='square',vol=0.13,delay=0,slide=null){
  if(!save.sound)return;const ctx=ac();if(!ctx)return;
  const t=ctx.currentTime+delay;
  const o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);
  if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);
  g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+d);
  o.connect(g).connect(ctx.destination);o.start(t);o.stop(t+d+0.03);
}
function noiseHit(d=0.28,vol=0.28){
  if(!save.sound)return;const ctx=ac();if(!ctx)return;
  const t=ctx.currentTime;
  const buf=ctx.createBuffer(1,ctx.sampleRate*d,ctx.sampleRate);
  const data=buf.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  const src=ctx.createBufferSource();src.buffer=buf;
  const g=ctx.createGain();g.gain.setValueAtTime(vol,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+d);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;
  src.connect(lp).connect(g).connect(ctx.destination);src.start(t);
}
const sfx={
  click(){tone(600,.06,'square',.09);},
  deal(){tone(500,.05,'triangle',.08);tone(700,.05,'triangle',.08,.06);},
  arm(){tone(880,.12,'sine',.12,0,1400);},
  flip(){tone(280,.2,'sine',.11,0,950);},
  clash(){noiseHit(.3,.3);tone(110,.22,'sawtooth',.18);},
  win(){[523,659,784,1046].forEach((f,i)=>tone(f,.12,'square',.11,i*.09));},
  lose(){[392,330,262].forEach((f,i)=>tone(f,.17,'sawtooth',.1,i*.13));},
  draw(){tone(440,.11,'triangle',.1);tone(440,.11,'triangle',.1,.15);},
  coin(){tone(990,.07,'square',.11);tone(1320,.13,'square',.11,.07);},
  pack(){[660,880,1100,1320,1760].forEach((f,i)=>tone(f,.09,'triangle',.11,i*.06));},
  fanfare(){[523,659,784,1046,784,1046,1318].forEach((f,i)=>tone(f,.15,'square',.11,i*.11));},
  gameover(){[330,294,262,220].forEach((f,i)=>tone(f,.2,'sawtooth',.1,i*.16));},
  spin(){for(let i=0;i<14;i++)tone(500+i*40,.05,'square',.06,i*.16);}
};

/* ============ helpers ============ */
function cardEl(c,{badge=false}={}){
  const wrap=document.createElement('div');
  wrap.className='cardwrap'+(save.holo[c.n]?' holo-fx':'');
  wrap.innerHTML=`
    <div class="card">
      <div class="card-face">
        <div class="sprite" style="${frontSprite(c.n)}"></div>
        ${badge?`<div class="elem-ribbon">${ELEMS[c.elem].emoji} ${ELEMS[c.elem].label}</div>`:''}
      </div>
      <div class="card-face card-elemface"><div class="sprite" style="${backSprite(c.elem)}"></div></div>
    </div>`;
  return wrap;
}
function shieldFloat(elem,side){
  const s=document.createElement('span');s.className='shield-float';
  if(side==='left'){s.style.right='auto';s.style.left='-12px';}
  s.innerHTML=`<span class="sprite" style="${backSprite(elem)}"></span>`;
  return s;
}
function spawnParticles(x,y,emojis,count=12){
  for(let i=0;i<count;i++){
    const p=document.createElement('span');p.className='particle';
    p.textContent=rand(emojis);
    p.style.left=x+'px';p.style.top=y+'px';
    p.style.setProperty('--dx',(Math.random()*200-100)+'px');
    p.style.setProperty('--dy',(Math.random()*200-100)+'px');
    p.style.setProperty('--rot',(Math.random()*360)+'deg');
    document.body.appendChild(p);setTimeout(()=>p.remove(),950);
  }
}
function confettiRain(){
  const colors=['#ffd23f','#ff5ec8','#7ee3ff','#7ae582','#ff9f1c'];
  for(let i=0;i<60;i++){
    const c=document.createElement('div');c.className='confetti';
    c.style.left=Math.random()*100+'vw';c.style.background=colors[i%colors.length];
    c.style.animationDuration=(1.6+Math.random()*1.6)+'s';
    c.style.animationDelay=(Math.random()*.6)+'s';
    document.body.appendChild(c);setTimeout(()=>c.remove(),3600);
  }
}

/* ============ HUD / relógio ============ */
function refreshHUD(){
  $('wCoins').textContent=`🪙 ${save.coins}`;
  $('wCards').textContent=`🎴 ${ownedCount()}/60`;
  $('xpFill').style.width=(save.xp%100)+'%';
  $('levelLabel').textContent=`Nível ${level()} · ${save.xp%100}/100 XP · recorde 🔥 ${save.bestStreak}`;
}
(function clock(){
  const f=()=>{const d=new Date();$('clock').textContent=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
  f();setInterval(f,20000);
})();

/* ============ tabela de elementos ============ */
(function fillTable(){
  const t=$('elemTable');
  Object.keys(BEATS).forEach(k=>{
    const row=document.createElement('div');row.className='elem-row';
    row.innerHTML=`<span class="thumb"><span class="sprite" style="${backSprite(k)}"></span></span>
      <span class="nm">${ELEMS[k].label}</span>
      <span class="win">vence ${BEATS[k].map(b=>ELEMS[b].label.toLowerCase()).join(', ')}</span>`;
    t.appendChild(row);
  });
})();

/* ============ NAVEGAÇÃO ============ */
const SCREENS=['menu','dex','shop','events','game'];
let currentScreen='menu';
function show(name){
  currentScreen=name;
  SCREENS.forEach(s=>$('screen-'+s).classList.toggle('hidden',s!==name));
  ['menu','dex','battle','events','shop'].forEach(n=>{
    const b=$('nav-'+n);if(b)b.classList.toggle('on',n===name||(n==='battle'&&name==='game'));
  });
  if(name==='menu'){refreshHUD();startCarousel();}else stopCarousel();
  if(name==='dex')renderDex();
  if(name==='shop')renderShop();
  if(name==='events')renderEvents();
  $('content').scrollTop=0;
}
function nav(n){
  sfx.click();
  if(battle.active&&n!=='game'){
    askConfirm('SAIR DA PARTIDA?','A partida atual será perdida (sem recompensa).',()=>{battle.active=false;doNav(n);});
    return;
  }
  doNav(n);
}
function doNav(n){
  if(n==='battle'){$('battleModeOverlay').classList.remove('hidden');return;}
  show(n);
}
document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.nav)));
$('rulesClose').addEventListener('click',()=>{sfx.click();$('rulesOverlay').classList.add('hidden');});

let confirmCb=null;
function askConfirm(title,text,cb){
  $('confirmTitle').textContent=title;$('confirmText').textContent=text;
  confirmCb=cb;$('confirmOverlay').classList.remove('hidden');
}
$('confirmYes').addEventListener('click',()=>{sfx.click();$('confirmOverlay').classList.add('hidden');if(confirmCb)confirmCb();confirmCb=null;});
$('confirmNo').addEventListener('click',()=>{sfx.click();$('confirmOverlay').classList.add('hidden');confirmCb=null;});

/* modo de batalha + dificuldade */
let pendingMode=null;
document.querySelectorAll('[data-bmode]').forEach(b=>b.addEventListener('click',()=>{
  sfx.click();$('battleModeOverlay').classList.add('hidden');
  pendingMode=b.dataset.bmode;
  $('diffTitle').textContent=pendingMode==='quick'?'PARTIDA RÁPIDA':'SOBREVIVÊNCIA';
  $('diffDesc').textContent=pendingMode==='quick'
    ?'Baralho completo dos 60 cards. Primeiro a 7 pontos!'
    :'Vença o máximo de rodadas seguidas. Uma derrota e acabou (empate não elimina).';
  $('diffOverlay').classList.remove('hidden');
}));
$('bmodeCancel').addEventListener('click',()=>{sfx.click();$('battleModeOverlay').classList.add('hidden');});
document.querySelectorAll('.diff-btn[data-diff]').forEach(b=>b.addEventListener('click',()=>{
  sfx.click();$('diffOverlay').classList.add('hidden');
  startBattle({mode:pendingMode,ai:b.dataset.diff,target:pendingMode==='survival'?Infinity:7});
}));
$('diffCancel').addEventListener('click',()=>{sfx.click();$('diffOverlay').classList.add('hidden');});

/* ============ CARROSSEL ============ */
let caroTimer=null,caroIdx=0,caroCards=[];
function caroPool(){
  const owned=Object.keys(save.owned).map(Number);
  return owned.length?owned:[1,2,3];
}
function startCarousel(){
  stopCarousel();
  caroCards=caroPool();caroIdx=0;
  renderCarousel();
  caroTimer=setInterval(()=>{caroIdx=(caroIdx+1)%caroCards.length;renderCarousel();},2600);
}
function stopCarousel(){if(caroTimer){clearInterval(caroTimer);caroTimer=null;}}
function renderCarousel(){
  const box=$('carousel');box.innerHTML='';
  const L=caroCards.length;
  const idxs=[(caroIdx-1+L)%L,caroIdx,(caroIdx+1)%L];
  const pos=['pos-l','pos-c','pos-r'];
  idxs.forEach((ci,k)=>{
    const n=caroCards[ci];
    const d=document.createElement('div');
    d.className='caro-card '+pos[k];
    d.innerHTML=`<div class="sprite" style="${frontSprite(n)}"></div>`;
    box.appendChild(d);
  });
  $('caroName').textContent=byN(caroCards[caroIdx]).name;
}

/* ============ JOKEN-DEX ============ */
let dexFilter='todos',dexSel=null;
function renderDex(){
  $('dexCount').textContent=`${ownedCount()}/60`;
  const fBox=$('dexFilters');fBox.innerHTML='';
  const mk=(key,label,thumb)=>{
    const b=document.createElement('button');
    b.className='fchip'+(dexFilter===key?' on':'');
    b.innerHTML=(thumb?`<span class="thumb"><span class="sprite" style="${backSprite(key)}"></span></span>`:'⭐ ')+label;
    b.addEventListener('click',()=>{sfx.click();dexFilter=key;dexSel=null;renderDex();});
    fBox.appendChild(b);
  };
  mk('todos','TODOS',false);
  Object.keys(ELEMS).forEach(k=>mk(k,ELEMS[k].label,true));

  const grid=$('dexGrid');grid.innerHTML='';
  COLLECTION.filter(c=>dexFilter==='todos'||c.el.includes(dexFilter)).forEach(c=>{
    const cell=document.createElement('div');
    const owned=!!save.owned[c.n];
    cell.className='dexcell'+(owned?'':' miss')+(dexSel===c.n?' sel':'')+(save.holo[c.n]?' holo-on':'');
    cell.innerHTML=`<div class="sprite" style="${frontSprite(c.n)}"></div>
      ${save.holo[c.n]?'<span class="holo-tag">✨</span>':''}
      ${owned&&save.owned[c.n]>1?`<span class="cnt">x${save.owned[c.n]}</span>`:''}`;
    cell.addEventListener('click',()=>{sfx.click();dexSel=c.n;renderDex();renderDetail(c);});
    grid.appendChild(cell);
  });
  if(dexSel)renderDetail(byN(dexSel));else $('dexDetail').classList.add('hidden');
}
function renderDetail(c){
  const box=$('dexDetail');box.classList.remove('hidden');
  const owned=!!save.owned[c.n];
  const r=rarity(c);
  const holoOn=!!save.holo[c.n];
  box.innerHTML=`
    <div class="dcardzone">
      <div class="cardwrap ${holoOn?'holo-fx':''}" id="dCard">
        <div class="card">
          <div class="card-face"><div class="sprite" style="${owned?frontSprite(c.n):frontSprite(c.n)+'filter:brightness(.12) saturate(0);'}"></div></div>
          <div class="card-face card-elemface"><div class="sprite" id="dBack" style="${backSprite(c.el[0])}"></div></div>
        </div>
      </div>
      <div class="flip-hint" id="dHint">toque para virar</div>
    </div>
    <div class="dstats">
      <div class="row"><span class="k">Card</span><span class="v">${String(c.n).padStart(2,'0')} · ${c.name}</span></div>
      <div class="row"><span class="k">Raridade</span><span class="v" style="color:${r.c}">${r.t}</span></div>
      <div class="row"><span class="k">Versão 1</span><span class="v cyan">${ELEMS[c.el[0]].emoji} ${ELEMS[c.el[0]].label}</span></div>
      <div class="row"><span class="k">Versão 2</span><span class="v cyan">${ELEMS[c.el[1]].emoji} ${ELEMS[c.el[1]].label}</span></div>
      <div class="row"><span class="k">Status</span><span class="v">${owned?('na coleção ×'+save.owned[c.n]):'FALTANDO'}</span></div>
      <div class="row"><span class="k">Holográfico</span><span class="v">${holoOn?'✨ aplicado':'—'}</span></div>
      ${owned&&!holoOn?`<button class="holo-btn" id="dHolo" ${save.coins<HOLO_PRICE?'disabled':''}>✨ APLICAR HOLOGRÁFICO · 🪙 ${HOLO_PRICE}</button>`:''}
    </div>`;
  let state=0;
  $('dCard').addEventListener('click',()=>{
    if(!owned){sfx.click();return;}
    const cd=box.querySelector('.card'),bk=$('dBack');
    if(state===0){state=1;cd.classList.add('flipped');sfx.flip();$('dHint').textContent='verso 1/2: '+ELEMS[c.el[0]].label;}
    else if(state===1){state=2;bk.setAttribute('style',backSprite(c.el[1]));sfx.click();$('dHint').textContent='verso 2/2: '+ELEMS[c.el[1]].label;}
    else{state=0;cd.classList.remove('flipped');sfx.flip();$('dHint').textContent='toque para virar';
      setTimeout(()=>bk.setAttribute('style',backSprite(c.el[0])),300);}
  });
  const hb=$('dHolo');
  if(hb)hb.addEventListener('click',e=>{
    e.stopPropagation();
    if(save.coins<HOLO_PRICE)return;
    save.coins-=HOLO_PRICE;save.holo[c.n]=true;storage.write();
    sfx.pack();refreshHUD();renderDex();
  });
}

/* ============ LOJA ============ */
function renderShop(){
  $('shopCoins').textContent=`🪙 ${save.coins}`;
  $('buyPack1').disabled=save.coins<PACK_PRICE;
  $('buyPack3').disabled=save.coins<COMBO_PRICE;
}
function buyPacks(qty,price){
  if(save.coins<price)return;
  sfx.coin();save.coins-=price;storage.write();refreshHUD();
  const stage=$('packStage');stage.innerHTML='';
  $('packDone').classList.add('hidden');
  $('packOverlay').classList.remove('hidden');
  let opened=0;
  const openNext=()=>{
    stage.innerHTML='';
    const pk=document.createElement('div');
    pk.className='pack-visual';pk.innerHTML=`🍿<span>TOQUE PARA ABRIR</span>`;
    stage.appendChild(pk);
    pk.addEventListener('click',()=>{
      pk.classList.add('opening');sfx.pack();
      setTimeout(()=>{
        stage.innerHTML='';
        const c=rand(COLLECTION);
        const dupe=!!save.owned[c.n];
        if(dupe){save.owned[c.n]++;save.coins+=DUPE_VALUE;sfx.coin();}
        else{save.owned[c.n]=1;sfx.win();}
        storage.write();refreshHUD();
        const rev=document.createElement('div');rev.className='pack-reveal';
        const cw=cardEl({...c,elem:c.el[0]});rev.appendChild(cw);
        const nm=document.createElement('div');nm.className='pack-name';
        nm.textContent=`${String(c.n).padStart(2,'0')} · ${c.name}`;rev.appendChild(nm);
        const d=document.createElement('div');d.className='pack-dupe';
        d.textContent=dupe?`repetida! trocada por 🪙 ${DUPE_VALUE}`:'NOVA NA COLEÇÃO! ✨';
        rev.appendChild(d);
        setTimeout(()=>{cw.querySelector('.card').classList.add('flipped');sfx.flip();},1000);
        stage.appendChild(rev);
        opened++;
        if(opened<qty){
          const next=document.createElement('button');next.className='btn';next.textContent='PRÓXIMO PACOTE';
          next.addEventListener('click',()=>{sfx.click();openNext();});
          stage.appendChild(next);
        }else $('packDone').classList.remove('hidden');
      },500);
    },{once:true});
  };
  openNext();
}
$('buyPack1').addEventListener('click',()=>buyPacks(1,PACK_PRICE));
$('buyPack3').addEventListener('click',()=>buyPacks(3,COMBO_PRICE));
$('packDone').addEventListener('click',()=>{sfx.click();$('packOverlay').classList.add('hidden');renderShop();});

/* ============ EVENTOS ============ */
function todayStr(){const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function renderEvents(){
  $('evCoins').textContent=`🪙 ${save.coins}`;
  $('wheelBtn').disabled = save.lastSpin===todayStr();
  $('wheelBtn').textContent = save.lastSpin===todayStr()?'AMANHÃ!':'GIRAR';
  const list=$('rivalList');list.innerHTML='';
  let prevBeaten=true;
  RIVALS.forEach(rv=>{
    const beaten=!!save.beaten[rv.id];
    const unlocked=prevBeaten;
    const row=document.createElement('div');
    row.className='rival-row'+(beaten?' beaten':'')+(unlocked?'':' locked');
    row.innerHTML=`
      <span class="rv-ic">${unlocked?rv.ic:'🔒'}</span>
      <span class="rv-info"><span class="rv-name">${rv.name}</span><br><span class="rv-desc">${rv.desc}${beaten?' · revanche 🪙'+Math.ceil(rv.reward/2):''}</span></span>
      <button class="rv-btn" ${unlocked?'':'disabled'}>${beaten?'REVANCHE':'DESAFIAR'}</button>`;
    if(unlocked)row.querySelector('.rv-btn').addEventListener('click',()=>{
      sfx.click();startBattle({mode:'campaign',ai:rv.ai,target:rv.target,rival:rv});
    });
    list.appendChild(row);
    prevBeaten=prevBeaten&&beaten;
  });
}
$('campReset').addEventListener('click',()=>{sfx.click();
  askConfirm('RECOMEÇAR DO ZERO?','Você vai perder cards, moedas, XP, holográficos e desafios.',()=>{
    save=newSave();storage.write();refreshHUD();renderEvents();
  });
});

/* ---- roda grátis ---- */
const WHEEL_PRIZES=[
  {t:'🪙 3',coins:3},{t:'🪙 6',coins:6},{t:'🪙 10',coins:10},{t:'🎴 CARD!',card:true},
  {t:'🪙 4',coins:4},{t:'🪙 8',coins:8},{t:'🪙 15',coins:15},{t:'🪙 5',coins:5}
];
let wheelSpinning=false, wheelRot=0;
$('wheelBtn').addEventListener('click',()=>{
  if(save.lastSpin===todayStr())return;
  sfx.click();
  $('wheelResult').textContent='toque em GIRAR!';
  $('wheelSpin').classList.remove('hidden');
  $('wheelClose').classList.add('hidden');
  $('wheelOverlay').classList.remove('hidden');
});
$('wheelSpin').addEventListener('click',()=>{
  if(wheelSpinning)return;
  wheelSpinning=true;sfx.spin();
  $('wheelSpin').classList.add('hidden');
  const slice=Math.floor(Math.random()*8);
  // ponteiro no topo: gira até o centro da fatia sorteada ficar no topo
  const targetDeg = 360*5 + (360 - (slice*45 + 22.5));
  wheelRot += targetDeg;
  $('wheel').style.transform=`rotate(${wheelRot}deg)`;
  setTimeout(()=>{
    const prize=WHEEL_PRIZES[slice];
    let msg;
    if(prize.card){
      const c=rand(COLLECTION);
      const dupe=!!save.owned[c.n];
      if(dupe){save.owned[c.n]++;save.coins+=DUPE_VALUE;msg=`🎴 ${c.name} — repetida, virou 🪙 ${DUPE_VALUE}!`;}
      else{save.owned[c.n]=1;msg=`🎴 ${c.name} NOVO NA COLEÇÃO!`;}
      sfx.win();
    }else{
      save.coins+=prize.coins;msg=`você ganhou ${prize.t}!`;sfx.coin();
    }
    save.lastSpin=todayStr();storage.write();refreshHUD();
    $('wheelResult').textContent=msg;
    $('wheelClose').classList.remove('hidden');
    spawnParticles(window.innerWidth/2,window.innerHeight/2,['✨','⭐','🪙'],12);
    wheelSpinning=false;
  },3500);
});
$('wheelClose').addEventListener('click',()=>{sfx.click();$('wheelOverlay').classList.add('hidden');renderEvents();});

/* ============ MOTOR DE BATALHA ============ */
const battle={active:false,mode:null,ai:'normal',target:7,rival:null,
  pScore:0,cScore:0,streak:0,roundCoins:0,locked:false,
  pDeck:[],cDeck:[],pHand:[],cHand:[],armedShieldIdx:null,pBuilder:null};

const hand=$('hand'),slotP=$('slotPlayer'),slotC=$('slotCpu'),
      banner=$('banner'),bannerSub=$('bannerSub'),burst=$('burst'),
      arena=$('arena'),handLabel=$('handLabel'),shout=$('shout');

function buildFullDeck(){return shuffle(COLLECTION.map(c=>({...c,elem:rand(c.el)})));}
function buildOwnedDeck(){
  const arr=[];
  Object.entries(save.owned).forEach(([n,cnt])=>{
    const c=byN(+n);for(let i=0;i<cnt;i++)arr.push({...c,elem:rand(c.el)});
  });
  return shuffle(arr);
}
function drawHand(deck,handArr,builder){
  while(handArr.length<HAND_SIZE){
    if(!deck.length)deck.push(...builder());
    handArr.push(deck.pop());
  }
  if(handArr.every(c=>SHIELDS.includes(c.elem))){
    const k=deck.findIndex(c=>!SHIELDS.includes(c.elem));
    if(k>-1){const swap=deck.splice(k,1)[0];deck.push(handArr.pop());handArr.push(swap);}
    else{
      const c=rand(COLLECTION.filter(x=>!x.el.every(e=>SHIELDS.includes(e))));
      handArr.pop();handArr.push({...c,elem:c.el.find(e=>!SHIELDS.includes(e))});
    }
  }
}
function updateHpBars(){
  const cap=battle.mode==='survival'?10:battle.target;
  $('hpMine').style.width=Math.min(100,battle.pScore/cap*100)+'%';
  $('hpTheirs').style.width=Math.min(100,battle.cScore/cap*100)+'%';
  $('pScore').textContent=battle.pScore;$('cScore').textContent=battle.cScore;
}
function startBattle(cfg){
  battle.active=true;
  Object.assign(battle,{mode:cfg.mode,ai:cfg.ai,target:cfg.target,rival:cfg.rival||null,
    pScore:0,cScore:0,streak:0,roundCoins:0,locked:false,armedShieldIdx:null});
  battle.pBuilder=cfg.mode==='campaign'?buildOwnedDeck:buildFullDeck;
  battle.pDeck=battle.pBuilder();battle.cDeck=buildFullDeck();
  battle.pHand=[];battle.cHand=[];
  drawHand(battle.pDeck,battle.pHand,battle.pBuilder);
  drawHand(battle.cDeck,battle.cHand,buildFullDeck);
  $('cpuName').textContent=battle.rival?battle.rival.name:'RIVAL';
  const names={quick:'PARTIDA RÁPIDA · PRIMEIRO A 7',survival:'SOBREVIVÊNCIA',campaign:'DESAFIO · primeiro a '+battle.target};
  $('modeTag').textContent=names[battle.mode]+' · '+({easy:'😊',normal:'😎',hard:'😈'}[battle.ai]);
  updateHpBars();$('streak').textContent='';
  slotP.innerHTML='sua carta';slotC.innerHTML='rival';
  banner.textContent='';banner.className='result-banner';bannerSub.textContent='';
  show('game');renderHand();sfx.deal();
}
function renderHand(){
  hand.innerHTML='';hand.classList.remove('locked');
  battle.armedShieldIdx=null;
  handLabel.textContent='ESCOLHA SUA CARTA';
  battle.pHand.forEach((c,i)=>{
    const el=cardEl(c,{badge:true});
    el.addEventListener('click',()=>onHandTap(i,el));
    hand.appendChild(el);
  });
}
function onHandTap(i,el){
  if(battle.locked||!battle.active)return;
  const c=battle.pHand[i];
  if(SHIELDS.includes(c.elem)){
    if(battle.armedShieldIdx===i){battle.armedShieldIdx=null;el.classList.remove('shield-armed');}
    else{
      [...hand.children].forEach(x=>x.classList.remove('shield-armed'));
      battle.armedShieldIdx=i;el.classList.add('shield-armed');sfx.arm();
    }
    handLabel.textContent=battle.armedShieldIdx!==null
      ?`🛡️ ${ELEMS[c.elem].label} preparado — jogue com uma carta de ataque!`
      :'ESCOLHA SUA CARTA';
    return;
  }
  sfx.click();playRound(i);
}
function cpuPlay(){
  const attackIdx=battle.cHand.map((c,i)=>i).filter(i=>!SHIELDS.includes(battle.cHand[i].elem));
  let pick;
  if(battle.ai==='hard'){
    const weights={agua:4,fogo:4,pedra:2,papel:2,tesoura:2,corda:1};
    const pool=[];
    attackIdx.forEach(i=>{const w=weights[battle.cHand[i].elem]||1;for(let k=0;k<w;k++)pool.push(i);});
    pick=rand(pool);
  }else pick=rand(attackIdx);
  const card=battle.cHand.splice(pick,1)[0];
  let shield=null;
  const shProb={easy:0,normal:.35,hard:.6}[battle.ai];
  const shIdx=battle.cHand.findIndex(c=>SHIELDS.includes(c.elem));
  if(shIdx>-1&&Math.random()<shProb)shield=battle.cHand.splice(shIdx,1)[0];
  return{card,shield};
}
async function playRound(cardIdx){
  battle.locked=true;hand.classList.add('locked');
  banner.textContent='';banner.className='result-banner';bannerSub.textContent='';

  const pCardData=battle.pHand.splice(cardIdx,1)[0];
  let pShield=null;
  if(battle.armedShieldIdx!==null){
    const shIdx=battle.armedShieldIdx>cardIdx?battle.armedShieldIdx-1:battle.armedShieldIdx;
    pShield=battle.pHand.splice(shIdx,1)[0];
    battle.armedShieldIdx=null;
  }
  const cpu=cpuPlay();
  const cCardData=cpu.card,cShield=cpu.shield;

  slotP.innerHTML='';slotC.innerHTML='';
  const pWrap=cardEl(pCardData);pWrap.classList.add('enter-left');slotP.appendChild(pWrap);
  const cWrap=cardEl(cCardData);cWrap.classList.add('enter-right');slotC.appendChild(cWrap);
  sfx.deal();

  await wait(700);
  shout.classList.remove('go');void shout.offsetWidth;shout.classList.add('go');
  tone(523,.1,'square',.1);tone(659,.1,'square',.1,.1);tone(784,.14,'square',.1,.2);
  await wait(500);
  pWrap.querySelector('.card').classList.add('flipped');
  cWrap.querySelector('.card').classList.add('flipped');
  sfx.flip();
  await wait(600);
  if(pShield)slotP.appendChild(shieldFloat(pShield.elem,'right'));
  if(cShield)slotC.appendChild(shieldFloat(cShield.elem,'left'));
  await wait(350);

  pWrap.classList.add('clash-l');cWrap.classList.add('clash-r');
  arena.classList.add('shake');
  burst.classList.remove('go');void burst.offsetWidth;burst.classList.add('go');
  sfx.clash();
  const r=arena.getBoundingClientRect();
  spawnParticles(r.left+r.width/2,r.top+r.height/2,
    [ELEMS[pCardData.elem].emoji,ELEMS[cCardData.elem].emoji,'✨','💥']);
  await wait(520);
  arena.classList.remove('shake');

  const pe=pCardData.elem,ce=cCardData.elem;
  const pShieldWins=pShield&&BEATS[pShield.elem].includes(ce);
  const cShieldWins=cShield&&BEATS[cShield.elem].includes(pe);
  let outcome,phrase='';
  if(pShieldWins&&cShieldWins){outcome='draw';phrase='os dois escudos anularam os ataques';}
  else if(pShieldWins){outcome='win';phrase=`${ELEMS[pShield.elem].emoji} ${ELEMS[pShield.elem].label} anula ${ELEMS[ce].label}`;}
  else if(cShieldWins){outcome='lose';phrase=`${ELEMS[cShield.elem].emoji} ${ELEMS[cShield.elem].label} anula ${ELEMS[pe].label}`;}
  else if(pe===ce){outcome='draw';phrase=`${ELEMS[pe].emoji} ${ELEMS[pe].label} contra ${ELEMS[ce].label}`;}
  else if(BEATS[pe].includes(ce)){outcome='win';phrase=`${ELEMS[pe].emoji} ${ELEMS[pe].label} vence ${ELEMS[ce].label}`;}
  else{outcome='lose';phrase=`${ELEMS[ce].emoji} ${ELEMS[ce].label} vence ${ELEMS[pe].label}`;}

  if(outcome==='win'){
    battle.pScore++;battle.streak++;
    if(battle.mode==='campaign')battle.roundCoins++;
    gainXp(5);
    banner.textContent='VOCÊ VENCEU A RODADA!';banner.classList.add('win');
    pWrap.classList.add('winner-glow');cWrap.classList.add('loser');sfx.win();
  }else if(outcome==='lose'){
    battle.cScore++;battle.streak=0;
    banner.textContent='O RIVAL VENCEU A RODADA!';banner.classList.add('lose');
    cWrap.classList.add('winner-glow');pWrap.classList.add('loser');sfx.lose();
  }else{
    battle.streak=0;
    banner.textContent='EMPATE!';banner.classList.add('draw');sfx.draw();
  }
  bannerSub.textContent=phrase;
  updateHpBars();
  const bits=[];
  if(battle.streak>=2)bits.push(`🔥 sequência de ${battle.streak}`);
  if(battle.mode==='campaign'&&battle.roundCoins>0)bits.push(`🪙 +${battle.roundCoins}`);
  if(battle.mode==='survival')bits.push(`recorde: ${save.bestStreak}`);
  $('streak').textContent=bits.join(' · ');

  await wait(1700);
  if(!battle.active)return;

  if(battle.mode==='survival'){
    if(outcome==='lose'){endBattle(false);return;}
  }else if(battle.pScore>=battle.target||battle.cScore>=battle.target){
    endBattle(battle.pScore>=battle.target);return;
  }
  drawHand(battle.pDeck,battle.pHand,battle.pBuilder);
  drawHand(battle.cDeck,battle.cHand,buildFullDeck);
  slotP.innerHTML='sua carta';slotC.innerHTML='rival';
  banner.textContent='';banner.className='result-banner';bannerSub.textContent='';
  renderHand();battle.locked=false;
}

let lastCfg=null;
function endBattle(won){
  battle.active=false;
  const m=battle.mode;
  lastCfg={mode:m,ai:battle.ai,target:m==='survival'?Infinity:battle.target,rival:battle.rival};
  let title,text,emoji;
  if(m==='survival'){
    const s=battle.pScore;
    const isRecord=s>save.bestStreak;
    if(isRecord){save.bestStreak=s;storage.write();}
    emoji=isRecord?'🏆':'💪';
    title=isRecord?'NOVO RECORDE!':'FIM DE JOGO!';
    text=`Você venceu ${s} rodada${s===1?'':'s'} antes de cair. ${isRecord?'Recorde novo!':'Recorde: '+save.bestStreak+'.'}`;
    if(isRecord){confettiRain();sfx.fanfare();}else sfx.gameover();
  }else if(m==='campaign'){
    const rv=battle.rival;
    if(won){
      const first=!save.beaten[rv.id];
      const base=first?rv.reward:Math.ceil(rv.reward/2);
      const total=base+battle.roundCoins;
      save.beaten[rv.id]=true;save.coins+=total;storage.write();
      gainXp(20);
      emoji='🏆';title=`VOCÊ VENCEU ${rv.name}!`;
      text=`Placar ${battle.pScore} × ${battle.cScore}. Recompensa: 🪙 ${total}. ${first?'Novo desafio desbloqueado!':''} +20 XP!`;
      confettiRain();sfx.fanfare();
    }else{
      const consol=3+battle.roundCoins;
      save.coins+=consol;storage.write();
      emoji='😵';title=`${rv.name} VENCEU...`;
      text=`Placar ${battle.pScore} × ${battle.cScore}. Consolação: 🪙 ${consol}. Passa na loja e volta mais forte!`;
      sfx.gameover();
    }
  }else{
    emoji=won?'🏆':'😵';
    title=won?'VOCÊ LEVOU A PARTIDA!':'O RIVAL VENCEU...';
    text=`Placar final ${battle.pScore} × ${battle.cScore}.${won?' +20 XP!':''}`;
    if(won){gainXp(20);confettiRain();sfx.fanfare();}else sfx.gameover();
  }
  refreshHUD();
  $('goEmoji').textContent=emoji;$('goTitle').textContent=title;$('goText').textContent=text;
  $('goMain').textContent=m==='campaign'?'VOLTAR AOS EVENTOS':'MENU';
  $('endOverlay').classList.remove('hidden');
}
$('goMain').addEventListener('click',()=>{sfx.click();
  $('endOverlay').classList.add('hidden');
  show(lastCfg&&lastCfg.mode==='campaign'?'events':'menu');
});
$('goAgain').addEventListener('click',()=>{sfx.click();
  $('endOverlay').classList.add('hidden');
  if(lastCfg)startBattle(lastCfg);
});

/* atalho: segurar o título abre a tabela de elementos */
document.querySelector('.app-title').addEventListener('click',()=>{$('rulesOverlay').classList.remove('hidden');sfx.click();});

/* ============ início ============ */
refreshHUD();
show('menu');

