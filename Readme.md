# Chat-Pro-MultiServer

## Sistem Chat Terdistribusi dengan Failover Otomatis

![Version](https://img.shields.io/badge/version-3.0-blue)
![Status](https://img.shields.io/badge/status-stable-green)
![License](https://img.shields.io/badge/license-MIT-orange)

Chat-Pro-MultiServer adalah aplikasi chat realtime terdistribusi yang dirancang dengan penekanan pada ketersediaan tinggi dan toleransi kesalahan. Sistem ini mendukung failover otomatis antara beberapa server, sinkronisasi pesan realtime, dan pengalaman pengguna yang mulus bahkan saat terjadi kegagalan server.

## Fitur Utama

- **Arsitektur Terdistribusi**: Sistem master-slave dengan failover otomatis
- **Sinkronisasi Data Realtime**: Menggunakan Redis untuk berbagi pesan dan status pengguna
- **Auto-Discovery**: Server dapat secara otomatis menemukan satu sama lain dalam jaringan
- **UI Modern**: Tema Navy yang elegan dengan antarmuka yang responsif
- **Private Chat**: Dukungan untuk ruang obrolan privat dengan token
- **QR Code Access**: Akses mudah dari perangkat lain menggunakan QR code

## Persyaratan Sistem

- Python 3.7+
- Redis Server (opsional, namun diperlukan untuk fungsionalitas terdistribusi penuh)
- Koneksi jaringan antara server (untuk mode multi-server)

## Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/Halfirzzha/Chat-Pro-MultiServer.git
cd Chat-Pro-MultiServer
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Konfigurasi Server

Edit `config.json` untuk mengonfigurasi server:

#### Server Utama (Master)

```json
{
  "server": {
    "id": "server-master",
    "role": "master",
    "port": 5000,
    "host": "auto"
  },
  "redis": {
    "host": "localhost",
    "port": 6379,
    "password": null,
    "db": 0
  },
  "alternative_servers": []
}
```

#### Server Backup

```json
{
  "server": {
    "id": "server-backup1",
    "role": "backup",
    "port": 5000,
    "host": "auto"
  },
  "redis": {
    "host": "192.168.1.5",  # IP server Redis (biasanya server utama)
    "port": 6379,
    "password": null,
    "db": 0
  },
  "alternative_servers": [
    {
      "id": "server-master",
      "url": "http://192.168.1.5:5000",  # IP server utama
      "role": "master"
    }
  ]
}
```

### 4. Menjalankan Aplikasi

```bash
python app.py
```

Aplikasi akan otomatis mendeteksi IP lokal dan menjalankan server di port yang ditentukan. Anda dapat mengakses aplikasi melalui browser di `http://<IP_SERVER>:5000`.

## Cara Penggunaan

### Mengakses Aplikasi

- Buka browser dan akses `http://<IP_SERVER>:5000`
- Atau scan QR code yang ditampilkan di halaman login dari perangkat lain

### Chat Publik

1. Masuk dengan username (kosongkan field token)
2. Mulai chatting dengan pengguna lain dalam channel publik

### Chat Privat

1. Masukkan username dan token privat (atau buat token baru dengan mengklik ikon dadu)
2. Bagikan token dengan pengguna lain yang ingin Anda ajak chat secara privat
3. Hanya pengguna dengan token yang sama yang dapat melihat pesan dalam chat privat

### Menambahkan Server Baru

1. Klik ikon server di sudut kiri atas
2. Klik "Add Server"
3. Masukkan URL server baru
4. Klik "Tambahkan Server"

### Menguji Failover

1. Pastikan setidaknya dua server berjalan (master dan backup)
2. Matikan server master (Ctrl+C)
3. Client akan otomatis terhubung ke server backup dalam beberapa detik
4. Riwayat pesan dan data pengguna akan tetap tersedia (jika Redis dikonfigurasi)

## Arsitektur Teknis

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client Web    │◄────┤   Server Master │◄────┤  Server Backup  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └─────────────┬─────────┴───────────┬───────────┘
                       │                     │
                       ▼                     ▼
              ┌─────────────────┐    ┌─────────────────┐
              │  Redis Server   │    │  User Database  │
              └─────────────────┘    └─────────────────┘
```

### Komponen Utama

- **Frontend**: HTML/CSS/JavaScript murni dengan tema Navy
- **Backend**: Flask dengan Flask-SocketIO untuk komunikasi realtime
- **Penyimpanan Bersama**: Redis untuk penyimpanan pesan dan status pengguna
- **Health Check System**: Monitor status server secara berkala
- **Auto-Discovery**: Mekanisme untuk menemukan server dalam jaringan
- **Client-Side Failover**: Logika untuk mendeteksi kegagalan dan beralih ke server alternatif

## Troubleshooting

### WebSocket Transport Not Available

Jika melihat pesan "WebSocket transport not available", pastikan dependencies berikut sudah terinstall:

```bash
pip install simple-websocket eventlet
```

Dan tambahkan kode ini di awal `app.py`:

```python
import eventlet
eventlet.monkey_patch()
```

### Koneksi Redis Gagal

Jika Redis tidak dapat dihubungi:

1. Pastikan Redis server berjalan: `redis-cli ping` harus menjawab `PONG`
2. Verifikasi konfigurasi host/port Redis di `config.json`
3. Periksa firewall jika menggunakan Redis pada server terpisah

### Failover Tidak Berfungsi

Jika failover otomatis tidak bekerja:

1. Pastikan server backup terdaftar di panel server
2. Verifikasi koneksi antar server dapat dilakukan
3. Pastikan Redis berjalan (diperlukan untuk sinkronisasi)

## Keamanan

- Aplikasi ini dirancang untuk jaringan lokal atau intranet terpercaya
- Tidak ada enkripsi end-to-end untuk pesan
- Token chat privat disimpan sebagai plaintext
- Disarankan untuk menambahkan layer keamanan tambahan (seperti HTTPS) jika digunakan di internet publik

## Pengembangan Lanjutan

- [ ] Implementasi enkripsi end-to-end untuk pesan privat
- [ ] Penyimpanan pesan persisten menggunakan database
- [ ] Autentikasi pengguna yang lebih kuat
- [ ] Fitur upload file dan gambar
- [ ] Implementasi clustering Redis untuk skalabilitas lebih tinggi

## Kontribusi

Kontribusi selalu disambut baik! Jika Anda memiliki ide untuk memperbaiki aplikasi ini, silakan:

1. Fork repository
2. Buat branch fitur baru (`git checkout -b feature/amazing-feature`)
3. Commit perubahan Anda (`git commit -m 'Add some amazing feature'`)
4. Push ke branch (`git push origin feature/amazing-feature`)
5. Buka Pull Request

## Lisensi

Didistribusikan di bawah Lisensi MIT. Lihat `LICENSE` untuk informasi lebih lanjut.

## Kontak

Halfirzzha - [@halfirzzha](https://instagram.com/halfirzzha) - halfirzzha@gmail.com

Project Link: [https://github.com/Halfirzzha/OrbitChat-MultiServer](https://github.com/Halfirzzha/OrbitChat-MultiServer)

---

Dibuat dengan ❤️ oleh Halfirzzha<br>
© 2025 OrbitChat-MultiServer. All rights reserved.