// Menampilkan detail satu pesanan berdasarkan kode di URL (?kode=...).
// Endpoint ini publik tetapi tidak mengirim data pribadi pelanggan,
// jadi kartu pesanan dibuat sendiri (tidak memakai orderBox).
(async () => {
  await renderNav();
  const kode = new URLSearchParams(location.search).get('kode');
  if (!kode) {
    $('detail').innerHTML = '<p class="muted">Kode pesanan tidak ditemukan. <a href="/">Kembali ke beranda</a></p>';
    return;
  }
  try {
    const o = await api('/api/orders/' + encodeURIComponent(kode));
    $('detail').innerHTML = `
      <article class="card">
        <div class="row">
          <strong>${escapeHtml(o.kode_order)}</strong>
          <span class="badge s-${escapeHtml(o.status)}">${escapeHtml(o.status)}</span>
        </div>
        <p class="muted">${escapeHtml(o.created_at)}</p>
        <ul>${o.items.map(i => `<li>${escapeHtml(i.nama_produk)} × ${i.qty} = ${rupiah(i.subtotal)}</li>`).join('')}</ul>
        <p class="muted">Ongkir ${rupiah(o.ongkir)} (${escapeHtml(o.metode_pengiriman)}) · Bayar: ${escapeHtml(o.metode_pembayaran)}</p>
        <div class="row"><strong>Total ${rupiah(o.total)}</strong></div>
      </article>
      <p><a href="/">Kembali belanja</a> · <a href="/pesanan.html">Pesanan saya</a></p>`;
  } catch (err) {
    $('detail').innerHTML = `<p class="muted">${escapeHtml(err.message)}</p><p><a href="/">Kembali ke beranda</a></p>`;
  }
})();
