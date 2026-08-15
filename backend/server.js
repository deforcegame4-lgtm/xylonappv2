/*
  ZeZo Song — Backend Proxy
  ---------------------------------------------------
  Tugasnya cuma dua:
  1. GET /api/search?q=...      -> cari lagu (proxy ke Piped, bypass CORS)
  2. GET /api/stream/:videoId   -> ambil link audio full durasi (proxy ke Piped)

  Setelah dapat link audio dari /api/stream/:videoId, dashboard.html akan
  memutar audio itu LANGSUNG (audioPlayer.src = url) — jadi server ini
  gak perlu nge-stream bytes audio yang berat, cuma ngurus request JSON kecil.
*/

/* ---------- auto-install paket yang belum ada, sebelum server jalan ---------- */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function ensureDependencies() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {});
    const missing = deps.filter((dep) => !fs.existsSync(path.join(__dirname, 'node_modules', dep)));
    if (missing.length) {
      console.log('Paket belum lengkap: ' + missing.join(', ') + ' — install otomatis, tunggu sebentar...');
      execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
      console.log('Install selesai, lanjut jalanin server.');
    }
  } catch (err) {
    console.error('Auto-install gagal (' + err.message + '). Jalankan manual: npm install lewat cPanel.');
  }
}
ensureDependencies();

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors()); // biar dashboard.html dari domain manapun boleh manggil server ini

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://piped-api.privacy.com.de',
  'https://api.piped.yt'
];

async function pipedFetch(endpointPath) {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(base + endpointPath);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && !data.error) return data;
    } catch (err) {
      // coba instance berikutnya
    }
  }
  throw new Error('Semua instance Piped gagal diakses dari server.');
}

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json([]);
  try {
    const data = await pipedFetch('/search?q=' + encodeURIComponent(q) + '&filter=music_songs');
    const results = (data.items || [])
      .filter((it) => it.url && it.url.indexOf('v=') !== -1)
      .map((it) => ({
        videoId: it.url.split('v=')[1].split('&')[0],
        title: it.title,
        artist: it.uploaderName || 'Unknown',
        duration: it.duration || 0,
        thumbnail: it.thumbnail || ''
      }));
    res.json(results);
  } catch (err) {
    res.status(502).json({ error: true, message: err.message });
  }
});

app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const data = await pipedFetch('/streams/' + req.params.videoId);
    const streams = (data.audioStreams || [])
      .filter((s) => s.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    if (!streams.length) {
      return res.status(404).json({ error: true, message: 'Audio stream tidak ditemukan.' });
    }
    res.json({ url: streams[0].url });
  } catch (err) {
    res.status(502).json({ error: true, message: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('ZeZo Song proxy aktif. Endpoint: /api/search?q=... dan /api/stream/:videoId');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('ZeZo Song proxy jalan di port ' + PORT));
