/*
  ZeZo Song — Backend Proxy (versi Vercel / serverless)
  ---------------------------------------------------
  Tugasnya cuma dua:
  1. GET /api/search?q=...      -> cari lagu (proxy ke Piped, bypass CORS)
  2. GET /api/stream/:videoId   -> ambil link audio full durasi (proxy ke Piped)

  Beda dari versi cPanel: di Vercel gak ada app.listen() karena Vercel yang
  ngatur siklus hidup server-nya (serverless). Kita cukup export "app"-nya.
*/

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

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

app.get('/api', (req, res) => {
  res.send('ZeZo Song proxy aktif. Endpoint: /api/search?q=... dan /api/stream/:videoId');
});

module.exports = app;
