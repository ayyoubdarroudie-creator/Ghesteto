/*
 * Tweaks applied to the generated android/ project (after `cap add android`):
 *   1. versionCode = GitHub run number, versionName = version in package.json
 *   2. status bar / navigation bar colors that match the app
 *   3. home-screen widget (AghsatWidgetProvider) + the small plugin the web app uses to feed it
 *   4. notification small icon + the permissions needed for reminders
 * Every step is non-fatal: if a template changes, the build still goes on and prints a warning.
 */
const fs = require('fs');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const cfg = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8'));
const root = 'android';
const COLOR = '#0B3B35';
const appId = cfg.appId;

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

function copyDir(from, to, transform) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (e.isDirectory()) copyDir(src, dst, transform);
    else if (transform) fs.writeFileSync(dst, transform(fs.readFileSync(src, 'utf8')));
    else fs.copyFileSync(src, dst);
  }
}

function findFile(dir, name) {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = findFile(p, name); if (r) return r; }
    else if (e.name === name) return p;
  }
  return null;
}

/* 1. version */
edit('app/build.gradle', s => s
  .replace(/versionCode\s+\d+/, `versionCode ${process.env.GITHUB_RUN_NUMBER || 1}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`));

/* 2. system bars */
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

/* 3. widget: Java classes, resources, strings, manifest receiver, MainActivity */
const javaDir = path.join(root, 'app/src/main/java', ...appId.split('.'));
try {
  fs.mkdirSync(javaDir, { recursive: true });
  copyDir('android-overrides/java', javaDir, s => s.replace(/__PACKAGE__/g, appId));
  console.log('copied    widget Java classes to', javaDir);
} catch (e) { console.warn('skipped   widget Java classes -', e.message); }

try {
  copyDir('android-overrides/res', path.join(root, 'app/src/main/res'));
  console.log('copied    widget resources');
} catch (e) { console.warn('skipped   widget resources -', e.message); }

edit('app/src/main/res/values/strings.xml', s => {
  const add = [];
  if (!/name="widget_label"/.test(s)) add.push('    <string name="widget_label">اقساط</string>');
  if (!/name="widget_desc"/.test(s)) add.push('    <string name="widget_desc">نمایش سررسید بعدی اقساط، چک‌ها و هزینه‌ها</string>');
  if (!/name="widget_loading"/.test(s)) add.push('    <string name="widget_loading">در حال بارگذاری…</string>');
  if (!add.length) return s;
  return s.replace('</resources>', add.join('\n') + '\n</resources>');
});

edit('app/src/main/AndroidManifest.xml', s => {
  let out = s;
  if (!/AghsatWidgetProvider/.test(out)) {
    const receiver = `
        <receiver
            android:name=".AghsatWidgetProvider"
            android:exported="true"
            android:label="@string/widget_label">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="android.intent.action.DATE_CHANGED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/aghsat_widget_info" />
        </receiver>
`;
    out = out.replace('</application>', receiver + '    </application>');
  }
  const perms = ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'RECEIVE_BOOT_COMPLETED'];
  const missing = perms.filter(p => !new RegExp(`android\\.permission\\.${p}`).test(out));
  if (missing.length) {
    const lines = missing.map(p => `    <uses-permission android:name="android.permission.${p}" />`).join('\n');
    out = out.replace('</manifest>', lines + '\n</manifest>');
  }
  return out;
});

try {
  const main = findFile(path.join(root, 'app/src/main/java'), 'MainActivity.java');
  if (!main) throw new Error('MainActivity.java not found');
  fs.writeFileSync(main, `package ${appId};

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AghsatWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
  console.log('patched   MainActivity.java (registers the widget plugin)');
} catch (e) { console.warn('skipped   MainActivity.java -', e.message); }
