// theme.js — تحكم الأدمن في مظهر المنصة (بيتخزن في app_settings ويتطبق على الكل)
const TH = {
  theme_primary: ['اللون الأساسي', '#0B5C6B', '--nile'],
  theme_accent: ['لون التمييز', '#F2B632', '--sun'],
  theme_ink: ['لون النص والعناوين', '#10202B', '--ink'],
  theme_paper: ['خلفية الصفحات', '#F5F8FA', '--paper'],
  theme_line: ['لون الحدود', '#D5DEE4', '--line']
};
const TH_FONTS = ['Cairo', 'Tajawal', 'Almarai', 'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Noto Kufi Arabic', 'Readex Pro', 'Alexandria', 'El Messiri', 'Amiri', 'Reem Kufi', 'Changa', 'Mada', 'Rubik'];
const TH_PRESETS = [
  { n: 'نيل', c: ['#0B5C6B', '#F2B632', '#10202B', '#F5F8FA', '#D5DEE4'] },
  { n: 'غروب', c: ['#C2410C', '#FBBF24', '#2B1408', '#FFF7ED', '#F3D9C4'] },
  { n: 'بنفسجي', c: ['#6D28D9', '#F59E0B', '#1E1B4B', '#F5F3FF', '#DDD6FE'] },
  { n: 'زيتوني', c: ['#3F6212', '#EAB308', '#1A2E05', '#F7FEE7', '#D9E8B8'] },
  { n: 'وردي', c: ['#BE185D', '#38BDF8', '#3B0A21', '#FFF1F6', '#F9CFE0'] }
];
const parsePresets = s => { try { const a = JSON.parse(s || '[]'); return (Array.isArray(a) ? a : []).filter(p => p && typeof p.n === 'string' && Array.isArray(p.c) && p.c.length === 5 && p.c.every(x => /^#[0-9a-f]{6}$/i.test(x))).slice(0, 12); } catch { return []; } };
// الخطوط الإضافية: أسماء من Google Fonts بحروف وأرقام ومسافات بس
const fontList = g => TH_FONTS.concat(String((g || {}).theme_fonts_extra || '').split(',').map(x => x.trim()).filter(x => /^[A-Za-z0-9 ]{2,40}$/.test(x) && !TH_FONTS.includes(x))).slice(0, 14);
function loadFont(f) {
  if (f === 'Cairo' || document.getElementById('th-font:' + f)) return;
  const l = document.createElement('link');
  l.id = 'th-font:' + f; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;800&display=swap';
  document.head.appendChild(l);
}
const TH_DEF = { theme_radius: '8', theme_font: 'Cairo', theme_shadow: '1', theme_hero: 'split' };

function applyTheme(g) {
  g = g || {};
  const de = document.documentElement, s = de.style;
  Object.keys(TH).forEach(k => /^#[0-9a-f]{6}$/i.test(g[k] || '') ? s.setProperty(TH[k][2], g[k]) : s.removeProperty(TH[k][2]));
  const r = Math.min(Math.max(parseInt(g.theme_radius, 10), 0), 24);
  isNaN(r) ? s.removeProperty('--r') : s.setProperty('--r', r + 'px');
  const f = fontList(g).includes(g.theme_font) ? g.theme_font : 'Cairo';
  s.setProperty('--font', "'" + f + "'");
  loadFont(f);
  de.dataset.shadow = g.theme_shadow === '0' ? '0' : '1';
  de.dataset.hero = g.theme_hero === 'center' ? 'center' : 'split';
}

function themePage(m) {
  if (!me || me.role !== 'super_admin') { location.hash = '#/'; return; }
  const g = window.APP_SETTINGS || {}, v = (k, d) => g[k] || d, presets = TH_PRESETS.concat(parsePresets(g.theme_presets));
  m.innerHTML = '<section class="wrap"><h1>التحكم في مظهر المنصة</h1><p class="hint">التغييرات بتظهر لحظيًا قدامك بس، ومبتتطبقش على الزوار غير لما تضغط حفظ.</p>' +
    '<form class="card wide" id="thf"><h3>لوحات ألوان جاهزة</h3><div class="act pre">' + presets.map((p, i) => '<button type="button" class="btn ghost sm" data-pre="' + i + '">' + esc(p.n) + '</button>').join('') + '<button type="button" class="btn sm" id="svp">حفظ الألوان الحالية كلوحة</button></div><div class="thg">' +
    Object.keys(TH).map(k => '<label>' + TH[k][0] + '<input type="color" name="' + k + '" value="' + esc(v(k, TH[k][1])) + '"></label>').join('') +
    '<label>استدارة الحواف: <span id="rv"></span><input type="range" name="theme_radius" min="0" max="24" value="' + esc(v('theme_radius', TH_DEF.theme_radius)) + '"></label>' +
    '<label>الخط<select name="theme_font">' + fontList(g).map(x => '<option' + (v('theme_font', 'Cairo') === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
    '<label>شكل الهيرو<select name="theme_hero"><option value="split"' + (v('theme_hero', 'split') === 'split' ? ' selected' : '') + '>نص + رسمة</option><option value="center"' + (g.theme_hero === 'center' ? ' selected' : '') + '>نص في المنتصف</option></select></label>' +
    '<label class="chk"><input type="checkbox" name="theme_shadow"' + (g.theme_shadow === '0' ? '' : ' checked') + '> ظلال للكروت</label></div>' +
    '<label>خطوط إضافية من Google Fonts (أسماء بالإنجليزي مفصولة بفاصلة، مثال: Reem Kufi, Amiri). احفظ وحدّث الصفحة عشان تظهر في القائمة<input dir="ltr" name="theme_fonts_extra" maxlength="300" value="' + esc(g.theme_fonts_extra) + '"></label>' +
    '<label>عنوان الصفحة الرئيسية<input class="rtl" name="hero_title" maxlength="120" value="' + esc(g.hero_title) + '"></label>' +
    '<label>النص التعريفي<textarea class="rtl" name="hero_text" rows="2" maxlength="300">' + esc(g.hero_text) + '</textarea></label>' +
    '<div class="pv"><span class="badge">معاينة</span> <button type="button" class="btn">زر رئيسي</button> <button type="button" class="btn ghost">زر ثانوي</button></div>' +
    '<div class="act"><button class="btn">حفظ للجميع</button><button type="button" class="btn ghost" id="rst">رجوع للافتراضي</button></div><div class="msg" role="alert"></div></form></section>';
  const f = m.querySelector('#thf'), msg = f.querySelector('.msg');
  const read = () => { const d = Object.fromEntries(new FormData(f)); d.theme_shadow = f.theme_shadow.checked ? '1' : '0'; return d; };
  const live = () => { f.querySelector('#rv').textContent = f.theme_radius.value + 'px'; applyTheme(read()); };
  f.oninput = live; live();
  f.querySelector('.pre').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pre !== undefined) { presets[+b.dataset.pre].c.forEach((c, i) => f[Object.keys(TH)[i]].value = c); live(); return; }
    const n = (prompt('اسم اللوحة:') || '').trim().slice(0, 30); if (!n) return;
    const mine = parsePresets(g.theme_presets).concat({ n, c: Object.keys(TH).map(k => f[k].value) }).slice(-12);
    const { error } = await sb.from('app_settings').upsert({ key: 'theme_presets', value: JSON.stringify(mine) }, { onConflict: 'key' });
    msg.className = error ? 'msg' : 'msg ok'; msg.textContent = error ? error.message : 'تم حفظ اللوحة. حدّث الصفحة عشان تظهر.';
    if (!error) g.theme_presets = JSON.stringify(mine);
  };
  f.querySelector('#rst').onclick = () => {
    Object.keys(TH).forEach(k => f[k].value = TH[k][1]);
    f.theme_radius.value = TH_DEF.theme_radius; f.theme_font.value = TH_DEF.theme_font; f.theme_hero.value = TH_DEF.theme_hero; f.theme_shadow.checked = true; live();
  };
  f.onsubmit = async e => {
    e.preventDefault(); msg.className = 'msg';
    const d = read(), rows = Object.keys(d).map(key => ({ key, value: String(d[key]) }));
    const { error } = await sb.from('app_settings').upsert(rows, { onConflict: 'key' });
    if (error) { msg.textContent = 'تعذر الحفظ: ' + error.message; return; }
    Object.assign(window.APP_SETTINGS = window.APP_SETTINGS || {}, d);
    msg.className = 'msg ok'; msg.textContent = 'تم الحفظ وتطبيقه على المنصة كلها.';
  };
}

// ====== مظهر كل موقع على حدة (صاحب الموقع بيتحكم فيه من "البيانات") ======
function themeFields(t) {
  t = t && typeof t === 'object' ? t : {};
  const ok = (c, d) => /^#[0-9a-f]{6}$/i.test(c || '') ? c : d;
  const sel = (v, a) => a.map(x => '<option value="' + x[0] + '"' + (v === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('');
  const r = parseInt(t.radius, 10);
  return '<h3>مظهر الموقع</h3><div class="thg">' +
    '<label>لون الخلفية<input type="color" name="t_bg" value="' + ok(t.bg, '#ffffff') + '"></label>' +
    '<label>لون النص<input type="color" name="t_ink" value="' + ok(t.ink, '#10202B') + '"></label>' +
    '<label>الخط<select name="t_font">' + sel(t.font || '', [['', 'الافتراضي']].concat(fontList(window.APP_SETTINGS).map(x => [x, x]))) + '</select></label>' +
    '<label>استدارة الحواف<input type="range" name="t_radius" min="0" max="32" value="' + (r >= 0 ? r : 8) + '"></label>' +
    '<label>شكل الهيرو<select name="t_hero">' + sel(t.hero || 'solid', [['solid', 'لون ثابت'], ['grad', 'تدرّج'], ['glass', 'زجاجي (تمويه)']]) + '</select></label>' +
    '<label>شكل المتجر (قالب)<select name="t_skin">' + sel(t.skin || '', [['', 'عادي'], ['clan', 'كلان (دافئ)'], ['exemore', 'إكسيمور (متجر كبير)'], ['defacto', 'ديفاكتو (أزياء بسيط)']]) + '</select></label><label>لوجو الموقع<input type="file" name="t_logofile" accept="image/jpeg,image/png,image/webp"></label><label>صورة البانر (الخلفية)<input type="file" name="t_bannerfile" accept="image/jpeg,image/png,image/webp"></label>' +
    '<label class="chk"><input type="checkbox" name="t_anim"' + (t.anim ? ' checked' : '') + '> حركة ظهور ناعمة</label></div>';
}
const readSiteTheme = f => ({ bg: f.get('t_bg'), ink: f.get('t_ink'), font: f.get('t_font') || '', radius: +f.get('t_radius'), hero: f.get('t_hero'), skin: f.get('t_skin') || '', anim: f.get('t_anim') === 'on' });
function siteTheme(t) {
  t = t && typeof t === 'object' ? t : {};
  const ok = c => /^#[0-9a-f]{6}$/i.test(c || ''), r = parseInt(t.radius, 10);
  let s = '';
  if (ok(t.bg)) s += ';--bg:' + t.bg;
  if (ok(t.ink)) s += ';--tx:' + t.ink;
  if (r >= 0 && r <= 32) s += ';--rs:' + r + 'px';
  if (fontList(window.APP_SETTINGS).includes(t.font)) { s += ";--sf:'" + t.font + "'"; loadFont(t.font); }
  const su = u => /^https:\/\/[^\s"'()<>\\]+$/i.test(u || '') ? u : '';
  const bn = su(t.banner), lg = su(t.logo);
  if (bn) s += ';--bn:url("' + bn + '")';
  return { style: s, logo: lg ? '<img class="s-logo" src="' + lg + '" alt="">' : '', cls: (t.hero === 'grad' || t.hero === 'glass' ? ' h-' + t.hero : '') + (t.anim === true ? ' anim' : '') + (['clan', 'exemore', 'defacto'].includes(t.skin) ? ' sk-' + t.skin : '') + (bn ? ' has-bn' : '') };
}

// قراءة مظهر الموقع مع رفع اللوجو والبانر لو العميل اختار صور جديدة
async function siteThemeFrom(f, old) {
  const th = readSiteTheme(f); old = old && typeof old === 'object' ? old : {};
  for (const [k, field] of [['logo', 't_logofile'], ['banner', 't_bannerfile']]) {
    th[k] = old[k] || '';
    const file = f.get(field);
    if (file && file.size) { try { th[k] = await uploadFile(file, ['image']); } catch (er) { alert(er.message); } }
  }
  return th;
}

