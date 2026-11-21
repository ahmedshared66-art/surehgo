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
  const d = p.plan_ends_at ? daysLeft(p.plan_ends_at) : 0;
  return d > 0 ? {ok:true, text:'الاشتراك ' + planName(p.plan) + ': متبقي ' + arDays(d)} : {ok:false, text:'انتهى الاشتراك ' + planName(p.plan)};
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
  const links = me
    ? '<a href="#/dashboard">لوحتي</a>' + (me.role === 'super_admin' ? '<a href="#/admin">لوحة الأدمن</a>' : '') + '<button id="logout" class="btn ghost">تسجيل الخروج</button>'
    : '<a href="#/login">تسجيل الدخول</a><a class="btn" href="#/signup">إنشاء حساب</a>';
  return '<header class="nav"><a class="brand" href="#/">' + esc(C.PLATFORM_NAME) + '</a><nav>' + links + '</nav></header>';
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
  m.innerHTML =
  '<section class="hero"><div><span class="badge">3 أيام مجاناً</span><h1>موقعك على الإنترنت في دقائق</h1><p>اختار نوع نشاطك، وابني موقعك بالسحب والإفلات أو بالذكاء الاصطناعي. من غير برمجة.</p><a class="btn" href="' + (me ? '#/dashboard' : '#/signup') + '">إنشاء موقع</a></div>' +
  '<div class="frame" aria-hidden="true"><div class="bar"></div><div class="body"><i class="h"></i><i></i><i class="s"></i><div class="drag"></div><div class="row"><i></i><i></i><i></i></div></div></div></section>' +
  '<div class="wrap"><section><h2>اختار نوع موقعك</h2><ul class="types">' + TYPES.map(t => '<li><a href="' + (me ? '#/dashboard' : '#/signup') + '">' + t + '</a></li>').join('') + '</ul></section>' +
  '<section class="sec"><h2>المميزات</h2><ul class="feat">' + FEATURES.map(f => '<li><b>' + f[0] + '</b><span>' + f[1] + '</span></li>').join('') + '</ul></section>' +
  '<section class="sec"><h2>الباقات</h2><div class="tbl"><table class="plans"><tr><th>الباقة</th><th>السعر</th><th>تشمل</th></tr>' +
  '<tr><td><b>المجانية</b></td><td>مجاناً لمدة 3 أيام</td><td>كل المميزات للتجربة، مع إعلانات</td></tr>' +
  '<tr><td><b>الشهرية</b></td><td>' + esc(C.PRICE_MONTHLY) + '</td><td>بدون إعلانات + دعم فني</td></tr>' +
  '<tr><td><b>السنوية</b></td><td>' + esc(C.PRICE_YEARLY) + '</td><td>متجر إلكتروني + ذكاء اصطناعي كامل + دومين خاص</td></tr></table></div></section></div>';
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
  m.innerHTML = '<section class="wrap"><h1>تسجيل الدخول</h1><form class="card"><label>البريد الإلكتروني<input name="email" type="email" required autocomplete="email"></label><label>كلمة المرور<input name="password" type="password" required autocomplete="current-password"></label><button class="btn">دخول</button><div class="msg" role="alert"></div></form><p>مفيش حساب؟ <a href="#/signup">أنشئ حساب</a></p></section>';
  m.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = m.querySelector('.msg'); msg.textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
    if (error) { msg.textContent = tr(error.message); return; }
    location.hash = '#/dashboard'; route();
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
const siteUrl = slug => location.origin + location.pathname + '#/s/' + slug;
const lum = c => { const n = parseInt(c.slice(1), 16); return ((n >> 16) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000; };
const siteErr = e => e.code === '23505' ? 'الرابط ده مستخدم. اختار اسم تاني.'
  : e.code === '42501' ? 'مينفعش تنشئ موقع: التجربة أو الاشتراك انتهى، أو وصلت للحد الأقصى (3 مواقع).'
  : e.code === '23514' ? 'تأكد من البيانات: الرابط بحروف إنجليزية صغيرة وأرقام وشرطة فقط (من 3 إلى 30 حرف).'
  : 'حصلت مشكلة: ' + e.message;

async function siteView(slug) {
  const { data } = await sb.from('sites').select('*').eq('slug', slug).maybeSingle();
  if (!data) { root.innerHTML = '<main class="wrap"><h1>الموقع غير موجود</h1><p><a href="#/">الرجوع إلى ' + esc(C.PLATFORM_NAME) + '</a></p></main>'; return; }
  if (data.status === 'suspended') { root.innerHTML = '<main class="wrap"><h1>هذا الموقع موقوف</h1><p>تم إيقاف هذا الموقع من إدارة المنصة.</p></main>'; return; }
  document.title = data.name;
  const ph = (data.phone || '').replace(/[^0-9+]/g, '');
  root.innerHTML = '<div class="site" style="--c:' + esc(data.color) + ';--t:' + (lum(data.color) > 150 ? '#10202B' : '#fff') + '"><header class="s-hero"><h1>' + esc(data.name) + '</h1><p>' + esc(data.description) + '</p>' + (ph ? '<a class="s-btn" href="tel:' + ph + '">اتصل بنا</a>' : '') + '</header><main class="s-body">' +
    (arr(data.content).length ? arr(data.content).map(renderBlock).join('') : (TEMPLATES[data.site_type] || []).map(x => '<section><h2>' + x[0] + '</h2><p>' + x[1] + '</p></section>').join('')) +
    '<div id="shop-box"></div></main><footer class="s-foot">' + (ph ? '<div dir="ltr">' + esc(ph) + '</div>' : '') + '<a href="#/">Powered by ' + esc(C.PLATFORM_NAME) + '</a></footer></div>';
  shopSection(data);
  siteExtras(data);
}

async function dashboard(m) {
  if (!me) { location.hash = '#/login'; return; }
  const s = status(me);
  const { data } = await sb.from('sites').select('*').eq('owner_id', me.id).order('created_at', { ascending: false });
  const sites = data || [];
  const canCreate = s.ok && sites.length < 3;
  m.innerHTML = '<section class="wrap"><h1>أهلاً ' + esc(me.full_name) + '</h1><div class="status ' + (s.ok ? 'on' : 'off') + '">' + esc(s.text) + '</div>' +
    '<h2>مواقعي</h2>' + (sites.length ? '<ul class="mysites">' + sites.map(x => '<li><div><b>' + esc(x.name) + '</b> <small>(' + TYPE_NAMES[x.site_type] + (x.status === 'suspended' ? ' - موقوف من الإدارة' : '') + ')</small><br><a href="#/s/' + esc(x.slug) + '" target="_blank" dir="ltr">' + esc(siteUrl(x.slug)) + '</a></div><div class="act"><a class="btn sm" href="#/builder/' + x.id + '">بناء الموقع</a><a class="btn sm ghost" href="#/edit/' + x.id + '">البيانات</a><a class="btn sm ghost" href="#/manage/' + x.id + '">المتجر والطلبات</a><button class="btn sm warn" data-del="' + x.id + '">حذف</button></div></li>').join('') + '</ul>' : '<p>لسه معندكش مواقع.</p>') +
    (canCreate ? '<h2>إنشاء موقع جديد</h2><form class="card" id="nf"><label>اسم الموقع<input class="rtl" name="name" required minlength="2" maxlength="80"></label><label>الرابط (حروف إنجليزية صغيرة وأرقام وشرطة)<input name="slug" required pattern="[a-z0-9][a-z0-9\\-]{2,29}" maxlength="30" placeholder="my-restaurant"></label><label>نوع النشاط<select name="type">' + Object.keys(TYPE_NAMES).map(k => '<option value="' + k + '">' + TYPE_NAMES[k] + '</option>').join('') + '</select></label><label>وصف النشاط<textarea class="rtl" name="description" rows="3" maxlength="600"></textarea></label><label>اللون المفضل<input type="color" name="color" value="#0B5C6B"></label><label>رقم الهاتف<input name="phone" type="tel" maxlength="20"></label><button class="btn">إنشاء الموقع</button><div class="msg" role="alert"></div></form>'
      : '<p class="msg">' + (s.ok ? 'وصلت للحد الأقصى (3 مواقع).' : 'مينفعش تنشئ مواقع جديدة لأن التجربة أو الاشتراك انتهى.') + '</p>') + '</section>';
  const nf = m.querySelector('#nf');
  if (nf) nf.onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(nf), msg = nf.querySelector('.msg'); msg.textContent = '';
    const { error } = await sb.from('sites').insert({ slug: f.get('slug').trim().toLowerCase(), name: f.get('name').trim(), site_type: f.get('type'), description: f.get('description').trim(), color: f.get('color'), phone: f.get('phone').trim() });
    if (error) { msg.textContent = siteErr(error); return; }
    route();
  };
  m.onclick = async e => {
    const b = e.target.closest('[data-del]'); if (!b || !confirm('متأكد إنك عايز تحذف الموقع نهائياً؟')) return;
    const { error } = await sb.from('sites').delete().eq('id', b.dataset.del);
    if (error) alert(error.message); else route();
  };
}

async function editSite(m, id) {
  if (!me) { location.hash = '#/login'; return; }
  const { data } = await sb.from('sites').select('*').eq('id', id).maybeSingle();
  if (!data || data.owner_id !== me.id) { location.hash = '#/dashboard'; return; }
  m.innerHTML = '<section class="wrap"><h1>تعديل: ' + esc(data.name) + '</h1><form class="card"><label>اسم الموقع<input class="rtl" name="name" required minlength="2" maxlength="80" value="' + esc(data.name) + '"></label><label>وصف النشاط<textarea class="rtl" name="description" rows="3" maxlength="600">' + esc(data.description) + '</textarea></label><label>اللون المفضل<input type="color" name="color" value="' + esc(data.color) + '"></label><label>رقم الهاتف<input name="phone" type="tel" maxlength="20" value="' + esc(data.phone) + '"></label><label>واتساب (رقم بالكود الدولي من غير + مثل 201001234567)<input name="whatsapp" type="tel" maxlength="15" pattern="[0-9]{8,15}" value="' + esc(data.whatsapp) + '"></label><label>رابط فيسبوك (يبدأ بـ https)<input name="facebook" type="url" maxlength="200" value="' + esc(data.facebook) + '"></label><label>رابط إنستجرام (يبدأ بـ https)<input name="instagram" type="url" maxlength="200" value="' + esc(data.instagram) + '"></label><button class="btn">حفظ التعديلات</button><div class="msg" role="alert"></div></form><p><a href="#/dashboard">الرجوع لمواقعي</a></p></section>';
  m.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = m.querySelector('.msg');
    const { error } = await sb.from('sites').update({ name: f.get('name').trim(), description: f.get('description').trim(), color: f.get('color'), phone: f.get('phone').trim(), whatsapp: f.get('whatsapp').trim(), facebook: f.get('facebook').trim(), instagram: f.get('instagram').trim() }).eq('id', id);
    if (error) { msg.textContent = error.code === '23514' ? 'تأكد: واتساب أرقام فقط بالكود الدولي، وروابط فيسبوك وإنستجرام تبدأ بـ https://' : siteErr(error); return; }
    location.hash = '#/dashboard';
  };
}

async function admin(m) {
  if (!me || me.role !== 'super_admin') { location.hash = '#/'; return; }
  const [u, st] = await Promise.all([
    sb.from('profiles').select('*').order('created_at', { ascending: false }),
    sb.from('sites').select('*').order('created_at', { ascending: false })
  ]);
  if (u.error || st.error) { m.innerHTML = '<section class="wrap"><div class="msg">' + esc((u.error || st.error).message) + '</div></section>'; return; }
  const users = u.data, sites = st.data, email = {};
  users.forEach(x => email[x.id] = x.email);
  const paid = users.filter(x => x.plan !== 'trial' && x.plan_ends_at && daysLeft(x.plan_ends_at) > 0).length;
  m.innerHTML = '<section class="wrap" style="max-width:1200px"><h1>لوحة الأدمن</h1><div class="stats"><div>المستخدمين: <b>' + users.length + '</b></div><div>مشتركين حالياً: <b>' + paid + '</b></div><div>معطّلين: <b>' + users.filter(x => x.is_disabled).length + '</b></div><div>المواقع: <b>' + sites.length + '</b></div></div><div class="msg" id="amsg" role="alert"></div>' +
    '<h2>المستخدمين</h2><div class="tbl"><table><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الباقة</th><th>الحالة</th><th>تاريخ التسجيل</th><th>إجراءات</th></tr>' +
    users.map(x => '<tr><td>' + esc(x.full_name) + '</td><td dir="ltr">' + esc(x.email) + '</td><td dir="ltr">' + esc(x.phone) + '</td><td>' + planName(x.plan) + (x.role === 'super_admin' ? ' (أدمن)' : '') + '</td><td>' + esc(status(x).text) + (x.is_disabled ? ' - معطّل' : '') + '</td><td>' + new Date(x.created_at).toLocaleDateString('ar-EG') + '</td><td class="act">' +
    (x.id === me.id ? '' : '<button class="btn sm ' + (x.is_disabled ? '' : 'warn') + '" data-a="dis" data-id="' + x.id + '" data-v="' + !x.is_disabled + '">' + (x.is_disabled ? 'تفعيل الحساب' : 'تعطيل') + '</button>') +
    '<button class="btn sm" data-a="plan" data-id="' + x.id + '" data-p="monthly" data-d="30">شهري 30 يوم</button><button class="btn sm" data-a="plan" data-id="' + x.id + '" data-p="yearly" data-d="365">سنوي 365 يوم</button><button class="btn sm ghost" data-a="plan" data-id="' + x.id + '" data-p="trial" data-d="3">تجربة +3 أيام</button></td></tr>').join('') + '</table></div>' +
    '<h2 style="margin-top:32px">المواقع</h2><div class="tbl"><table><tr><th>الموقع</th><th>الرابط</th><th>النوع</th><th>صاحب الموقع</th><th>الحالة</th><th>إجراءات</th></tr>' +
    (sites.length ? sites.map(x => '<tr><td>' + esc(x.name) + '</td><td><a href="#/s/' + esc(x.slug) + '" target="_blank" dir="ltr">' + esc(x.slug) + '</a></td><td>' + TYPE_NAMES[x.site_type] + '</td><td dir="ltr">' + esc(email[x.owner_id] || '') + '</td><td>' + (x.status === 'active' ? 'شغال' : 'موقوف') + '</td><td class="act"><button class="btn sm ' + (x.status === 'active' ? 'warn' : '') + '" data-a="site" data-id="' + x.id + '" data-s="' + (x.status === 'active' ? 'suspended' : 'active') + '">' + (x.status === 'active' ? 'إيقاف' : 'تشغيل') + '</button><button class="btn sm warn" data-a="sdel" data-id="' + x.id + '">حذف</button></td></tr>').join('') : '<tr><td colspan="6">مفيش مواقع لسه.</td></tr>') + '</table></div></section>';
  m.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const msg = document.getElementById('amsg'); msg.textContent = '';
    const a = b.dataset.a; let r;
    if (a === 'dis') r = await sb.rpc('admin_set_disabled', { target: b.dataset.id, disabled: b.dataset.v === 'true' });
    else if (a === 'plan') r = await sb.rpc('admin_set_plan', { target: b.dataset.id, new_plan: b.dataset.p, days: +b.dataset.d });
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
  map:{n:'خريطة', d:() => ({type:'map', url:''})}
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
  if (!data || data.owner_id !== me.id || data.status !== 'active') { location.hash = '#/dashboard'; return; }
  const blocks = arr(data.content).filter(b => b && BLOCKS[b.type]);
  m.innerHTML = '<section class="bld"><aside class="pal"><h3>العناصر</h3><p class="hint">اسحب العنصر وضعه في الصفحة، أو اضغط عليه.</p>' +
    Object.keys(BLOCKS).map(k => '<button type="button" class="pal-i" draggable="true" data-new="' + k + '">' + BLOCKS[k].n + '</button>').join('') +
    '</aside><div class="cv"><div class="bar"><b>' + esc(data.name) + '</b><span class="grow"></span><span id="st" role="status"></span><button type="button" class="btn" id="save">حفظ</button><a class="btn ghost" href="#/s/' + esc(data.slug) + '" target="_blank">معاينة</a><a class="btn ghost" href="#/dashboard">رجوع</a></div><div id="canvas"></div></div></section>';
  const cv = m.querySelector('#canvas'), st = t => m.querySelector('#st').textContent = t;

  const inp = (i, f, label, v, ltr, extra) => '<label>' + label + '<input' + (ltr ? ' dir="ltr"' : ' class="rtl"') + ' data-i="' + i + '" data-f="' + f + '" value="' + esc(v) + '" ' + (extra || '') + '></label>';
  const up = (i, f, accept, kinds, label, multi) => '<label>' + label + '<input type="file" accept="' + accept + '"' + (multi ? ' multiple' : '') + ' data-up="' + kinds + '" data-i="' + i + '" data-f="' + f + '"></label>';
  const items = (b, i, a, bl, al, bl2) => arr(b.items).map((x, j) => '<div class="item">' + '<input class="rtl" placeholder="' + al + '" data-i="' + i + '" data-f="items" data-j="' + j + '" data-k="' + a + '" value="' + esc(x[a]) + '"><textarea class="rtl" rows="2" placeholder="' + bl2 + '" data-i="' + i + '" data-f="items" data-j="' + j + '" data-k="' + bl + '">' + esc(x[bl]) + '</textarea><button type="button" class="btn sm warn" data-rm="' + j + '" data-i="' + i + '">حذف</button></div>').join('') + '<button type="button" class="btn sm ghost" data-add="' + i + '">إضافة</button>';
  function fields(b, i) {
    switch (b.type) {
      case 'heading': return inp(i, 'text', 'النص', b.text, false, 'maxlength="200"');
      case 'text': return '<label>النص<textarea class="rtl" rows="4" data-i="' + i + '" data-f="text" maxlength="3000">' + esc(b.text) + '</textarea></label>';
      case 'image': return (okUrl(b.url, U_HTTPS) ? '<img class="th" src="' + esc(b.url) + '" alt="">' : '') + up(i, 'url', 'image/jpeg,image/png,image/webp', 'image', 'رفع صورة (JPG أو PNG أو WEBP)') + inp(i, 'url', 'أو رابط الصورة (https)', b.url, true) + inp(i, 'alt', 'وصف الصورة', b.alt);
      case 'video': return up(i, 'url', 'video/mp4', 'video', 'رفع فيديو (MP4 حتى 20 ميجا)') + inp(i, 'url', 'أو رابط فيديو MP4 (https)', b.url, true);
      case 'button': return inp(i, 'label', 'نص الزر', b.label, false, 'maxlength="60"') + inp(i, 'url', 'الرابط (https أو tel: أو mailto:)', b.url, true) + up(i, 'url', 'application/pdf', 'application', 'أو ارفع ملف PDF للزر');
      case 'gallery': return '<div class="ths">' + arr(b.urls).map((x, j) => '<span><img class="th" src="' + esc(x) + '" alt=""><button type="button" class="btn sm warn" data-gdel="' + j + '" data-i="' + i + '">x</button></span>').join('') + '</div>' + up(i, 'urls', 'image/jpeg,image/png,image/webp', 'image', 'إضافة صور (حتى 12)', true);
      case 'faq': return items(b, i, 'q', 'a', 'السؤال', 'الإجابة');
      case 'reviews': return items(b, i, 'name', 'text', 'اسم العميل', 'نص التقييم');
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
    const n = e.target.closest && e.target.closest('[data-new]'), h = e.target.closest && e.target.closest('.bh');
    if (n) e.dataTransfer.setData('text/plain', 'new:' + n.dataset.new); else if (h) e.dataTransfer.setData('text/plain', 'move:' + h.dataset.i);
  });
  cv.addEventListener('dragover', e => e.preventDefault());
  cv.addEventListener('drop', e => {
    e.preventDefault();
    const d = e.dataTransfer.getData('text/plain'), t = e.target.closest('.blk');
    let at = t ? +t.dataset.i : blocks.length;
    if (d.startsWith('new:') && BLOCKS[d.slice(4)] && blocks.length < 40) blocks.splice(at, 0, BLOCKS[d.slice(4)].d());
    else if (d.startsWith('move:')) { const from = +d.slice(5), [x] = blocks.splice(from, 1); if (!x) return; if (at > from) at--; blocks.splice(at, 0, x); }
    draw();
  });
  cv.addEventListener('input', e => {
    const t = e.target, b = blocks[+t.dataset.i]; if (!b || t.dataset.f === undefined) return;
    if (t.dataset.j !== undefined) b[t.dataset.f][+t.dataset.j][t.dataset.k] = t.value; else b[t.dataset.f] = t.value;
  });
  cv.addEventListener('change', async e => {
    const t = e.target; if (!t.dataset.up) return;
    const b = blocks[+t.dataset.i], files = [...t.files]; if (!b || !files.length) return;
    st('جاري الرفع...');
    try {
      for (const f of files) {
        if (b.type === 'gallery' && b.urls.length >= 12) break;
        const u = await uploadFile(f, t.dataset.up.split(','));
        if (b.type === 'gallery') b.urls.push(u); else b.url = u;
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

const routes = { '/': home, '/login': login, '/signup': signup, '/dashboard': dashboard, '/admin': admin, '/terms': terms };

async function route() {
  await loadMe();
  const h = location.hash.slice(1) || '/';
  if (h.startsWith('/s/')) { await siteView(decodeURIComponent(h.slice(3)).toLowerCase()); return; }
  document.title = C.PLATFORM_NAME;
  root.innerHTML = nav() + (notice ? '<div class="banner" role="alert">' + esc(notice) + '</div>' : '') + '<main></main><footer><span>© ' + new Date().getFullYear() + ' ' + esc(C.PLATFORM_NAME) + '</span><a href="#/terms">شروط الاستخدام</a></footer>';
  notice = '';
  const main = root.querySelector('main');
  if (h.startsWith('/manage/')) await manage(main, h.slice(8)); else if (h.startsWith('/builder/')) await builder(main, h.slice(9)); else if (h.startsWith('/edit/')) await editSite(main, h.slice(6)); else await (routes[h] || home)(main);
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; route(); };
}
window.addEventListener('hashchange', route);
route();
