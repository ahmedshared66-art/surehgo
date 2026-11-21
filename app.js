const C = window.APP_CONFIG;
const sb = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
const root = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me = null, notice = '';

const arDays = d => d === 1 ? 'يوم واحد' : d === 2 ? 'يومان' : d <= 10 ? d + ' أيام' : d + ' يوم';
const daysLeft = d => Math.ceil((new Date(d) - Date.now()) / 864e5);
const planName = p => ({trial:'تجربة مجانية', monthly:'الشهري', yearly:'السنوي'}[p] || p);
const tr = m => {
  m = m || '';
  if (m.includes('already registered')) return 'هذا البريد مسجّل بالفعل. سجّل الدخول بدل ما تنشئ حساب جديد.';
  if (m.includes('Invalid login')) return 'البريد أو كلمة المرور غير صحيحة.';
  if (m.includes('not confirmed')) return 'أكّد بريدك الإلكتروني أولاً من الرسالة اللي وصلتك.';
  if (m.includes('at least')) return 'كلمة المرور قصيرة. اكتب 8 أحرف على الأقل.';
  if (m.includes('rate limit')) return 'محاولات كتير. استنى دقائق وجرّب تاني.';
  return 'حصلت مشكلة: ' + m;
};

function status(p) {
  if (p.plan === 'trial') {
    const d = daysLeft(p.trial_ends_at);
    return d > 0 ? {ok:true, text:'متبقي ' + arDays(d) + ' من التجربة المجانية'} : {ok:false, text:'انتهت التجربة المجانية'};
  }
  if (p.plan === 'cancelled') return {ok:false, text:'الاشتراك ملغي'};
  const custom = (window.APP_PLANS || []).find(x => x.id === p.subscription_plan_id);
  const d = p.plan_ends_at ? daysLeft(p.plan_ends_at) : 0;
  return d > 0 ? {ok:true, text:'الاشتراك ' + (custom ? custom.name : planName(p.plan)) + ': متبقي ' + arDays(d)} : {ok:false, text:'انتهى الاشتراك ' + (custom ? custom.name : planName(p.plan))};
}

async function loadMe() {
  me = null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
  if (!data) return;
  if (data.is_disabled) { await sb.auth.signOut(); notice = 'تم تعطيل هذا الحساب. تواصل مع إدارة المنصة.'; return; }
  me = data;
}

function nav() {
  const currentPlan = me && (window.APP_PLANS || []).find(p => p.id === me.subscription_plan_id);
  const remaining = me ? status(me) : null;
  const links = me
    ? '<a href="#/dashboard">لوحتي</a>' + (me.role === 'super_admin' ? '<a href="#/admin">لوحة الأدمن' + (window._pc ? ' <span class="cnt">' + window._pc + '</span>' : '') + '</a><a href="#/theme">المظهر</a>' : '') + '<button id="logout" class="btn ghost">تسجيل الخروج</button>'
    : '<a href="#/login">تسجيل الدخول</a><a class="btn" href="#/signup">إنشاء حساب</a>';
  const sub = me ? '<a class="subnav" href="#/subscriptions">الاشتراك <small>' + esc(currentPlan ? currentPlan.name : (me.plan === 'trial' ? 'تجربة مجانية' : planName(me.plan))) + ' · ' + esc(remaining.text) + '</small></a>' : '';
  return '<header class="nav"><div class="nav-main"><a class="brand" href="#/">' + esc(C.PLATFORM_NAME) + '</a>' + sub + '</div><nav>' + links + '</nav></header>';
}

const TYPES = ['مطعم','متجر','شركة','عيادة','مدرسة','موقع شخصي','فندق'];
const FEATURES = [
  ['محرر بالسحب والإفلات','اسحب النص والصور والفيديو والأزرار والخرائط وضعها في أي مكان.'],
  ['إنشاء بالذكاء الاصطناعي','اكتب اسم نشاطك ووصفه ولونك المفضل، ويجهّز لك الصفحات والأقسام والألوان.'],
  ['متجر إلكتروني','منتجات وأسعار وخصومات وكوبونات وسلة شراء وإدارة الطلبات.'],
  ['حجوزات','العميل يختار التاريخ والوقت، وإشعار يوصلك فوراً.'],
  ['لوحة تحكم لكل موقع','الزوّار والطلبات والحجوزات والأرباح في مكان واحد.'],
  ['ربط واتساب وفيسبوك وإنستجرام','وتواصل مباشر مع عملائك.']
];

function home(m) {
  const settings = window.APP_SETTINGS || {}, trialDays = Number(settings.trial_days || 3), trialSites = Number(settings.trial_sites || 3);
  const catalog = Array.isArray(window.APP_PLANS) ? window.APP_PLANS.filter(p => p.active) : [];
  let cards = []; try { cards = JSON.parse(settings.home_cards || '[]'); } catch {}
  if (!Array.isArray(cards)) cards = [];
  const safeHref = x => /^(#\/|https:\/\/|mailto:|tel:)/i.test(String(x || '')) ? String(x) : '#/signup';
  const planRows = catalog.length ? catalog.map(p => '<tr><td><b>' + esc(p.name) + '</b><br><small>' + esc(p.description) + '</small></td><td>' + (p.original_price > p.price ? '<s>' + esc(p.original_price) + '</s> <b>' + esc(p.price) + ' جنيه</b> <span class="discount">خصم ' + esc(p.discount_percent) + '%</span>' : esc(p.price) + ' جنيه') + '</td><td>' + esc(p.duration_days) + ' يوم</td><td>' + (p.max_sites === -1 ? 'مواقع غير محدودة' : esc(p.max_sites) + ' مواقع') + '<br>' + (p.max_products === -1 ? 'منتجات غير محدودة' : esc(p.max_products) + ' منتج') + '</td></tr>').join('') :
    '<tr><td><b>الشهرية</b></td><td>' + esc(C.PRICE_MONTHLY) + '</td><td>30 يوم</td><td>حسب الباقة</td></tr><tr><td><b>السنوية</b></td><td>' + esc(C.PRICE_YEARLY) + '</td><td>365 يوم</td><td>حسب الباقة</td></tr>';
  m.innerHTML =
  '<section class="hero home-' + (settings.home_layout === 'center' ? 'center' : 'split') + '"><div><span class="badge">' + esc(trialDays) + ' أيام مجاناً</span><h1>' + esc(settings.hero_title || 'موقعك على الإنترنت في دقائق') + '</h1><p>' + esc(settings.hero_text || 'اختار نوع نشاطك، وابني موقعك بالسحب والإفلات أو بالذكاء الاصطناعي. من غير برمجة.') + '</p><a class="btn" href="' + esc(safeHref(settings.home_cta_url || (me ? '#/dashboard' : '#/signup'))) + '">' + esc(settings.home_cta_text || 'إنشاء موقع') + '</a></div>' +
  (settings.hero_image && /^https:\/\/[^\s"'()<>\\]+$/i.test(settings.hero_image) ? '<img class="home-hero-image" src="' + esc(settings.hero_image) + '" alt="معاينة مواقع" loading="lazy">' : '<div class="frame" aria-hidden="true"><div class="bar"></div><div class="body"><i class="h"></i><i></i><i class="s"></i><div class="drag"></div><div class="row"><i></i><i></i><i></i></div></div></div>') + '</section>' +
  (cards.length ? '<section class="home-cards">' + cards.filter(x => x && (x.title || x.image)).map(x => '<article class="home-card">' + (x.image && /^https:\/\//i.test(x.image) ? '<img src="' + esc(x.image) + '" alt="" loading="lazy">' : '') + '<div><h2>' + esc(x.title) + '</h2><p>' + esc(x.text) + '</p>' + (x.button ? '<a class="btn" href="' + esc(safeHref(x.url)) + '">' + esc(x.button) + '</a>' : '') + '</div></article>').join('') + '</section>' : '') +
  '<div class="wrap"><section><h2>اختار نوع موقعك</h2><ul class="types">' + TYPES.map(t => '<li><a href="' + (me ? '#/dashboard' : '#/signup') + '">' + t + '</a></li>').join('') + '</ul></section>' +
  '<section class="sec"><h2>المميزات</h2><ul class="feat">' + FEATURES.map(f => '<li><b>' + f[0] + '</b><span>' + f[1] + '</span></li>').join('') + '</ul></section>' +
  '<section class="sec"><h2>الباقات</h2><div class="tbl"><table class="plans"><tr><th>الباقة</th><th>السعر</th><th>المدة</th><th>عدد المواقع</th></tr>' +
  '<tr><td><b>تجربة مجانية</b></td><td>مجانًا</td><td>' + esc(trialDays) + ' أيام</td><td>' + (trialSites === -1 ? 'غير محدود' : esc(trialSites)) + ' مواقع</td></tr>' + planRows + '</table></div><p><a class="btn" href="' + (me ? '#/subscriptions' : '#/signup') + '">اختار باقتك</a></p></section></div>';
}

function signup(m) {
  m.innerHTML = '<section class="wrap"><h1>إنشاء حساب</h1><form class="card"><label>الاسم<input class="rtl" name="name" required maxlength="100" autocomplete="name"></label><label>البريد الإلكتروني<input name="email" type="email" required autocomplete="email"></label><label>رقم الهاتف<input name="phone" type="tel" required maxlength="20" autocomplete="tel"></label><label>كلمة المرور (8 أحرف على الأقل)<input name="password" type="password" required minlength="8" autocomplete="new-password"></label><label><span><input type="checkbox" required> أوافق على <a href="#/terms">شروط الاستخدام</a></span></label><button class="btn">ابدأ التجربة المجانية</button><div class="msg" role="alert"></div></form><p>عندك حساب؟ <a href="#/login">سجّل الدخول</a></p></section>';
  m.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = m.querySelector('.msg'); msg.className = 'msg'; msg.textContent = '';
    const { error } = await sb.auth.signUp({
      email: f.get('email').trim(), password: f.get('password'),
      options: { data: { full_name: f.get('name').trim(), phone: f.get('phone').trim() }, emailRedirectTo: location.origin + location.pathname }
    });
    if (error) { msg.textContent = tr(error.message); return; }
    e.target.reset(); msg.className = 'msg ok';
    msg.textContent = 'تم إنشاء الحساب. افتح بريدك واضغط رابط التأكيد، وبعدها سجّل الدخول.';
  };
}

function login(m) {
  m.innerHTML = '<section class="wrap"><h1>تسجيل الدخول</h1><form class="card"><label>البريد الإلكتروني<input name="email" type="email" required autocomplete="email"></label><label>كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label><button class="btn">دخول</button><div class="msg" role="alert"></div></form><p>مفيش حساب؟ <a href="#/signup">أنشئ حساب</a></p><p><a href="#" id="fp">نسيت كلمة المرور؟</a></p></section>';
  m.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = m.querySelector('.msg'); msg.textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
    if (error) { msg.textContent = tr(error.message); return; }
    location.hash = '#/dashboard'; route();
  };
  m.querySelector('#fp').onclick = async ev => {
    ev.preventDefault();
    const em = m.querySelector('[name=email]').value.trim(), msg = m.querySelector('.msg');
    if (!em) { msg.className = 'msg'; msg.textContent = 'اكتب بريدك الأول.'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    msg.className = error ? 'msg' : 'msg ok';
    msg.textContent = error ? tr(error.message) : 'لو البريد مسجّل هيوصلك رابط إعادة تعيين كلمة المرور.';
  };
}

const TYPE_NAMES = {restaurant:'مطعم', store:'متجر', company:'شركة', clinic:'عيادة', school:'مدرسة', personal:'موقع شخصي', hotel:'فندق'};
const TEMPLATES = {
  restaurant:[['قائمة الطعام','تعرّف على أصنافنا المميزة. تواصل معنا لمعرفة أطباق اليوم والأسعار.'],['ساعات العمل','نستقبلكم يومياً. اتصل بنا لتأكيد المواعيد.'],['احجز طاولتك','تواصل معنا هاتفياً لحجز طاولتك.']],
  store:[['منتجاتنا','تشكيلة متنوعة من المنتجات بجودة عالية. تواصل معنا للطلب والاستفسار.'],['التوصيل','نوصّل لحد بابك. اسأل عن مناطق التوصيل والمصاريف.'],['ليه تختارنا','جودة وسعر مناسب وخدمة سريعة.']],
  company:[['خدماتنا','نقدّم حلولاً متكاملة تناسب احتياج عملائنا.'],['من نحن','فريق متخصص وخبرة في مجال عملنا.'],['اطلب عرض سعر','تواصل معنا ونرد عليك في أقرب وقت.']],
  clinic:[['خدماتنا الطبية','نقدّم رعاية طبية متخصصة في بيئة مريحة.'],['مواعيد الكشف','احجز موعدك بالاتصال بنا.'],['من نحن','فريق طبي ذو خبرة يهتم براحتك.']],
  school:[['عن المدرسة','بيئة تعليمية تدعم تفوّق الطلاب وتنمّي مهاراتهم.'],['المراحل الدراسية','تعرّف على المراحل المتاحة وشروط التقديم بالتواصل معنا.'],['التقديم','للاستفسار عن التقديم تواصل مع الإدارة.']],
  personal:[['نبذة عني','مرحباً بك في موقعي الشخصي.'],['أعمالي','نماذج من أعمالي وخبراتي.'],['تواصل معي','يسعدني التواصل معك.']],
  hotel:[['غرفنا','غرف مريحة بخدمات متكاملة لإقامة هادئة.'],['المرافق','اسأل عن المرافق والخدمات المتاحة.'],['احجز إقامتك','للحجز والاستفسار تواصل معنا مباشرة.']]
};
const BASE = (() => { const p = location.pathname, i = p.indexOf('/s/'); return i >= 0 ? p.slice(0, i + 1) : p.replace(/[^/]*$/, ''); })();
const siteUrl = slug => location.origin + BASE + 's/' + slug;
const pathSlug = () => { try { const p = decodeURIComponent(location.pathname); return p.startsWith(BASE + 's/') ? p.slice(BASE.length + 2).split('/')[0].toLowerCase() : ''; } catch { return ''; } };
const safeCol = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#0B5C6B';
const lum = c => { const n = parseInt(c.slice(1), 16); return ((n >> 16) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000; };
const siteErr = (e, action = 'create') => e.code === '23505' ? 'الرابط ده مستخدم. اختار اسم تاني.'
  : e.code === '42501' ? (action === 'update' ? 'قاعدة البيانات رفضت حفظ التعديل بسبب صلاحيات الموقع. شغّل ملف إصلاح صلاحيات المواقع من Supabase ثم حدّث الصفحة.' : 'قاعدة البيانات رفضت إنشاء الموقع بسبب صلاحيات قديمة. شغّل ملف إصلاح صلاحيات المواقع من Supabase ثم حدّث الصفحة.')
  : /site_limit_reached/.test(e.message || '') ? 'وصلت للحد الأقصى لعدد المواقع في باقتك.'
  : /subscription_expired/.test(e.message || '') ? 'انتهى اشتراكك. جدّده لإنشاء موقع جديد.'
  : e.code === '23514' ? 'تأكد من البيانات: الرابط بحروف إنجليزية صغيرة وأرقام وشرطة فقط (من 3 إلى 30 حرف).'
  : 'حصلت مشكلة: ' + e.message;

async function siteView(slug) {
  const { data } = await sb.from('sites').select('*').eq('slug', slug).maybeSingle();
  if (!data) { root.innerHTML = '<main class="wrap"><h1>الموقع غير موجود</h1><p><a href="#/">الرجوع إلى ' + esc(C.PLATFORM_NAME) + '</a></p></main>'; return; }
  if (data.status === 'suspended') { root.innerHTML = '<main class="wrap"><h1>هذا الموقع موقوف</h1><p>تم إيقاف هذا الموقع من إدارة المنصة.</p></main>'; return; }
  document.title = data.name;
  const ph = (data.phone || '').replace(/[^0-9+]/g, '');
  const ST = siteTheme(data.theme);
  root.innerHTML = '<div class="site' + ST.cls + '" style="--c:' + esc(safeCol(data.color)) + ';--t:' + (lum(safeCol(data.color)) > 150 ? '#10202B' : '#fff') + esc(ST.style) + '"><header class="s-hero"><div class="s-in">' + ST.logo + '<h1>' + esc(data.name) + '</h1><p>' + esc(data.description) + '</p>' + (ph ? '<a class="s-btn" href="tel:' + ph + '">اتصل بنا</a>' : '') + '</div></header><main class="s-body">' +
    (arr(data.content).length ? arr(data.content).map(renderBlock).join('') : (TEMPLATES[data.site_type] || []).map(x => '<section><h2>' + x[0] + '</h2><p>' + x[1] + '</p></section>').join('')) + ST.gallery +
    '<div id="shop-box"></div></main><footer class="s-foot">' + (ph ? '<div dir="ltr">' + esc(ph) + '</div>' : '') + '<a href="' + esc(BASE) + '">Powered by ' + esc(C.PLATFORM_NAME) + '</a></footer></div>';
  shopSection(data);
  siteExtras(data);
  siteEnhance();
}

async function dashboard(m) {
  if (!me) { location.hash = '#/login'; return; }
  const s = status(me);
  const { data } = await sb.from('sites').select('*').eq('owner_id', me.id).order('created_at', { ascending: false });
  const sites = data || [];
  let siteLimit = me.plan === 'trial' ? Number(me.trial_site_limit ?? 3) : 3;
  if (me.subscription_plan_id) {
    const { data: activePlan } = await sb.from('subscription_plans').select('max_sites').eq('id', me.subscription_plan_id).maybeSingle();
    if (activePlan && Number.isInteger(activePlan.max_sites)) siteLimit = activePlan.max_sites;
  }
  const bonus = Number(me.site_limit_bonus || 0);
  if (bonus === -1) siteLimit = -1;
  else if (siteLimit !== -1) siteLimit += Math.max(0, bonus);
  const tp = await sb.from('site_templates').select('id,name,site_type,description,content,color,theme').eq('active', true).order('created_at');
  const tpls = tp.error ? [] : (tp.data || []);
  let pend = []; if (me.role !== 'super_admin') {
    try { pend = (await sb.from('payment_requests').select('*').eq('status', 'pending')).data || []; } catch {}
    try { pend = pend.concat((await sb.from('subscription_plan_requests').select('plan_name').eq('status', 'pending')).data || []); } catch {}
  }
  const canCreate = s.ok && (siteLimit === -1 || sites.length < siteLimit);
  m.innerHTML = '<section class="wrap"><h1>أهلاً ' + esc(me.full_name) + '</h1><div class="status ' + (s.ok ? 'on' : 'off') + '">' + esc(s.text) + '</div>' + (pend.length ? '<div class="banner pend">طلب الاشتراك' + (pend[0].plan_name || (pend[0].plan ? ' ' + planName(pend[0].plan) : '')) + ' بانتظار تأكيد الأدمن. هيتفعّل بعد مراجعة التحويل.</div>' : '') + '<p><a class="btn" href="#/subscriptions">عرض الاشتراكات وتفاصيل باقتي</a></p>' +
    '<h2>مواقعي</h2>' + (sites.length ? '<ul class="mysites">' + sites.map(x => '<li><div><b>' + esc(x.name) + '</b> <small>(' + TYPE_NAMES[x.site_type] + (x.status === 'suspended' ? ' - موقوف من الإدارة' : '') + ')</small><br><a href="' + esc(siteUrl(x.slug)) + '" target="_blank" dir="ltr">' + esc(siteUrl(x.slug)) + '</a></div><div class="act"><a class="btn sm" href="#/builder/' + x.id + '">بناء الموقع</a><a class="btn sm ghost" href="#/edit/' + x.id + '">البيانات</a><a class="btn sm ghost" href="#/manage/' + x.id + '">المتجر والطلبات</a><button class="btn sm warn" data-del="' + x.id + '">حذف</button></div></li>').join('') + '</ul>' : '<p>لسه معندكش مواقع.</p>') +
    (canCreate ? '<h2>إنشاء موقع جديد</h2><form class="card" id="nf"><label>اسم الموقع<input class="rtl" name="name" required minlength="2" maxlength="80"></label><label>الرابط (حروف إنجليزية صغيرة وأرقام وشرطة)<input name="slug" required pattern="[a-z0-9][a-z0-9\\-]{2,29}" maxlength="30" placeholder="my-restaurant"></label><label>نوع النشاط<select name="type">' + Object.keys(TYPE_NAMES).map(k => '<option value="' + k + '">' + TYPE_NAMES[k] + '</option>').join('') + '</select></label>' + (tpls.length ? '<label>ابدأ من قالب جاهز<select name="tpl"><option value="">بدون قالب (موقع فاضي)</option>' + tpls.map(t => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>').join('') + '</select></label>' : '') + '<label>وصف النشاط<textarea class="rtl" name="description" rows="3" maxlength="600"></textarea></label><label>اللون المفضل<input type="color" name="color" value="#0B5C6B"></label><label>رقم الهاتف<input name="phone" type="tel" maxlength="20"></label><button class="btn">إنشاء الموقع</button><div class="msg" role="alert"></div></form>'
      : '<p class="msg">' + (s.ok ? 'وصلت للحد الأقصى (' + (siteLimit === -1 ? 'غير محدود' : siteLimit) + ' مواقع).' : 'مينفعش تنشئ مواقع جديدة لأن التجربة أو الاشتراك انتهى.') + '</p>') + '</section>';
  const nf = m.querySelector('#nf');
  if (nf) nf.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(nf), msg = nf.querySelector('.msg'); msg.textContent = '';
    const tpl = tpls.find(t => t.id === f.get('tpl'));
    const row = { owner_id: me.id, slug: f.get('slug').trim().toLowerCase(), name: f.get('name').trim(), site_type: (tpl && tpl.site_type) || f.get('type'), description: f.get('description').trim() || (tpl && tpl.description) || '', color: f.get('color'), phone: f.get('phone').trim() };
    if (tpl) { row.content = arr(tpl.content).slice(0, 40); row.theme = tpl.theme && typeof tpl.theme === 'object' ? tpl.theme : {}; if (/^#[0-9a-f]{6}$/i.test(tpl.color || '')) row.color = tpl.color; }
    const { error } = await sb.from('sites').insert(row);
    if (error) { msg.textContent = siteErr(error); return; }
    route();
  };
  m.onclick = async e => {
    const pb = e.target.closest('[data-pay]'); if (pb) { startPay(pb.dataset.pay, pb); return; }
    const b = e.target.closest('[data-del]'); if (!b || !confirm('متأكد إنك عايز تحذف الموقع نهائياً؟')) return;
    const { error } = await sb.from('sites').delete().eq('id', b.dataset.del);
    if (error) alert(error.message); else route();
  };
}

async function editSite(m, id) {
  if (!me) { location.hash = '#/login'; return; }
  const { data } = await sb.from('sites').select('*').eq('id', id).maybeSingle();
  if (!data || (data.owner_id !== me.id && me.role !== 'super_admin')) { location.hash = '#/dashboard'; return; }
  m.innerHTML = '<section class="wrap"><h1>تعديل: ' + esc(data.name) + '</h1><form class="card"><label>اسم الموقع<input class="rtl" name="name" required minlength="2" maxlength="80" value="' + esc(data.name) + '"></label><label>وصف النشاط<textarea class="rtl" name="description" rows="3" maxlength="600">' + esc(data.description) + '</textarea></label><label>اللون المفضل<input type="color" name="color" value="' + esc(data.color) + '"></label><label>رقم الهاتف<input name="phone" type="tel" maxlength="20" value="' + esc(data.phone) + '"></label><label>واتساب (رقم بالكود الدولي من غير + مثل 201001234567)<input name="whatsapp" type="tel" maxlength="15" pattern="[0-9]{8,15}" value="' + esc(data.whatsapp) + '"></label><label>رابط فيسبوك (يبدأ بـ https)<input name="facebook" type="url" maxlength="200" value="' + esc(data.facebook) + '"></label><label>رابط إنستجرام (يبدأ بـ https)<input name="instagram" type="url" maxlength="200" value="' + esc(data.instagram) + '"></label>' + themeFields(data.theme) + '<button class="btn">حفظ التعديلات</button><div class="msg" role="alert"></div></form><p><a href="#/dashboard">الرجوع لمواقعي</a></p></section>';
  m.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = m.querySelector('.msg');
    const { error } = await sb.from('sites').update({ name: f.get('name').trim(), description: f.get('description').trim(), color: f.get('color'), phone: f.get('phone').trim(), whatsapp: f.get('whatsapp').trim(), facebook: f.get('facebook').trim(), instagram: f.get('instagram').trim(), theme: await siteThemeFrom(f, data.theme) }).eq('id', id);
    if (error) { msg.textContent = error.code === '23514' ? 'تأكد: واتساب أرقام فقط بالكود الدولي، وروابط فيسبوك وإنستجرام تبدأ بـ https://' : siteErr(error, 'update'); return; }
    location.hash = '#/dashboard';
  };
}

async function admin(m) {
  if (!me || me.role !== 'super_admin') { location.hash = '#/'; return; }
  const [u, st, pr, ss, tp, pl, lib, cpr] = await Promise.all([
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('sites').select('*').order('created_at', { ascending: false }),
    sb.from('payment_requests').select('*').order('created_at', { ascending: true }),
    sb.from('app_settings').select('*'),
    sb.from('site_templates').select('*').order('created_at', { ascending: false }),
    sb.from('subscription_plans').select('*').order('sort_order').order('created_at'),
    sb.from('site_asset_library').select('*').order('created_at', { ascending: false }),
    sb.from('subscription_plan_requests').select('*').eq('status', 'pending').order('created_at')
  ]);
  if (u.error || st.error) { m.innerHTML = '<section class="wrap"><div class="msg">' + esc((u.error || st.error).message) + '</div></section>'; return; }
  const users = u.data, sites = st.data, email = {};
  users.forEach(x => email[x.id] = x.email);
  const allReq = pr && !pr.error ? pr.data : [], reqs = allReq.filter(x => x.status === 'pending'), byId = {};
  const revenue = allReq.filter(x => x.status === 'approved').reduce((t, x) => t + Number(x.amount), 0);
  const cfg = {}; ((ss && !ss.error && ss.data) || []).forEach(x => cfg[x.key] = x.value);
  const firstUser = users.length ? new Date(Math.min(...users.map(x => +new Date(x.created_at)))) : new Date();
  const launch = cfg.launch_date && !isNaN(new Date(cfg.launch_date)) ? new Date(cfg.launch_date) : firstUser;
  const runDays = Math.max(0, Math.floor((Date.now() - launch) / 864e5));
  const runTxt = runDays === 0 ? 'من النهاردة' : arDays(runDays);
  const tpls = tp && !tp.error ? tp.data : [];
  const plans = pl && !pl.error ? pl.data : [];
  const assets = lib && !lib.error ? lib.data : [];
  const planHtml = '<h2>إضافة باقة</h2>' + (pl && pl.error ? '<p class="msg">شغّل ملف SQL الخاص بالباقات أولًا.</p>' : '') +
    '<form class="card" id="planf"><label>اسم الباقة<input name="name" required maxlength="80" placeholder="مثال: باقة المتجر"></label>' +
    '<label>كود داخلي (إنجليزي وأرقام وشرطة)<input name="code" required pattern="[a-z0-9][a-z0-9-]{1,39}" maxlength="40" placeholder="store-pro"></label>' +
    '<label>وصف ومميزات الباقة<textarea class="rtl" name="description" rows="3" maxlength="500" placeholder="اكتب للعميل ما الذي تتضمنه الباقة"></textarea></label>' +
    '<div class="thg"><label>السعر قبل الخصم<input name="original_price" type="number" min="0" step="0.01" value="0" required></label><label>نسبة الخصم %<input name="discount_percent" type="number" min="0" max="100" value="0" required></label><label>السعر بعد الخصم<input name="price" type="number" readonly></label><label>مدة الباقة بالأيام<input name="duration_days" type="number" min="1" max="3650" value="30" required></label>' +
    '<label>عدد المواقع المسموح (-1 = غير محدود)<input name="max_sites" type="number" min="-1" value="1" required></label><label>عدد المنتجات لكل موقع (-1 = غير محدود)<input name="max_products" type="number" min="-1" value="0" required></label></div>' +
    '<button class="btn">إضافة الباقة</button></form><h2>الباقات الحالية</h2>' + (plans.length ? '<div class="tbl"><table><tr><th>الباقة</th><th>السعر والخصم</th><th>المدة</th><th>حد الاستخدام</th><th>الحالة</th><th></th></tr>' + plans.map(x => '<tr><td><b>' + esc(x.name) + '</b><br><small>' + esc(x.description) + '</small></td><td>' + (x.original_price > x.price ? '<s>' + esc(x.original_price) + '</s> خصم ' + esc(x.discount_percent) + '%<br><b>' + esc(x.price) + ' جنيه</b>' : esc(x.price) + ' جنيه') + '</td><td>' + esc(x.duration_days) + ' يوم</td><td>' + (x.max_sites === -1 ? 'مواقع غير محدودة' : esc(x.max_sites) + ' مواقع') + '<br>' + (x.max_products === -1 ? 'منتجات غير محدودة' : esc(x.max_products) + ' منتجات') + '</td><td>' + (x.active ? 'متاحة' : 'مخفية') + '</td><td><button type="button" class="btn sm" data-a="pedit" data-id="' + esc(x.id) + '">تعديل</button> <button type="button" class="btn sm ghost" data-a="pact" data-id="' + esc(x.id) + '" data-v="' + !x.active + '">' + (x.active ? 'إخفاء' : 'إظهار') + '</button> <button type="button" class="btn sm warn" data-a="pdel" data-id="' + esc(x.id) + '">حذف</button></td></tr>').join('') + '</table></div>' : '<p>لسه مفيش باقات.</p>');
  const assetHtml = '<h2>مكتبة صور المواقع</h2><p class="hint">ارفع الصور مرة واحدة، وهتظهر لصاحب الموقع في قائمة الاختيار داخل البنّاء.</p>' +
    '<form class="card" id="assetf"><label>اسم الصورة<input name="title" required maxlength="100"></label><label>القسم<input name="category" maxlength="50" placeholder="مطاعم، أزياء، خلفيات"></label><label>الصورة<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required></label><button class="btn">رفع وإضافة للمكتبة</button></form>' +
    (lib && lib.error ? '<p class="msg">شغّل ملف SQL الخاص بالمكتبة أولًا.</p>' : assets.length ? '<div class="tbl"><table><tr><th>معاينة</th><th>الاسم</th><th>القسم</th><th>الحالة</th><th>إجراء</th></tr>' + assets.map(x => '<tr><td><img src="' + esc(x.url) + '" alt="" style="width:72px;height:52px;object-fit:cover;border-radius:8px"></td><td>' + esc(x.title) + '</td><td>' + esc(x.category) + '</td><td>' + (x.active ? 'متاحة' : 'مخفية') + '</td><td class="act"><button class="btn sm ghost" data-a="alib" data-id="' + esc(x.id) + '" data-v="' + !x.active + '">' + (x.active ? 'إخفاء' : 'إظهار') + '</button><button class="btn sm warn" data-a="adel" data-id="' + esc(x.id) + '">حذف</button></td></tr>').join('') + '</table></div>' : '<p>مكتبة الصور فاضية.</p>');
  const tplHtml = '<h2>القوالب</h2><p class="hint">عشان تضيف قالب جديد: ابني موقع بالبنّاء زي ما تحب، وبعدين من تبويب المواقع اضغط <b>حفظ كقالب</b>. القالب بيظهر للمستخدمين وهم بينشئوا موقع جديد.</p>' +
    (tp && tp.error ? '<p class="msg">تأكد إنك شغّلت SQL التحكم الكامل.</p>' : tpls.length ?
    '<div class="tbl"><table><tr><th>الاسم</th><th>النوع</th><th>عدد العناصر</th><th>الحالة</th><th>إجراءات</th></tr>' +
    tpls.map(x => '<tr><td>' + esc(x.name) + '</td><td>' + esc(TYPE_NAMES[x.site_type] || '') + '</td><td>' + arr(x.content).length + '</td><td>' + (x.active ? 'ظاهر' : 'مخفي') + '</td><td class="act"><button class="btn sm ghost" data-a="tact" data-id="' + esc(x.id) + '" data-v="' + !x.active + '">' + (x.active ? 'إخفاء' : 'إظهار') + '</button><button class="btn sm warn" data-a="tdel" data-id="' + esc(x.id) + '">حذف</button></td></tr>').join('') + '</table></div>'
    : '<p>لسه مفيش قوالب.</p>');
  const TABS = [['req', 'طلبات الاشتراك (' + reqs.length + ')'], ['users', 'المستخدمون'], ['plans', 'الباقات'], ['assets', 'مكتبة الصور'], ['sites', 'المواقع'], ['tpl', 'القوالب'], ['set', 'الإعدادات']];
  let curTab = window._adminTab || (reqs.length ? 'req' : 'users');
  if (!TABS.some(t => t[0] === curTab)) curTab = 'users';
  const tabsNav = '<nav class="atabs" style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 20px">' +
    TABS.map(t => '<button type="button" class="btn sm' + (t[0] === curTab ? '' : ' ghost') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') + '</nav>';
  let homeCardsCfg = []; try { homeCardsCfg = JSON.parse(cfg.home_cards || '[]'); } catch {} if (!Array.isArray(homeCardsCfg)) homeCardsCfg = [];
  const setHtml = '<h2>الإعدادات</h2>' + (ss && ss.error ? '<p class="msg">تأكد إنك شغّلت SQL الإعدادات.</p>' : '') +
    '<form class="card" id="setf"><label>رقم فودافون كاش (اللي العميل بيحوّل عليه)<input name="cash" type="tel" required maxlength="20" value="' + esc(cfg.vodafone_cash || C.VODAFONE_CASH || '') + '"></label>' +
    '<label>رقم واتساب (بالشكل 01xxxxxxxxx)<input name="wa" type="tel" required maxlength="20" value="' + esc(cfg.whatsapp || C.WHATSAPP || '') + '"></label>' +
    '<label>تاريخ بداية تشغيل الموقع<input name="launch" type="date" required value="' + launch.toISOString().slice(0, 10) + '"></label>' +
    '<h3>التجربة المجانية الافتراضية للحسابات الجديدة</h3><div class="thg"><label>مدتها بالأيام<input name="trial_days" type="number" min="1" max="365" value="' + esc(cfg.trial_days || '3') + '" required></label><label>عدد المواقع (-1 = غير محدود)<input name="trial_sites" type="number" min="-1" value="' + esc(cfg.trial_sites || '3') + '" required></label></div>' +
    '<label>عنوان الصفحة الرئيسية<input class="rtl" name="ht" maxlength="120" value="' + esc(cfg.hero_title || '') + '" placeholder="موقعك على الإنترنت في دقائق"></label>' +
    '<label>وصف الصفحة الرئيسية<textarea class="rtl" name="hx" rows="2" maxlength="300" placeholder="اتركه فاضي لاستخدام النص الافتراضي">' + esc(cfg.hero_text || '') + '</textarea></label>' +
    '<div class="thg"><label>شكل مقدمة الصفحة<select name="home_layout"><option value="split"' + (cfg.home_layout === 'center' ? '' : ' selected') + '>نص وصورة</option><option value="center"' + (cfg.home_layout === 'center' ? ' selected' : '') + '>نص بالمنتصف</option></select></label><label>نص زر المقدمة<input name="home_cta_text" value="' + esc(cfg.home_cta_text || 'إنشاء موقع') + '" maxlength="50"></label><label>رابط زر المقدمة<input dir="ltr" name="home_cta_url" value="' + esc(cfg.home_cta_url || '#/signup') + '" maxlength="300"></label><label>الصورة الرئيسية<input name="home_img" type="file" accept="image/jpeg,image/png,image/webp">' + (cfg.hero_image ? '<small>فيه صورة محفوظة حاليًا.</small>' : '') + '</label></div>' +
    '<h3>بطاقات الصفحة الرئيسية (صور وروابط)</h3>' + [1,2,3].map(i => { const c = homeCardsCfg[i-1] || {}; return '<fieldset class="home-card-fields"><legend>بطاقة ' + i + '</legend><label>العنوان<input name="hc_title' + i + '" value="' + esc(c.title || '') + '" maxlength="80"></label><label>الوصف<input name="hc_text' + i + '" value="' + esc(c.text || '') + '" maxlength="180"></label><label>رابط الصورة (اختياري)<input dir="ltr" name="hc_image' + i + '" value="' + esc(c.image || '') + '"></label><label>أو ارفع صورة<input name="hc_file' + i + '" type="file" accept="image/jpeg,image/png,image/webp"></label><div class="thg"><label>نص الزر<input name="hc_button' + i + '" value="' + esc(c.button || '') + '" maxlength="50"></label><label>رابط الزر<input dir="ltr" name="hc_url' + i + '" value="' + esc(c.url || '') + '" maxlength="300"></label></div></fieldset>'; }).join('') +
    '<label>نص الإعلان على المواقع المجانية<input class="rtl" name="ad" maxlength="200" value="' + esc(cfg.ad_text || C.AD_TEXT || '') + '"></label>' +
    '<button class="btn">حفظ الإعدادات</button></form>';
  users.forEach(x => byId[x.id] = x);
  const reqHtml = '<h2>طلبات الاشتراك (' + reqs.length + ')</h2>' + (pr && pr.error ? '<p class="msg">تأكد إنك شغّلت SQL طلبات الاشتراك.</p>' : reqs.length ?
    '<div class="tbl"><table><tr><th>التاريخ</th><th>العميل</th><th>الهاتف</th><th>الباقة</th><th>المبلغ</th><th>حوّل من رقم</th><th>ملاحظة</th><th>إجراءات</th></tr>' +
    reqs.map(x => { const w = byId[x.user_id] || {}, y = x.plan === 'yearly', p = plans.find(z => z.code === x.plan);
      return '<tr><td>' + new Date(x.created_at).toLocaleString('ar-EG') + '</td><td>' + esc(w.full_name) + '<br><small dir="ltr">' + esc(w.email) + '</small></td><td dir="ltr">' + esc(w.phone) + '</td><td>' + esc(p ? p.name : (y ? 'سنوي' : 'شهري')) + '</td><td>' + esc(x.amount) + ' جنيه</td><td dir="ltr">' + esc(x.sender_phone) + '</td><td style="white-space:normal">' + esc(x.note) + '</td><td class="act"><button class="btn sm" data-a="rok" data-id="' + esc(x.id) + '" data-u="' + esc(x.user_id) + '" data-p="' + (y ? 'yearly' : 'monthly') + '"' + (p ? ' data-pid="' + esc(p.id) + '"' : '') + ' data-d="' + (p ? p.duration_days : (y ? 365 : 30)) + '">تفعيل</button><button class="btn sm warn" data-a="rno" data-id="' + esc(x.id) + '">رفض</button></td></tr>'; }).join('') + '</table></div>'
    : '<p>مفيش طلبات جديدة.</p>');
  const customReqs = cpr && !cpr.error ? cpr.data : [];
  const customReqHtml = '<h2>طلبات الباقات المضافة (' + customReqs.length + ')</h2>' + (cpr && cpr.error ? '<p class="hint">طلبات الباقات الجديدة هتظهر بعد تشغيل SQL التحديث.</p>' : customReqs.length ?
    '<div class="tbl"><table><tr><th>التاريخ</th><th>العميل</th><th>الباقة</th><th>المبلغ</th><th>حوّل من رقم</th><th>ملاحظة</th><th>إجراء</th></tr>' + customReqs.map(x => { const w = byId[x.user_id] || {}; return '<tr><td>' + new Date(x.created_at).toLocaleString('ar-EG') + '</td><td>' + esc(w.full_name) + '<br><small dir="ltr">' + esc(w.email) + '</small></td><td>' + esc(x.plan_name) + '</td><td>' + esc(x.amount) + ' جنيه</td><td dir="ltr">' + esc(x.sender_phone) + '</td><td>' + esc(x.note) + '</td><td class="act"><button class="btn sm" data-a="crok" data-id="' + esc(x.id) + '" data-u="' + esc(x.user_id) + '" data-pid="' + esc(x.plan_id) + '">تأكيد وتفعيل</button><button class="btn sm warn" data-a="crno" data-id="' + esc(x.id) + '">رفض</button></td></tr>'; }).join('') + '</table></div>' : '<p>مفيش طلبات معلقة.</p>');
  const paid = users.filter(x => x.plan !== 'trial' && x.plan_ends_at && daysLeft(x.plan_ends_at) > 0).length;
  m.innerHTML = '<section class="wrap" style="max-width:1200px"><h1>لوحة الأدمن</h1><div class="stats"><div>المستخدمين: <b>' + users.length + '</b></div><div>مشتركين حالياً: <b>' + paid + '</b></div><div>معطّلين: <b>' + users.filter(x => x.is_disabled).length + '</b></div><div>المواقع: <b>' + sites.length + '</b></div><div>طلبات اشتراك معلّقة: <b>' + reqs.length + '</b></div><div>إيرادات مؤكدة: <b>' + revenue.toLocaleString('ar-EG') + ' جنيه</b></div><div>المنصة شغالة بقالها: <b>' + runTxt + '</b></div></div><div class="msg" id="amsg" role="alert"></div>' +
    tabsNav + '<div class="tab" id="t-set" hidden>' + setHtml + '</div><div class="tab" id="t-plans" hidden>' + planHtml + '</div><div class="tab" id="t-assets" hidden>' + assetHtml + '</div><div class="tab" id="t-tpl" hidden>' + tplHtml + '</div><div class="tab" id="t-req" hidden>' + reqHtml + customReqHtml + '</div>' +
    '<div class="tab" id="t-users" hidden><h2>المستخدمين</h2><div class="tbl"><table><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الباقة</th><th>الحالة</th><th>تاريخ التسجيل</th><th>إجراءات</th></tr>' +
    users.map(x => '<tr><td>' + esc(x.full_name) + '</td><td dir="ltr">' + esc(x.email) + '</td><td dir="ltr">' + esc(x.phone) + '</td><td>' + esc((plans.find(p => p.id === x.subscription_plan_id) || {}).name || planName(x.plan)) + (x.role === 'super_admin' ? ' (أدمن)' : '') + '</td><td>' + esc(status(x).text) + (x.is_disabled ? ' - معطّل' : '') + '</td><td>' + new Date(x.created_at).toLocaleDateString('ar-EG') + '</td><td class="act">' +
    (x.id === me.id ? '' : '<button class="btn sm ' + (x.is_disabled ? '' : 'warn') + '" data-a="dis" data-id="' + x.id + '" data-v="' + !x.is_disabled + '">' + (x.is_disabled ? 'تفعيل الحساب' : 'تعطيل') + '</button><button class="btn sm warn" data-a="udel" data-id="' + x.id + '" data-email="' + esc(x.email) + '">حذف الحساب</button>') +
    '<button class="btn sm" data-a="assign" data-id="' + x.id + '">إسناد باقة</button>' + (x.subscription_plan_id ? '<button class="btn sm ghost" data-a="renew" data-id="' + x.id + '" data-pid="' + esc(x.subscription_plan_id) + '">تجديد وإضافة أيام</button>' : '') + '<button class="btn sm ghost" data-a="bonus" data-id="' + x.id + '" data-bonus="' + Number(x.site_limit_bonus || 0) + '">زيادة حد المواقع (' + Number(x.site_limit_bonus || 0) + ')</button>' + (x.plan !== 'trial' && x.plan_ends_at && daysLeft(x.plan_ends_at) > 0 ? '<button class="btn sm warn" data-a="cancel" data-id="' + x.id + '">إلغاء الاشتراك</button>' : '') + '<button class="btn sm ghost" data-a="plan" data-id="' + x.id + '" data-p="trial" data-d="' + esc(cfg.trial_days || '3') + '">تجربة +' + esc(cfg.trial_days || '3') + ' أيام</button></td></tr>').join('') + '</table></div>' +
    '</div><div class="tab" id="t-sites" hidden><h2>المواقع</h2><div class="tbl"><table><tr><th>الموقع</th><th>الرابط</th><th>النوع</th><th>صاحب الموقع</th><th>الحالة</th><th>إجراءات</th></tr>' +
    (sites.length ? sites.map(x => '<tr><td>' + esc(x.name) + '</td><td><a href="' + esc(siteUrl(x.slug)) + '" target="_blank" dir="ltr">' + esc(x.slug) + '</a></td><td>' + TYPE_NAMES[x.site_type] + '</td><td dir="ltr">' + esc(email[x.owner_id] || '') + '</td><td>' + (x.status === 'active' ? 'شغال' : 'موقوف') + '</td><td class="act"><a class="btn sm" href="#/builder/' + esc(x.id) + '">تعديل بالماوس</a><button class="btn sm ' + (x.status === 'active' ? 'warn' : '') + '" data-a="site" data-id="' + x.id + '" data-s="' + (x.status === 'active' ? 'suspended' : 'active') + '">' + (x.status === 'active' ? 'إيقاف' : 'تشغيل') + '</button><button class="btn sm ghost" data-a="move" data-id="' + esc(x.id) + '">نقل الملكية</button><button class="btn sm ghost" data-a="tpl" data-id="' + x.id + '">حفظ كقالب</button><button class="btn sm warn" data-a="sdel" data-id="' + x.id + '">حذف الموقع</button></td></tr>').join('') : '<tr><td colspan="6">مفيش مواقع لسه.</td></tr>') + '</table></div></div></section>';
  const showTab = t => {
    window._adminTab = t;
    m.querySelectorAll('.tab').forEach(d => d.hidden = d.id !== 't-' + t);
    m.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('ghost', b.dataset.tab !== t));
  };
  showTab(curTab);
  m.querySelector('.atabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  m.querySelector('#setf').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = document.getElementById('amsg'); msg.textContent = '';
    const cash = String(f.get('cash')).replace(/[^0-9]/g, '');
    let wa = String(f.get('wa')).replace(/[^0-9]/g, '');
    if (wa.startsWith('0') && wa.length === 11) wa = '20' + wa.slice(1);
    if (cash.length < 8 || cash.length > 15 || wa.length < 10 || wa.length > 15) { msg.textContent = 'راجع الأرقام اللي كتبتها.'; return; }
    const trialDays = +f.get('trial_days'), trialSites = +f.get('trial_sites');
    if (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365 || !Number.isInteger(trialSites) || trialSites < -1) { msg.textContent = 'راجع مدة التجربة وحد المواقع.'; return; }
    let heroImage = cfg.hero_image || '';
    const heroFile = f.get('home_img');
    if (heroFile && heroFile.size) { try { heroImage = await uploadFile(heroFile, ['image']); } catch (er) { msg.textContent = er.message; return; } }
    const homeCards = [];
    for (const i of [1,2,3]) {
      const c = { title: String(f.get('hc_title' + i) || '').trim(), text: String(f.get('hc_text' + i) || '').trim(), image: String(f.get('hc_image' + i) || '').trim(), button: String(f.get('hc_button' + i) || '').trim(), url: String(f.get('hc_url' + i) || '').trim() };
      const file = f.get('hc_file' + i);
      if (file && file.size) { try { c.image = await uploadFile(file, ['image']); } catch (er) { msg.textContent = er.message; return; } }
      if (c.title || c.image || c.text) homeCards.push(c);
    }
    const now = new Date().toISOString();
    const r = await sb.from('app_settings').upsert([
      { key: 'trial_days', value: String(trialDays), updated_at: now },
      { key: 'trial_sites', value: String(trialSites), updated_at: now },
      { key: 'hero_title', value: String(f.get('ht')).trim(), updated_at: now },
      { key: 'hero_text', value: String(f.get('hx')).trim(), updated_at: now },
      { key: 'hero_image', value: heroImage, updated_at: now },
      { key: 'home_layout', value: String(f.get('home_layout')), updated_at: now },
      { key: 'home_cta_text', value: String(f.get('home_cta_text')).trim(), updated_at: now },
      { key: 'home_cta_url', value: String(f.get('home_cta_url')).trim(), updated_at: now },
      { key: 'home_cards', value: JSON.stringify(homeCards), updated_at: now },
      { key: 'ad_text', value: String(f.get('ad')).trim(), updated_at: now },
      { key: 'vodafone_cash', value: cash, updated_at: now },
      { key: 'whatsapp', value: wa, updated_at: now },
      { key: 'launch_date', value: new Date(f.get('launch') + 'T00:00:00').toISOString(), updated_at: now }
    ], { onConflict: 'key' });
    if (r.error) { msg.textContent = r.error.message; return; }
    route();
  };
  const pf = m.querySelector('#planf');
  if (pf) {
    const recalcPrice = () => { const base = Math.max(+pf.elements.original_price.value || 0, 0), pct = Math.min(Math.max(+pf.elements.discount_percent.value || 0, 0), 100); pf.elements.price.value = (base * (1 - pct / 100)).toFixed(2); };
    pf.addEventListener('input', recalcPrice); recalcPrice();
  }
  if (pf) pf.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(pf), msg = document.getElementById('amsg');
    const row = { name: String(f.get('name')).trim(), code: String(f.get('code')).trim().toLowerCase(), description: String(f.get('description')).trim(), original_price: +f.get('original_price'), discount_percent: +f.get('discount_percent'), price: +f.get('price'), duration_days: +f.get('duration_days'), max_sites: +f.get('max_sites'), max_products: +f.get('max_products'), features: [], active: true, sort_order: plans.length + 1 };
    const { error } = await sb.from('subscription_plans').insert(row);
    if (error) { msg.textContent = 'تعذر إضافة الباقة: ' + error.message; return; }
    window._adminTab = 'plans'; route();
  };
  const af = m.querySelector('#assetf');
  if (af) af.onsubmit = async e => {
    e.preventDefault(); const f = new FormData(af), msg = document.getElementById('amsg'), file = f.get('image');
    msg.textContent = '';
    try {
      const url = await uploadFile(file, ['image']);
      const { error } = await sb.from('site_asset_library').insert({ title: String(f.get('title')).trim(), category: String(f.get('category')).trim(), url, active: true, created_by: me.id });
      if (error) { msg.textContent = 'رُفعت الصورة لكن تعذرت إضافتها للمكتبة: ' + error.message; return; }
      window._adminTab = 'assets'; route();
    } catch (er) { msg.textContent = er.message; }
  };
  m.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const msg = document.getElementById('amsg'); msg.textContent = '';
    const a = b.dataset.a; let r;
    if (a === 'dis') r = await sb.rpc('admin_set_disabled', { target: b.dataset.id, disabled: b.dataset.v === 'true' });
    else if (a === 'bonus') {
      const raw = prompt('عدد المواقع الإضافية لهذا الحساب. اكتب -1 لجعله غير محدود:', b.dataset.bonus || '0'); if (raw === null) return;
      const n = Number(raw); if (!Number.isInteger(n) || n < -1) { msg.textContent = 'اكتب صفرًا أو رقمًا موجبًا، أو -1 لغير محدود.'; return; }
      r = await sb.rpc('admin_set_site_limit_bonus', { p_target: b.dataset.id, p_bonus: n });
    }
    else if (a === 'cancel') { if (!confirm('إلغاء اشتراك هذا العميل الآن؟ سيظل حسابه ومواقعه موجودة، لكن لن يستطيع إنشاء مواقع جديدة.')) return; r = await sb.rpc('admin_cancel_subscription', { p_target: b.dataset.id }); }
    else if (a === 'pedit') {
      const p = plans.find(x => x.id === b.dataset.id); if (!p) return;
      const name = prompt('اسم الباقة:', p.name); if (name === null) return;
      const description = prompt('الوصف والمميزات:', p.description || ''); if (description === null) return;
      const original_price = Number(prompt('السعر قبل الخصم:', String(p.original_price ?? p.price))); if (!Number.isFinite(original_price) || original_price < 0) { msg.textContent = 'السعر غير صحيح.'; return; }
      const discount_percent = Number(prompt('الخصم بالنسبة المئوية (0 إلى 100):', String(p.discount_percent || 0))); if (!Number.isInteger(discount_percent) || discount_percent < 0 || discount_percent > 100) { msg.textContent = 'نسبة الخصم لازم تكون من 0 إلى 100.'; return; }
      const price = +(original_price * (1 - discount_percent / 100)).toFixed(2);
      const duration_days = Number(prompt('مدة الاشتراك بالأيام:', String(p.duration_days))); if (!Number.isInteger(duration_days) || duration_days < 1 || duration_days > 3650) { msg.textContent = 'المدة لازم تكون من يوم إلى 3650 يوم.'; return; }
      const max_sites = Number(prompt('عدد المواقع (-1 لغير محدود):', String(p.max_sites))); if (!Number.isInteger(max_sites) || max_sites < -1) { msg.textContent = 'حد المواقع غير صحيح.'; return; }
      const max_products = Number(prompt('عدد المنتجات (-1 لغير محدود):', String(p.max_products))); if (!Number.isInteger(max_products) || max_products < -1) { msg.textContent = 'حد المنتجات غير صحيح.'; return; }
      r = await sb.from('subscription_plans').update({ name: name.trim(), description: description.trim(), original_price, discount_percent, price, duration_days, max_sites, max_products, updated_at: new Date().toISOString() }).eq('id', p.id);
      if (!r.error) window._adminTab = 'plans';
    }
    else if (a === 'pdel') { if (!confirm('حذف الباقة نهائيًا؟ لو عليها حسابات مشتركة، لازم تخفيها بدل حذفها.')) return; r = await sb.rpc('admin_delete_subscription_plan', { p_plan: b.dataset.id }); if (!r.error) window._adminTab = 'plans'; }
    else if (a === 'pact') { r = await sb.from('subscription_plans').update({ active: b.dataset.v === 'true', updated_at: new Date().toISOString() }).eq('id', b.dataset.id); if (!r.error) window._adminTab = 'plans'; }
    else if (a === 'alib') { r = await sb.from('site_asset_library').update({ active: b.dataset.v === 'true' }).eq('id', b.dataset.id); if (!r.error) window._adminTab = 'assets'; }
    else if (a === 'adel') { if (!confirm('حذف الصورة من مكتبة الاختيار؟ المواقع التي تستخدمها حاليًا لن تتأثر.')) return; r = await sb.from('site_asset_library').delete().eq('id', b.dataset.id); if (!r.error) window._adminTab = 'assets'; }
    else if (a === 'udel') { if (!confirm('حذف حساب ' + b.dataset.email + ' نهائيًا مع كل مواقعه؟ لا يمكن التراجع عن الحذف.')) return; r = await sb.rpc('admin_delete_customer', { p_target: b.dataset.id }); }
    else if (a === 'move') {
      const emailTo = (prompt('اكتب بريد صاحب الموقع الجديد:') || '').trim().toLowerCase(); if (!emailTo) return;
      const target = users.find(x => String(x.email || '').toLowerCase() === emailTo);
      if (!target) { msg.textContent = 'مفيش حساب بهذا البريد.'; return; }
      if (!confirm('نقل ملكية الموقع إلى ' + emailTo + '؟')) return;
      r = await sb.rpc('admin_transfer_site', { p_site: b.dataset.id, p_new_owner: target.id });
    }
    else if (a === 'assign') {
      if (!plans.length) { msg.textContent = 'أضف باقة أولًا من تبويب الباقات.'; return; }
      const menu = plans.filter(p => p.active).map((p, i) => (i + 1) + ') ' + p.name + ' — ' + p.duration_days + ' يوم').join('\n');
      const choice = prompt('اختار رقم الباقة:\n' + menu); if (choice === null) return;
      const p = plans.filter(x => x.active)[Number(choice) - 1]; if (!p) { msg.textContent = 'رقم الباقة غير صحيح.'; return; }
      const rawDays = prompt('مدة الاشتراك بالأيام:', String(p.duration_days)); if (rawDays === null) return;
      const days = Number(rawDays); if (!Number.isInteger(days) || days < 1 || days > 3650) { msg.textContent = 'اكتب مدة صحيحة من يوم إلى 3650 يوم.'; return; }
      r = await sb.rpc('admin_assign_subscription', { p_target: b.dataset.id, p_plan: p.id, p_days: days });
    }
    else if (a === 'renew') {
      const p = plans.find(x => x.id === b.dataset.pid);
      if (!p) { msg.textContent = 'الباقة الحالية غير موجودة؛ استخدم إسناد باقة لاختيار باقة جديدة.'; return; }
      const rawDays = prompt('عدد الأيام التي ستضاف فوق المدة المتبقية:', String(p.duration_days)); if (rawDays === null) return;
      const days = Number(rawDays); if (!Number.isInteger(days) || days < 1 || days > 3650) { msg.textContent = 'اكتب مدة صحيحة من يوم إلى 3650 يوم.'; return; }
      if (!confirm('إضافة ' + days + ' يومًا إلى اشتراك ' + p.name + '؟')) return;
      r = await sb.rpc('admin_assign_subscription', { p_target: b.dataset.id, p_plan: p.id, p_days: days });
    }
    else if (a === 'plan') r = b.dataset.p === 'trial'
      ? await sb.rpc('admin_clear_subscription', { p_target: b.dataset.id, p_days: +b.dataset.d })
      : await sb.rpc('admin_set_plan', { target: b.dataset.id, new_plan: b.dataset.p, days: +b.dataset.d });
    else if (a === 'rok') {
      r = b.dataset.pid
        ? await sb.rpc('admin_assign_subscription', { p_target: b.dataset.u, p_plan: b.dataset.pid, p_days: +b.dataset.d })
        : await sb.rpc('admin_set_plan', { target: b.dataset.u, new_plan: b.dataset.p, days: +b.dataset.d });
      if (!r.error) r = await sb.from('payment_requests').update({ status: 'approved', handled_at: new Date().toISOString() }).eq('id', b.dataset.id);
    }
    else if (a === 'crok') {
      const p = plans.find(x => x.id === b.dataset.pid);
      if (!p) { msg.textContent = 'الباقة دي مش موجودة أو اتمسحت.'; return; }
      r = await sb.rpc('admin_assign_subscription', { p_target: b.dataset.u, p_plan: p.id, p_days: p.duration_days });
      if (!r.error) r = await sb.from('subscription_plan_requests').update({ status: 'approved', handled_at: new Date().toISOString() }).eq('id', b.dataset.id);
    }
    else if (a === 'crno') r = await sb.from('subscription_plan_requests').update({ status: 'rejected', handled_at: new Date().toISOString() }).eq('id', b.dataset.id);
    else if (a === 'tpl') {
      const sx = sites.find(z => z.id === b.dataset.id), nm = sx && prompt('اسم القالب:', sx.name);
      if (!nm || !nm.trim()) return;
      r = await sb.from('site_templates').insert({ name: nm.trim().slice(0, 80), site_type: sx.site_type, description: sx.description || '', color: sx.color, content: arr(sx.content) });
      if (!r.error) window._adminTab = 'tpl';
    }
    else if (a === 'tact') r = await sb.from('site_templates').update({ active: b.dataset.v === 'true' }).eq('id', b.dataset.id);
    else if (a === 'tdel') { if (!confirm('حذف القالب؟')) return; r = await sb.from('site_templates').delete().eq('id', b.dataset.id); }
    else if (a === 'rno') r = await sb.from('payment_requests').update({ status: 'rejected', handled_at: new Date().toISOString() }).eq('id', b.dataset.id);
    else if (a === 'site') r = await sb.rpc('admin_set_site_status', { target: b.dataset.id, new_status: b.dataset.s });
    else if (a === 'sdel') { if (!confirm('حذف الموقع نهائياً؟')) return; r = await sb.from('sites').delete().eq('id', b.dataset.id); }
    else return;
    if (r.error) { msg.textContent = r.error.message; return; }
    route();
  };
}

const BLOCKS = {
  heading:{n:'عنوان', d:() => ({type:'heading', text:'عنوان جديد'})},
  text:{n:'نص', d:() => ({type:'text', text:'اكتب النص هنا'})},
  image:{n:'صورة', d:() => ({type:'image', url:'', alt:''})},
  video:{n:'فيديو', d:() => ({type:'video', url:''})},
  button:{n:'زر', d:() => ({type:'button', label:'تواصل معنا', url:''})},
  gallery:{n:'معرض صور', d:() => ({type:'gallery', urls:[]})},
  faq:{n:'أسئلة شائعة', d:() => ({type:'faq', items:[{q:'', a:''}]})},
  reviews:{n:'تقييمات', d:() => ({type:'reviews', items:[{name:'', text:''}]})},
  map:{n:'خريطة', d:() => ({type:'map', url:''})},
  announce:{n:'شريط إعلان', d:() => ({type:'announce', text:'عروض مبتنتهيش!', url:''})},
  trust:{n:'مميزات (ثقة)', d:() => ({type:'trust', items:[{name:'دفع عند الاستلام', text:'نقدي عند وصول الأوردر'}]})},
  cats:{n:'أقسام المتجر', d:() => ({type:'cats'})},
  slider:{n:'بانر صور متحرك', d:() => ({type:'slider', urls:[]})}
};
const U_HTTPS = /^https:\/\//i, U_LINK = /^(https:\/\/|tel:|mailto:)/i, U_MAP = /^https:\/\/(www\.google\.com|maps\.google\.com)\/maps\/embed/i;
const okUrl = (u, re) => typeof u === 'string' && re.test(u) ? u : '';
const arr = x => Array.isArray(x) ? x : [];
const nl = s => esc(s).replace(/\n/g, '<br>');

function renderBlock(b) {
  if (!b || typeof b !== 'object') return '';
  let u;
  switch (b.type) {
    case 'heading': return '<h2 class="b-h">' + esc(b.text) + '</h2>';
    case 'text': return '<p class="b-t">' + nl(b.text) + '</p>';
    case 'image': u = okUrl(b.url, U_HTTPS); return u ? '<figure class="b-img"><img src="' + esc(u) + '" alt="' + esc(b.alt) + '" loading="lazy"></figure>' : '';
    case 'video': u = okUrl(b.url, U_HTTPS); return u ? '<video class="b-vid" controls preload="metadata" src="' + esc(u) + '"></video>' : '';
    case 'button': u = okUrl(b.url, U_LINK); return u ? '<p><a class="s-btn" href="' + esc(u) + '" rel="noopener">' + esc(b.label) + '</a></p>' : '';
    case 'gallery': return '<div class="b-gal">' + arr(b.urls).map(x => okUrl(x, U_HTTPS) ? '<img src="' + esc(x) + '" alt="" loading="lazy">' : '').join('') + '</div>';
    case 'faq': return '<div class="b-faq">' + arr(b.items).filter(x => x && x.q).map(x => '<details><summary>' + esc(x.q) + '</summary><p>' + nl(x.a) + '</p></details>').join('') + '</div>';
    case 'reviews': return '<div class="b-rev">' + arr(b.items).filter(x => x && x.text).map(x => '<blockquote>' + nl(x.text) + '<cite>' + esc(x.name) + '</cite></blockquote>').join('') + '</div>';
    case 'announce': u = okUrl(b.url, U_LINK); return b.text ? '<div class="ann">' + (u ? '<a href="' + esc(u) + '" rel="noopener">' + esc(b.text) + '</a>' : esc(b.text)) + '</div>' : '';
    case 'trust': return '<div class="b-trust">' + arr(b.items).filter(x => x && x.name).map(x => '<div class="tr-c"><b>' + esc(x.name) + '</b><span>' + esc(x.text) + '</span></div>').join('') + '</div>';
    case 'cats': return '<div class="b-cats"></div>';
    case 'slider': return arr(b.urls).some(x => okUrl(x, U_HTTPS)) ? '<div class="b-sld">' + arr(b.urls).map(x => okUrl(x, U_HTTPS) ? '<img src="' + esc(x) + '" alt="" loading="lazy">' : '').join('') + '</div>' : '';
    case 'map': u = okUrl(b.url, U_MAP); return u ? '<iframe class="b-map" src="' + esc(u) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' : '';
  }
  return '';
}

const MIME = {'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'video/mp4':'mp4', 'application/pdf':'pdf'};
async function uploadFile(file, kinds) {
  if (!MIME[file.type] || !kinds.includes(file.type.split('/')[0])) throw new Error('نوع الملف غير مدعوم هنا.');
  if (file.size > 20 * 1024 * 1024) throw new Error('الملف أكبر من 20 ميجا.');
  const path = me.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + MIME[file.type];
  const { error } = await sb.storage.from('site-assets').upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return sb.storage.from('site-assets').getPublicUrl(path).data.publicUrl;
}

async function builder(m, id) {
  if (!me) { location.hash = '#/login'; return; }
  const { data } = await sb.from('sites').select('*').eq('id', id).maybeSingle();
  if (!data || (data.owner_id !== me.id && me.role !== 'super_admin') || (data.status !== 'active' && me.role !== 'super_admin')) { location.hash = '#/dashboard'; return; }
  const { data: libraryData } = await sb.from('site_asset_library').select('id,title,category,url').eq('active', true).order('created_at', { ascending: false });
  const library = libraryData || [];
  const blocks = arr(data.content).filter(b => b && BLOCKS[b.type]);
  m.innerHTML = '<section class="bld"><aside class="pal"><h3>العناصر</h3><p class="hint">اسحب العنصر وضعه في الصفحة، أو اضغط عليه.</p>' +
    Object.keys(BLOCKS).map(k => '<button type="button" class="pal-i" draggable="true" data-new="' + k + '">' + BLOCKS[k].n + '</button>').join('') +
    '</aside><div class="cv"><div class="bar"><b>' + esc(data.name) + '</b><span class="grow"></span><span id="st" role="status"></span><button type="button" class="btn ghost" id="ai">إنشاء بالذكاء الاصطناعي</button><button type="button" class="btn" id="save">حفظ</button><a class="btn ghost" href="' + esc(siteUrl(data.slug)) + '" target="_blank">معاينة</a><a class="btn ghost" href="#/dashboard">رجوع</a></div><div id="canvas"></div></div></section>';
  const cv = m.querySelector('#canvas'), st = t => m.querySelector('#st').textContent = t;

  const inp = (i, f, label, v, ltr, extra) => '<label>' + label + '<input' + (ltr ? ' dir="ltr"' : ' class="rtl"') + ' data-i="' + i + '" data-f="' + f + '" value="' + esc(v) + '" ' + (extra || '') + '></label>';
  const up = (i, f, accept, kinds, label, multi) => '<label>' + label + '<input type="file" accept="' + accept + '"' + (multi ? ' multiple' : '') + ' data-up="' + kinds + '" data-i="' + i + '" data-f="' + f + '"></label>';
  const libPick = (i, mode) => library.length ? '<label>أو اختار صورة من مكتبة المنصة<select data-lib="' + mode + '" data-i="' + i + '"><option value="">اختار صورة جاهزة</option>' + library.map(x => '<option value="' + esc(x.id) + '">' + esc(x.title) + (x.category ? ' — ' + esc(x.category) : '') + '</option>').join('') + '</select></label>' : '';
  const items = (b, i, a, bl, al, bl2) => arr(b.items).map((x, j) => '<div class="item">' + '<input class="rtl" placeholder="' + al + '" data-i="' + i + '" data-f="items" data-j="' + j + '" data-k="' + a + '" value="' + esc(x[a]) + '"><textarea class="rtl" rows="2" placeholder="' + bl2 + '" data-i="' + i + '" data-f="items" data-j="' + j + '" data-k="' + bl + '">' + esc(x[bl]) + '</textarea><button type="button" class="btn sm warn" data-rm="' + j + '" data-i="' + i + '">حذف</button></div>').join('') + '<button type="button" class="btn sm ghost" data-add="' + i + '">إضافة</button>';
  function fields(b, i) {
    switch (b.type) {
      case 'heading': return inp(i, 'text', 'النص', b.text, false, 'maxlength="200"');
      case 'text': return '<label>النص<textarea class="rtl" rows="4" data-i="' + i + '" data-f="text" maxlength="3000">' + esc(b.text) + '</textarea></label>';
      case 'image': return (okUrl(b.url, U_HTTPS) ? '<img class="th" src="' + esc(b.url) + '" alt="">' : '') + up(i, 'url', 'image/jpeg,image/png,image/webp', 'image', 'رفع صورة (JPG أو PNG أو WEBP)') + libPick(i, 'single') + inp(i, 'url', 'أو رابط الصورة (https)', b.url, true) + inp(i, 'alt', 'وصف الصورة', b.alt);
      case 'video': return up(i, 'url', 'video/mp4', 'video', 'رفع فيديو (MP4 حتى 20 ميجا)') + inp(i, 'url', 'أو رابط فيديو MP4 (https)', b.url, true);
      case 'button': return inp(i, 'label', 'نص الزر', b.label, false, 'maxlength="60"') + inp(i, 'url', 'الرابط (https أو tel: أو mailto:)', b.url, true) + up(i, 'url', 'application/pdf', 'application', 'أو ارفع ملف PDF للزر');
      case 'gallery': return '<div class="ths">' + arr(b.urls).map((x, j) => '<span draggable="true" data-gdrag="' + i + ':' + j + '" data-gpos="' + j + '" data-i="' + i + '"><img class="th" src="' + esc(x) + '" alt=""><button type="button" class="btn sm warn" data-gdel="' + j + '" data-i="' + i + '">×</button></span>').join('') + '</div>' + libPick(i, 'gallery') + up(i, 'urls', 'image/jpeg,image/png,image/webp', 'image', 'إضافة صور (حتى 12)', true);
      case 'faq': return items(b, i, 'q', 'a', 'السؤال', 'الإجابة');
      case 'reviews': return items(b, i, 'name', 'text', 'اسم العميل', 'نص التقييم');
      case 'announce': return inp(i, 'text', 'نص الشريط', b.text, false, 'maxlength="120"') + inp(i, 'url', 'رابط (اختياري)', b.url, true);
      case 'trust': return items(b, i, 'name', 'text', 'العنوان', 'الوصف');
      case 'slider': return '<div class="ths">' + arr(b.urls).map((x, j) => '<span draggable="true" data-gdrag="' + i + ':' + j + '" data-gpos="' + j + '" data-i="' + i + '"><img class="th" src="' + esc(x) + '" alt=""><button type="button" class="btn sm warn" data-gdel="' + j + '" data-i="' + i + '">×</button></span>').join('') + libPick(i, 'slider') + up(i, 'urls', 'image/jpeg,image/png,image/webp', 'image', 'أضف صور البانر (حتى 6)', true);
      case 'cats': return '<p class="hint">بتظهر أقسام المتجر تلقائيًا بصور من منتجاتك.</p>';
      case 'map': return inp(i, 'url', 'رابط الخريطة (قيمة src من Embed a map في Google Maps)', b.url, true);
    }
    return '';
  }
  function draw() {
    cv.innerHTML = blocks.map((b, i) => '<div class="blk" data-i="' + i + '"><div class="bh" draggable="true" data-i="' + i + '"><span>⠿ ' + BLOCKS[b.type].n + '</span><span><button type="button" data-m="up" data-i="' + i + '">↑</button><button type="button" data-m="down" data-i="' + i + '">↓</button><button type="button" data-m="del" data-i="' + i + '">حذف</button></span></div>' + fields(b, i) + '</div>').join('') +
      '<div class="drop-end">' + (blocks.length ? 'اسحب هنا للإضافة في آخر الصفحة' : 'ابدأ بسحب عنصر من القائمة وضعه هنا') + '</div>';
  }
  draw();
  const add = k => { if (blocks.length >= 40) { st('وصلت للحد الأقصى (40 عنصر).'); return; } blocks.push(BLOCKS[k].d()); draw(); };

  m.addEventListener('dragstart', e => {
    const n = e.target.closest && e.target.closest('[data-new]'), h = e.target.closest && e.target.closest('.bh'), g = e.target.closest && e.target.closest('[data-gdrag]');
    if (n) e.dataTransfer.setData('text/plain', 'new:' + n.dataset.new); else if (g) e.dataTransfer.setData('text/plain', 'image:' + g.dataset.gdrag); else if (h) e.dataTransfer.setData('text/plain', 'move:' + h.dataset.i);
  });
  cv.addEventListener('dragover', e => e.preventDefault());
  cv.addEventListener('drop', e => {
    e.preventDefault();
    const d = e.dataTransfer.getData('text/plain'), t = e.target.closest('.blk');
    let at = t ? +t.dataset.i : blocks.length;
    if (d.startsWith('new:') && BLOCKS[d.slice(4)] && blocks.length < 40) blocks.splice(at, 0, BLOCKS[d.slice(4)].d());
    else if (d.startsWith('image:') && t) {
      const [fromI, fromJ] = d.slice(6).split(':').map(Number), src = blocks[fromI], dst = blocks[at];
      if (!src || !dst || !['gallery','slider'].includes(src.type) || !['gallery','slider'].includes(dst.type)) return;
      const from = arr(src.urls), to = arr(dst.urls), cap = dst.type === 'slider' ? 6 : 12;
      if (src !== dst && to.length >= cap) { st('المعرض وصل للحد الأقصى من الصور.'); return; }
      const [url] = from.splice(fromJ, 1); if (!url) return;
      const posEl = e.target.closest('[data-gpos]');
      let pos = posEl && +posEl.dataset.i === at ? +posEl.dataset.gpos : to.length;
      if (src === dst && fromJ < pos) pos--;
      to.splice(Math.max(0, Math.min(pos, to.length)), 0, url);
      src.urls = from; dst.urls = to;
    }
    else if (d.startsWith('move:')) { const from = +d.slice(5), [x] = blocks.splice(from, 1); if (!x) return; if (at > from) at--; blocks.splice(at, 0, x); }
    draw();
  });
  cv.addEventListener('input', e => {
    const t = e.target, b = blocks[+t.dataset.i]; if (!b || t.dataset.f === undefined) return;
    if (t.dataset.j !== undefined) b[t.dataset.f][+t.dataset.j][t.dataset.k] = t.value; else b[t.dataset.f] = t.value;
  });
  cv.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.lib) {
      const img = library.find(x => x.id === t.value), b = blocks[+t.dataset.i];
      if (!img || !b) return;
      if (t.dataset.lib === 'single') b.url = img.url;
      else { const cap = b.type === 'slider' ? 6 : 12; if (b.urls.length >= cap) { st('وصلت للحد الأقصى للصور.'); return; } b.urls.push(img.url); }
      st('تم اختيار الصورة. اضغط حفظ.'); draw(); return;
    }
    if (!t.dataset.up) return;
    const b = blocks[+t.dataset.i], files = [...t.files]; if (!b || !files.length) return;
    st('جاري الرفع...');
    try {
      for (const f of files) {
        if ((b.type === 'gallery' || b.type === 'slider') && b.urls.length >= (b.type === 'slider' ? 6 : 12)) break;
        const u = await uploadFile(f, t.dataset.up.split(','));
        if (b.type === 'gallery' || b.type === 'slider') b.urls.push(u); else b.url = u;
      }
      st('تم الرفع. اضغط حفظ.'); draw();
    } catch (er) { st(er.message); }
  });
  m.addEventListener('click', e => {
    const n = e.target.closest('[data-new]'); if (n) { add(n.dataset.new); return; }
    const b = e.target.closest('button'); if (!b) return;
    const i = +b.dataset.i, mv = b.dataset.m;
    if (mv === 'del') blocks.splice(i, 1);
    else if (mv === 'up' && i > 0) [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]];
    else if (mv === 'down' && i < blocks.length - 1) [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]];
    else if (b.dataset.add !== undefined) { const x = blocks[+b.dataset.add]; if (x.items.length < 20) x.items.push(x.type === 'faq' ? {q:'', a:''} : {name:'', text:''}); }
    else if (b.dataset.rm !== undefined) blocks[i].items.splice(+b.dataset.rm, 1);
    else if (b.dataset.gdel !== undefined) blocks[i].urls.splice(+b.dataset.gdel, 1);
    else if (b.id === 'ai') { aiGenerate(id, blocks, st, draw); return; }
    else if (b.id === 'save') {
      st('جاري الحفظ...');
      sb.from('sites').update({ content: blocks }).eq('id', id).then(r => st(r.error ? 'فشل الحفظ: ' + r.error.message : 'تم الحفظ.'));
      return;
    } else return;
    draw();
  });
}

function terms(m) {
  m.innerHTML = '<section class="wrap"><h1>شروط الاستخدام</h1><p>باستخدامك ' + esc(C.PLATFORM_NAME) + ' فأنت توافق على الآتي:</p><ol><li>أنت المسؤول عن محتوى موقعك وصحته، وعن أي صور أو فيديوهات ترفعها.</li><li>يُمنع نشر أي محتوى مخالف للقانون، أو مسيء، أو ينتهك حقوق الآخرين، أو يتضمن احتيالاً.</li><li>من حق إدارة المنصة إيقاف أو حذف أي موقع أو تعطيل أي حساب يخالف هذه الشروط، دون إخطار مسبق.</li><li>التجربة المجانية مدتها 3 أيام، وتعرض إعلانات على المواقع المجانية.</li><li>الاشتراكات المدفوعة غير قابلة للاسترداد إلا بقرار من الإدارة.</li><li>قد نحدّث هذه الشروط، واستمرارك في الاستخدام يعني موافقتك عليها.</li></ol><p><a href="#/">الرجوع للرئيسية</a></p></section>';
}

function subscriptionsPage(m) {
  if (!me) { location.hash = '#/login'; return; }
  const current = (window.APP_PLANS || []).find(p => p.id === me.subscription_plan_id);
  const st = status(me), end = me.plan === 'trial' ? me.trial_ends_at : me.plan_ends_at;
  const cancellable = me.plan !== 'trial' && me.plan !== 'cancelled' && me.plan_ends_at && daysLeft(me.plan_ends_at) > 0;
  m.innerHTML = '<section class="wrap"><h1>الاشتراك</h1><article class="current-plan"><div><small>باقتك الحالية</small><h2>' + esc(current ? current.name : (me.plan === 'trial' ? 'التجربة المجانية' : planName(me.plan))) + '</h2><p class="status ' + (st.ok ? 'on' : 'off') + '">' + esc(st.text) + '</p>' + (end ? '<small>تاريخ الانتهاء: ' + new Date(end).toLocaleDateString('ar-EG') + '</small>' : '') + '</div><div><a class="btn" href="#/dashboard">لوحة مواقعي</a> ' + (cancellable ? '<button type="button" id="cancel-mine" class="btn warn">إلغاء اشتراكي</button>' : '') + '</div></article>' + payHtml() + '<p class="hint">اختار الباقة المناسبة، حوّل المبلغ، ثم أرسل طلبك. الاشتراك يتفعّل بعد مراجعة الأدمن.</p></section>';
  m.onclick = async e => {
    const b = e.target.closest('[data-pay]'); if (b) { startPay(b.dataset.pay, b); return; }
    if (e.target.closest('#cancel-mine')) {
      if (!confirm('إلغاء اشتراكك الآن؟ سيظل حسابك ومواقعك موجودة، لكن لن تستطيع إنشاء مواقع جديدة.')) return;
      const { error } = await sb.rpc('cancel_my_subscription');
      if (error) { alert('تعذر إلغاء الاشتراك: ' + error.message); return; }
      route();
    }
  };
}

const routes = { '/': home, '/login': login, '/signup': signup, '/dashboard': dashboard, '/subscriptions': subscriptionsPage, '/admin': admin, '/terms': terms, '/theme': themePage };

async function loadSettings() {
  try {
    const { data } = await sb.from('app_settings').select('key,value'), g = {};
    (data || []).forEach(x => g[x.key] = x.value);
    window.APP_SETTINGS = g; applyTheme(g);
    const { data: plans } = await sb.from('subscription_plans').select('id,code,name,description,price,original_price,discount_percent,duration_days,max_sites,max_products,ai_uses_monthly,features,active,sort_order').eq('active', true).order('sort_order');
    window.APP_PLANS = plans || [];
    const money = v => /^[0-9]+(\.[0-9]+)?$/.test(String(v || '').trim()) ? Number(v) + ' جنيه' : '';
    if (money(g.price_monthly)) C.PRICE_MONTHLY = money(g.price_monthly);
    if (money(g.price_yearly)) C.PRICE_YEARLY = money(g.price_yearly);
    if (g.ad_text) C.AD_TEXT = g.ad_text;
  } catch {}
}

async function route() {
  await loadSettings();
  await loadMe();
  const h = (location.hash.slice(1) || '/').split('?')[0];
  const dom = await domainSlug();
  const ps = pathSlug();
  if (ps && (h === '/' || h === '')) { await siteView(ps); return; }
  if (dom && h === '/') { await siteView(dom); return; }
  if (/[?&]success=true/.test(location.hash)) notice = 'تم استلام الدفع. اشتراكك بيتفعّل خلال لحظات، حدّث الصفحة لو الحالة ما اتغيرتش.';
  else if (/[?&]success=false/.test(location.hash)) notice = 'عملية الدفع ما اكتملتش. ما اتخصمش منك أي مبلغ، تقدر تجرّب تاني.';
  if (h.startsWith('/s/')) { await siteView(decodeURIComponent(h.slice(3)).toLowerCase()); return; }
  document.title = C.PLATFORM_NAME;
  window._pc = 0;
  if (me && me.role === 'super_admin') { try { window._pc = (await sb.from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')).count || 0; } catch {} }
  root.innerHTML = nav() + (notice ? '<div class="banner" role="alert">' + esc(notice) + '</div>' : '') + '<main></main><footer><span>© ' + new Date().getFullYear() + ' ' + esc(C.PLATFORM_NAME) + '</span><a href="#/terms">شروط الاستخدام</a></footer>';
  notice = '';
  const main = root.querySelector('main');
  if (h.startsWith('/manage/')) await manage(main, h.slice(8)); else if (h.startsWith('/builder/')) await builder(main, h.slice(9)); else if (h.startsWith('/edit/')) await editSite(main, h.slice(6)); else await (routes[h] || home)(main);
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; route(); };
}
sb.auth.onAuthStateChange(async ev => {
  if (ev !== 'PASSWORD_RECOVERY') return;
  const p = prompt('اكتب كلمة المرور الجديدة (8 أحرف على الأقل):');
  if (p && p.length >= 8) { const { error } = await sb.auth.updateUser({ password: p }); alert(error ? tr(error.message) : 'تم تغيير كلمة المرور.'); }
});
window.addEventListener('hashchange', route);
route();
