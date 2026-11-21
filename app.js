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

function dashboard(m) {
  if (!me) { location.hash = '#/login'; return; }
  const s = status(me);
  m.innerHTML = '<section class="wrap"><h1>أهلاً ' + esc(me.full_name) + '</h1><div class="status ' + (s.ok ? 'on' : 'off') + '">' + esc(s.text) + '</div><dl class="kv"><dt>البريد</dt><dd dir="ltr">' + esc(me.email) + '</dd><dt>الهاتف</dt><dd dir="ltr">' + esc(me.phone) + '</dd><dt>الباقة</dt><dd>' + planName(me.plan) + '</dd></dl><button class="btn" disabled>إنشاء موقع (يتفعّل في المرحلة التالية)</button></section>';
}

async function admin(m) {
  if (!me || me.role !== 'super_admin') { location.hash = '#/'; return; }
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) { m.innerHTML = '<section class="wrap"><div class="msg">' + esc(error.message) + '</div></section>'; return; }
  const paid = data.filter(u => u.plan !== 'trial' && u.plan_ends_at && daysLeft(u.plan_ends_at) > 0).length;
  m.innerHTML = '<section class="wrap" style="max-width:1200px"><h1>لوحة الأدمن</h1><div class="stats"><div>المستخدمين: <b>' + data.length + '</b></div><div>مشتركين حالياً: <b>' + paid + '</b></div><div>معطّلين: <b>' + data.filter(u => u.is_disabled).length + '</b></div></div><div class="msg" id="amsg" role="alert"></div><div class="tbl"><table><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الباقة</th><th>الحالة</th><th>تاريخ التسجيل</th><th>إجراءات</th></tr>' +
  data.map(u => '<tr><td>' + esc(u.full_name) + '</td><td dir="ltr">' + esc(u.email) + '</td><td dir="ltr">' + esc(u.phone) + '</td><td>' + planName(u.plan) + (u.role === 'super_admin' ? ' (أدمن)' : '') + '</td><td>' + esc(status(u).text) + (u.is_disabled ? ' - معطّل' : '') + '</td><td>' + new Date(u.created_at).toLocaleDateString('ar-EG') + '</td><td class="act">' +
  (u.id === me.id ? '' : '<button class="btn sm ' + (u.is_disabled ? '' : 'warn') + '" data-a="dis" data-id="' + u.id + '" data-v="' + !u.is_disabled + '">' + (u.is_disabled ? 'تفعيل الحساب' : 'تعطيل') + '</button>') +
  '<button class="btn sm" data-a="plan" data-id="' + u.id + '" data-p="monthly" data-d="30">شهري 30 يوم</button><button class="btn sm" data-a="plan" data-id="' + u.id + '" data-p="yearly" data-d="365">سنوي 365 يوم</button><button class="btn sm ghost" data-a="plan" data-id="' + u.id + '" data-p="trial" data-d="3">تجربة +3 أيام</button></td></tr>').join('') + '</table></div></section>';
  m.querySelector('.tbl').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    const msg = document.getElementById('amsg'); msg.textContent = '';
    const { error: er } = b.dataset.a === 'dis'
      ? await sb.rpc('admin_set_disabled', { target: b.dataset.id, disabled: b.dataset.v === 'true' })
      : await sb.rpc('admin_set_plan', { target: b.dataset.id, new_plan: b.dataset.p, days: +b.dataset.d });
    if (er) { msg.textContent = er.message; return; }
    route();
  };
}

function terms(m) {
  m.innerHTML = '<section class="wrap"><h1>شروط الاستخدام</h1><p>باستخدامك ' + esc(C.PLATFORM_NAME) + ' فأنت توافق على الآتي:</p><ol><li>أنت المسؤول عن محتوى موقعك وصحته، وعن أي صور أو فيديوهات ترفعها.</li><li>يُمنع نشر أي محتوى مخالف للقانون، أو مسيء، أو ينتهك حقوق الآخرين، أو يتضمن احتيالاً.</li><li>من حق إدارة المنصة إيقاف أو حذف أي موقع أو تعطيل أي حساب يخالف هذه الشروط، دون إخطار مسبق.</li><li>التجربة المجانية مدتها 3 أيام، وتعرض إعلانات على المواقع المجانية.</li><li>الاشتراكات المدفوعة غير قابلة للاسترداد إلا بقرار من الإدارة.</li><li>قد نحدّث هذه الشروط، واستمرارك في الاستخدام يعني موافقتك عليها.</li></ol><p><a href="#/">الرجوع للرئيسية</a></p></section>';
}

const routes = { '/': home, '/login': login, '/signup': signup, '/dashboard': dashboard, '/admin': admin, '/terms': terms };

async function route() {
  await loadMe();
  root.innerHTML = nav() + (notice ? '<div class="banner" role="alert">' + esc(notice) + '</div>' : '') + '<main></main><footer><span>© ' + new Date().getFullYear() + ' ' + esc(C.PLATFORM_NAME) + '</span><a href="#/terms">شروط الاستخدام</a></footer>';
  notice = '';
  await (routes[location.hash.slice(1) || '/'] || home)(root.querySelector('main'));
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { await sb.auth.signOut(); location.hash = '#/'; route(); };
}
window.addEventListener('hashchange', route);
route();
