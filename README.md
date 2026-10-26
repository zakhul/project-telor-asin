# 🥚 Telur Asin Nusantara

Website toko online sederhana untuk menjual telur asin. Pelanggan dapat melihat produk, berbelanja, checkout, dan mengecek status pesanan. Pemilik dapat mengelola produk dan pesanan lewat dashboard admin.

## Fitur

**Pelanggan**
- Katalog produk dengan stok (produk habis tidak bisa dibeli)
- Keranjang belanja: tambah, kurangi, dan hapus item (tersimpan di browser)
- Checkout dengan pilihan pengiriman dan pembayaran, ongkir dihitung di server
- Daftar akun dan login, riwayat "Pesanan saya"
- Cek status pesanan memakai kode pesanan
- Halaman Tentang Kami dan Kontak

**Pemilik (admin)**
- Dashboard: pesanan dan omzet hari ini, pesanan yang perlu diproses, stok menipis
- Kelola produk: tambah, edit, nonaktifkan, dan hapus (produk yang pernah dipesan dinonaktifkan agar riwayat aman)
- Kelola pesanan: filter per status, ubah status, dan pembatalan yang otomatis mengembalikan stok

**Keamanan**
- Login pelanggan dan pemilik dipisah; akun pemilik tidak bisa masuk lewat tab pelanggan dan sebaliknya
- Password di-hash dengan bcrypt, sesi memakai JWT di cookie httpOnly
- Halaman dan API admin dilindungi di server
- Tidak ada credential default; server menolak berjalan jika `JWT_SECRET`, `ADMIN_EMAIL`, atau `ADMIN_PASSWORD` belum diisi

## Teknologi

- **Backend**: Node.js, Express
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML, CSS, dan JavaScript murni (tanpa framework)
- **Autentikasi**: JWT + bcryptjs

## Cara Menjalankan

Syarat: Node.js 18 atau lebih baru.

```bash
# 1. Install dependensi
npm install

# 2. Buat file .env dari contoh, lalu isi nilainya
cp .env.example .env        # Windows: copy .env.example .env

# 3. Jalankan server
npm start
```

Buka `http://localhost:3000`.

Isi `.env`:

| Variabel | Keterangan |
|---|---|
| `PORT` | Port server, default 3000 |
| `JWT_SECRET` | String acak panjang untuk menandatangani sesi (wajib) |
| `ADMIN_NAME` | Nama pemilik yang tampil di dashboard |
| `ADMIN_EMAIL` | Email akun pemilik (wajib) |
| `ADMIN_PASSWORD` | Password akun pemilik (wajib) |

Akun pemilik dibuat otomatis saat server pertama kali dijalankan. Database `data/shop.db` dan produk contoh juga dibuat otomatis.

## Alur Penggunaan

1. Pelanggan memilih produk, lalu menambahkannya ke keranjang.
2. Pelanggan login atau daftar, lalu checkout.
3. Sistem membuat pesanan dengan status `baru` dan menampilkan kode pesanan.
4. Pemilik login di tab **Pemilik**, melihat pesanan di dashboard, lalu mengubah statusnya (baru → diproses → dikirim → selesai).
5. Pelanggan bisa mengecek status lewat halaman **Cek pesanan** memakai kode pesanan.

## Struktur Folder

```
telur-asin-shop/
├── server/
│   ├── app.js            # Server Express: API auth, produk, pesanan, dashboard
│   └── db.js             # Skema database, akun pemilik, dan produk contoh
├── public/
│   ├── index.html        # Katalog dan keranjang
│   ├── login.html        # Login pelanggan / pemilik, daftar akun
│   ├── checkout.html     # Form pesanan
│   ├── pesanan.html      # Pesanan saya (pelanggan)
│   ├── konfirmasi.html   # Cek status pesanan dengan kode
│   ├── tentang.html      # Tentang kami
│   ├── kontak.html       # Kontak
│   ├── admin.html        # Dashboard pemilik
│   ├── css/style.css
│   └── js/               # common, index, login, checkout, pesanan, konfirmasi, admin
├── data/                 # Database SQLite (dibuat otomatis, tidak di-commit)
├── .env.example
├── .gitignore
└── package.json
```

## API Utama

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/auth/register` | Publik | Daftar akun pelanggan |
| POST | `/api/auth/login` | Publik | Login (membutuhkan `portal`: `customer` atau `admin`) |
| POST | `/api/auth/logout` | Publik | Logout |
| GET | `/api/auth/me` | Publik | Info sesi aktif |
| GET | `/api/products` | Publik | Daftar produk aktif |
| GET | `/api/shipping` | Publik | Daftar ongkir dan metode pembayaran |
| POST | `/api/orders` | Pelanggan | Buat pesanan |
| GET | `/api/orders/:kode` | Publik (kode acak) | Detail pesanan tanpa data pribadi pelanggan |
| GET | `/api/my/orders` | Pelanggan | Riwayat pesanan sendiri |
| GET | `/api/admin/products` | Pemilik | Semua produk |
| POST / PUT / DELETE | `/api/admin/products[/:id]` | Pemilik | Kelola produk |
| GET | `/api/admin/orders` | Pemilik | Semua pesanan (`?status=`) |
| PATCH | `/api/admin/orders/:id/status` | Pemilik | Ubah status pesanan |
| GET | `/api/admin/dashboard` | Pemilik | Ringkasan dashboard |

## Screenshot

<!-- Tambahkan screenshot di sini, misalnya: -->
<!-- ![Katalog](docs/katalog.png) -->
<!-- ![Dashboard pemilik](docs/dashboard.png) -->

## Link Deployment

<!-- Isi setelah aplikasi di-deploy, misalnya: https://telur-asin-shop.onrender.com -->

## Pengujian Manual

- [ ] Daftar akun pelanggan baru, lalu login
- [ ] Login pemilik dari tab Pelanggan ditolak, dan sebaliknya
- [ ] Tambah produk ke keranjang, ubah jumlah, lalu hapus
- [ ] Checkout, lalu stok produk berkurang
- [ ] Cek kode pesanan di halaman Cek pesanan
- [ ] Pemilik mengubah status pesanan
- [ ] Pemilik membatalkan pesanan, lalu stok kembali
- [ ] Tambah, edit, dan hapus produk
- [ ] Halaman responsif di HP

## Lisensi

Proyek ini dibuat untuk keperluan tugas (UTS) pemrograman web.
