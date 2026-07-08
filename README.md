# Jo-Kén-Pokémon — Jornada Johto

Jogo de cards (Jokenpô com 8 elementos) em HTML/CSS/JS puro, sem framework.

## Estrutura

```
game_pokemon/
├── index.html                 ← página do jogo (markup + <link>/<script>)
├── index.css                  ← estilo
├── index.js                   ← lógica do jogo (menu, batalha, álbum, campanha, XP…)
│
├── assets/                    ← imagens (sprite sheets)
│   ├── sheet-1-20.jpg         ·  frentes cards 01–20  (grade 4×5)
│   ├── sheet-21-40.jpg        ·  frentes cards 21–40  (grade 4×5)
│   ├── sheet-41-60.jpg        ·  frentes cards 41–60  (grade 4×5)
│   └── sheet-backs.jpg        ·  versos dos 8 elementos (grade 4×2)
│
├── shared/                    ← núcleo reutilizável (dados + helpers)
│   ├── util.js                ·  helpers: $, wait, rand, shuffle
│   └── cards.js               ·  BANCO DE DADOS: os 60 cards, os 8 elementos
│                                 (ELEMS/BEATS) e o atlas de sprites
│                                 (SHEET_*, frontSprite, backSprite)
│
├── build.js                   ← gera dist/index.html (arquivo único, ver abaixo)
├── dist/index.html            ← build autossuficiente (gerado por node build.js)
└── _backup_monolito/          ← HTML original tudo-em-1 (backup; pode apagar)
```

O `index.html` carrega os scripts nesta ordem (importa!):

```html
<script src="shared/util.js"></script>   <!-- 1º: helpers -->
<script src="shared/cards.js"></script>  <!-- 2º: dados + sprites -->
<script src="index.js"></script>         <!-- 3º: lógica do jogo -->
```

## Build (arquivo único para publicar / jogar no celular)

```
node build.js
```

Gera `dist/index.html` — um **`.html` único e autossuficiente** (CSS, JS e imagens
em base64 tudo embutido, ~1,1 MB). Não depende de mais nada: dá pra abrir offline,
mandar por WhatsApp/e-mail, ou subir em qualquer hospedagem estática.

Editar o jogo continua sendo nos arquivos modulares; rode `node build.js` de novo
quando quiser regerar o `dist/`.

### Publicar na internet

Suba `dist/index.html` em qualquer host estático:

- **Netlify Drop** (app.netlify.com/drop) — arrasta o arquivo, ganha uma URL na hora.
- **GitHub Pages**, **Cloudflare Pages**, **Vercel**, **itch.io** (bom pra jogos).
- Ou no seu próprio VPS/Laragon com um domínio público.

Como é 1 arquivo só, no celular basta abrir a URL — já é responsivo. Dá pra
"Adicionar à tela inicial".

## Como rodar (desenvolvimento)

Precisa ser servido por HTTP (por causa dos caminhos relativos e das imagens):

- **Laragon**: apontar um vhost para esta pasta e abrir a URL.
- **Node**: `npx serve` dentro da pasta e abrir a URL que ele mostrar.
- Abrir o `index.html` direto por `file://` também funciona na maioria dos navegadores.

## Onde mexer

| Quero… | Edito… |
|---|---|
| Adicionar/corrigir um card, ou mudar os elementos de um card | `shared/cards.js` (`COLLECTION`) |
| Mudar a tabela de quem vence quem | `shared/cards.js` (`BEATS`) |
| Trocar as imagens dos cards | substituir os `.jpg` em `assets/` (manter a grade 4×5 / 4×2) |
| Mudar o visual | `index.css` |
| Mudar a lógica/telas/regras | `index.js` |

### Adicionar um novo card (ex.: nº 61)

1. Em `assets/`, o sprite dele precisa existir numa folha (cada folha comporta 20).
   Para passar de 60, crie `sheet-61-80.jpg` no mesmo padrão 4×5.
2. Em `shared/cards.js`:
   - adicione `{n:61,name:'NOME',el:['elemento1','elemento2']}` na `COLLECTION`;
   - se criou uma folha nova, adicione `const SHEET_61_80="assets/sheet-61-80.jpg";`
     e estenda o `if` dentro de `frontSprite(n)` para cobrir `n<=80`.

O jogo passa a reconhecer o card automaticamente.
