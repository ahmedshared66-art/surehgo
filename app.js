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
    (TEMPLATES[data.site_type] || []).map(x => '<section><h2>' + x[0] + '</h2><p>' + x[1] + '</p></section>').join('') +
    '</main><footer class="s-foot">' + (ph ? '<div dir="ltr">' + esc(ph) + '</div>' : '') + '<a href="#/">Powered by ' + esc(C.PLATFORM_NAME) + '</a></footer></div>';
}

async function dashboard(m) {
  if (!me) { location.hash = '#/login'; return; }
  const s = status(me);
  const { data } = await sb.from('sites').select('*').eq('owner_id', me.id).order('created_at', { ascending: false });
  const sites = data || [];
  const canCreate = s.ok && sites.length < 3;
  m.innerHTML = '<section class="wrap"><h1>أهلاً ' + esc(me.full_name) + '</h1><div class="status ' + (s.ok ? 'on' : 'off') + '">' + esc(s.text) + '</div>' +
    '<h2>مواقعي</h2>' + (sites.length ? '<ul class="mysites">' + sites.map(x => '<li><div><b>' + esc(x.name) + '</b> <small>(' + TYPE_NAMES[x.site_type] + (x.status === 'suspended' ? ' - موقوف من الإدارة' : '') + ')</small><br><a href="#/s/' + esc(x.slug) + '" target="_blank" dir="ltr">' + esc(siteUrl(x.slug)) + '</a></div><div class="act"><a class="btn sm" href="#/edit/' + x.id + '">تعديل</a><button class="btn sm warn" data-del="' + x.id + '">حذف</button></div></li>').join('') + '</ul>' : '<p>لسه معندكش مواقع.</p>') +
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
  m.innerHTML = '<section class="wrap"><h1>تعديل: ' + esc(data.name) + '</h1><form class="card"><label>اسم الموقع<input class="rtl" name="name" required minlength="2" maxlength="80" value="' + esc(data.name) + '"></label><label>وصف النشاط<textarea class="rtl" name="description" rows="3" maxlength="600">' + esc(data.description) + '</textarea></label><label>اللون المفضل<input type="color" name="color" value="' + esc(data.color) + '"></label><label>رقم الهاتف<input name="phone" type="tel" maxlength="20" value="' + esc(data.phone) + '"></label><button class="btn">حفظ التعديلات</button><div class="msg" role="alert"></div></form><p><a href="#/dashboard">الرجوع لمواقعي</a></p></section>';
  m.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), msg = m.querySelector('.msg');
    const { error } = await sb.from('sites').update({ name: f.get('name').trim(), description: f.get('description').trim(), color: f.get('color'), phone: f.get('phone').trim() }).eq('id', id);
    if (error) { msg.textContent = siteErr(error); return; }
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
  if (h.startsWith('/edit/')) await editSite(main, h.slice(6)); else await (routes[h] || home)(main);
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; route(); };
}
window.addEventListener('hashchange', route);
route();
