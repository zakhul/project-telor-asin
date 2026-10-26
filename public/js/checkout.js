(async () => {
  const me = await renderNav();
  if (!me || me.role !== 'customer') {
    location.href = '/login.html?next=' + encodeURIComponent('/checkout.html');
    return;
  }
  const cart = getCart();
  if (!cart.length) {
    toast('Keranjang kosong', false);
    setTimeout(() => location.href = '/', 1200);
    return;
  }

  const { ongkir, pembayaran } = await api('/api/shipping');
  const form = $('form-checkout');
  $('sel-kirim').innerHTML = Object.entries(ongkir)
    .map(([k, v]) => `<option value="${escapeHtml(k)}">${escapeHtml(k)} (${rupiah(v)})</option>`).join('');
  $('sel-bayar').innerHTML = pembayaran.map(p => `<option>${escapeHtml(p)}</option>`).join('');
  form.nama_pelanggan.value = me.nama;

  const subtotal = cart.reduce((a, i) => a + i.harga * i.qty, 0);
  $('sum-items').innerHTML = cart.map(i =>
    `<div class="cart-total"><span>${escapeHtml(i.nama)} × ${i.qty}</span><span>${rupiah(i.harga * i.qty)}</span></div>`).join('');

  const updateTotal = () => {
    const o = ongkir[form.metode_pengiriman.value] || 0;
    $('sum-ongkir').textContent = rupiah(o);
    $('sum-total').textContent = rupiah(subtotal + o);
  };
  form.metode_pengiriman.onchange = updateTotal;
  updateTotal();

  form.onsubmit = async e => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    body.items = cart.map(i => ({ product_id: i.id, qty: i.qty }));
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      const r = await api('/api/orders', { method: 'POST', body });
      saveCart([]);
      document.querySelector('.checkout').classList.add('hidden');
      $('success').classList.remove('hidden');
      $('success').innerHTML = `
        <h2>Pesanan berhasil dibuat 🎉</h2>
        <p>Kode pesanan Anda: <strong>${escapeHtml(r.kode)}</strong></p>
        <p>Total pembayaran: <strong>${rupiah(r.total)}</strong></p>
        <p class="muted">Simpan kode ini. Admin akan menghubungi Anda lewat WhatsApp untuk instruksi pembayaran.</p>
        <p><a href="/konfirmasi.html?kode=${encodeURIComponent(r.kode)}">Lihat status pesanan</a> · <a href="/pesanan.html">Pesanan saya</a> · <a href="/">Kembali belanja</a></p>`;
    } catch (err) {
      toast(err.message, false);
      btn.disabled = false;
    }
  };
})();
