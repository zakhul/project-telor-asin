// Uji otomatis alur utama. Jalankan server dulu (npm start), lalu: npm test
require('dotenv').config();

const BASE = process.env.BASE_URL || 'http://localhost:3000';
let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + name); };

// Kirim request dan simpan cookie sesi (token) bila ada
async function call(method, path, body, cookie) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: (res.headers.get('set-cookie') || '').split(';')[0] };
}

(async () => {
  const email = `uji${Date.now()}@mail.com`;

  // Pelanggan: daftar, login, dan pembatasan akses
  const reg = await call('POST', '/api/auth/register', { nama: 'Uji', email, password: '123456', no_hp: '08123456789' });
  check('daftar pelanggan baru', reg.status === 201);
  const cust = reg.cookie;

  check('password salah ditolak', (await call('POST', '/api/auth/login', { email, password: 'salah', portal: 'customer' })).status === 401);
  check('pelanggan tidak bisa masuk lewat tab pemilik', (await call('POST', '/api/auth/login', { email, password: '123456', portal: 'admin' })).status === 403);

  // Pemilik: login dan pembatasan akses
  const adm = await call('POST', '/api/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, portal: 'admin' });
  check('pemilik bisa login', adm.status === 200);
  check('API admin ditolak tanpa login', (await call('GET', '/api/admin/dashboard')).status === 401);
  check('pelanggan tidak bisa membuka API admin', (await call('GET', '/api/admin/dashboard', null, cust)).status === 403);

  // Alur pesanan: stok berkurang, konfirmasi bisa dibuka, pembatalan mengembalikan stok
  const products = (await call('GET', '/api/products')).data;
  const p = products[0];
  const order = await call('POST', '/api/orders', {
    items: [{ product_id: p.id, qty: 2 }], nama_pelanggan: 'Uji', no_hp: '08123456789',
    alamat: 'Jl. Uji 1', metode_pengiriman: 'JNE Reguler', metode_pembayaran: 'COD',
  }, cust);
  check('pelanggan bisa membuat pesanan', order.status === 201);

  const afterOrder = (await call('GET', '/api/products')).data.find(x => x.id === p.id);
  check('stok berkurang setelah pesanan', afterOrder.stok === p.stok - 2);

  const detail = await call('GET', '/api/orders/' + order.data.kode, null, cust);
  check('pemilik pesanan bisa membuka halaman konfirmasi', detail.status === 200);

  const list = (await call('GET', '/api/admin/orders', null, adm.cookie)).data;
  const ord = list.find(o => o.kode_order === order.data.kode);
  const cancel = await call('PATCH', `/api/admin/orders/${ord.id}/status`, { status: 'dibatalkan' }, adm.cookie);
  const restored = (await call('GET', '/api/products')).data.find(x => x.id === p.id);
  check('pembatalan pesanan mengembalikan stok', cancel.status === 200 && restored.stok === p.stok);

  console.log(`\nHasil: ${pass} lulus, ${fail} gagal`);
  process.exit(fail ? 1 : 0);
})().catch(e => {
  console.error('Tidak bisa terhubung ke server. Pastikan `npm start` sudah berjalan.\n', e.message);
  process.exit(1);
});
