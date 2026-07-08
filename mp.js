/* =====================================================================
   mp.js — cliente de multiplayer local (LAN). Carregado depois de
   index.js (mesmo escopo global) — usa cardEl/sfx/$/bump/battle/
   resolveAndAnimateRound/renderHand/show/gainXp/confettiRain/askConfirm
   definidos lá.

   Sincroniza com server.js via polling HTTP (~700ms) sob /mp/*.
===================================================================== */
let mpState = { code:null, playerId:null, pollTimer:null, matchStarted:false, lastResultSeq:0 };

function mpOpenLobby(){
  mpStopPolling();
  mpState = { code:null, playerId:null, pollTimer:null, matchStarted:false, lastResultSeq:0 };
  $('mpChoice').classList.remove('hidden');
  $('mpCreatePanel').classList.add('hidden');
  $('mpJoinPanel').classList.add('hidden');
  $('mpErrorPanel').classList.add('hidden');
  $('mpJoinError').textContent='';
  $('mpOverlay').classList.remove('hidden');
}
function mpShowCreatePanel(){
  $('mpChoice').classList.add('hidden');
  $('mpJoinPanel').classList.add('hidden');
  $('mpErrorPanel').classList.add('hidden');
  $('mpCreatePanel').classList.remove('hidden');
}
function mpShowJoinPanel(){
  $('mpChoice').classList.add('hidden');
  $('mpCreatePanel').classList.add('hidden');
  $('mpErrorPanel').classList.add('hidden');
  $('mpJoinError').textContent='';
  $('mpJoinPanel').classList.remove('hidden');
}
function mpShowError(){
  $('mpChoice').classList.add('hidden');
  $('mpCreatePanel').classList.add('hidden');
  $('mpJoinPanel').classList.add('hidden');
  $('mpErrorPanel').classList.remove('hidden');
}

async function mpCreateRoom(){
  mpShowCreatePanel();
  $('mpAddress').textContent='...';$('mpCode').textContent='----';
  $('mpCreateStatus').textContent='Criando sala...';
  try{
    const name=$('mpNameInput').value;
    const r=await fetch('/mp/create',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name})});
    const data=await r.json();
    if(!data.ok){ mpShowError(); return; }
    mpState.code=data.code; mpState.playerId=data.playerId;
    $('mpAddress').textContent=`http://${data.ip}:${data.port}`;
    $('mpCode').textContent=data.code;
    $('mpCreateStatus').textContent='Aguardando o segundo jogador...';
    mpPoll();
  }catch(e){
    mpShowError();
  }
}

async function mpJoinRoom(){
  const code=$('mpCodeInput').value.trim().toUpperCase();
  if(code.length!==4){ $('mpJoinError').textContent='Digite os 4 caracteres do código.'; return; }
  $('mpJoinError').textContent='Entrando...';
  try{
    const name=$('mpNameInput').value;
    const r=await fetch('/mp/join',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code,name})});
    const data=await r.json();
    if(!data.ok){
      $('mpJoinError').textContent = data.error==='room_not_found'
        ? 'Código não encontrado. Confira e tente de novo.'
        : data.error==='room_full'
        ? 'Essa sala já começou ou está cheia.'
        : 'Não foi possível entrar. Tente de novo.';
      return;
    }
    mpState.code=code; mpState.playerId=data.playerId;
    $('mpOverlay').classList.add('hidden');
    await mpEnterMatch(data);
    mpPoll();
  }catch(e){
    mpShowError();
  }
}

async function mpPoll(){
  if(!mpState.code)return;
  try{
    const r=await fetch(`/mp/state?code=${mpState.code}&playerId=${mpState.playerId}`);
    const data=await r.json();
    if(!data.ok){ mpFatal(data.error); return; }
    await mpHandleState(data);
  }catch(e){ /* soneca curta de rede, tenta de novo no próximo agendamento */ }
  if(mpState.code) mpState.pollTimer=setTimeout(mpPoll,700);
}

async function mpHandleState(data){
  if(data.state==='waiting'){
    return; // host aguardando, nada a fazer (texto já fixo)
  }
  if(data.state==='active'){
    if(!mpState.matchStarted){ await mpEnterMatch(data); }
    if(data.result && data.result.resultSeq>mpState.lastResultSeq){
      mpState.lastResultSeq=data.result.resultSeq;
      await resolveAndAnimateRound({
        pCardData:data.result.yourCard, pShield:data.result.yourShield,
        cCardData:data.result.oppCard,  cShield:data.result.oppShield,
        outcome:data.result.outcome,    phrase:data.result.phrase
      });
      if(!battle.active)return;
      battle.pHand=data.you.hand;
      slotP.innerHTML='sua carta<br>aqui';slotC.innerHTML='carta do oponente';
      banner.textContent='';banner.className='result-banner';bannerSub.textContent='';
      renderHand();
      battle.locked=false;
    }
    return;
  }
  if(data.state==='finished'){
    if(data.result && data.result.resultSeq>mpState.lastResultSeq){
      mpState.lastResultSeq=data.result.resultSeq;
      await resolveAndAnimateRound({
        pCardData:data.result.yourCard, pShield:data.result.yourShield,
        cCardData:data.result.oppCard,  cShield:data.result.oppShield,
        outcome:data.result.outcome,    phrase:data.result.phrase
      });
    }
    mpEndMatch(data);
  }
}

async function mpEnterMatch(data){
  battle.active=true; battle.mode='multiplayer'; battle.target=7;
  battle.pScore=0; battle.cScore=0; battle.streak=0; battle.locked=false;
  battle.oppLabel='O '+(data.opp.name||'JOGADOR 2').toUpperCase();
  $('cpuName').textContent=data.opp.name||'JOGADOR 2';
  $('modeTag').textContent='MULTIPLAYER LOCAL · SALA '+mpState.code;
  $('pScore').textContent='0';$('cScore').textContent='0';$('streak').textContent='';
  battle.pHand=data.you.hand;
  slotP.innerHTML='sua carta<br>aqui';slotC.innerHTML='carta do oponente';
  banner.textContent='';banner.className='result-banner';bannerSub.textContent='';
  $('mpOverlay').classList.add('hidden');
  show('game');
  renderHand();
  sfx.deal();
  mpState.matchStarted=true;
}

async function mpPlayCard(i){
  if(battle.locked||!battle.active)return;
  battle.locked=true;hand.classList.add('locked');
  handLabel.textContent='AGUARDANDO O OPONENTE...';
  const shieldIdx=battle.armedShieldIdx; // capturar ANTES de zerar
  battle.armedShieldIdx=null;
  try{
    const r=await fetch('/mp/play',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code:mpState.code,playerId:mpState.playerId,cardIdx:i,shieldIdx})});
    const data=await r.json();
    if(!data.ok){
      battle.locked=false;hand.classList.remove('locked');handLabel.textContent='ESCOLHA SUA CARTA';
    }
  }catch(e){
    battle.locked=false;hand.classList.remove('locked');handLabel.textContent='ERRO DE CONEXÃO — tente de novo';
  }
  // resultado chega pelo loop de polling (mpHandleState), não aqui
}

function mpEndMatch(data){
  battle.active=false; mpStopPolling();
  const won=data.winner==='you';
  const emoji=won?'🏆':'😵';
  const title=data.forfeit
    ? (won?'O OUTRO JOGADOR SAIU — VOCÊ VENCE!':'VOCÊ SAIU DA PARTIDA')
    : (won?'VOCÊ LEVOU A PARTIDA!':`${data.opp.name||'JOGADOR 2'} VENCEU...`);
  $('goEmoji').textContent=emoji;$('goTitle').textContent=title;
  $('goText').textContent=`Placar final ${data.you.score} × ${data.opp.score}.`;
  $('goMain').textContent='MENU';
  if(won){gainXp(20);confettiRain();sfx.fanfare();}else sfx.gameover();
  $('endOverlay').classList.remove('hidden');
}

function mpLeave(){
  if(mpState.code){
    try{ navigator.sendBeacon('/mp/leave', JSON.stringify({code:mpState.code,playerId:mpState.playerId})); }catch(e){}
  }
  mpStopPolling();
  mpState = { code:null, playerId:null, pollTimer:null, matchStarted:false, lastResultSeq:0 };
}
window.addEventListener('beforeunload', ()=>{
  if(mpState.code){
    try{ navigator.sendBeacon('/mp/leave', JSON.stringify({code:mpState.code,playerId:mpState.playerId})); }catch(e){}
  }
});

function mpStopPolling(){
  if(mpState.pollTimer){ clearTimeout(mpState.pollTimer); mpState.pollTimer=null; }
}
function mpFatal(err){
  mpStopPolling();
  askConfirm('CONEXÃO PERDIDA','A sala não existe mais.', ()=>{battle.active=false;show('menu');});
}

/* ================== wiring de botões ================== */
$('mpCreateBtn').addEventListener('click',()=>{sfx.click();mpCreateRoom();});
$('mpJoinBtn').addEventListener('click',()=>{sfx.click();mpShowJoinPanel();});
$('mpChoiceCancel').addEventListener('click',()=>{sfx.click();$('mpOverlay').classList.add('hidden');});
$('mpCreateCancel').addEventListener('click',()=>{sfx.click();mpLeave();$('mpOverlay').classList.add('hidden');});
$('mpJoinCancel').addEventListener('click',()=>{sfx.click();mpState.code=null;$('mpChoice').classList.remove('hidden');$('mpJoinPanel').classList.add('hidden');});
$('mpJoinSubmit').addEventListener('click',()=>{sfx.click();mpJoinRoom();});
$('mpErrorClose').addEventListener('click',()=>{sfx.click();$('mpOverlay').classList.add('hidden');});
$('mpCodeInput').addEventListener('input',(e)=>{e.target.value=e.target.value.toUpperCase();});
