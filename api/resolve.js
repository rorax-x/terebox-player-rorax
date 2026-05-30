// api/resolve.js — Vercel Serverless Function
// Runs on Vercel's servers, so no CORS issues ever.
// Your jsToken and Cookie stay safely in environment variables.

export default async function handler(req, res) {
  // Allow your frontend to call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing ?url= parameter' });

  // ── Credentials from Vercel Environment Variables ──
  const JS_TOKEN = process.env.TERABOX_JS_TOKEN;
  const COOKIE   = process.env.TERABOX_COOKIE;

  if (!JS_TOKEN || !COOKIE) {
    return res.status(500).json({
      error: 'Server not configured. Add TERABOX_JS_TOKEN and TERABOX_COOKIE in Vercel environment variables.'
    });
  }

  // ── Extract surl from any Terabox URL format ──
  function extractSurl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      const match = u.pathname.match(/\/s\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      return u.searchParams.get('surl') || u.searchParams.get('shorturl') || null;
    } catch { return null; }
  }

  const surl = extractSurl(url);
  if (!surl) {
    return res.status(400).json({ error: 'Could not parse Terabox URL. Make sure it contains /s/ or surl=' });
  }

  const cookieStr = COOKIE.includes('jsToken=')
    ? COOKIE
    : `${COOKIE}; jsToken=${JS_TOKEN}`;

  const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36',
    'Referer': `https://www.terabox.app/sharing/link?surl=${surl}`,
    'Cookie': cookieStr,
    'Accept': 'application/json',
  };

  try {
    // ── Step 1: Get file list ──
    const listUrl = `https://www.terabox.app/share/list?app_id=250528&web=1&channel=dubox&clienttype=0&jsToken=${encodeURIComponent(JS_TOKEN)}&shorturl=${encodeURIComponent(surl)}&root=1`;

    const listResp = await fetch(listUrl, { headers: HEADERS });
    const listData = await listResp.json();

    if (listData.errno !== 0) {
      const msg = listData.errno === -6
        ? 'Token expired. Update TERABOX_JS_TOKEN in Vercel environment variables.'
        : `Terabox error ${listData.errno}: ${listData.errmsg || 'Unknown error'}`;
      return res.status(400).json({ error: msg });
    }

    const files = listData.list || [];
    if (!files.length) {
      return res.status(404).json({ error: 'No files found in this share link.' });
    }

    // Prefer video files
    const videoExts = /\.(mp4|mkv|avi|mov|flv|webm|m4v|ts|wmv|3gp)$/i;
    const file = files.find(f => videoExts.test(f.server_filename || f.filename || '')) || files[0];

    const fsId    = file.fs_id;
    const filename = file.server_filename || file.filename || 'video';
    const size     = file.size || 0;
    const thumb    = file.thumbs?.url3 || file.thumbs?.url2 || file.thumbs?.url1 || '';
    const sign     = listData.sign || '';
    const timestamp = listData.timestamp || '';

    // ── Step 2: Get direct download/stream link ──
    const dlUrl = `https://www.terabox.app/api/dlink?app_id=250528&web=1&channel=dubox&clienttype=0&jsToken=${encodeURIComponent(JS_TOKEN)}&sign=${encodeURIComponent(sign)}&timestamp=${timestamp}&fs_ids=[${fsId}]&type=1`;

    const dlResp = await fetch(dlUrl, { headers: HEADERS });
    const dlData = await dlResp.json();

    if (dlData.errno && dlData.errno !== 0) {
      return res.status(400).json({ error: `Stream error ${dlData.errno}: ${dlData.errmsg || 'Could not get stream URL'}` });
    }

    const dlink = dlData.dlink?.[0]?.dlink || dlData.list?.[0]?.dlink || '';
    if (!dlink) {
      return res.status(404).json({ error: 'Stream URL not found. File may be restricted.' });
    }

    // ── Step 3: Return everything to frontend ──
    return res.status(200).json({
      success: true,
      filename,
      size,
      thumb,
      stream_url: dlink,
      download_url: dlink,
    });

  } catch (err) {
    console.error('[TeraPlay API]', err);
    return res.status(500).json({ error: 'Server error: ' + (err.message || 'Unknown') });
  }
}
