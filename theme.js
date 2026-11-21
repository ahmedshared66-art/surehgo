// theme.js — تحكم الأدمن في مظهر المنصة (بيتخزن في app_settings ويتطبق على الكل)
const TH = {
  theme_primary: ['اللون الأساسي', '#0B5C6B', '--nile'],
  theme_accent: ['لون التمييز', '#F2B632', '--sun'],
  theme_ink: ['لون النص والعناوين', '#10202B', '--ink'],
  theme_paper: ['خلفية الصفحات', '#F5F8FA', '--paper'],
  theme_line: ['لون الحدود', '#D5DEE4', '--line']
};
const TH_FONTS = ['Cairo', 'Tajawal', 'Almarai', 'IBM Plex Sans Arabic'];
const TH_DEF = { theme_radius: '8', theme_font: 'Cairo', theme_shadow: '1', theme_hero: 'split' };

function applyTheme(g) {
  g = g || {};
  const de = document.documentElement, s = de.style;
  Object.keys(TH).forEach(k => /^#[0-9a-f]{6}$/i.test(g[k] || '') ? s.setProperty(TH[k][2], g[k]) : s.removeProperty(TH[k][2]));
  const r = Math.min(Math.max(parseInt(g.theme_radius, 10), 0), 24);
  isNaN(r) ? s.removeProperty('--r') : s.setProperty('--r', r + 'px');
  const f = TH_FONTS.includes(g.theme_font) ? g.theme_font : 'Cairo';
  s.setProperty('--font', "'" + f + "'");
  if (f !== 'Cairo' && !document.getElementById('th-font:' + f)) {
    const l = document.createElement('link');
    l.id = 'th-font:' + f; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;800&display=swap';
    document.head.appendChild(l);
  }
  de.dataset.shadow = g.theme_shadow === '0' ? '0' : '1';
  de.dataset.hero = g.theme_hero === 'center' ? 'center' : 'split';
}

function themePage(m) {
  if (!me || me.role !== 'super_admin') { location.hash = '#/'; return; }
  const g = window.APP_SETTINGS || {}, v = (k, d) => g[k] || d;
  m.innerHTML = '<section class="wrap"><h1>التحكم في مظهر المنصة</h1><p class="hint">التغييرات بتظهر لحظيًا قدامك بس، ومبتتطبقش على الزوار غير لما تضغط حفظ.</p>' +
    '<form class="card wide" id="thf"><div class="thg">' +
    Object.keys(TH).map(k => '<label>' + TH[k][0] + '<input type="color" name="' + k + '" value="' + esc(v(k, TH[k][1])) + '"></label>').join('') +
    '<label>استدارة الحواف: <span id="rv"></span><input type="range" name="theme_radius" min="0" max="24" value="' + esc(v('theme_radius', TH_DEF.theme_radius)) + '"></label>' +
    '<label>الخط<select name="theme_font">' + TH_FONTS.map(x => '<option' + (v('theme_font', 'Cairo') === x ? ' selected' : '') + '>' + x + '</option>').join('') + '</select></label>' +
    '<label>شكل الهيرو<select name="theme_hero"><option value="split"' + (v('theme_hero', 'split') === 'split' ? ' selected' : '') + '>نص + رسمة</option><option value="center"' + (g.theme_hero === 'center' ? ' selected' : '') + '>نص في المنتصف</option></select></label>' +
    '<label class="chk"><input type="checkbox" name="theme_shadow"' + (g.theme_shadow === '0' ? '' : ' checked') + '> ظلال للكروت</label></div>' +
    '<label>عنوان الصفحة الرئيسية<input class="rtl" name="hero_title" maxlength="120" value="' + esc(g.hero_title) + '"></label>' +
    '<label>النص التعريفي<textarea class="rtl" name="hero_text" rows="2" maxlength="300">' + esc(g.hero_text) + '</textarea></label>' +
    '<div class="pv"><span class="badge">معاينة</span> <button type="button" class="btn">زر رئيسي</button> <button type="button" class="btn ghost">زر ثانوي</button></div>' +
    '<div class="act"><button class="btn">حفظ للجميع</button><button type="button" class="btn ghost" id="rst">رجوع للافتراضي</button></div><div class="msg" role="alert"></div></form></section>';
  const f = m.querySelector('#thf'), msg = f.querySelector('.msg');
  const read = () => { const d = Object.fromEntries(new FormData(f)); d.theme_shadow = f.theme_shadow.checked ? '1' : '0'; return d; };
  const live = () => { f.querySelector('#rv').textContent = f.theme_radius.value + 'px'; applyTheme(read()); };
  f.oninput = live; live();
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
