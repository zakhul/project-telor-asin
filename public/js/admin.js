const content = document.getElementById('content');
let editing = null;   // id produk yang sedang diedit
let byId = {};        // cache produk untuk form edit
let currentFilter = '';

(async () => {
  const me = await currentUser();
  if (!me || me.role !== 'admin') { location.href = '/login.html'; return; }
  $('admin-name').textContent = me.nama;
  show('dashboard');
})();

document.querySelectorAll('.nav-btn[data-view]').forEach(b =>
  b.addEventListener('click', () => show(b.dataset.view)));

$('btn-logout').onclick = async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = '/login.html';
};

function show(view) {
  document.querySelectorAll('.nav-btn[data-view]').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
  const views = {
    dashboard: viewDashboard,
    products: viewProducts,
    orders: () => viewOrders(currentFilter),
  };
  views[view]().catch(err => toast(err.message, false));
}

async function viewDashboard() {
  const d = await api('/api/admin/dashboard');
  content.innerHTML = `
    <h2>Ringkasan</h2>
    <div class="stats">
      <div class="stat"><span>Pesanan hari ini</span><strong>${d.today.jumlah}</strong></div>
      <div class="stat"><span>Omzet hari ini</span><strong>${rupiah(d.today.omzet)}</strong></div>
      <div class="stat"><span>Perlu diproses</span><strong>${d.pending}</strong></div>
      <div class="stat"><span>Produk aktif</span><strong>${d.totalProduk}</strong></div>
    </div>
    <h3>Stok menipis (≤ 5)</h3>
    ${d.stokMenipis.length
      ? `<ul>${d.stokMenipis.map(p => `<li>${escapeHtml(p.nama)} — sisa ${p.stok}</li>`).join('')}</ul>`
      : '<p class="muted">Semua stok aman.</p>'}`;
}

async function viewProducts() {
  const list = await api('/api/admin/products');
  byId = Object.fromEntries(list.map(p => [p.id, p]));
  content.innerHTML = `
    <div class="head">
      <h2>Kelola Produk</h2>
      <button class="btn primary" id="btn-new">+ Produk baru</button>
    </div>
    <form id="pform" class="card form hidden">
      <h3 id="pform-title">Produk baru</h3>
      <label>Nama <input name="nama" required></label>
      <label>Deskripsi <textarea name="deskripsi" rows="2"></textarea></label>
      <div class="grid2">
        <label>Harga (Rp) <input name="harga" type="number" min="0" required></label>
        <label>Stok <input name="stok" type="number" min="0" required></label>
        <label>Berat (gram) <input name="berat_gram" type="number" min="0"></label>
        <label>Status
          <select name="is_aktif"><option value="1">Aktif</option><option value="0">Nonaktif</option></select>
        </label>
      </div>
      <label>URL foto (opsional) <input name="foto_url" placeholder="https://..."></label>
      <div class="row">
        <button class="btn primary" type="submit">Simpan</button>
        <button class="btn" type="button" id="btn-cancel">Batal</button>
      </div>
    </form>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produk</th><th>Harga</th><th>Stok</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${list.map(p => `
            <tr>
              <td>${escapeHtml(p.nama)}</td>
              <td>${rupiah(p.harga)}</td>
              <td>${p.stok}</td>
              <td>${p.is_aktif ? 'Aktif' : 'Nonaktif'}</td>
              <td class="actions">
                <button class="link" data-edit="${p.id}">Edit</button>
                <button class="link danger" data-del="${p.id}">Hapus</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function openForm(p) {
  const f = $('pform');
  f.reset();
  f.classList.remove('hidden');
  $('pform-title').textContent = p ? 'Edit produk' : 'Produk baru';
  if (p) {
    f.nama.value = p.nama;
    f.deskripsi.value = p.deskripsi || '';
    f.harga.value = p.harga;
    f.stok.value = p.stok;
    f.berat_gram.value = p.berat_gram || '';
    f.is_aktif.value = p.is_aktif ? '1' : '0';
    f.foto_url.value = p.foto_url || '';
  }
  f.nama.focus();
}

async function viewOrders(filter) {
  currentFilter = filter;
  const orders = await api('/api/admin/orders' + (filter ? '?status=' + filter : ''));
  content.innerHTML = `
    <h2>Pesanan Masuk</h2>
    <div>${['', ...STATUSES].map(s =>
      `<button class="chip ${s === filter ? 'active' : ''}" data-filter="${s}">${s || 'Semua'}</button>`).join('')}</div>
    ${orders.length
      ? orders.map(o => orderBox(o, `
          <select data-status="${o.id}">
            ${STATUSES.map(s => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>`)).join('')
      : '<p class="muted">Belum ada pesanan.</p>'}`;
}

// Event delegation: satu listener untuk seluruh area konten
content.addEventListener('click', async e => {
  const t = e.target;
  try {
    if (t.dataset.filter !== undefined) return viewOrders(t.dataset.filter);
    if (t.id === 'btn-new') { editing = null; return openForm(null); }
    if (t.id === 'btn-cancel') return $('pform').classList.add('hidden');
    if (t.dataset.edit) { editing = t.dataset.edit; return openForm(byId[editing]); }
    if (t.dataset.del) {
      if (!confirm('Hapus produk ini?')) return;
      const r = await api(`/api/admin/products/${t.dataset.del}`, { method: 'DELETE' });
      toast(r.message || 'Produk dihapus');
      return viewProducts();
    }
  } catch (err) {
    toast(err.message, false);
  }
});

content.addEventListener('change', async e => {
  if (!e.target.dataset.status) return;
  try {
    await api(`/api/admin/orders/${e.target.dataset.status}/status`, {
      method: 'PATCH',
      body: { status: e.target.value },
    });
    toast('Status pesanan diperbarui');
    viewOrders(currentFilter);
  } catch (err) {
    toast(err.message, false);
  }
});

content.addEventListener('submit', async e => {
  if (e.target.id !== 'pform') return;
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  body.is_aktif = body.is_aktif === '1';
  try {
    if (editing) await api(`/api/admin/products/${editing}`, { method: 'PUT', body });
    else await api('/api/admin/products', { method: 'POST', body });
    toast('Produk tersimpan');
    viewProducts();
  } catch (err) {
    toast(err.message, false);
  }
});
