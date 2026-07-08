/* =====================================================================
   build.js — empacota o jogo modular num ÚNICO .html autossuficiente.

   Uso:  node build.js
   Saída: dist/index.html

   O que faz:
   - inline do CSS (<link> -> <style>)
   - inline dos JS na ordem correta (util -> cards -> index) num só <script>
   - troca as refs "assets/xxx.jpg" por data:URI base64 (arquivo fica offline)
   Os arquivos-fonte não são alterados; só se lê deles.
===================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

const MIME = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png',
               '.gif':'image/gif', '.svg':'image/svg+xml', '.webp':'image/webp',
               '.ogg':'audio/ogg', '.mp3':'audio/mpeg' };

// troca toda ocorrência de assets/arquivo.ext (em aspas ou url()) por base64
function inlineAssets(code){
  return code.replace(/assets\/[A-Za-z0-9._-]+/g, (ref) => {
    const file = path.join(ROOT, ref);
    if(!fs.existsSync(file)){ console.warn('  ! asset não encontrado:', ref); return ref; }
    const ext = path.extname(file).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    const b64 = fs.readFileSync(file).toString('base64');
    return `data:${mime};base64,${b64}`;
  });
}

const GAMES = [
  { html:'index.html', css:'index.css',
    js:['shared/util.js','shared/cards.js','index.js'] },
];

fs.mkdirSync(DIST, { recursive:true });

for(const g of GAMES){
  let html = fs.readFileSync(path.join(ROOT, g.html), 'utf8');

  // 1) CSS -> <style> (com assets inline, por segurança)
  const css = inlineAssets(fs.readFileSync(path.join(ROOT, g.css), 'utf8'));
  html = html.replace(
    new RegExp(`\\s*<link[^>]*href=["']${g.css.replace(/[.]/g,'\\.')}["'][^>]*>`),
    `\n<style>\n${css}\n</style>`
  );

  // 2) JS (util -> cards -> versão) -> um único <script>, com assets inline
  let js = g.js.map(f => `/* --- ${f} --- */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  js = inlineAssets(js).replace(/<\/script>/gi, '<\\/script>'); // evita fechar a tag por engano
  // remove as 3 tags <script src=...> e injeta o bundle no lugar da 1ª
  let first = true;
  html = html.replace(/\s*<script\s+src=["'][^"']+["']><\/script>/gi, () => {
    if(first){ first=false; return `\n<script>\n${js}\n</script>`; }
    return '';
  });

  // 3) refs a assets/ que sobraram no HTML puro (ex: <source src="assets/...">) -> inline
  html = inlineAssets(html);

  const out = path.join(DIST, g.html);
  fs.writeFileSync(out, html);
  console.log(`✔ ${path.relative(ROOT,out)}  (${(fs.statSync(out).size/1024/1024).toFixed(2)} MB)`);
}

console.log('\nPronto. Os arquivos em dist/ são autossuficientes — 1 arquivo cada, sem dependências.');
