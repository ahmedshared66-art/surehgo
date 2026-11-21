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

// ====== الذكاء الاصطناعي في المحرر (بيستدعي Edge Function اسمها generate-site) ======
async function aiGenerate(siteId, blocks, st, draw) {
  const prompt = window.prompt('اكتب وصف نشاطك وأهم خدماتك أو منتجاتك (اختياري)، وهنجهّز لك أقسام الموقع. المحتوى بيتضاف لآخر الصفحة وتقدر تعدّله قبل الحفظ:', '');
  if (prompt === null) return;
  st('جاري إنشاء المحتوى بالذكاء الاصطناعي...');
  const { data, error } = await sb.functions.invoke('generate-site', { body: { site_id: siteId, prompt: prompt.slice(0, 1000) } });
  if (error) {
    let code = '';
    try { code = (await error.context.json()).error; } catch {}
    st(({
      plan_required: 'الذكاء الاصطناعي متاح في الباقة السنوية.',
      rate_limited: 'وصلت للحد اليومي (10 مرات). جرّب بكرة.',
      ai_not_configured: 'الذكاء الاصطناعي لسه مش مفعّل من إدارة المنصة.',
      ai_failed: 'خدمة الذكاء الاصطناعي مش متاحة دلوقتي. جرّب بعد شوية.',
      ai_bad_output: 'النتيجة مش صالحة. جرّب تاني بوصف أوضح.'
    })[code] || 'تعذر إنشاء المحتوى. جرّب تاني.');
    return;
  }
  const room = 40 - blocks.length, add = arr(data && data.blocks).filter(b => b && BLOCKS[b.type]).slice(0, Math.max(room, 0));
  if (!add.length) { st(room <= 0 ? 'وصلت للحد الأقصى (40 عنصر).' : 'مفيش محتوى جديد. جرّب تاني.'); return; }
  blocks.push(...add); draw();
  st('تمت إضافة ' + add.length + ' عنصر. راجعهم واضغط حفظ.');
}

// ====== الاشتراك: دفع يدوي بفودافون كاش، والتفعيل بيتم من لوحة الأدمن ======
const planLabel = p => p === 'yearly' ? 'سنوي' : 'شهري';
const planPrice = p => p === 'yearly' ? C.PRICE_YEARLY : C.PRICE_MONTHLY;

const payHtml = () =>
  '<h2>الاشتراك</h2><div class="pay"><button type="button" class="btn" data-pay="monthly">اشترك شهري: ' + esc(C.PRICE_MONTHLY) +
  '</button> <button type="button" class="btn" data-pay="yearly">اشترك سنوي: ' + esc(C.PRICE_YEARLY) +
  '</button></div><div id="pay-info"></div>';

function startPay(plan, btn) {
  const box = document.getElementById('pay-info'); if (!box) return;
  const cash = String(C.VODAFONE_CASH || '').trim();
  const wa = String(C.WHATSAPP || '').replace(/[^0-9]/g, '');
  if (!cash || !wa) { box.innerHTML = '<p class="msg">طريقة الدفع لسه مش مجهزة من الإدارة.</p>'; return; }
  const text = 'السلام عليكم، حولت اشتراك ' + planLabel(plan) + ' (' + planPrice(plan) + ') على فودافون كاش.\n' +
    'الاسم: ' + (me.full_name || '') + '\nالبريد: ' + (me.email || '') + '\nالهاتف: ' + (me.phone || '');
  const link = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
  box.innerHTML =
    '<div style="border:1px solid var(--line);background:#fff;border-radius:8px;padding:18px;margin:14px 0;max-width:520px">' +
    '<h3 style="margin:0 0 10px">اشتراك ' + planLabel(plan) + ': ' + esc(planPrice(plan)) + '</h3>' +
    '<ol style="margin:0 0 12px;padding-inline-start:20px">' +
    '<li>حوّل <b>' + esc(planPrice(plan)) + '</b> على فودافون كاش للرقم:<br><b dir="ltr" style="font-size:1.3rem">' + esc(cash) + '</b></li>' +
    '<li>اكتب رقم الموبايل اللي حوّلت منه تحت واضغط إرسال.</li></ol>' +
    '<form id="rq" style="display:grid;gap:10px">' +
    '<label>رقم الموبايل اللي حوّلت منه<input name="sender" type="tel" required minlength="8" maxlength="20"></label>' +
    '<label>ملاحظة (اختياري)<input class="rtl" name="note" maxlength="200"></label>' +
    '<button class="btn">تم التحويل، ابعت الطلب</button><div class="msg" role="alert"></div></form>' +
    '<p class="hint" style="margin-top:10px">تقدر كمان تبعت صورة التحويل على واتساب: <a href="' + esc(link) + '" target="_blank" rel="noopener">فتح واتساب</a></p>' +
    '<p class="hint">سيتم الرد عليك وتفعيل اشتراكك خلال 24 ساعة من وصول التحويل.</p></div>';
  const f = box.querySelector('#rq'), msg = f.querySelector('.msg'), go = f.querySelector('button');
  f.onsubmit = async ev => {
    ev.preventDefault(); msg.className = 'msg'; msg.textContent = ''; go.disabled = true;
    const fd = new FormData(f);
    const { error } = await sb.rpc('request_subscription', { p_plan: plan, p_sender: fd.get('sender').trim(), p_note: fd.get('note').trim() });
    go.disabled = false;
    if (error) { msg.textContent = /too_many_pending/.test(error.message || '') ? 'عندك طلبات لسه تحت المراجعة. استنى الرد عليها.' : 'تعذر إرسال الطلب. جرّب تاني.'; return; }
    f.reset(); msg.className = 'msg ok'; msg.textContent = 'تم استلام طلبك. هنراجع التحويل ونفعّل اشتراكك خلال 24 ساعة.';
  };
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ====== الدومين الخاص: لو الزائر داخل من دومين مربوط بموقع، نعرض الموقع على طول ======
let _dom;
async function domainSlug() {
  if (_dom !== undefined) return _dom;
  const h = location.hostname;
  if (!h || h === 'localhost' || h.endsWith('.github.io') || arr(C.PLATFORM_HOSTS).includes(h)) return (_dom = null);
  try { const { data } = await sb.rpc('slug_by_domain', { p_host: h }); _dom = typeof data === 'string' ? data : null; } catch { _dom = null; }
  return _dom;
}
