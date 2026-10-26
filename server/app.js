require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
// JWT_SECRET wajib diisi di .env. Server menolak berjalan tanpa secret,
// supaya tidak ada secret tebakan yang bisa dipakai orang lain.
if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET belum diatur di file .env');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 };
const ONGKIR = { 'Kurir Lokal': 10000, 'JNE Reguler': 15000, 'Ambil di Toko': 0 };
const PEMBAYARAN = ['Transfer Bank', 'QRIS', 'COD'];
const STATUS_VALID = ['baru', 'diproses', 'dikirim', 'selesai', 'dibatalkan'];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

app.use(express.json());
app.use(cookieParser());

// ---------- Proteksi halaman HTML (di sisi server) ----------
const GUARDED_PAGES = { '/admin.html': 'admin', '/checkout.html': 'customer', '/pesanan.html': 'customer' };
app.use((req, res, next) => {
  const role = GUARDED_PAGES[req.path];
  if (!role) return next();
  try {
    const u = jwt.verify(req.cookies.token || '', JWT_SECRET);
    if (u.role === role) return next();
  } catch (_) { /* token tidak valid */ }
  res.redirect('/login.html?next=' + encodeURIComponent(req.originalUrl));
});
app.get('/admin', (req, res) => res.redirect('/admin.html'));
app.use(express.static(PUBLIC_DIR));

// ---------- Middleware autentikasi API ----------
function setSession(res, user) {
  const token = jwt.sign({ id: user.id, role: user.role, nama: user.nama }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, COOKIE_OPTS);
}
function requireRole(role) {
  return (req, res, next) => {
    try {
      const u = jwt.verify(req.cookies.token || '', JWT_SECRET);
      if (u.role !== role) return res.status(403).json({ message: 'Akses ditolak' });
      req.user = u;
      next();
    } catch (_) {
      res.status(401).json({ message: 'Silakan login terlebih dahulu' });
    }
  };
}
const requireAdmin = requireRole('admin');
const requireCustomer = requireRole('customer');

// ---------- Auth ----------
app.post('/api/auth/register', (req, res) => {
  const nama = (req.body.nama || '').trim();
  const email = (req.body.email || '').toLowerCase().trim();
  const password = req.body.password || '';
  if (!nama || !email || !password) return res.status(400).json({ message: 'Nama, email, dan password wajib diisi' });
  // Validasi format email sederhana
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Format email tidak valid' });
  if (password.length < 6) return res.status(400).json({ message: 'Password minimal 6 karakter' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ message: 'Email sudah terdaftar' });

  const info = db.prepare("INSERT INTO users (nama, email, password, role, no_hp) VALUES (?, ?, ?, 'customer', ?)")
    .run(nama, email, bcrypt.hashSync(password, 10), req.body.no_hp || null);
  const user = { id: info.lastInsertRowid, nama, role: 'customer' };
  setSession(res, user);
  res.status(201).json({ user });
});

// portal: 'customer' | 'admin' -> memisahkan akses pelanggan dan pemilik
app.post('/api/auth/login', (req, res) => {
  const { email, password, portal } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return res.status(401).json({ message: 'Email atau password salah' });
  }
  if (user.role !== portal) {
    return res.status(403).json({
      message: portal === 'admin'
        ? 'Akun ini bukan akun pemilik. Silakan masuk lewat tab Pelanggan.'
        : 'Akun ini adalah akun pemilik. Silakan masuk lewat tab Pemilik.'
    });
  }
  setSession(res, user);
  res.json({ user: { id: user.id, nama: user.nama, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  try {
    const u = jwt.verify(req.cookies.token || '', JWT_SECRET);
    res.json({ user: { id: u.id, nama: u.nama, role: u.role } });
  } catch (_) {
    res.json({ user: null });
  }
});

// ---------- Produk ----------
app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products WHERE is_aktif = 1 ORDER BY id').all());
});

function productInput(b) {
  const nama = (b.nama || '').trim();
  const harga = parseInt(b.harga, 10);
  if (!nama || !(harga >= 0)) return null;
  const nonaktif = b.is_aktif === false || b.is_aktif === 0 || b.is_aktif === '0';
  return {
    nama,
    deskripsi: b.deskripsi || '',
    harga,
    stok: parseInt(b.stok, 10) || 0,
    berat_gram: parseInt(b.berat_gram, 10) || null,
    foto_url: b.foto_url || '',
    is_aktif: nonaktif ? 0 : 1,
  };
}

app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY id').all());
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const p = productInput(req.body);
  if (!p) return res.status(400).json({ message: 'Nama dan harga wajib diisi dengan benar' });
  const info = db.prepare(`INSERT INTO products (nama, deskripsi, harga, stok, berat_gram, foto_url, is_aktif)
    VALUES (@nama, @deskripsi, @harga, @stok, @berat_gram, @foto_url, @is_aktif)`).run(p);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const p = productInput(req.body);
  if (!p) return res.status(400).json({ message: 'Nama dan harga wajib diisi dengan benar' });
  const info = db.prepare(`UPDATE products SET nama=@nama, deskripsi=@deskripsi, harga=@harga, stok=@stok,
    berat_gram=@berat_gram, foto_url=@foto_url, is_aktif=@is_aktif WHERE id=@id`).run({ ...p, id: req.params.id });
  if (!info.changes) return res.status(404).json({ message: 'Produk tidak ditemukan' });
  res.json({ ok: true });
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ ok: true, message: 'Produk dihapus' });
  } catch (_) {
    // Produk sudah pernah dipesan -> nonaktifkan saja agar riwayat pesanan aman
    db.prepare('UPDATE products SET is_aktif = 0 WHERE id = ?').run(req.params.id);
    res.json({ ok: true, message: 'Produk pernah dipesan, jadi dinonaktifkan' });
  }
});

// ---------- Pesanan ----------
app.get('/api/shipping', (req, res) => {
  res.json({ ongkir: ONGKIR, pembayaran: PEMBAYARAN });
});

// Membuat kode pesanan, contoh: TA20261023-7F3K
function genKode() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return 'TA' + ymd + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function withItems(orders) {
  const stmt = db.prepare('SELECT nama_produk, harga_satuan, qty, subtotal FROM order_items WHERE order_id = ?');
  return orders.map(o => ({ ...o, items: stmt.all(o.id) }));
}

app.post('/api/orders', requireCustomer, (req, res) => {
  const { items, nama_pelanggan, no_hp, alamat, metode_pengiriman, metode_pembayaran, catatan } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Keranjang kosong' });
  if (!nama_pelanggan || !no_hp || !alamat) return res.status(400).json({ message: 'Nama, nomor WhatsApp, dan alamat wajib diisi' });
  if (!/^[0-9+\-\s]{8,20}$/.test(String(no_hp))) return res.status(400).json({ message: 'Format nomor WhatsApp tidak valid' });
  if (!(metode_pengiriman in ONGKIR)) return res.status(400).json({ message: 'Metode pengiriman tidak valid' });
  if (!PEMBAYARAN.includes(metode_pembayaran)) return res.status(400).json({ message: 'Metode pembayaran tidak valid' });

  const createOrder = db.transaction(() => {
    let subtotal = 0;
    const lines = [];
    for (const it of items) {
      const qty = parseInt(it.qty, 10);
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND is_aktif = 1').get(it.product_id);
      if (!p) throw new HttpError(400, 'Ada produk yang tidak tersedia');
      if (!(qty > 0)) throw new HttpError(400, 'Jumlah produk tidak valid');
      if (p.stok < qty) throw new HttpError(400, `Stok ${p.nama} tidak cukup (sisa ${p.stok})`);

      db.prepare('UPDATE products SET stok = stok - ? WHERE id = ?').run(qty, p.id);
      lines.push({ product_id: p.id, nama: p.nama, harga: p.harga, qty, subtotal: p.harga * qty });
      subtotal += p.harga * qty;
    }

    const ongkir = ONGKIR[metode_pengiriman];
    const total = subtotal + ongkir;
    const kode = genKode();
    const info = db.prepare(`INSERT INTO orders (kode_order, user_id, nama_pelanggan, no_hp, alamat,
      metode_pengiriman, ongkir, total, metode_pembayaran, catatan) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(kode, req.user.id, nama_pelanggan, no_hp, alamat, metode_pengiriman, ongkir, total, metode_pembayaran, catatan || null);

    const ins = db.prepare(`INSERT INTO order_items (order_id, product_id, nama_produk, harga_satuan, qty, subtotal)
      VALUES (?,?,?,?,?,?)`);
    for (const l of lines) ins.run(info.lastInsertRowid, l.product_id, l.nama, l.harga, l.qty, l.subtotal);
    return { kode, total };
  });

  try {
    res.status(201).json(createOrder());
  } catch (e) {
    if (e.status) return res.status(e.status).json({ message: e.message });
    console.error(e);
    res.status(500).json({ message: 'Gagal membuat pesanan' });
  }
});

app.get('/api/my/orders', requireCustomer, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(withItems(orders));
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const { status } = req.query;
  const orders = STATUS_VALID.includes(status)
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  res.json(withItems(orders));
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!STATUS_VALID.includes(status)) return res.status(400).json({ message: 'Status tidak valid' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });

  db.transaction(() => {
    // Pembatalan mengembalikan stok
    if (status === 'dibatalkan' && order.status !== 'dibatalkan') {
      const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(order.id);
      for (const it of items) {
        if (it.product_id) db.prepare('UPDATE products SET stok = stok + ? WHERE id = ?').run(it.qty, it.product_id);
      }
    }
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  })();
  res.json({ ok: true });
});

// ---------- Konfirmasi pesanan berdasarkan kode (publik) ----------
// Kode pesanan dibuat acak, jadi hanya orang yang memegang kode yang bisa melihat detailnya.
app.get('/api/orders/:kode', (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE kode_order = ?').get(req.params.kode);
  if (!o) return res.status(404).json({ message: 'Pesanan dengan kode tersebut tidak ditemukan' });
  const items = db.prepare('SELECT nama_produk, harga_satuan, qty, subtotal FROM order_items WHERE order_id = ?').all(o.id);
  // Data pribadi pelanggan (nama, HP, alamat) sengaja tidak ditampilkan di sini
  res.json({
    kode_order: o.kode_order, status: o.status, created_at: o.created_at, total: o.total,
    ongkir: o.ongkir, metode_pengiriman: o.metode_pengiriman, metode_pembayaran: o.metode_pembayaran, items,
  });
});

// ---------- Dashboard admin ----------
app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  const today = db.prepare(`SELECT COUNT(*) AS jumlah, COALESCE(SUM(total), 0) AS omzet FROM orders
    WHERE date(created_at) = date('now','localtime') AND status != 'dibatalkan'`).get();
  const pending = db.prepare(`SELECT COUNT(*) AS n FROM orders WHERE status IN ('baru','diproses')`).get().n;
  const totalProduk = db.prepare('SELECT COUNT(*) AS n FROM products WHERE is_aktif = 1').get().n;
  const stokMenipis = db.prepare('SELECT nama, stok FROM products WHERE stok <= 5 AND is_aktif = 1 ORDER BY stok').all();
  res.json({ today, pending, totalProduk, stokMenipis });
});

// ---------- Error handling ----------
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint tidak ditemukan' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan di server' });
});

app.listen(PORT, () => console.log(`Toko telur asin berjalan di http://localhost:${PORT}`));
