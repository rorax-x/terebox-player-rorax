// api/resolve.js — Vercel Serverless Function
// Uses public Terabox API — no cookies or tokens needed!

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url= parameter' });

  try {
    // ── Try API 1: Robin's Cloudflare Worker ──
    const api1 = `https://terabox-worker.robinkumarshakya103.workers.dev/api?url=${encodeURIComponent(url)}`;
    
    const resp1 = await fetch(api1, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });

    const text1 = await resp1.text();
    let data1;
    try { data1 = JSON.parse(text1); } catch { data1 = null; }

    if (data1 && data1.success && data1.files && data1.files.length > 0) {
      const file = data1.files[0];
      return res.status(200).json({
        success: true,
        filename: file.file_name || 'video',
        size: file.size || 0,
        thumb: file.thumbnail || '',
        stream_url: file.streaming_url || file.download_url || file.original_download_url,
        download_url: file.download_url || file.original_download_url,
      });
    }

    // ── Try API 2: Ashlynn API ──
    const api2 = `https://ashlynn.serv00.net/Ashlynnterabox.php/?url=${encodeURIComponent(url)}`;
    
    const resp2 = await fetch(api2, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });

    const text2 = await resp2.text();
    let data2;
    try { data2 = JSON.parse(text2); } catch { data2 = null; }

    if (data2 && (data2.url || data2.download || data2.link || data2.video)) {
      const streamUrl = data2.url || data2.download || data2.link || data2.video;
      return res.status(200).json({
        success: true,
        filename: data2.filename || data2.name || 'video',
        size: data2.size || 0,
        thumb: data2.thumb || data2.thumbnail || '',
        stream_url: streamUrl,
        download_url: streamUrl,
      });
    }

    // ── Try API 3: pika-terabox-dl ──
    const api3 = `https://pika-terabox-dl.vercel.app/?url=${encodeURIComponent(url)}`;

    const resp3 = await fetch(api3, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });

    const text3 = await resp3.text();
    let data3;
    try { data3 = JSON.parse(text3); } catch { data3 = null; }

    if (data3 && data3.ok && data3.downloadLink) {
      return res.status(200).json({
        success: true,
        filename: data3.filename || 'video',
        size: data3.size || 0,
        thumb: '',
        stream_url: data3.downloadLink,
        download_url: data3.downloadLink,
      });
    }

    // ── All APIs failed ──
    return res.status(500).json({
      error: 'All public APIs failed. The link may be private, expired, or invalid.'
    });

  } catch (err) {
    console.error('[TeraPlay API]', err);
    return res.status(500).json({ error: 'Server error: ' + (err.message || 'Unknown') });
  }
}
