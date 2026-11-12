(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');

  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- state ---------- */
  let cart    = store.get('cart', []);
  let user    = store.get('user', null);
  let address = store.get('address', 'India');
  let orders  = store.get('orders', []);
  let coupon  = null;
  const COUPONS = { SAVE10: 10, WELCOME20: 20 };

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    let t = $('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---------- modal + sidebar ---------- */
  function closeModal() { $('.modal-overlay')?.remove(); $('.side-overlay')?.remove(); }
  function openModal(title, html) {
    closeModal();
    const o = document.createElement('div');
    o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <button class="modal-close" aria-label="Close">&times;</button>
        <h3>${esc(title)}</h3><div class="modal-body">${html}</div></div>`;
    o.addEventListener('click', e => { if (e.target === o || e.target.closest('.modal-close')) closeModal(); });
    document.body.appendChild(o);
    return $('.modal-body', o);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  /* ---------- products ---------- */
  const boxes = $$('.box');
  const products = boxes.map(b => ({
    id: b.dataset.id, name: b.dataset.name,
    category: b.dataset.category, price: Number(b.dataset.price)
  }));

  boxes.forEach((box, i) => {
    const p = products[i];
    const content = $('.box-content', box);
    const seeMore = $('p', content);
    seeMore.classList.add('see-more');
    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = inr(p.price);
    const btn = document.createElement('button');
    btn.className = 'add-btn';
    btn.textContent = 'Add to Cart';
    btn.addEventListener('click', () => addToCart(p.id));
    content.append(price, btn);
    seeMore.addEventListener('click', () => {
      $('#search-select, .search-select').value = p.category;
      $('#search-input').value = '';
      applyFilter();
      $('.shop-section').scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------- search / filter ---------- */
  const shop = $('.shop-section');
  const noRes = document.createElement('div');
  noRes.className = 'no-results';
  noRes.textContent = 'No products found. Try another search.';
  shop.appendChild(noRes);

  function applyFilter() {
    const q = $('#search-input').value.trim().toLowerCase();
    const cat = $('.search-select').value;
    let shown = 0;
    boxes.forEach((box, i) => {
      const p = products[i];
      const match = (cat === 'all' || p.category === cat) &&
                    (!q || p.name.toLowerCase().includes(q) || p.category.includes(q));
      box.classList.toggle('hidden', !match);
      if (match) shown++;
    });
    noRes.style.display = shown ? 'none' : 'block';
  }
  $('#search-btn').addEventListener('click', () => { applyFilter(); shop.scrollIntoView({ behavior: 'smooth' }); });
  $('#search-input').addEventListener('keydown', e => { if (e.key === 'Enter') { applyFilter(); shop.scrollIntoView({ behavior: 'smooth' }); } });
  $('#search-input').addEventListener('input', applyFilter);
  $('.search-select').addEventListener('change', applyFilter);

  /* ---------- cart ---------- */
  function saveCart() { store.set('cart', cart); updateCartCount(); }
  function updateCartCount() { $('#cart-count').textContent = cart.reduce((s, i) => s + i.qty, 0); }

  function addToCart(id) {
    const p = products.find(x => x.id === id);
    const item = cart.find(x => x.id === id);
    item ? item.qty++ : cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
    saveCart();
    toast(`${p.name} added to cart`);
  }

  function cartTotals() {
    const sub = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const disc = coupon ? sub * COUPONS[coupon] / 100 : 0;
    return { sub, disc, total: sub - disc };
  }

  function renderCart() {
    const body = openModal('Shopping Cart', '');
    if (!cart.length) { body.innerHTML = '<p class="muted">Your cart is empty.</p>'; return; }
    const { sub, disc, total } = cartTotals();
    body.innerHTML = cart.map(i => `
      <div class="cart-row" data-id="${esc(i.id)}">
        <div><div>${esc(i.name)}</div><small>${inr(i.price)} each</small></div>
        <div class="qty">
          <button data-act="dec">−</button><span>${i.qty}</span><button data-act="inc">+</button>
          <button data-act="del" title="Remove">🗑</button>
        </div>
      </div>`).join('') + `
      <div class="coupon-row">
        <input id="coupon-input" placeholder="Coupon code (SAVE10 / WELCOME20)" value="${esc(coupon || '')}">
        <button class="secondary" data-act="coupon">Apply</button>
      </div>
      <div class="total-row"><span>Subtotal</span><span>${inr(sub)}</span></div>
      ${coupon ? `<div class="total-row"><span>Discount (${esc(coupon)})</span><span>− ${inr(disc)}</span></div>` : ''}
      <div class="total-row"><span>Total</span><span>${inr(total)}</span></div>
      <button class="primary" data-act="checkout">Proceed to Buy</button>`;

    body.onclick = e => {
      const act = e.target.dataset.act;
      if (!act) return;
      const row = e.target.closest('.cart-row');
      const item = row && cart.find(x => x.id === row.dataset.id);
      if (act === 'inc') item.qty++;
      if (act === 'dec') item.qty = Math.max(1, item.qty - 1);
      if (act === 'del') cart = cart.filter(x => x !== item);
      if (act === 'coupon') {
        const code = $('#coupon-input').value.trim().toUpperCase();
        if (COUPONS[code]) { coupon = code; toast(`Coupon applied: ${COUPONS[code]}% off`); }
        else { coupon = null; toast('Invalid coupon'); }
      }
      if (act === 'checkout') return checkout();
      saveCart(); renderCart();
    };
  }

  function checkout() {
    if (!user) { toast('Please sign in to place your order'); return openSignin(); }
    const { total } = cartTotals();
    orders.unshift({
      id: 'OD' + Date.now().toString().slice(-8),
      date: new Date().toLocaleDateString('en-IN'),
      items: cart.map(i => `${i.name} × ${i.qty}`),
      total, address
    });
    store.set('orders', orders);
    cart = []; coupon = null; saveCart();
    openModal('Order placed ✅', `<p>Thank you, ${esc(user.name)}! Your order total of <b>${inr(total)}</b> will be delivered to ${esc(address)}.</p>`);
  }
  $('#nav-cart').addEventListener('click', renderCart);

  /* ---------- sign in ---------- */
  function updateHello() { $('#hello-text').textContent = user ? `Hello, ${user.name}` : 'Hello, sign in'; }

  function openSignin() {
    if (user) {
      const body = openModal('Your Account', `<p>Signed in as <b>${esc(user.name)}</b><br><span class="muted" style="font-size:.9rem">${esc(user.email)}</span></p><br>
        <button class="primary" id="signout">Sign out</button>`);
      $('#signout', body).onclick = () => { user = null; store.set('user', null); updateHello(); closeModal(); toast('Signed out'); };
      return;
    }
    const body = openModal('Sign in', `
      <form id="signin-form">
        <label>Name</label><input id="su-name" required>
        <label>Email</label><input id="su-email" type="email" required>
        <label>Password (min 6 characters)</label><input id="su-pass" type="password" minlength="6" required>
        <button class="primary" type="submit">Continue</button>
      </form>`);
    $('#signin-form', body).addEventListener('submit', e => {
      e.preventDefault();
      user = { name: $('#su-name').value.trim(), email: $('#su-email').value.trim() };
      store.set('user', user);   // password is intentionally NOT stored
      updateHello(); closeModal(); toast(`Welcome, ${user.name}!`);
    });
  }
  $('#nav-signin').addEventListener('click', openSignin);

  /* ---------- returns & orders ---------- */
  $('#nav-orders').addEventListener('click', () => {
    const html = orders.length
      ? orders.map(o => `<div class="cart-row" style="display:block">
          <b>${esc(o.id)}</b> <span class="muted">· ${esc(o.date)}</span><br>
          ${o.items.map(esc).join(', ')}<br>
          <b>${inr(o.total)}</b> <span class="muted">→ ${esc(o.address)}</span></div>`).join('')
      : '<p class="muted">You have no orders yet.</p>';
    openModal('Returns & Orders', html);
  });

  /* ---------- delivery address ---------- */
  function setAddressText() { $('.add-two').textContent = address; }
  $('#nav-address').addEventListener('click', () => {
    const body = openModal('Choose your location', `
      <input id="addr-input" placeholder="Enter city or pincode" value="${address === 'India' ? '' : esc(address)}">
      <button class="primary" id="addr-save">Apply</button>`);
    $('#addr-save', body).onclick = () => {
      const v = $('#addr-input').value.trim();
      address = v || 'India';
      store.set('address', address); setAddressText(); closeModal(); toast('Location updated');
    };
  });

  /* ---------- left menu (All) ---------- */
  $('#menu-btn').addEventListener('click', () => {
    closeModal();
    const o = document.createElement('div');
    o.className = 'side-overlay';
    const cats = [['health','Health & Personal Care'],['electronics','Electronics'],['fashion','Fashion'],['home','Home & Kitchen'],['books','Books'],['toys','Toys & Games'],['sports','Sports & Fitness']];
    o.innerHTML = `<div class="sidebar"><div class="side-head"><span>${user ? 'Hello, ' + esc(user.name) : 'Hello, sign in'}</span><button aria-label="Close">&times;</button></div>
      <div class="side-item" data-cat="all">All Products</div>
      ${cats.map(([v, n]) => `<div class="side-item" data-cat="${v}">${n}</div>`).join('')}</div>`;
    o.addEventListener('click', e => {
      const item = e.target.closest('.side-item');
      if (item) { $('.search-select').value = item.dataset.cat; $('#search-input').value = ''; applyFilter(); closeModal(); shop.scrollIntoView({ behavior: 'smooth' }); }
      else if (e.target === o || e.target.closest('button')) closeModal();
    });
    document.body.appendChild(o);
  });

  /* ---------- top panel links ---------- */
  $('#deals-btn').addEventListener('click', () => {
    $('.search-select').value = 'electronics'; $('#search-input').value = '';
    applyFilter(); shop.scrollIntoView({ behavior: 'smooth' });
  });

  $$('.panel-ops p').forEach(p => p.addEventListener('click', () => {
    const name = p.textContent.trim();
    if (name === 'Coupons') {
      openModal('Available Coupons', `<div class="cart-row"><div><b>SAVE10</b><br><small>10% off your order</small></div></div>
        <div class="cart-row"><div><b>WELCOME20</b><br><small>20% off your order</small></div></div>
        <p class="muted" style="margin-top:10px">Apply these in your cart.</p>`);
    } else if (name === "Today's Deals") {
      $('.search-select').value = 'all'; $('#search-input').value = ''; applyFilter();
      shop.scrollIntoView({ behavior: 'smooth' });
    } else if (name === 'Gift Cards') {
      openModal('Gift Cards', '<p>Choose an amount:</p><br>' + [500, 1000, 2000].map(a => `<button class="secondary gc" data-a="${a}" style="margin:0 6px 6px 0">${inr(a)}</button>`).join(''))
        .addEventListener('click', e => { if (e.target.dataset.a) { closeModal(); toast(`${inr(+e.target.dataset.a)} gift card selected`); } });
    } else if (name === 'Sell') {
      window.open('https://sell.amazon.in', '_blank', 'noopener');
    } else if (name === 'Prime Video') {
      window.open('https://www.primevideo.com', '_blank', 'noopener');
    } else {
      toast(`${name} — coming soon`);
    }
  }));

  /* ---------- footer ---------- */
  $('#back-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  $$('footer ul a, .pages a').forEach(a => a.addEventListener('click', () => toast(`${a.textContent.trim()} — coming soon`)));

  /* ---------- init ---------- */
  updateCartCount(); updateHello(); setAddressText();
})();
