// extras.js — المرحلة 5: إعلانات النسخة المجانية، واتساب وروابط التواصل، وعدّاد الزيارات
// بيتحمّل قبل app.js، وبيستخدم sb و esc و me و C و okUrl و U_HTTPS من app.js وقت التشغيل.

async function siteExtras(site) {
  const el = document.querySelector('.site'); if (!el) return;

  // عدّاد الزيارات: مرة واحدة لكل جلسة، ومن غير زيارات صاحب الموقع نفسه
  try {
    const k = 'v:' + site.id;
    if (!(me && me.id === site.owner_id) && !sessionStorage.getItem(k)) {
      sessionStorage.setItem(k, '1');
      await sb.rpc('track_visit', { p_site: site.id });
    }
  } catch {}

  // زر واتساب العائم
  const wa = String(site.whatsapp || '').replace(/[^0-9]/g, '');
  if (wa.length >= 8 && wa.length <= 15) {
    const a = document.createElement('a');
    a.className = 'wa'; a.href = 'https://wa.me/' + wa; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = 'تواصل عبر واتساب';
    el.appendChild(a);
  }

  // روابط فيسبوك وإنستجرام في الفوتر
  const soc = [['فيسبوك', okUrl(site.facebook, U_HTTPS)], ['إنستجرام', okUrl(site.instagram, U_HTTPS)]].filter(x => x[1]);
  const foot = el.querySelector('.s-foot');
  if (soc.length && foot) {
    const d = document.createElement('div');
    d.className = 'soc';
    d.innerHTML = soc.map(x => '<a href="' + esc(x[1]) + '" target="_blank" rel="noopener">' + x[0] + '</a>').join('');
    foot.insertBefore(d, foot.firstChild);
  }

  // إعلان المنصة على المواقع المجانية
  try {
    const { data } = await sb.rpc('site_shows_ads', { p_site: site.id });
    if (data === true && el.isConnected) {
      const bar = document.createElement('div');
      bar.className = 'ad-bar'; bar.setAttribute('role', 'complementary'); bar.setAttribute('aria-label', 'إعلان');
      bar.innerHTML = '<span>إعلان: </span><a href="' + esc(location.origin + location.pathname) + '">' + esc(C.AD_TEXT || 'موقع مجاني من ' + C.PLATFORM_NAME) + '</a>';
      el.insertBefore(bar, el.firstChild);
    }
  } catch {}
}
