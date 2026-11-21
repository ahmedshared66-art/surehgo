// shop.js — المرحلة 4: المتجر والحجوزات ولوحة صاحب الموقع
// بيتحمّل قبل app.js، وبيستخدم sb و esc و me و okUrl و U_HTTPS و uploadFile و arr و route من app.js وقت التشغيل.

const money = n => Number(n || 0).toLocaleString('ar-EG') + ' جنيه';
const getCart = id => { try { const c = JSON.parse(localStorage.getItem('cart:' + id) || '{}'); return c && typeof c === 'object' ? c : {}; } catch { return {}; } };
const setCart = (id, c) => { try { localStorage.setItem('cart:' + id, JSON.stringify(c)); } catch {} };
const ORD = { new: 'جديد', confirmed: 'تم التأكيد', delivered: 'تم التسليم', cancelled: 'ملغي' };
const BK = { new: 'جديد', confirmed: 'مؤكد', done: 'تم', cancelled: 'ملغي' };
const opts = (map, cur) => Object.keys(map).map(k => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + map[k] + '</option>').join('');
const fdate = d => new Date(d).toLocaleString('ar-EG');

// ====== صفحة الموقع العامة: المنتجات والسلة والحجز ======
async function shopSection(site) {
  const box = document.getElementById('shop-box'); if (!box) return;
  const { data } = await sb.from('products').select('*').eq('site_id', site.id).eq('active', true).order('created_at');
  const products = data || [], byId = {};
  products.forEach(p => byId[p.id] = p);
  if (!products.length && !site.booking_enabled) return;
  const today = new Date().toISOString().slice(0, 10);

  const storeHtml = products.length
    ? '<section class="shop"><h2 class="b-h">المتجر</h2><div class="prods">' + products.map(p => {
        const img = okUrl(p.image_url, U_HTTPS);
        return '<div class="prod">' + (img ? '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy">' : '') +
          '<b>' + esc(p.name) + '</b><p>' + esc(p.description) + '</p><div class="price">' + money(p.price) + '</div>' +
          '<button type="button" class="s-btn" data-add="' + esc(p.id) + '">أضف للسلة</button></div>';
      }).join('') + '</div>' +
      '<div id="cl"></div>' +
      '<form class="card" id="ord" hidden><h3>إتمام الطلب (الدفع عند الاستلام)</h3>' +
      '<label>الاسم<input class="rtl" name="name" required minlength="2" maxlength="100"></label>' +
      '<label>رقم الهاتف<input name="phone" type="tel" required minlength="6" maxlength="20"></label>' +
      '<label>العنوان<textarea class="rtl" name="address" rows="2" required maxlength="300"></textarea></label>' +
      '<label>ملاحظات<textarea class="rtl" name="note" rows="2" maxlength="300"></textarea></label>' +
      '<button class="btn">تأكيد الطلب</button></form><div class="msg" id="omsg" role="alert"></div></section>'
    : '';

  const bookHtml = site.booking_enabled
    ? '<section class="shop"><h2 class="b-h">احجز موعدك</h2><form class="card" id="bk">' +
      '<label>الاسم<input class="rtl" name="name" required minlength="2" maxlength="100"></label>' +
      '<label>رقم الهاتف<input name="phone" type="tel" required minlength="6" maxlength="20"></label>' +
      '<label>التاريخ<input name="date" type="date" required min="' + today + '"></label>' +
      '<label>الوقت<input name="time" type="time" required></label>' +
      '<label>ملاحظات<textarea class="rtl" name="note" rows="2" maxlength="300"></textarea></label>' +
      '<button class="btn">تأكيد الحجز</button></form><div class="msg" id="bmsg" role="alert"></div></section>'
    : '';

  box.innerHTML = storeHtml + bookHtml;

  const drawCart = () => {
    const el = box.querySelector('#cl'), form = box.querySelector('#ord'); if (!el) return;
    const cart = getCart(site.id), ids = Object.keys(cart).filter(k => byId[k] && cart[k] > 0);
    if (!ids.length) { el.innerHTML = '<p class="cart-empty">السلة فاضية.</p>'; form.hidden = true; return; }
    const total = ids.reduce((s, k) => s + byId[k].price * cart[k], 0);
    el.innerHTML = '<h3>السلة</h3><ul class="cart">' + ids.map(k =>
      '<li><span>' + esc(byId[k].name) + '</span><span class="qty"><button type="button" data-q="-1" data-id="' + esc(k) + '">-</button> ' + cart[k] +
      ' <button type="button" data-q="1" data-id="' + esc(k) + '">+</button></span><b>' + money(byId[k].price * cart[k]) + '</b></li>').join('') +
      '</ul><div class="cart-total">الإجمالي: <b>' + money(total) + '</b></div>';
    form.hidden = false;
  };
  drawCart();

  box.addEventListener('click', e => {
    const a = e.target.closest('[data-add]'), q = e.target.closest('[data-q]');
    const cart = getCart(site.id);
    if (a && byId[a.dataset.add]) cart[a.dataset.add] = Math.min((cart[a.dataset.add] || 0) + 1, 99);
    else if (q && byId[q.dataset.id]) { cart[q.dataset.id] = Math.min(Math.max((cart[q.dataset.id] || 0) + (+q.dataset.q), 0), 99); if (!cart[q.dataset.id]) delete cart[q.dataset.id]; }
    else return;
    setCart(site.id, cart); drawCart();
  });

  box.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target, f = new FormData(form);
    if (form.id === 'ord') {
      const msg = box.querySelector('#omsg'); msg.className = 'msg'; msg.textContent = '';
      const cart = getCart(site.id), items = Object.keys(cart).filter(k => byId[k] && cart[k] > 0).map(k => ({ id: k, qty: cart[k] }));
      if (!items.length) { msg.textContent = 'السلة فاضية.'; return; }
      const { error } = await sb.rpc('place_order', { p_site: site.id, p_name: f.get('name').trim(), p_phone: f.get('phone').trim(), p_address: f.get('address').trim(), p_note: f.get('note').trim(), p_items: items });
      if (error) { msg.textContent = 'تعذر إرسال الطلب. راجع البيانات وجرّب تاني.'; return; }
      setCart(site.id, {}); form.reset(); drawCart();
      msg.className = 'msg ok'; msg.textContent = 'تم استلام طلبك. هنتواصل معاك قريباً.';
    } else if (form.id === 'bk') {
      const msg = box.querySelector('#bmsg'); msg.className = 'msg'; msg.textContent = '';
      const { error } = await sb.from('bookings').insert({ site_id: site.id, customer_name: f.get('name').trim(), customer_phone: f.get('phone').trim(), booking_date: f.get('date'), booking_time: f.get('time'), note: f.get('note').trim() });
      if (error) { msg.textContent = 'تعذر إرسال الحجز. تأكد من التاريخ والبيانات وجرّب تاني.'; return; }
      form.reset(); msg.className = 'msg ok'; msg.textContent = 'تم إرسال طلب الحجز. هنؤكد معاك قريباً.';
    }
  });
}

// ====== لوحة صاحب الموقع: المنتجات والطلبات والحجوزات ======
async function manage(m, id) {
  if (!me) { location.hash = '#/login'; return; }
  const { data: site } = await sb.from('sites').select('*').eq('id', id).maybeSingle();
  if (!site || site.owner_id !== me.id) { location.hash = '#/dashboard'; return; }
  const [p, o, b] = await Promise.all([
    sb.from('products').select('*').eq('site_id', id).order('created_at', { ascending: false }),
    sb.from('orders').select('*').eq('site_id', id).order('created_at', { ascending: false }).limit(200),
    sb.from('bookings').select('*').eq('site_id', id).order('created_at', { ascending: false }).limit(200)
  ]);
  const err = p.error || o.error || b.error;
  if (err) { m.innerHTML = '<section class="wrap"><div class="msg">' + esc(err.message) + '</div><p>تأكد إنك شغّلت SQL المرحلة الرابعة.</p><p><a href="#/dashboard">الرجوع لمواقعي</a></p></section>'; return; }
  const products = p.data, orders = o.data, books = b.data;
  const revenue = orders.filter(x => x.status !== 'cancelled').reduce((s, x) => s + Number(x.total), 0);

  m.innerHTML = '<section class="wrap" style="max-width:1100px"><h1>إدارة: ' + esc(site.name) + '</h1><p><a href="#/dashboard">الرجوع لمواقعي</a> | <a href="#/s/' + esc(site.slug) + '" target="_blank">فتح الموقع</a></p>' +
    '<div class="stats"><div>الطلبات: <b>' + orders.length + '</b></div><div>طلبات جديدة: <b>' + orders.filter(x => x.status === 'new').length + '</b></div><div>الإيرادات: <b>' + money(revenue) + '</b></div><div>الحجوزات: <b>' + books.length + '</b></div></div>' +
    '<div class="msg" id="mmsg" role="alert"></div>' +
    '<h2>الحجوزات</h2><label class="chk"><input type="checkbox" id="bken"' + (site.booking_enabled ? ' checked' : '') + '> تفعيل نموذج الحجز في موقعي</label>' +
    '<h2 style="margin-top:28px">المنتجات</h2><form class="card" id="pf"><label>اسم المنتج<input class="rtl" name="name" required maxlength="100"></label><label>السعر (جنيه)<input name="price" type="number" min="0" max="10000000" step="0.01" required></label><label>الوصف<textarea class="rtl" name="description" rows="2" maxlength="500"></textarea></label><label>صورة المنتج (اختياري)<input type="file" name="img" accept="image/jpeg,image/png,image/webp"></label><button class="btn">إضافة المنتج</button></form>' +
    (products.length ? '<div class="tbl"><table><tr><th>المنتج</th><th>السعر</th><th>الحالة</th><th>إجراءات</th></tr>' + products.map(x =>
      '<tr><td>' + esc(x.name) + '</td><td>' + money(x.price) + '</td><td>' + (x.active ? 'ظاهر' : 'مخفي') + '</td><td class="act"><button class="btn sm ghost" data-pt="' + esc(x.id) + '" data-v="' + !x.active + '">' + (x.active ? 'إخفاء' : 'إظهار') + '</button><button class="btn sm warn" data-pd="' + esc(x.id) + '">حذف</button></td></tr>').join('') + '</table></div>' : '<p>لسه مفيش منتجات.</p>') +
    '<h2 style="margin-top:28px">الطلبات</h2>' +
    (orders.length ? '<div class="tbl"><table><tr><th>التاريخ</th><th>العميل</th><th>الهاتف</th><th>العنوان</th><th>الأصناف</th><th>الإجمالي</th><th>الحالة</th></tr>' + orders.map(x =>
      '<tr><td>' + fdate(x.created_at) + '</td><td>' + esc(x.customer_name) + '</td><td dir="ltr">' + esc(x.customer_phone) + '</td><td style="white-space:normal;min-width:160px">' + esc(x.customer_address) + (x.note ? '<br><small>' + esc(x.note) + '</small>' : '') + '</td><td style="white-space:normal;min-width:160px">' +
      arr(x.items).map(i => esc(i.name) + ' × ' + esc(i.qty)).join('<br>') + '</td><td>' + money(x.total) + '</td><td><select data-ost="' + esc(x.id) + '">' + opts(ORD, x.status) + '</select></td></tr>').join('') + '</table></div>' : '<p>لسه مفيش طلبات.</p>') +
    '<h2 style="margin-top:28px">طلبات الحجز</h2>' +
    (books.length ? '<div class="tbl"><table><tr><th>العميل</th><th>الهاتف</th><th>الموعد</th><th>ملاحظات</th><th>الحالة</th></tr>' + books.map(x =>
      '<tr><td>' + esc(x.customer_name) + '</td><td dir="ltr">' + esc(x.customer_phone) + '</td><td>' + esc(x.booking_date) + ' ' + esc(String(x.booking_time).slice(0, 5)) + '</td><td style="white-space:normal">' + esc(x.note) + '</td><td><select data-bst="' + esc(x.id) + '">' + opts(BK, x.status) + '</select></td></tr>').join('') + '</table></div>' : '<p>لسه مفيش حجوزات.</p>') +
    '</section>';

  const msg = m.querySelector('#mmsg'), done = r => { if (r.error) { msg.textContent = 'حصلت مشكلة: ' + r.error.message; return; } route(); };

  m.querySelector('#bken').onchange = async e => done(await sb.from('sites').update({ booking_enabled: e.target.checked }).eq('id', id));

  m.querySelector('#pf').onsubmit = async e => {
    e.preventDefault(); msg.textContent = '';
    const f = new FormData(e.target), file = f.get('img');
    try {
      const image_url = file && file.size ? await uploadFile(file, ['image']) : '';
      done(await sb.from('products').insert({ site_id: id, name: f.get('name').trim(), price: +f.get('price'), description: f.get('description').trim(), image_url }));
    } catch (er) { msg.textContent = er.message; }
  };

  m.onclick = async e => {
    const t = e.target.closest('[data-pt]'), d = e.target.closest('[data-pd]');
    if (t) done(await sb.from('products').update({ active: t.dataset.v === 'true' }).eq('id', t.dataset.pt));
    else if (d && confirm('حذف المنتج نهائياً؟')) done(await sb.from('products').delete().eq('id', d.dataset.pd));
  };
  m.onchange = async e => {
    const o2 = e.target.closest('[data-ost]'), b2 = e.target.closest('[data-bst]');
    if (o2) done(await sb.from('orders').update({ status: o2.value }).eq('id', o2.dataset.ost));
    else if (b2) done(await sb.from('bookings').update({ status: b2.value }).eq('id', b2.dataset.bst));
  };
}
