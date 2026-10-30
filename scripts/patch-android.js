/*
 * Small tweaks to the generated android/ project:
 *  - versionCode = GitHub run number, versionName = version in package.json
 *  - status bar and navigation bar colors that match the app
 * Every step is non-fatal: if the template changes, the build still goes on.
 */
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const root = 'android';
const COLOR = '#0B3B35';

function edit(file, fn) {
  const p = path.join(root, file);
  try {
    const before = fs.readFileSync(p, 'utf8');
    const after = fn(before);
    if (after !== before) { fs.writeFileSync(p, after); console.log('patched  ', file); }
    else console.log('unchanged', file);
  } catch (e) {
    console.warn('skipped  ', file, '-', e.message);
  }
}

edit('app/build.gradle', s => s
  .replace(/versionCode\s+\d+/, `versionCode ${process.env.GITHUB_RUN_NUMBER || 1}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`));

edit('app/src/main/res/values/styles.xml', s => {
  const re = /(<style\s+name="AppTheme\.NoActionBar"[^>]*>)([\s\S]*?)(<\/style>)/;
  if (!re.test(s)) return s;
  return s.replace(re, (m, open, body, close) => {
    let add = '';
    if (!/android:statusBarColor/.test(body)) add += `        <item name="android:statusBarColor">${COLOR}</item>\n`;
    if (!/android:navigationBarColor/.test(body)) add += `        <item name="android:navigationBarColor">${COLOR}</item>\n`;
    if (!add) return m;
    return open + body.replace(/\s*$/, '\n') + add + '    ' + close;
  });
});
