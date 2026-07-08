/* =====================================================================
   server.js — servidor multiplayer local (LAN), zero dependências.
   Serve os arquivos estáticos do jogo + API JSON sob /mp/* para partidas
   de 2 jogadores (um PC hospeda, o outro conecta pelo IP local + código
   de sala). Sincronização por polling HTTP (não WebSocket).

   Uso: node server.js   (porta padrão 4321, configurável via PORT)

   v2 (não implementado): POST /mp/rematch {code} reaproveitaria o mesmo
   código de sala, resetando placares/decks sem os jogadores re-digitarem
   nada.
===================================================================== */
const http=require('http'), fs=require('fs'), path=require('path'),
      os=require('os'), crypto=require('crypto');
const { COLLECTION, SHIELDS, HAND_SIZE, resolveRoundOutcome } = require('./shared/cards.js');
const { rand, shuffle } = require('./shared/util.js');

const PORT = process.env.PORT || 4321;
const ROOT = __dirname;

/* ================== deck/mão (porta server-side de buildFullDeck/draw) ================== */
function buildFullDeckServer(){
  return shuffle(COLLECTION.map(c=>({...c,elem:rand(c.el)})));
}
function drawHand(deck,hand){
  while(hand.length<HAND_SIZE){
    if(!deck.length)deck.push(...buildFullDeckServer());
    hand.push(deck.pop());
  }
  if(hand.every(c=>SHIELDS.includes(c.elem))){
    const k=deck.findIndex(c=>!SHIELDS.includes(c.elem));
    if(k>-1){const swap=deck.splice(k,1)[0];deck.push(hand.pop());hand.push(swap);}
    else{
      const c=rand(COLLECTION.filter(x=>!x.el.every(e=>SHIELDS.includes(e))));
      hand.pop();hand.push({...c,elem:c.el.find(e=>!SHIELDS.includes(e))});
    }
  }
}

/* ================== modelo de sala (em memória) ================== */
const rooms = new Map(); // code -> room
const CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I/L (ambíguos)
function genCode(){
  let code;
  do{ code=Array.from({length:4},()=>CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]).join(''); }
  while(rooms.has(code));
  return code;
}
function newPlayer(name,defaultName){
  return { id:crypto.randomUUID(), name:(name||'').trim().slice(0,12)||defaultName,
           deck:[], hand:[], score:0, streak:0, connected:true, lastSeen:Date.now() };
}
function newRoom(hostName){
  const code=genCode();
  const room={
    code, state:'waiting', target:7, createdAt:Date.now(), finishedAt:null,
    players:{ p1:newPlayer(hostName,'JOGADOR 1'), p2:null },
    round:{ seq:0, resultSeq:0, result:null, pending:{p1:null,p2:null} },
    winner:null, forfeit:false
  };
  rooms.set(code, room);
  return room;
}
function roleFor(room, playerId){
  if(room.players.p1 && room.players.p1.id===playerId) return 'p1';
  if(room.players.p2 && room.players.p2.id===playerId) return 'p2';
  return null;
}
function otherRole(role){ return role==='p1'?'p2':'p1'; }

/* projeção do estado da sala do ponto de vista de um jogador específico */
function viewFor(room, role){
  const me=room.players[role], opp=room.players[otherRole(role)];
  const base = { ok:true, state:room.state, target:room.target };
  if(room.state==='waiting') return base;

  const you={ name:me.name, score:me.score, streak:me.streak };
  const oppView={ name:opp?opp.name:null, score:opp?opp.score:0, connected:opp?opp.connected:false };

  let result=null;
  if(room.round.result){
    const rr=room.round.result;
    const mine = role==='p1' ? {card:rr.p1Card,shield:rr.p1Shield} : {card:rr.p2Card,shield:rr.p2Shield};
    const theirs= role==='p1' ? {card:rr.p2Card,shield:rr.p2Shield} : {card:rr.p1Card,shield:rr.p1Shield};
    const outcome = role==='p1' ? rr.outcomeP1
                   : (rr.outcomeP1==='win'?'lose':rr.outcomeP1==='lose'?'win':'draw');
    result={ resultSeq:rr.resultSeq, yourCard:mine.card, yourShield:mine.shield,
             oppCard:theirs.card, oppShield:theirs.shield, outcome, phrase:rr.phrase };
  }

  if(room.state==='active'){
    you.hand=me.hand;
    return {...base, you, opp:oppView, result};
  }
  // finished
  return {...base, winner: room.winner===role?'you':'opp', forfeit:room.forfeit, you, opp:oppView, result};
}

/* ================== resolução de rodada ================== */
function resolveRound(room){
  const {p1,p2}=room.players;
  const m1=room.round.pending.p1, m2=room.round.pending.p2;
  const {outcome,phrase}=resolveRoundOutcome(
    m1.card.elem, m2.card.elem,
    m1.shield?m1.shield.elem:null, m2.shield?m2.shield.elem:null);
  if(outcome==='win'){p1.score++;p1.streak++;p2.streak=0;}
  else if(outcome==='lose'){p2.score++;p2.streak++;p1.streak=0;}
  else{p1.streak=0;p2.streak=0;}

  room.round.resultSeq++;
  room.round.result={ resultSeq:room.round.resultSeq,
    p1Card:m1.card,p1Shield:m1.shield, p2Card:m2.card,p2Shield:m2.shield,
    outcomeP1:outcome, phrase };
  room.round.pending.p1=null; room.round.pending.p2=null;

  if(p1.score>=room.target||p2.score>=room.target){
    room.state='finished'; room.winner=p1.score>=room.target?'p1':'p2';
    room.finishedAt=Date.now();
  }else{
    drawHand(p1.deck,p1.hand); drawHand(p2.deck,p2.hand);
    room.round.seq++;
  }
}

/* ================== IP local (LAN) ==================
   Evita pegar interfaces virtuais (WSL/Docker/Hyper-V/VPN), que existem
   mas não são alcançáveis pelo celular na mesma rede WiFi. */
const VIRTUAL_IFACE_RE=/vEthernet|virtual|hyper-v|wsl|docker|vmware|virtualbox|loopback|tailscale|zerotier/i;
function getLanIp(){
  const ifaces=os.networkInterfaces();
  const candidates=[];
  for(const name of Object.keys(ifaces)){
    for(const iface of ifaces[name]){
      if(iface.family==='IPv4' && !iface.internal) candidates.push({name, address:iface.address});
    }
  }
  const real = candidates.find(c=>!VIRTUAL_IFACE_RE.test(c.name));
  if(real) return real.address;
  return candidates.length ? candidates[0].address : '127.0.0.1';
}

/* ================== limpeza de salas inativas ================== */
setInterval(()=>{
  const now=Date.now();
  for(const [code,room] of rooms){
    if(room.state==='waiting' && now-room.createdAt>10*60*1000){ rooms.delete(code); continue; }
    if(room.state==='active'){
      for(const role of ['p1','p2']){
        const p=room.players[role];
        if(p && p.connected && now-p.lastSeen>20000){
          p.connected=false;
          room.state='finished'; room.forfeit=true;
          room.winner=otherRole(role); room.finishedAt=now;
        }
      }
    }
    if(room.state==='finished' && now-(room.finishedAt||now)>2*60*1000){ rooms.delete(code); }
  }
}, 15000);

/* ================== API /mp/* ================== */
function sendJson(res, status, obj){
  const body=JSON.stringify(obj);
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(body)});
  res.end(body);
}
function readBody(req, cb){
  let chunks=[];
  req.on('data', c=>chunks.push(c));
  req.on('end', ()=>{
    const raw=Buffer.concat(chunks).toString('utf8');
    if(!raw){ cb(null, {}); return; }
    try{ cb(null, JSON.parse(raw)); }
    catch(e){ cb(e); }
  });
}

function handleApi(req, res, u){
  const parts=u.pathname.split('/').filter(Boolean); // ['mp','create'] etc
  const action=parts[1];

  if(req.method==='GET' && action==='state'){
    const code=(u.searchParams.get('code')||'').toUpperCase();
    const playerId=u.searchParams.get('playerId')||'';
    const room=rooms.get(code);
    const role=room && roleFor(room, playerId);
    if(!room || !role){ sendJson(res,404,{ok:false,error:'room_not_found'}); return; }
    room.players[role].lastSeen=Date.now();
    room.players[role].connected=true;
    sendJson(res,200, viewFor(room, role));
    return;
  }

  if(req.method!=='POST'){ sendJson(res,404,{ok:false,error:'not_found'}); return; }

  readBody(req, (err, body)=>{
    if(err){ sendJson(res,400,{ok:false,error:'bad_json'}); return; }

    if(action==='create'){
      const room=newRoom(body.name);
      sendJson(res,200,{ok:true, code:room.code, playerId:room.players.p1.id, role:'p1', ip:getLanIp(), port:PORT});
      return;
    }

    if(action==='join'){
      const code=(body.code||'').toUpperCase();
      const room=rooms.get(code);
      if(!room){ sendJson(res,404,{ok:false,error:'room_not_found'}); return; }
      if(room.state!=='waiting'){ sendJson(res,409,{ok:false,error:'room_full'}); return; }
      room.players.p2=newPlayer(body.name,'JOGADOR 2');
      room.players.p1.deck=buildFullDeckServer(); room.players.p1.hand=[];
      room.players.p2.deck=buildFullDeckServer(); room.players.p2.hand=[];
      drawHand(room.players.p1.deck, room.players.p1.hand);
      drawHand(room.players.p2.deck, room.players.p2.hand);
      room.state='active'; room.round.seq=1;
      sendJson(res,200,{ok:true, playerId:room.players.p2.id, role:'p2', ...viewFor(room,'p2')});
      return;
    }

    if(action==='play'){
      const code=(body.code||'').toUpperCase();
      const room=rooms.get(code);
      const role=room && roleFor(room, body.playerId);
      if(!room || !role){ sendJson(res,404,{ok:false,error:'room_not_found'}); return; }
      if(room.state!=='active'){ sendJson(res,409,{ok:false,error:'not_active'}); return; }
      if(room.round.pending[role]!==null){ sendJson(res,409,{ok:false,error:'already_moved'}); return; }

      const hand=room.players[role].hand;
      const cardIdx=body.cardIdx;
      const shieldIdx=(body.shieldIdx===undefined||body.shieldIdx===null)?null:body.shieldIdx;
      const cardOk = Number.isInteger(cardIdx) && cardIdx>=0 && cardIdx<hand.length && !SHIELDS.includes(hand[cardIdx].elem);
      const shieldOk = shieldIdx===null || (Number.isInteger(shieldIdx) && shieldIdx>=0 && shieldIdx<hand.length && shieldIdx!==cardIdx && SHIELDS.includes(hand[shieldIdx].elem));
      if(!cardOk || !shieldOk){ sendJson(res,400,{ok:false,error:'invalid_move'}); return; }

      const card=hand[cardIdx], shield=shieldIdx!==null?hand[shieldIdx]:null;
      room.players[role].hand = hand.filter((_,i)=>i!==cardIdx && i!==shieldIdx);
      room.round.pending[role]={card,shield};
      room.players[role].lastSeen=Date.now();
      room.players[role].connected=true;

      if(room.round.pending[otherRole(role)]) resolveRound(room);

      sendJson(res,200,{ok:true});
      return;
    }

    if(action==='leave'){
      const code=(body.code||'').toUpperCase();
      const room=rooms.get(code);
      const role=room && roleFor(room, body.playerId);
      if(room && role){
        if(room.state==='waiting'){ rooms.delete(code); }
        else if(room.state==='active'){
          room.state='finished'; room.winner=otherRole(role);
          room.forfeit=true; room.finishedAt=Date.now();
        }
      }
      sendJson(res,200,{ok:true});
      return;
    }

    sendJson(res,404,{ok:false,error:'not_found'});
  });
}

/* ================== estático ================== */
const MIME = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8', '.json':'application/json',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png',
  '.svg':'image/svg+xml', '.ico':'image/x-icon' };

function serveStatic(req,res,urlPath){
  let rel = urlPath==='/' ? '/index.html' : urlPath;
  const full = path.normalize(path.join(ROOT, decodeURIComponent(rel)));
  if(!full.startsWith(ROOT)){ res.writeHead(403); res.end(); return; }
  fs.readFile(full, (err,data)=>{
    if(err){ res.writeHead(404); res.end('not found'); return; }
    const ext=path.extname(full).toLowerCase();
    res.writeHead(200, {'Content-Type': MIME[ext]||'application/octet-stream'});
    res.end(data);
  });
}

const server=http.createServer((req,res)=>{
  const u=new URL(req.url, `http://${req.headers.host}`);
  if(u.pathname.startsWith('/mp/')) return handleApi(req,res,u);
  return serveStatic(req,res,u.pathname);
});
server.listen(PORT, ()=>{
  console.log(`Jo-Kén-Pokémon multiplayer rodando:`);
  console.log(`  neste PC:  http://localhost:${PORT}/`);
  console.log(`  na rede:   http://${getLanIp()}:${PORT}/  (abra este endereço no celular)`);
});
