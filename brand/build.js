// Gera uma cópia "white label" do app em ./dist para outra lanchonete.
// Uso (no Vercel do cliente): Build Command = node brand/build.js demo · Output Directory = dist
// O site principal (Lanches do Boy) não usa este script e continua igual.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), brand = process.argv[2] || 'demo';
const B = require(`./${brand}/brand.json`), BD = path.join(__dirname, brand), OUT = path.join(ROOT, 'dist');

fs.rmSync(OUT, { recursive: true, force: true });
const skip = new Set(['.git', 'brand', 'dist', 'node_modules', 'README.md', '591.supabase.js']);
(function copy(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    if (skip.has(f)) continue;
    const s = path.join(src, f), d = path.join(dst, f);
    fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
})(ROOT, OUT);

// Logo, ícones e fotos da marca
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(BD, f)).toString('base64');
fs.writeFileSync(path.join(OUT, 'assets.js'),
  `LOGO="${b64('logo.png')}";LOGO_SM="${b64('logo-sm.png')}";\nwindow.__applyAssets&&window.__applyAssets();\n`);
for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(BD, f), path.join(OUT, f));

// Textos e conexões
const swap = (file, pairs) => {
  const p = path.join(OUT, file); let t = fs.readFileSync(p, 'utf8');
  for (const [a, b] of pairs) { if (!t.includes(a)) continue; t = t.split(a).join(b); }
  fs.writeFileSync(p, t);
};
const common = [
  ['Lanches<br>do Boy', B.heroName],
  ['Avenida João XXIII, 439, Belo Horizonte, Brasil', B.addrFull],
  ['Avenida João XXIII, 439', B.addrShort],
  ['Av. João XXIII, 439', B.addrShort],
  ['João XXIII, 439', B.addrShort.replace(/^Av\.\s*/, '')],
  ['Desde 2014', B.since], ['desde 2014', B.since.toLowerCase()],
  ['O melhor sabor de BH', B.slogan],
  ['Lanches do Boy', B.name],
  ['LANCHES DO BOY', B.name.toUpperCase()],
  ['>LB</text>', '>'+(B.initials||'LB')+'</text>'],
  ['lanches-do-boy', B.slug],
  ['lat:-19.8415,lng:-43.9710', `lat:${B.lat},lng:${B.lng}`],
];
const SRC = { url: 'https://dvrupqsedmgqpfmoyivm.supabase.co', ref: 'dvrupqsedmgqpfmoyivm' };
swap('app.js', [
  [SRC.url, B.supabaseUrl],
  [/SB_KEY='[^']+'/.exec(fs.readFileSync(path.join(OUT, 'app.js'), 'utf8'))[0], `SB_KEY='${B.supabaseAnonKey}'`],
  [/VAPID_PUB='[^']+'/.exec(fs.readFileSync(path.join(OUT, 'app.js'), 'utf8'))[0], `VAPID_PUB='${B.vapidPublic}'`],
  ...common,
]);
for (const f of ['index.html', 'privacidade.html', 'sw.js', 'manifest.webmanifest', 'manifest-loja.webmanifest', 'manifest-moto.webmanifest']) swap(f, common);
const ref = new URL(B.supabaseUrl).hostname.split('.')[0];
swap('vercel.json', [[SRC.ref, ref]]);
if (B.themeColor) for (const f of ['manifest.webmanifest', 'manifest-loja.webmanifest', 'manifest-moto.webmanifest']) {
  const p = path.join(OUT, f), m = JSON.parse(fs.readFileSync(p, 'utf8')); m.theme_color = B.themeColor; fs.writeFileSync(p, JSON.stringify(m));
}
console.log('Marca', B.name, 'gerada em dist/');
