// Fungsi bersama untuk semua halaman
const $ = id => document.getElementById(id);
const STATUSES = ['baru', 'diproses', 'dikirim', 'selesai', 'dibatalkan'];
const CART_KEY = 'telur_cart';

const rupiah = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Terjadi kesalahan');
  return data;
}

function toast(msg, ok = true) {
  const t = document.createElement('div');
  t.className = 'toast ' + (ok ? 'ok' : 'err');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

async function currentUser() {
  try { return (await api('/api/auth/me')).user; } catch (_) { return null; }
}

// Isi navigasi atas sesuai status login
async function renderNav() {
  const user = await currentUser();
  const nav = $('nav-user');
  if (nav) {
    const info = user
      ? `<span>Halo, ${escapeHtml(user.nama)}</span> `
        + (user.role === 'admin' ? '<a href="/admin.html">Dashboard</a>' : '<a href="/pesanan.html">Pesanan saya</a>')
        + ' <button id="btn-logout" class="link">Keluar</button>'
      : '<a href="/login.html">Masuk / Daftar</a>';
    nav.innerHTML = `<a href="/tentang.html">Tentang</a> <a href="/kontak.html">Kontak</a> <a href="/konfirmasi.html">Cek pesanan</a> ${info}`;
    const logout = $('btn-logout');
    if (logout) logout.onclick = async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.href = '/';
    };
  }
  return user;
}

// Keranjang disimpan di localStorage peramban
function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (_) { return []; }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// Kartu ringkasan pesanan (dipakai di halaman pelanggan dan admin)
function orderBox(o, extra = '') {
  return `
  <article class="card order">
    <div class="row">
      <strong>${escapeHtml(o.kode_order)}</strong>
      <span class="badge s-${o.status}">${escapeHtml(o.status)}</span>
    </div>
    <p class="muted">${escapeHtml(o.created_at)} · ${escapeHtml(o.nama_pelanggan)} · ${escapeHtml(o.no_hp)}</p>
    <p>${escapeHtml(o.alamat)}</p>
    <ul>${o.items.map(i => `<li>${escapeHtml(i.nama_produk)} × ${i.qty} = ${rupiah(i.subtotal)}</li>`).join('')}</ul>
    <p class="muted">Ongkir ${rupiah(o.ongkir)} (${escapeHtml(o.metode_pengiriman)}) · Bayar: ${escapeHtml(o.metode_pembayaran)}</p>
    ${o.catatan ? `<p class="muted">Catatan: ${escapeHtml(o.catatan)}</p>` : ''}
    <div class="row"><strong>Total ${rupiah(o.total)}</strong>${extra}</div>
  </article>`;
}
