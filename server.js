const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { db } = require('./db');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme-admin-key';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const PUBLIC_DIR = path.join(__dirname, 'public');

const newsletterRateLimit = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': MIME_TYPES['.json'] });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, contentType, payload) {
  res.writeHead(statusCode, { 'Content-Type': contentType });
  res.end(payload);
}

function isAdminRequest(req) {
  const providedKey = req.headers['x-admin-key'];
  return providedKey && providedKey === ADMIN_KEY;
}

function getRequestBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      callback(null, JSON.parse(body || '{}'));
    } catch {
      callback(new Error('Invalid JSON payload'));
    }
  });
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function applyNewsletterRateLimit(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReq = 5;

  const history = newsletterRateLimit.get(ip) || [];
  const fresh = history.filter((stamp) => now - stamp < windowMs);

  if (fresh.length >= maxReq) {
    newsletterRateLimit.set(ip, fresh);
    return false;
  }

  fresh.push(now);
  newsletterRateLimit.set(ip, fresh);
  return true;
}

function getAdsConfig() {
  const rows = db.prepare("SELECT key, value FROM site_settings WHERE key LIKE 'ads_%'").all();
  const result = { header: '', sidebar: '', inArticle: '' };

  for (const row of rows) {
    if (row.key === 'ads_header') result.header = row.value;
    if (row.key === 'ads_sidebar') result.sidebar = row.value;
    if (row.key === 'ads_in_article') result.inArticle = row.value;
  }

  return result;
}

function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/posts') {
    const category = url.searchParams.get('category');
    const query = (url.searchParams.get('q') || '').toLowerCase();

    let posts = db
      .prepare('SELECT * FROM posts WHERE published = 1 ORDER BY date DESC, id DESC')
      .all()
      .map((post) => ({ ...post, trending: Boolean(post.trending), published: Boolean(post.published) }));

    if (category && category !== 'All') {
      posts = posts.filter((post) => post.category === category);
    }

    if (query) {
      posts = posts.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.summary.toLowerCase().includes(query) ||
          post.category.toLowerCase().includes(query)
      );
    }

    return sendJson(res, 200, posts);
  }

  if (req.method === 'GET' && url.pathname === '/api/trending') {
    const posts = db
      .prepare('SELECT * FROM posts WHERE published = 1 AND trending = 1 ORDER BY date DESC, id DESC LIMIT 6')
      .all()
      .map((post) => ({ ...post, trending: Boolean(post.trending), published: Boolean(post.published) }));

    return sendJson(res, 200, posts);
  }

  if (req.method === 'GET' && url.pathname === '/api/popular') {
    const posts = db
      .prepare('SELECT * FROM posts WHERE published = 1 ORDER BY views DESC, date DESC LIMIT 5')
      .all()
      .map((post) => ({ ...post, trending: Boolean(post.trending), published: Boolean(post.published) }));

    return sendJson(res, 200, posts);
  }

  if (req.method === 'GET' && url.pathname === '/api/info') {
    const infoItems = db.prepare('SELECT id, title, message, created_at AS createdAt FROM info_notices ORDER BY id DESC').all();
    return sendJson(res, 200, infoItems);
  }

  if (req.method === 'GET' && url.pathname === '/api/settings/ads') {
    return sendJson(res, 200, getAdsConfig());
  }

  if (req.method === 'POST' && url.pathname === '/api/posts/view') {
    return getRequestBody(req, (err, payload) => {
      if (err || !payload.id) {
        return sendJson(res, 400, { message: 'Invalid payload.' });
      }

      db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(payload.id);
      return sendJson(res, 200, { message: 'View recorded.' });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/newsletter') {
    if (!applyNewsletterRateLimit(req)) {
      return sendJson(res, 429, { message: 'Too many requests. Please try again in a minute.' });
    }

    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });

      const email = (payload.email || '').trim().toLowerCase();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return sendJson(res, 400, { message: 'Please provide a valid email address.' });
      }

      try {
        db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(email);
        return sendJson(res, 201, { message: 'Thanks for subscribing to Kenya Connect!' });
      } catch {
        return sendJson(res, 409, { message: 'This email is already subscribed.' });
      }
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/newsletter') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });
    const subscribers = db
      .prepare('SELECT id, email, subscribed_at AS subscribedAt FROM newsletter_subscribers ORDER BY id DESC')
      .all();
    return sendJson(res, 200, subscribers);
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/posts') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });

    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });

      const title = (payload.title || '').trim();
      const summary = (payload.summary || '').trim();
      const category = (payload.category || '').trim();
      const author = (payload.author || '').trim() || 'Kenya Connect Team';
      const image = (payload.image || '').trim();

      if (!title || !summary || !category) {
        return sendJson(res, 400, { message: 'title, summary, and category are required.' });
      }

      const result = db
        .prepare(
          'INSERT INTO posts (title, summary, category, author, date, image, trending, views, published) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)'
        )
        .run(
          title,
          summary,
          category,
          author,
          payload.date || new Date().toISOString().slice(0, 10),
          image || 'https://source.unsplash.com/7DS9AKLs23o/1200x800',
          payload.trending ? 1 : 0,
          payload.published === false ? 0 : 1
        );

      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(result.lastInsertRowid);
      return sendJson(res, 201, { message: 'Post saved successfully.', post });
    });
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/admin/posts/')) {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });
    const postId = Number(url.pathname.split('/').pop());

    return getRequestBody(req, (err, payload) => {
      if (err || !postId) return sendJson(res, 400, { message: 'Invalid payload.' });

      const published = payload.published ? 1 : 0;
      db.prepare('UPDATE posts SET published = ? WHERE id = ?').run(published, postId);
      return sendJson(res, 200, { message: published ? 'Post published.' : 'Post unpublished.' });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/info') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });

    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });
      const title = (payload.title || '').trim();
      const message = (payload.message || '').trim();
      if (!title || !message) return sendJson(res, 400, { message: 'title and message are required.' });

      const result = db.prepare('INSERT INTO info_notices (title, message) VALUES (?, ?)').run(title, message);
      const info = db.prepare('SELECT id, title, message, created_at AS createdAt FROM info_notices WHERE id = ?').get(result.lastInsertRowid);
      return sendJson(res, 201, { message: 'Info notice added.', info });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/settings/ads') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });

    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });

      const mappings = [
        ['ads_header', payload.header || ''],
        ['ads_sidebar', payload.sidebar || ''],
        ['ads_in_article', payload.inArticle || '']
      ];

      const upsert = db.prepare(`
        INSERT INTO site_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      mappings.forEach(([key, value]) => upsert.run(key, value));
      return sendJson(res, 200, { message: 'Ad settings updated.', settings: getAdsConfig() });
    });
  }

  sendJson(res, 404, { message: 'API route not found.' });
}

function handleSpecialRoutes(res, url) {
  if (url.pathname === '/robots.txt') {
    const robots = `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`;
    sendText(res, 200, MIME_TYPES['.txt'], robots);
    return true;
  }

  if (url.pathname === '/sitemap.xml') {
    const posts = db.prepare('SELECT id, date FROM posts WHERE published = 1 ORDER BY date DESC').all();
    const urls = [`<url><loc>${BASE_URL}/</loc></url>`]
      .concat(posts.map((post) => `<url><loc>${BASE_URL}/posts/${post.id}</loc><lastmod>${post.date}</lastmod></url>`))
      .join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
    sendText(res, 200, MIME_TYPES['.xml'], xml);
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/')) {
    return handleApi(req, res, url);
  }

  if (handleSpecialRoutes(res, url)) return;

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Kenya Connect server running on http://localhost:${PORT}`);
});
