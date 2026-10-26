const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'shop.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','customer')),
  no_hp TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  harga INTEGER NOT NULL,
  stok INTEGER NOT NULL DEFAULT 0,
  berat_gram INTEGER,
  foto_url TEXT,
  is_aktif INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kode_order TEXT UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  nama_pelanggan TEXT NOT NULL,
  no_hp TEXT NOT NULL,
  alamat TEXT NOT NULL,
  metode_pengiriman TEXT NOT NULL,
  ongkir INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  metode_pembayaran TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'baru',
  catatan TEXT,
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  nama_produk TEXT NOT NULL,
  harga_satuan INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  subtotal INTEGER NOT NULL
);
`);

// Seed akun admin (pemilik) dari .env. Tidak ada password default:
// ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi.
const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const adminPass = process.env.ADMIN_PASSWORD || '';
if (!adminEmail || !adminPass) {
  console.error('ERROR: ADMIN_EMAIL dan ADMIN_PASSWORD wajib diisi di file .env');
  process.exit(1);
}
if (!db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail)) {
  db.prepare("INSERT INTO users (nama, email, password, role) VALUES (?, ?, ?, 'admin')")
    .run(process.env.ADMIN_NAME || 'Pemilik Toko', adminEmail, bcrypt.hashSync(adminPass, 10));
  console.log('Akun admin dibuat:', adminEmail);
}

// Seed produk contoh jika tabel masih kosong
if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
  const ins = db.prepare('INSERT INTO products (nama, deskripsi, harga, stok, berat_gram, foto_url) VALUES (?,?,?,?,?,?)');
  [
    ['Telur Asin Original (isi 2)', 'Telur bebek asin matang dengan kuning berminyak dan tekstur pulen.', 25000, 50, 120, ''],
    ['Telur Asin Original (isi 4)', 'Paket keluarga, cocok untuk lauk nasi dan oleh-oleh.', 45000, 40, 240, ''],
    ['Telur Asin Jumbo (1 butir)', 'Ukuran jumbo dengan kuning telur besar dan lebih gurih.', 15000, 30, 90, ''],
    ['Paket Hemat (10 butir)', 'Pilihan tepat untuk acara keluarga dan arisan.', 110000, 15, 600, ''],
  ].forEach(r => ins.run(...r));
  console.log('Produk contoh ditambahkan.');
}

module.exports = db;
