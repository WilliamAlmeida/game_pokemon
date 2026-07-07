/* =====================================================================
   cards.js — BANCO DE DADOS compartilhado pelas DUAS versões
   (jokenpokemon.html e jokenpokemon-battle-chips.html)

   Edite aqui uma única vez e as duas versões refletem a mudança:
   os 60 cards, a tabela dos 8 elementos e o atlas de sprites.

   Sprite sheets em assets/ (ver frontSprite/backSprite no fim):
     frentes: grade 4x5 (20 cards por folha)
     versos : grade 4x2 (8 elementos)
===================================================================== */
const SHEET_1_20  = "assets/sheet-1-20.jpg";
const SHEET_21_40 = "assets/sheet-21-40.jpg";
const SHEET_41_60 = "assets/sheet-41-60.jpg";
const SHEET_BACKS = "assets/sheet-backs.jpg";

const F_COLS=4, F_ROWS=5, B_COLS=4, B_ROWS=2;
const BACK_POS = {
  corda:[0,0], tesoura:[1,0], agua:[2,0], fogo:[3,0],
  papel:[0,1], antichamas:[1,1], impermeavel:[2,1], pedra:[3,1]
};

/* ================== OS 8 ELEMENTOS — tabela oficial ================== */
const ELEMS = {
  pedra:{label:'PEDRA',emoji:'🪨'}, papel:{label:'PAPEL',emoji:'📄'},
  tesoura:{label:'TESOURA',emoji:'✂️'}, corda:{label:'CORDA',emoji:'🪢'},
  fogo:{label:'FOGO',emoji:'🔥'}, agua:{label:'ÁGUA',emoji:'💧'},
  antichamas:{label:'ANTI-CHAMAS',emoji:'🧯'}, impermeavel:{label:'IMPERMEÁVEL',emoji:'☂️'}
};
const BEATS = {
  pedra:['tesoura','agua'], papel:['pedra','corda'], tesoura:['papel','corda'],
  corda:['pedra'], fogo:['pedra','papel','tesoura','corda'],
  agua:['papel','tesoura','corda','fogo'], antichamas:['fogo'], impermeavel:['agua']
};

/* ============ OS 60 CARDS — pares de elemento oficiais ============ */
const COLLECTION = [
 {n:1,name:'CHARIZARD',el:['antichamas','agua']},{n:2,name:'PIKACHU',el:['antichamas','tesoura']},
 {n:3,name:'MEOWTH',el:['tesoura','agua']},{n:4,name:'CHIKORITA',el:['papel','impermeavel']},
 {n:5,name:'CYNDAQUIL',el:['fogo','corda']},{n:6,name:'TOTODILE',el:['papel','corda']},
 {n:7,name:'SENTRET',el:['papel','impermeavel']},{n:8,name:'HOOTHOOT',el:['pedra','tesoura']},
 {n:9,name:'LEDYBA',el:['pedra','corda']},{n:10,name:'SPINARAK',el:['tesoura','agua']},
 {n:11,name:'CHINCHOU',el:['papel','corda']},{n:12,name:'PICHU',el:['papel','pedra']},
 {n:13,name:'TOGEPI',el:['antichamas','tesoura']},{n:14,name:'NATU',el:['papel','tesoura']},
 {n:15,name:'MAREEP',el:['fogo','corda']},{n:16,name:'MARILL',el:['papel','pedra']},
 {n:17,name:'SUDOWOODO',el:['corda','impermeavel']},{n:18,name:'POLITOED',el:['tesoura','agua']},
 {n:19,name:'HOPPIP',el:['fogo','tesoura']},{n:20,name:'AIPOM',el:['papel','pedra']},
 {n:21,name:'SUNKERN',el:['pedra','tesoura']},{n:22,name:'YANMA',el:['pedra','tesoura']},
 {n:23,name:'WOOPER',el:['papel','corda']},{n:24,name:'MURKROW',el:['corda','impermeavel']},
 {n:25,name:'MISDREAVUS',el:['papel','tesoura']},{n:26,name:'UNOWN',el:['antichamas','pedra']},
 {n:27,name:'WOBBUFFET',el:['fogo','agua']},{n:28,name:'GIRAFARIG',el:['papel','pedra']},
 {n:29,name:'PINECO',el:['papel','corda']},{n:30,name:'DUNSPARCE',el:['papel','pedra']},
 {n:31,name:'GLIGAR',el:['pedra','corda']},{n:32,name:'SNUBBULL',el:['pedra','corda']},
 {n:33,name:'QWILFISH',el:['pedra','tesoura']},{n:34,name:'SCIZOR',el:['papel','corda']},
 {n:35,name:'SHUCKLE',el:['pedra','agua']},{n:36,name:'HERACROSS',el:['fogo','pedra']},
 {n:37,name:'SNEASEL',el:['antichamas','agua']},{n:38,name:'TEDDIURSA',el:['tesoura','impermeavel']},
 {n:39,name:'SLUGMA',el:['papel','corda']},{n:40,name:'SWINUB',el:['papel','tesoura']},
 {n:41,name:'CORSOLA',el:['papel','pedra']},{n:42,name:'REMORAID',el:['pedra','tesoura']},
 {n:43,name:'DELIBIRD',el:['fogo','pedra']},{n:44,name:'MANTINE',el:['tesoura','agua']},
 {n:45,name:'SKARMORY',el:['tesoura','impermeavel']},{n:46,name:'HOUNDOUR',el:['pedra','corda']},
 {n:47,name:'KINGDRA',el:['papel','corda']},{n:48,name:'PHANPY',el:['fogo','papel']},
 {n:49,name:'STANTLER',el:['antichamas','tesoura']},{n:50,name:'SMEARGLE',el:['pedra','tesoura']},
 {n:51,name:'TYROGUE',el:['papel','corda']},{n:52,name:'HITMONTOP',el:['papel','tesoura']},
 {n:53,name:'SMOOCHUM',el:['pedra','agua']},{n:54,name:'ELEKID',el:['corda','impermeavel']},
 {n:55,name:'MAGBY',el:['fogo','pedra']},{n:56,name:'MILTANK',el:['fogo','corda']},
 {n:57,name:'ENTEI',el:['papel','agua']},{n:58,name:'LARVITAR',el:['tesoura','agua']},
 {n:59,name:'LUGIA',el:['antichamas','tesoura']},{n:60,name:'HO-OH',el:['antichamas','agua']}
];
const byN = n => COLLECTION.find(c=>c.n===n);

/* ================== ATLAS DE SPRITES ================== */
function frontSprite(n){
  let url,idx;
  if(n<=20){url=SHEET_1_20;idx=n-1;}
  else if(n<=40){url=SHEET_21_40;idx=n-21;}
  else{url=SHEET_41_60;idx=n-41;}
  const col=idx%F_COLS,row=Math.floor(idx/F_COLS);
  return `background-image:url('${url}');background-size:${F_COLS*100}% ${F_ROWS*100}%;`+
         `background-position:${(col*100/(F_COLS-1)).toFixed(4)}% ${(row*100/(F_ROWS-1)).toFixed(4)}%;`;
}
function backSprite(elem){
  const [col,row]=BACK_POS[elem];
  return `background-image:url('${SHEET_BACKS}');background-size:${B_COLS*100}% ${B_ROWS*100}%;`+
         `background-position:${(col*100/(B_COLS-1)).toFixed(4)}% ${(row*100/(B_ROWS-1)).toFixed(4)}%;`;
}
