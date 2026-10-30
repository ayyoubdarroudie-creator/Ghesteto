/*
 * src/ → www/ (the folder Capacitor packs into the app).
 * If the "vazirmatn" npm package is available, the font is bundled inside the app
 * so the app is fully offline and no request goes to Google Fonts.
 * Otherwise the Google Fonts link is kept (it works online and falls back to the system font offline).
 */
const fs = require('fs');
const path = require('path');

const SRC = 'src';
const OUT = 'www';
const FILES = ['index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) {
  const from = path.join(SRC, f);
  if (!fs.existsSync(from)) { console.warn('missing source file:', from); continue; }
  fs.copyFileSync(from, path.join(OUT, f));
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}

function findFont() {
  const files = walk(path.join('node_modules', 'vazirmatn')).filter(f => f.toLowerCase().endsWith('.woff2'));
  const variable = files.find(f => /\[wght\]|variable|vf/i.test(path.basename(f)));
  if (variable) return { file: variable, variable: true };
  const regular = files.find(f => /regular/i.test(path.basename(f)));
  if (regular) return { file: regular, variable: false };
  return null;
}

const font = findFont();
if (font) {
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
  fs.copyFileSync(font.file, path.join(OUT, 'fonts', 'Vazirmatn.woff2'));
  const htmlPath = path.join(OUT, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  html = html
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/g, '')
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>\s*/g, '');
  const weight = font.variable ? '100 900' : '400';
  const face = `<style>@font-face{font-family:"Vazirmatn";src:url("fonts/Vazirmatn.woff2") format("woff2");font-weight:${weight};font-style:normal;font-display:swap}</style>\n`;
  html = html.replace('<style>', face + '<style>');
  fs.writeFileSync(htmlPath, html);
  console.log('Bundled font:', path.basename(font.file), font.variable ? '(variable)' : '(regular only)');
} else {
  console.log('Vazirmatn package not found: keeping the online font link.');
}
console.log('www/ is ready.');
