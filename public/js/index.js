let products = [];

function renderProducts() {
  const el = $('products');
  if (!products.length) { el.innerHTML = '<p>Belum ada produk.</p>'; return; }
  el.innerHTML = products.map(p => `
    <article class="card">
      <div class="thumb">${p.foto_url ? `<img src="${escapeHtml(p.foto_url)}" alt="">` : '🥚'}</div>
      <h3>${escapeHtml(p.nama)}</h3>
      <p class="muted">${escapeHtml(p.deskripsi || '')}</p>
      <p class="meta">${p.berat_gram ? p.berat_gram + ' gram · ' : ''}Stok: ${p.stok}</p>
      <div class="row">
        <strong>${rupiah(p.harga)}</strong>
        <button class="btn small primary" data-add="${p.id}" ${p.stok <= 0 ? 'disabled' : ''}>
          ${p.stok <= 0 ? 'Habis' : '+ Keranjang'}
        </button>
      </div>
    </article>`).join('');
}

function renderCart() {
  const cart = getCart();
  $('cart-count').textContent = cart.reduce((a, i) => a + i.qty, 0);
  $('cart-items').innerHTML = cart.length
    ? cart.map(i => `
      <div class="cart-row">
        <div><strong>${escapeHtml(i.nama)}</strong><br><small>${rupiah(i.harga)} × ${i.qty}</small></div>
        <div class="qty">
          <button data-act="dec" data-id="${i.id}">−</button>
          <span>${i.qty}</span>
          <button data-act="inc" data-id="${i.id}">+</button>
          <button data-act="del" data-id="${i.id}" class="link danger">Hapus</button>
        </div>
      </div>`).join('')
    : '<p class="muted">Keranjang masih kosong.</p>';
  $('cart-total').textContent = rupiah(cart.reduce((a, i) => a + i.harga * i.qty, 0));
}

$('products').addEventListener('click', e => {
  const id = Number(e.target.dataset.add);
  if (!id) return;
  const p = products.find(x => x.id === id);
  if (!p) return;
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (item) {
    if (item.qty >= p.stok) { toast('Stok tidak mencukupi', false); return; }
    item.qty++;
  } else {
    cart.push({ id: p.id, nama: p.nama, harga: p.harga, qty: 1, stok: p.stok });
  }
  saveCart(cart);
  renderCart();
  toast('Ditambahkan ke keranjang');
});

$('cart-items').addEventListener('click', e => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  let cart = getCart();
  const item = cart.find(i => String(i.id) === id);
  if (!item) return;
  if (act === 'inc') {
    if (item.qty >= item.stok) { toast('Stok tidak mencukupi', false); return; }
    item.qty++;
  }
  if (act === 'dec') item.qty--;
  if (act === 'del' || item.qty <= 0) cart = cart.filter(i => String(i.id) !== id);
  saveCart(cart);
  renderCart();
});

$('btn-cart').onclick = () => $('cart').classList.toggle('hidden');
$('btn-close-cart').onclick = () => $('cart').classList.add('hidden');
$('btn-checkout').onclick = () => {
  if (!getCart().length) { toast('Keranjang masih kosong', false); return; }
  location.href = '/checkout.html';
};

(async () => {
  await renderNav();
  try {
    products = await api('/api/products');
  } catch (err) {
    toast(err.message, false);
  }
  renderProducts();
  renderCart();
})();
