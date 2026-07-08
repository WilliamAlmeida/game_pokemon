/* =====================================================================
   index.js — lógica do jogo Jo-Kén-Pokémon "Jornada Johto".
   Depende de shared/util.js e shared/cards.js (carregados antes).
   Dados dos cards, elementos e sprites vivem em shared/cards.js.
===================================================================== */
const PACK_PRICE=10, COMBO_PRICE=26, DUPE_VALUE=4;
const RIVALS=[
 {id:'r1',ic:'👶',name:'IRMÃO CAÇULA',ai:'easy',target:3,reward:15,desc:'fácil · 3 pontos · 🪙15'},
 {id:'r2',ic:'🚲',name:'VIZINHO DA RUA',ai:'easy',target:5,reward:20,desc:'fácil · 5 pontos · 🪙20'},
 {id:'r3',ic:'🎀',name:'MENINA DA BANCA',ai:'normal',target:5,reward:25,desc:'normal · 5 pontos · 🪙25'},
 {id:'r4',ic:'🎒',name:'ZÉ DO RECREIO',ai:'normal',target:7,reward:30,desc:'normal · 7 pontos · 🪙30'},
 {id:'r5',ic:'🥤',name:'TIO DA CANTINA',ai:'normal',target:7,reward:35,desc:'normal · 7 pontos · 🪙35'},
 {id:'r6',ic:'🏅',name:'CAMPEÃO DA ESCOLA',ai:'hard',target:7,reward:45,desc:'difícil · 7 pontos · 🪙45'},
 {id:'r7',ic:'🕶️',name:'COLECIONADOR MISTERIOSO',ai:'hard',target:9,reward:55,desc:'difícil · 9 pontos · 🪙55'},
 {id:'r8',ic:'👑',name:'MESTRE DO JOKENPÔ',ai:'hard',target:10,reward:70,desc:'difícil · 10 pontos · 🪙70'}
];

/* ================== SAVE (com fallback em memória) ================== */
let save=null;
const storage={
  read(){try{const r=localStorage.getItem('jkp_save_v1');return r?JSON.parse(r):null;}catch(e){return null;}},
  write(){try{localStorage.setItem('jkp_save_v1',JSON.stringify(save));}catch(e){}}
};
function newSave(){
  const owned={};
  const pool=COLLECTION.map(c=>c.n);
  for(let i=0;i<15;i++){ // coleção inicial: 15 cards distintos sorteados
    const k=Math.floor(Math.random()*pool.length);
    owned[pool.splice(k,1)[0]]=1;
  }
  return {coins:20, owned, beaten:{}, bestStreak:0, sound:true, xp:0};
}
function loadSave(){ save=storage.read()||newSave(); if(typeof save.xp!=='number')save.xp=0; storage.write(); }
loadSave();
const ownedCount=()=>Object.keys(save.owned).length;

/* ================== NÍVEL / XP ================== */
const level=()=>1+Math.floor(save.xp/100);
function gainXp(n){
  const before=level();save.xp+=n;storage.write();
  if(level()>before){sfx.fanfare();toastLevel();}
  refreshMenu();
}
function toastLevel(){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;left:50%;top:70px;transform:translateX(-50%);z-index:200;font-family:Bungee;font-size:.9rem;color:#7dffa1;text-shadow:0 0 12px rgba(125,255,161,.8);animation:pop .5s ease;';
  t.textContent=`⬆ NÍVEL ${level()}!`;
  document.body.appendChild(t);setTimeout(()=>t.remove(),1800);
}
const ownedTotal=()=>Object.values(save.owned).reduce((a,b)=>a+b,0);

/* ================== SOM — sintetizado (Web Audio) ================== */
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
  g.gain.setValueAtTime(vol,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+d);
  o.connect(g).connect(ctx.destination);
  o.start(t);o.stop(t+d+0.03);
}
function noiseHit(d=0.28,vol=0.28,delay=0){
  if(!save.sound)return;const ctx=ac();if(!ctx)return;
  const t=ctx.currentTime+delay;
  const buf=ctx.createBuffer(1,ctx.sampleRate*d,ctx.sampleRate);
  const data=buf.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
  const src=ctx.createBufferSource();src.buffer=buf;
  const g=ctx.createGain();g.gain.setValueAtTime(vol,t);
  g.gain.exponentialRampToValueAtTime(0.001,t+d);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1200;
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start(t);
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
  gameover(){[330,294,262,220].forEach((f,i)=>tone(f,.2,'sawtooth',.1,i*.16));}
};

/* ================== helpers ================== */
function cardEl(c,{badge=false}={}){
  const wrap=document.createElement('div');
  wrap.className='cardwrap';
  wrap.innerHTML=`
    <div class="card">
      <div class="card-face">
        <div class="sprite" style="${frontSprite(c.n)}"></div>
        ${badge?`<div class="elem-ribbon">${ELEMS[c.elem].emoji} ${ELEMS[c.elem].label}</div>`:''}
      </div>
      <div class="card-face card-elemface">
        <div class="sprite" style="${backSprite(c.elem)}"></div>
      </div>
    </div>`;
  return wrap;
}
function shieldFloat(elem,side){
  const s=document.createElement('span');
  s.className='shield-float';
  if(side==='left'){s.style.right='auto';s.style.left='-14px';}
  s.innerHTML=`<span class="sprite" style="${backSprite(elem)}"></span>`;
  return s;
}
function spawnParticles(x,y,emojis,count=12){
  for(let i=0;i<count;i++){
    const p=document.createElement('span');p.className='particle';
    p.textContent=rand(emojis);
    p.style.left=x+'px';p.style.top=y+'px';
    p.style.setProperty('--dx',(Math.random()*220-110)+'px');
    p.style.setProperty('--dy',(Math.random()*220-110)+'px');
    p.style.setProperty('--rot',(Math.random()*360)+'deg');
    document.body.appendChild(p);setTimeout(()=>p.remove(),950);
  }
}
function confettiRain(){
  const colors=['#ffe14d','#ff5ec8','#39d0ff','#7dffa1','#ffb84d'];
  for(let i=0;i<70;i++){
    const c=document.createElement('div');c.className='confetti';
    c.style.left=Math.random()*100+'vw';c.style.background=colors[i%colors.length];
    c.style.animationDuration=(1.6+Math.random()*1.6)+'s';
    c.style.animationDelay=(Math.random()*.6)+'s';
    document.body.appendChild(c);setTimeout(()=>c.remove(),3600);
  }
}

/* ================== fundo & tabela ================== */
(function stars(){
  const box=$('stars'),g=['✦','✧','⋆','✩'];
  for(let i=0;i<26;i++){
    const s=document.createElement('span');
    s.textContent=g[i%g.length];
    s.style.left=Math.random()*100+'vw';s.style.top=Math.random()*100+'vh';
    s.style.color=['#ff5ec8','#39d0ff','#ffe14d'][i%3];
    s.style.animationDelay=(Math.random()*4)+'s';
    box.appendChild(s);
  }
})();
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

/* ================== NAVEGAÇÃO ================== */
const SCREENS=['menu','game','album','campaign'];
function show(name){
  SCREENS.forEach(s=>$('screen-'+s).classList.toggle('hidden',s!==name));
  $('homeBtn').classList.toggle('hidden',name==='menu');
  $('gameTitle').classList.toggle('hidden',name==='game');
  $('gameSubtitle').classList.toggle('hidden',name==='game');
  if(name==='menu'){refreshMenu();startCarousel();} else stopCarousel();
  if(name==='album')renderAlbum();
  if(name==='campaign')renderCampaign();
}
function refreshMenu(){
  $('xpFill').style.width=(save.xp%100)+'%';
  $('levelLabel').textContent=`Nível ${level()} · ${save.xp%100}/100 XP · recorde 🔥 ${save.bestStreak}`;
  $('wCoins').textContent=`🪙 ${save.coins}`;
  $('wCards').textContent=`🎴 ${ownedCount()}/60`;
}

/* ================== CARROSSEL (menu) ================== */
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
  const box=$('carousel');if(!box)return;box.innerHTML='';
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
$('homeBtn').addEventListener('click',()=>{sfx.click();
  if(battle.active){askConfirm('SAIR DA PARTIDA?','A partida atual será perdida (sem recompensa).',()=>{
    if(battle.mode==='multiplayer')mpLeave();
    battle.active=false;show('menu');
  });}
  else show('menu');
});
$('soundBtn').addEventListener('click',()=>{
  save.sound=!save.sound;storage.write();
  $('soundBtn').textContent=save.sound?'🔊':'🔇';
  sfx.click();
});
$('soundBtn').textContent=save.sound?'🔊':'🔇';

document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{
  sfx.click();
  const nav=b.dataset.nav;
  if(nav==='rules'){$('rulesOverlay').classList.remove('hidden');return;}
  if(nav==='quick'){openDiff('PARTIDA RÁPIDA','Baralho completo dos 60 cards. Primeiro a 7 pontos!','quick');return;}
  if(nav==='survival'){openDiff('SOBREVIVÊNCIA','Vença o máximo de rodadas seguidas. Uma derrota e acabou! Empate não elimina.','survival');return;}
  if(nav==='multiplayer'){
    if(typeof mpOpenLobby==='function') mpOpenLobby();
    else askConfirm('MULTIPLAYER INDISPONÍVEL','Este é o pacote standalone (sem servidor). Rode node server.js a partir dos arquivos-fonte do projeto para jogar em multiplayer.', ()=>{});
    return;
  }
  show(nav);
}));
$('rulesClose').addEventListener('click',()=>{sfx.click();$('rulesOverlay').classList.add('hidden');});

/* confirmação genérica */
let confirmCb=null;
function askConfirm(title,text,cb){
  $('confirmTitle').textContent=title;$('confirmText').textContent=text;
  confirmCb=cb;$('confirmOverlay').classList.remove('hidden');
}
$('confirmYes').addEventListener('click',()=>{sfx.click();$('confirmOverlay').classList.add('hidden');if(confirmCb)confirmCb();confirmCb=null;});
$('confirmNo').addEventListener('click',()=>{sfx.click();$('confirmOverlay').classList.add('hidden');confirmCb=null;});

/* seletor de dificuldade */
let pendingMode=null;
function openDiff(title,desc,mode){
  $('diffTitle').textContent=title;$('diffDesc').textContent=desc;
  pendingMode=mode;$('diffOverlay').classList.remove('hidden');
}
document.querySelectorAll('.diff-btn').forEach(b=>b.addEventListener('click',()=>{
  sfx.click();$('diffOverlay').classList.add('hidden');
  startBattle({mode:pendingMode,ai:b.dataset.diff,target:pendingMode==='survival'?Infinity:7});
}));
$('diffCancel').addEventListener('click',()=>{sfx.click();$('diffOverlay').classList.add('hidden');});

/* ================== ÁLBUM ================== */
function renderAlbum(){
  $('albumProgress').textContent=`📗 SUA COLEÇÃO: ${ownedCount()}/60 cards`;
  const grid=$('albumGrid');grid.innerHTML='';
  COLLECTION.forEach(c=>{
    const cell=document.createElement('div');
    cell.className='album-cell'+(save.owned[c.n]?'':' miss');
    const view={state:0}; // 0=pokémon, 1=verso elemento A, 2=verso elemento B
    const wrap=document.createElement('div');wrap.className='cardwrap';
    wrap.innerHTML=`
      <div class="card">
        <div class="card-face"><div class="sprite" style="${frontSprite(c.n)}"></div></div>
        <div class="card-face card-elemface"><div class="sprite" style="${backSprite(c.el[0])}"></div></div>
      </div>
      ${save.owned[c.n]
        ? (save.owned[c.n]>1?`<span class="own-badge">x${save.owned[c.n]}</span>`:'')
        : `<span class="miss-badge">FALTA</span>`}`;
    const cap=document.createElement('div');cap.className='cap';
    const capText=()=>view.state===0
      ? `${String(c.n).padStart(2,'0')} · ${c.name}`
      : `verso ${view.state}/2: ${ELEMS[c.el[view.state-1]].label}`;
    cap.textContent=capText();
    wrap.addEventListener('click',()=>{
      const cardDiv=wrap.querySelector('.card');
      const backFace=wrap.querySelector('.card-elemface .sprite');
      if(view.state===0){view.state=1;cardDiv.classList.add('flipped');sfx.flip();}
      else if(view.state===1){view.state=2;backFace.setAttribute('style',backSprite(c.el[1]));sfx.click();}
      else{view.state=0;cardDiv.classList.remove('flipped');sfx.flip();
        setTimeout(()=>backFace.setAttribute('style',backSprite(c.el[0])),300);}
      cap.textContent=capText();
    });
    cell.appendChild(wrap);cell.appendChild(cap);
    grid.appendChild(cell);
  });
}

/* ================== CAMPANHA ================== */
function renderCampaign(){
  $('campCoins').textContent=`🪙 ${save.coins}`;
  $('campProgress').textContent=`📗 ${ownedCount()}/60 cards`;
  $('buyPack1').disabled=save.coins<PACK_PRICE;
  $('buyPack3').disabled=save.coins<COMBO_PRICE;
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
    if(unlocked){
      row.querySelector('.rv-btn').addEventListener('click',()=>{
        sfx.click();
        startBattle({mode:'campaign',ai:rv.ai,target:rv.target,rival:rv});
      });
    }
    list.appendChild(row);
    prevBeaten=prevBeaten&&beaten;
  });
}
$('campReset').addEventListener('click',()=>{sfx.click();
  askConfirm('RECOMEÇAR CAMPANHA?','Você vai perder todos os cards, moedas e desafios vencidos.',()=>{
    save=newSave();storage.write();renderCampaign();
  });
});

/* ---- pacotes ---- */
function buyPacks(qty,price){
  if(save.coins<price)return;
  sfx.coin();
  save.coins-=price;storage.write();
  const stage=$('packStage');stage.innerHTML='';
  $('packDone').classList.add('hidden');
  $('packOverlay').classList.remove('hidden');
  let opened=0;
  const openNext=()=>{
    stage.innerHTML='';
    const pk=document.createElement('div');
    pk.className='pack-visual';
    pk.innerHTML=`🍿<span>TOQUE PARA ABRIR</span>`;
    stage.appendChild(pk);
    pk.addEventListener('click',()=>{
      pk.classList.add('opening');sfx.pack();
      setTimeout(()=>{
        stage.innerHTML='';
        const c=rand(COLLECTION);
        const dupe=!!save.owned[c.n];
        if(dupe){save.owned[c.n]++;save.coins+=DUPE_VALUE;sfx.coin();}
        else{save.owned[c.n]=1;sfx.win();}
        storage.write();
        const rev=document.createElement('div');rev.className='pack-reveal';
        const cw=cardEl({...c,elem:c.el[0]});cw.classList.add('holo');
        rev.appendChild(cw);
        const nm=document.createElement('div');nm.className='pack-name';
        nm.textContent=`${String(c.n).padStart(2,'0')} · ${c.name}`;
        rev.appendChild(nm);
        if(dupe){
          const d=document.createElement('div');d.className='pack-dupe';
          d.textContent=`repetida! trocada na banca por 🪙 ${DUPE_VALUE}`;
          rev.appendChild(d);
        }else{
          const d=document.createElement('div');d.className='pack-dupe';
          d.textContent='NOVA NA COLEÇÃO! ✨';rev.appendChild(d);
        }
        // vira pra mostrar o elemento depois de 1s
        setTimeout(()=>{cw.querySelector('.card').classList.add('flipped');sfx.flip();},1000);
        stage.appendChild(rev);
        opened++;
        const r=stage.getBoundingClientRect();
        spawnParticles(r.left+r.width/2,r.top+80,['✨','⭐','🎴'],10);
        if(opened<qty){
          const next=document.createElement('button');next.className='btn';next.textContent='PRÓXIMO PACOTE';
          next.addEventListener('click',()=>{sfx.click();openNext();});
          stage.appendChild(next);
        }else{
          $('packDone').classList.remove('hidden');
        }
      },500);
    },{once:true});
  };
  openNext();
}
$('buyPack1').addEventListener('click',()=>buyPacks(1,PACK_PRICE));
$('buyPack3').addEventListener('click',()=>buyPacks(3,COMBO_PRICE));
$('packDone').addEventListener('click',()=>{sfx.click();$('packOverlay').classList.add('hidden');renderCampaign();});

/* ================== MOTOR DE BATALHA ================== */
const battle={active:false,mode:null,ai:'normal',target:7,rival:null,
              pScore:0,cScore:0,streak:0,roundCoins:0,locked:false,
              pDeck:[],cDeck:[],pHand:[],cHand:[],armedShieldIdx:null};

const hand=$('hand'),slotP=$('slotPlayer'),slotC=$('slotCpu'),
      banner=$('banner'),bannerSub=$('bannerSub'),burst=$('burst'),
      arena=$('arena'),handLabel=$('handLabel'),shout=$('shout');

function buildFullDeck(){
  return shuffle(COLLECTION.map(c=>({...c,elem:rand(c.el)})));
}
function buildOwnedDeck(){
  const arr=[];
  Object.entries(save.owned).forEach(([n,cnt])=>{
    const c=byN(+n);
    for(let i=0;i<cnt;i++)arr.push({...c,elem:rand(c.el)});
  });
  return shuffle(arr);
}
function draw(deck,handArr,builder){
  while(handArr.length<HAND_SIZE){
    if(!deck.length)deck.push(...builder());
    handArr.push(deck.pop());
  }
  if(handArr.every(c=>SHIELDS.includes(c.elem))){
    const k=deck.findIndex(c=>!SHIELDS.includes(c.elem));
    if(k>-1){const swap=deck.splice(k,1)[0];deck.push(handArr.pop());handArr.push(swap);}
    else{ // coleção só de escudos? completa com um card do baralho cheio
      const c=rand(COLLECTION.filter(x=>!x.el.every(e=>SHIELDS.includes(e))));
      handArr.pop();handArr.push({...c,elem:c.el.find(e=>!SHIELDS.includes(e))});
    }
  }
}
function startBattle(cfg){
  battle.active=true;
  battle.mode=cfg.mode;battle.ai=cfg.ai;battle.target=cfg.target;battle.rival=cfg.rival||null;
  battle.pScore=0;battle.cScore=0;battle.streak=0;battle.roundCoins=0;battle.locked=false;
  battle.pBuilder = cfg.mode==='campaign' ? buildOwnedDeck : buildFullDeck;
  battle.pDeck=battle.pBuilder();battle.cDeck=buildFullDeck();
  battle.pHand=[];battle.cHand=[];
  draw(battle.pDeck,battle.pHand,battle.pBuilder);
  draw(battle.cDeck,battle.cHand,buildFullDeck);
  $('pScore').textContent='0';$('cScore').textContent='0';$('streak').textContent='';
  $('cpuName').textContent=battle.rival?battle.rival.name.split(' ')[0]:'RIVAL';
  const modeNames={quick:'PARTIDA RÁPIDA · PRIMEIRO A 7',survival:'SOBREVIVÊNCIA · NÃO PERCA!',campaign:'CAMPANHA · '+(battle.rival?battle.rival.name+' · primeiro a '+battle.target:'')};
  $('modeTag').textContent=modeNames[battle.mode]+' · '+({easy:'😊',normal:'😎',hard:'😈'}[battle.ai]);
  slotP.innerHTML='sua carta<br>aqui';slotC.innerHTML='carta do<br>rival';
  banner.textContent='';banner.className='result-banner';bannerSub.textContent='';
  show('game');
  renderHand();
  sfx.deal();
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
    handLabel.textContent = battle.armedShieldIdx!==null
      ? `🛡️ ${ELEMS[c.elem].label} preparado — jogue junto com uma carta de ataque!`
      : 'ESCOLHA SUA CARTA';
    return;
  }
  sfx.click();
  if(battle.mode==='multiplayer'){ mpPlayCard(i); }
  else{ playRound(i); }
}

/* IA do rival */
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
  return {card,shield};
}

/* metade de baixo — reveal/animação/aplicação de outcome, idêntica para
   single-player (CPU) e multiplayer (servidor); recebe as cartas e o
   resultado já decidido, não decide "quem é o oponente". */
async function resolveAndAnimateRound({pCardData,pShield,cCardData,cShield,outcome,phrase}){
  banner.textContent='';banner.className='result-banner';bannerSub.textContent='';
  slotP.innerHTML='';slotC.innerHTML='';
  const pWrap=cardEl(pCardData);pWrap.classList.add('in-slot','enter-left','holo');
  slotP.appendChild(pWrap);
  const cWrap=cardEl(cCardData);cWrap.classList.add('in-slot','enter-right','holo');
  slotC.appendChild(cWrap);
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

  if(outcome==='win'){
    battle.pScore++;battle.streak++;gainXp(5);
    if(battle.mode==='campaign'){battle.roundCoins++;}
    banner.textContent='VOCÊ VENCEU A RODADA!';banner.classList.add('win');
    pWrap.classList.add('winner-glow');cWrap.classList.add('loser');
    bump('pScore',battle.pScore);sfx.win();
  }else if(outcome==='lose'){
    battle.cScore++;battle.streak=0;
    banner.textContent=`${battle.oppLabel||'O RIVAL'} VENCEU A RODADA!`;banner.classList.add('lose');
    cWrap.classList.add('winner-glow');pWrap.classList.add('loser');
    bump('cScore',battle.cScore);sfx.lose();
  }else{
    battle.streak=0;
    banner.textContent='EMPATE!';banner.classList.add('draw');sfx.draw();
  }
  bannerSub.textContent=phrase;
  const streakBits=[];
  if(battle.streak>=2)streakBits.push(`🔥 sequência de ${battle.streak}`);
  if(battle.mode==='campaign'&&battle.roundCoins>0)streakBits.push(`🪙 +${battle.roundCoins} nesta partida`);
  if(battle.mode==='survival')streakBits.push(`recorde: ${save.bestStreak}`);
  $('streak').textContent=streakBits.join(' · ');

  await wait(1700);
}

/* metade de cima — single-player: decide o que a CPU joga, resolve o
   outcome via shared/cards.js e delega a animação/aplicação. */
async function playRound(cardIdx){
  battle.locked=true;hand.classList.add('locked');
  const pCardData=battle.pHand.splice(cardIdx,1)[0];
  let pShield=null;
  if(battle.armedShieldIdx!==null){
    const shIdx=battle.armedShieldIdx>cardIdx?battle.armedShieldIdx-1:battle.armedShieldIdx;
    pShield=battle.pHand.splice(shIdx,1)[0];
    battle.armedShieldIdx=null;
  }
  const cpu=cpuPlay();
  const cCardData=cpu.card, cShield=cpu.shield;
  const {outcome,phrase}=resolveRoundOutcome(
    pCardData.elem, cCardData.elem, pShield?pShield.elem:null, cShield?cShield.elem:null);

  await resolveAndAnimateRound({pCardData,pShield,cCardData,cShield,outcome,phrase});
  if(!battle.active)return; // saiu no meio

  /* fim de partida? */
  if(battle.mode==='survival'){
    if(outcome==='lose'){endBattle(false);return;}
  }else if(battle.pScore>=battle.target||battle.cScore>=battle.target){
    endBattle(battle.pScore>=battle.target);return;
  }

  draw(battle.pDeck,battle.pHand,battle.pBuilder);
  draw(battle.cDeck,battle.cHand,buildFullDeck);
  slotP.innerHTML='sua carta<br>aqui';slotC.innerHTML='carta do<br>rival';
  banner.textContent='';banner.className='result-banner';bannerSub.textContent='';
  renderHand();
  battle.locked=false;
}
function bump(id,val){
  const el=$(id);el.textContent=val;
  el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');
}

/* ---- fim de partida por modo ---- */
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
      save.beaten[rv.id]=true;save.coins+=total;storage.write();gainXp(20);
      emoji='🏆';title=`VOCÊ VENCEU ${rv.name}!`;
      text=`Placar ${battle.pScore} × ${battle.cScore}. Recompensa: 🪙 ${base}${battle.roundCoins?` + 🪙 ${battle.roundCoins} das rodadas`:''} = 🪙 ${total}. ${first?'Novo desafio desbloqueado!':''} Corre pra banca comprar pacotes!`;
      confettiRain();sfx.fanfare();
    }else{
      const consol=3+battle.roundCoins;
      save.coins+=consol;storage.write();
      emoji='😵';title=`${rv.name} VENCEU...`;
      text=`Placar ${battle.pScore} × ${battle.cScore}. Consolação: 🪙 ${consol}. Compre uns pacotes e volte mais forte!`;
      sfx.gameover();
    }
  }else{ // quick
    emoji=won?'🏆':'😵';
    title=won?'VOCÊ LEVOU A PARTIDA!':'O RIVAL VENCEU...';
    text=`Placar final ${battle.pScore} × ${battle.cScore}.`;
    if(won){gainXp(20);confettiRain();sfx.fanfare();}else sfx.gameover();
  }
  $('goEmoji').textContent=emoji;$('goTitle').textContent=title;$('goText').textContent=text;
  $('goMain').textContent=m==='campaign'?'IR PARA A BANCA':'MENU';
  $('endOverlay').classList.remove('hidden');
}
$('goMain').addEventListener('click',()=>{sfx.click();
  $('endOverlay').classList.add('hidden');
  if(battle.mode==='multiplayer'){show('menu');return;}
  show(lastCfg&&lastCfg.mode==='campaign'?'campaign':'menu');
});
$('goAgain').addEventListener('click',()=>{sfx.click();
  $('endOverlay').classList.add('hidden');
  if(battle.mode==='multiplayer'){mpOpenLobby();return;}
  if(lastCfg)startBattle(lastCfg);
});

/* ================== início ================== */
show('menu');

