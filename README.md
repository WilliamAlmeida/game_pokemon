# Jo-Kén-Pokémon

Dois jogos (mesmo tema, layouts diferentes) que compartilham o mesmo baralho de cards.

## Estrutura

```
game_pokemon/
├── assets/                         ← imagens (sprite sheets) usadas pelas DUAS versões
│   ├── sheet-1-20.jpg              ·  frentes cards 01–20  (grade 4×5)
│   ├── sheet-21-40.jpg             ·  frentes cards 21–40  (grade 4×5)
│   ├── sheet-41-60.jpg             ·  frentes cards 41–60  (grade 4×5)
│   └── sheet-backs.jpg             ·  versos dos 8 elementos (grade 4×2)
│
├── shared/                         ← código compartilhado (editar 1x, vale pras 2 versões)
│   ├── util.js                     ·  helpers: $, wait, rand, shuffle
│   └── cards.js                    ·  BANCO DE DADOS: os 60 cards, os 8 elementos
│                                      (ELEMS/BEATS), e o atlas de sprites
│                                      (SHEET_*, frontSprite, backSprite)
│
├── jokenpokemon.html               ← VERSÃO 1 "Jornada Johto" (página cheia)
├── jokenpokemon.css                ·  estilo só desta versão
├── jokenpokemon.js                 ·  lógica só desta versão
│
├── jokenpokemon-battle-chips.html  ← VERSÃO 2 "Battle Chips" (moldura de celular)
├── jokenpokemon-battle-chips.css   ·  estilo só desta versão
├── jokenpokemon-battle-chips.js    ·  lógica só desta versão
│
└── _backup_monolito/               ← os 2 HTML originais (tudo-em-1, 1,1 MB cada)
                                       guardados como backup; podem ser apagados
```

Cada HTML carrega os scripts nesta ordem (importa!):

```html
<script src="shared/util.js"></script>   <!-- 1º: helpers -->
<script src="shared/cards.js"></script>  <!-- 2º: dados + sprites -->
<script src="jokenpokemon.js"></script>  <!-- 3º: lógica da versão -->
```

## Build (arquivo único para publicar / jogar no celular)

```
node build.js
```

Gera em `dist/` um **`.html` único e autossuficiente** por versão (CSS, JS e imagens
em base64 tudo embutido — ~1,1 MB cada). Não depende de mais nada: dá pra abrir
offline, mandar por WhatsApp/e-mail, ou subir em qualquer hospedagem estática.

Editar o jogo continua sendo nos arquivos modulares; rode `node build.js` de novo
quando quiser regerar os arquivos de `dist/`.

### Publicar na internet

Suba `dist/jokenpokemon.html` (e/ou o do battle-chips) em qualquer host estático:

- **Netlify Drop** (app.netlify.com/drop) — arrasta o arquivo, ganha uma URL na hora.
- **GitHub Pages**, **Cloudflare Pages**, **Vercel**, **itch.io** (bom pra jogos).
- Ou no seu próprio VPS/Laragon com um domínio público.

Como é 1 arquivo só, no celular basta abrir a URL — já é responsivo (o battle-chips
inclusive tem moldura de celular). Também dá pra salvar na tela inicial (PWA leve).

## Como rodar (desenvolvimento)

Precisa ser servido por HTTP (por causa dos caminhos relativos e das imagens).
Qualquer uma das opções:

- **Laragon**: colocar/apontar um vhost para esta pasta e abrir a URL.
- **Node**: `npx serve` (ou `npx http-server`) dentro da pasta e abrir `http://localhost:3000`.
- Abrir o `.html` direto por `file://` também funciona na maioria dos navegadores.

## Onde mexer

| Quero… | Edito… |
|---|---|
| Adicionar/corrigir um card, ou mudar os elementos de um card | `shared/cards.js` (`COLLECTION`) → vale pras 2 versões |
| Mudar a tabela de quem vence quem | `shared/cards.js` (`BEATS`) |
| Trocar as imagens dos cards | substituir os `.jpg` em `assets/` (manter a grade 4×5 / 4×2) |
| Mudar o visual da versão 1 | `jokenpokemon.css` |
| Mudar a lógica/telas da versão 2 | `jokenpokemon-battle-chips.js` |

### Adicionar um novo card (ex.: nº 61)

1. Em `assets/`, o sprite dele precisa existir numa folha (cada folha comporta 20).
   Para passar de 60, crie `sheet-61-80.jpg` no mesmo padrão 4×5.
2. Em `shared/cards.js`:
   - adicione `{n:61,name:'NOME',el:['elemento1','elemento2']}` na `COLLECTION`;
   - se criou uma folha nova, adicione `const SHEET_61_80="assets/sheet-61-80.jpg";`
     e estenda o `if` dentro de `frontSprite(n)` para cobrir `n<=80`.

As duas versões passam a reconhecer o card automaticamente.

## Observação

Os `.js`/`.css` de cada versão divergem de propósito (save v1 vs v2, sons e
partículas com afinações diferentes, layouts distintos). Só o que é **idêntico**
entre as duas — dados dos cards e atlas de sprites — foi centralizado em `shared/`.
