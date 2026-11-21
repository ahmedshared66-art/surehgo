// store.js — واجهة المتجر التفاعلية: هيدر بلوجو كبير وبحث وسلة، قايمة أقسام، سلة جانبية، سلايدر وأسهم
const _fwd = el => getComputedStyle(el).direction === 'rtl' ? -1 : 1;

function arrows(el) {
  if (!el || !el.parentNode || el.parentNode.classList.contains('car')) return;
  const w = document.createElement('div'); w.className = 'car';
  el.parentNode.insertBefore(w, el); w.appendChild(el);
  [['prev', -1], ['next', 1]].forEach(([c, d]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'car-' + c;
    b.setAttribute('aria-label', d > 0 ? 'التالي' : 'السابق');
    b.textContent = (d * _fwd(el)) > 0 ? '›' : '‹';
    b.onclick = () => el.scrollBy({ left: d * _fwd(el) * el.clientWidth * .8, behavior: 'smooth' });
    w.appendChild(b);
  });
}

function slider(el) {
  arrows(el);
  const n = el.children.length; if (n < 2) return;
  const dots = document.createElement('div'); dots.className = 'car-dots';
  for (let i = 0; i < n; i++) dots.appendChild(document.createElement('i'));
  el.parentNode.appendChild(dots);
  const mark = () => { const k = Math.round(Math.abs(el.scrollLeft) / el.clientWidth); [...dots.children].forEach((d, i) => d.classList.toggle('on', i === k)); };
  el.addEventListener('scroll', mark); mark();
  let hold = false; el.onmouseenter = () => hold = true; el.onmouseleave = () => hold = false;
  const t = setInterval(() => {
    if (!el.isConnected) { clearInterval(t); return; }
    if (hold || document.hidden) return;
    const end = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 4;
    end ? el.scrollTo({ left: 0, behavior: 'smooth' }) : el.scrollBy({ left: _fwd(el) * el.clientWidth, behavior: 'smooth' });
  }, 4500);
}

function siteEnhance() {
  document.querySelectorAll('.b-sld').forEach(slider);
  document.querySelectorAll('.b-trust').forEach(arrows);
}

function storeShell(site, cats, box) {
  const el = document.querySelector('.site[class*="sk-"]'); if (!el || el.querySelector('.sh')) return;
  const t = site.theme || {}, lg = /^https:\/\/[^\s"'()<>\\]+$/i.test(t.logo || '') ? t.logo : '';
  const wa = String(site.whatsapp || '').replace(/[^0-9]/g, '');
  const items = cats.map(c => '<button type="button" data-n="' + esc(c) + '">' + esc(c) + '</button>').join('');
  const sh = document.createElement('header'); sh.className = 'sh';
  sh.innerHTML = '<div class="sh-top"><div class="sh-logo">' + (lg ? '<img src="' + esc(lg) + '" alt="' + esc(site.name) + '">' : esc(site.name)) + '</div>' +
    '<form class="sh-search" role="search"><input type="search" placeholder="ابحث عن منتج" maxlength="60" aria-label="بحث"><button aria-label="بحث">🔍</button></form>' +
    '<div class="sh-act">' + (wa.length >= 8 && wa.length <= 15 ? '<a class="sh-wa" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">تواصل معنا</a>' : '') + '<button type="button" class="sh-cart">🛒 0</button></div></div>' +
    '<nav class="sh-nav">' + (cats.length ? '<div class="dd"><button type="button" class="dd-b">☰ الأقسام</button><div class="dd-m">' + items + '</div></div>' : '') + '<button type="button" data-n="">كل المنتجات</button>' + items + '</nav>';
  const go = () => box && box.scrollIntoView({ behavior: 'smooth' });
  sh.onclick = e => { const b = e.target.closest('[data-n]'); if (!b || !box) return; const ch = [...box.querySelectorAll('.chip')].find(x => x.dataset.c === b.dataset.n); if (ch) ch.click(); go(); };
  const inp = sh.querySelector('input'), sync = () => { const q = box && box.querySelector('#q'); if (q) { q.value = inp.value; q.dispatchEvent(new Event('input', { bubbles: true })); } };
  inp.oninput = sync; sh.querySelector('form').onsubmit = e => { e.preventDefault(); sync(); go(); };
  el.insertBefore(sh, el.firstChild);
  const ov = document.createElement('div'); ov.className = 'cart-ov'; el.appendChild(ov);
  if (!window._stOnce) {
    window._stOnce = 1;
    document.addEventListener('click', e => {
      const s = document.querySelector('.site[class*="sk-"]'); if (!s) return;
      if (e.target.closest('.sh-cart,.cart-fab')) s.classList.toggle('cart-open');
      else if (e.target.closest('.cp-x,.cart-ov')) s.classList.remove('cart-open');
    });
  }
}
