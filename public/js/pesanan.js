(async () => {
  const me = await renderNav();
  if (!me || me.role !== 'customer') {
    location.href = '/login.html?next=' + encodeURIComponent('/pesanan.html');
    return;
  }
  try {
    const orders = await api('/api/my/orders');
    $('list').innerHTML = orders.length
      ? orders.map(o => orderBox(o)).join('')
      : '<p class="muted">Belum ada pesanan. <a href="/">Mulai belanja</a></p>';
  } catch (err) {
    toast(err.message, false);
  }
})();
