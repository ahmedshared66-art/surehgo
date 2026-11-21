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
      bar.innerHTML = '<span>إعلان: </span><a href="' + esc(location.origin + BASE) + '">' + esc(C.AD_TEXT || 'موقع مجاني من ' + C.PLATFORM_NAME) + '</a>';
      el.insertBefore(bar, el.firstChild);
    }
  } catch {}
}

// ====== الذكاء الاصطناعي في المحرر (بيستدعي Edge Function اسمها generate-site) ======
function aiAsk() {
  return new Promise(res => {
    const d = document.createElement('dialog'); d.className = 'dlg';
    d.innerHTML = '<form method="dialog"><h3>إنشاء بالذكاء الاصطناعي</h3><label>وصف نشاطك وأهم خدماتك أو منتجاتك<textarea class="rtl" name="desc" rows="4" maxlength="800"></textarea></label>' +
      '<label>نبرة الكتابة<select name="tone"><option>ودّية</option><option>رسمية</option><option>حماسية</option><option>فاخرة</option></select></label>' +
      '<label>طريقة الإضافة<select name="mode"><option value="add">إضافة لآخر الصفحة</option><option value="replace">استبدال محتوى الصفحة</option></select></label>' +
      '<div class="act"><button class="btn" value="ok">إنشاء</button><button class="btn ghost" value="no" formnovalidate>إلغاء</button></div></form>';
    document.body.appendChild(d);
    d.onclose = () => { const f = new FormData(d.querySelector('form')), ok = d.returnValue === 'ok'; d.remove(); res(ok ? { desc: String(f.get('desc') || '').trim(), tone: f.get('tone'), mode: f.get('mode') } : null); };
    d.showModal();
  });
}
function aiUndoBtn(prev, blocks, draw, st) {
  let b = document.getElementById('ai-undo');
  if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'ai-undo'; b.className = 'btn ghost'; document.getElementById('ai').after(b); }
  b.textContent = 'تراجع عن الذكاء الاصطناعي';
  b.onclick = () => { blocks.length = 0; blocks.push(...prev); draw(); st('تم التراجع. اضغط حفظ.'); b.remove(); };
}
async function aiGenerate(siteId, blocks, st, draw) {
  const ask = await aiAsk(); if (!ask) return;
  if (ask.mode === 'replace' && blocks.length && !confirm('هيتم استبدال محتوى الصفحة الحالي. تقدر تتراجع بعدها. تكمل؟')) return;
  const prompt = (ask.desc + '\nالنبرة المطلوبة: ' + ask.tone + '\nاكتب بالعربية.').trim();
  st('جاري إنشاء المحتوى بالذكاء الاصطناعي...');
  const { data, error } = await sb.functions.invoke('generate-site', { body: { site_id: siteId, prompt: prompt.slice(0, 1000), tone: ask.tone, mode: ask.mode } });
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
  const room = 40 - (ask.mode === 'replace' ? 0 : blocks.length), add = arr(data && data.blocks).filter(b => b && BLOCKS[b.type]).slice(0, Math.max(room, 0));
  if (!add.length) { st(room <= 0 ? 'وصلت للحد الأقصى (40 عنصر).' : 'مفيش محتوى جديد. جرّب تاني.'); return; }
  const prev = blocks.slice(); if (ask.mode === 'replace') blocks.length = 0;
  blocks.push(...add); draw(); aiUndoBtn(prev, blocks, draw, st);
  st('تمت إضافة ' + add.length + ' عنصر. راجعهم واضغط حفظ.');
}

// ====== الاشتراك: دفع يدوي بفودافون كاش، والتفعيل بيتم من لوحة الأدمن ======
const planLabel = p => typeof p === 'object' ? p.name : p === 'yearly' ? 'سنوي' : 'شهري';
const planPrice = p => typeof p === 'object' ? Number(p.price).toLocaleString('ar-EG') + ' جنيه' : p === 'yearly' ? C.PRICE_YEARLY : C.PRICE_MONTHLY;

const payHtml = () => {
  const plans = Array.isArray(window.APP_PLANS) ? window.APP_PLANS : [];
  const choices = plans.length ? plans.map(p => '<article class="plan-card"><h3>' + esc(p.name) + '</h3><p>' + esc(p.description) + '</p><b>' + esc(planPrice(p)) + '</b><small>لمدة ' + esc(p.duration_days) + ' يوم · ' + (p.max_sites === -1 ? 'مواقع غير محدودة' : esc(p.max_sites) + ' مواقع') + ' · ' + (p.max_products === -1 ? 'منتجات غير محدودة' : esc(p.max_products) + ' منتج') + '</small><button type="button" class="btn" data-pay="' + esc(p.id) + '">اختيار الباقة</button></article>').join('') :
    '<button type="button" class="btn" data-pay="monthly">اشترك شهري: ' + esc(C.PRICE_MONTHLY) + '</button> <button type="button" class="btn" data-pay="yearly">اشترك سنوي: ' + esc(C.PRICE_YEARLY) + '</button>';
  return '<h2>اختار اشتراكك</h2><div class="plan-choices">' + choices + '</div><div id="pay-info"></div>';
};

async function startPay(plan, btn) {
  const chosen = (window.APP_PLANS || []).find(p => p.id === plan || p.code === plan);
  const label = chosen ? chosen.name : planLabel(plan), price = chosen ? planPrice(chosen) : planPrice(plan);
  if (!confirm('هتبعت طلب اشتراك ' + label + ' (' + price + '). الاشتراك مش بيتفعّل غير بعد ما الأدمن يراجع التحويل ويوافق. تكمل؟')) return;
  const box = document.getElementById('pay-info'); if (!box) return;
  const cfg = {};
  try { const { data } = await sb.from('app_settings').select('key,value').in('key', ['vodafone_cash', 'whatsapp']); (data || []).forEach(x => cfg[x.key] = x.value); } catch {}
  const cash = String(cfg.vodafone_cash || C.VODAFONE_CASH || '').trim();
  const wa = String(cfg.whatsapp || C.WHATSAPP || '').replace(/[^0-9]/g, '');
  if (!cash || !wa) { box.innerHTML = '<p class="msg">طريقة الدفع لسه مش مجهزة من الإدارة.</p>'; return; }
  const text = 'السلام عليكم، حولت اشتراك ' + label + ' (' + price + ') على فودافون كاش.\n' +
    'الاسم: ' + (me.full_name || '') + '\nالبريد: ' + (me.email || '') + '\nالهاتف: ' + (me.phone || '');
  const link = 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);
  box.innerHTML =
    '<div style="border:1px solid var(--line);background:#fff;border-radius:8px;padding:18px;margin:14px 0;max-width:520px">' +
    '<h3 style="margin:0 0 10px">اشتراك ' + esc(label) + ': ' + esc(price) + '</h3>' +
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
    const { error } = chosen
      ? await sb.rpc('request_custom_subscription', { p_plan: chosen.id, p_sender: fd.get('sender').trim(), p_note: fd.get('note').trim() })
      : await sb.rpc('request_subscription', { p_plan: plan, p_sender: fd.get('sender').trim(), p_note: fd.get('note').trim() });
    go.disabled = false;
    if (error) { msg.textContent = /too_many_pending/.test(error.message || '') ? 'عندك طلبات لسه تحت المراجعة. استنى الرد عليها.' : 'تعذر إرسال الطلب. جرّب تاني.'; return; }
    f.reset(); msg.className = 'msg ok'; msg.textContent = 'تم استلام طلبك وهو بانتظار تأكيد الأدمن. هيتفعّل اشتراكك بعد مراجعة التحويل (خلال 24 ساعة).';
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
