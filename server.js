const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { db, slugify, upsertAuthor } = require('./db');

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
  '.txt': 'text/plain; charset=utf-8'
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
  return req.headers['x-admin-key'] === ADMIN_KEY;
}

function getRequestBody(req, callback) {
  let body = '';
  req.on('data', (chunk) => (body += chunk));
  req.on('end', () => {
    try {
      callback(null, JSON.parse(body || '{}'));
    } catch {
      callback(new Error('Invalid JSON'));
    }
  });
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return sendText(res, 404, 'text/plain; charset=utf-8', 'Not Found');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function applyNewsletterRateLimit(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxReq = 5;
  const history = (newsletterRateLimit.get(ip) || []).filter((stamp) => now - stamp < windowMs);
  if (history.length >= maxReq) return false;
  history.push(now);
  newsletterRateLimit.set(ip, history);
  return true;
}

function getAdsConfig() {
  const rows = db.prepare("SELECT key, value FROM site_settings WHERE key LIKE 'ads_%'").all();
  const result = { header: '', sidebar: '', inArticle: '' };
  rows.forEach((row) => {
    if (row.key === 'ads_header') result.header = row.value;
    if (row.key === 'ads_sidebar') result.sidebar = row.value;
    if (row.key === 'ads_in_article') result.inArticle = row.value;
  });
  return result;
}

function postMap(post) {
  return { ...post, trending: Boolean(post.trending), published: Boolean(post.published) };
}

function renderPostPage(post) {
  const safeTitle = post.meta_title || `${post.title} | Kenya Connect`;
  const safeDescription = post.meta_description || post.summary;
  const safeOgImage = post.og_image || post.image;

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}" />
<meta property="og:title" content="${safeTitle}" />
<meta property="og:description" content="${safeDescription}" />
<meta property="og:image" content="${safeOgImage}" />
<link rel="stylesheet" href="/styles.css" />
</head><body>
<main class="container">
  <p><a href="/">← Back to home</a></p>
  <article class="sidebar"><section>
    <h1>${post.title}</h1>
    <p class="meta">${post.category} · ${post.date} · By <a href="/author/${post.author_slug}">${post.author}</a></p>
    <img src="${post.image}" alt="${post.title}" style="width:100%;border-radius:12px;" loading="lazy" />
    <p>${post.content.replace(/\n/g, '<br/>')}</p>
  </section></article>

  <section class="sidebar" style="margin-top:1rem;"><section>
    <h2>Comments</h2>
    <form id="comment-form" class="admin-form">
      <input name="name" placeholder="Your name" required />
      <textarea name="comment" placeholder="Your comment" required></textarea>
      <button type="submit">Post Comment</button>
    </form>
    <p id="comment-message" class="form-message"></p>
    <div id="comments-list"></div>
  </section></section>
</main>
<script>
async function loadComments(){
  const res=await fetch('/api/post/${post.slug}/comments');
  const comments=await res.json();
  document.getElementById('comments-list').innerHTML=comments.map(c=>'<p><strong>'+c.name+'</strong><br/>'+c.comment+'</p>').join('')||'<p class=\"meta\">No comments yet.</p>';
}

document.getElementById('comment-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const res=await fetch('/api/post/${post.slug}/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fd.get('name'),comment:fd.get('comment')})});
  const payload=await res.json();
  const m=document.getElementById('comment-message');
  m.textContent=payload.message;
  m.style.color=res.ok?'#15803D':'#C8102E';
  if(res.ok){e.target.reset();loadComments();}
});
loadComments();
</script>
</body></html>`;
}

function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/posts') {
    const category = url.searchParams.get('category');
    const query = (url.searchParams.get('q') || '').toLowerCase();
    let posts = db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY date DESC, id DESC').all().map(postMap);
    if (category && category !== 'All') posts = posts.filter((post) => post.category === category);
    if (query) posts = posts.filter((p) => `${p.title} ${p.summary} ${p.category}`.toLowerCase().includes(query));
    return sendJson(res, 200, posts);
  }

  if (url.pathname.startsWith('/api/post/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    const slug = parts[2];
    if (!slug) return sendJson(res, 404, { message: 'Post not found.' });

    if (parts[3] === 'comments') {
      const post = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
      if (!post) return sendJson(res, 404, { message: 'Post not found.' });

      if (req.method === 'GET') {
        const comments = db
          .prepare('SELECT id, name, comment, created_at AS createdAt FROM comments WHERE post_id = ? AND approved = 1 ORDER BY id DESC')
          .all(post.id);
        return sendJson(res, 200, comments);
      }

      if (req.method === 'POST') {
        return getRequestBody(req, (err, payload) => {
          if (err) return sendJson(res, 400, { message: 'Invalid payload.' });
          const name = (payload.name || '').trim();
          const comment = (payload.comment || '').trim();
          if (!name || !comment) return sendJson(res, 400, { message: 'Name and comment are required.' });
          db.prepare('INSERT INTO comments (post_id, name, comment, approved) VALUES (?, ?, ?, 1)').run(post.id, name, comment);
          return sendJson(res, 201, { message: 'Comment posted.' });
        });
      }
    }

    const post = db.prepare('SELECT * FROM posts WHERE slug = ? AND published = 1').get(slug);
    if (!post) return sendJson(res, 404, { message: 'Post not found.' });
    return sendJson(res, 200, postMap(post));
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/category/')) {
    const slug = decodeURIComponent(url.pathname.split('/').pop()).toLowerCase();
    const category = slug.charAt(0).toUpperCase() + slug.slice(1);
    const posts = db.prepare('SELECT * FROM posts WHERE published = 1 AND lower(category) = ? ORDER BY date DESC').all(slug).map(postMap);
    return sendJson(res, 200, { category, posts });
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/author/')) {
    const slug = decodeURIComponent(url.pathname.split('/').pop());
    const author = db.prepare('SELECT * FROM authors WHERE slug = ?').get(slug);
    if (!author) return sendJson(res, 404, { message: 'Author not found.' });
    const posts = db.prepare('SELECT * FROM posts WHERE author_slug = ? AND published = 1 ORDER BY date DESC').all(slug).map(postMap);
    return sendJson(res, 200, { author, posts });
  }

  if (req.method === 'GET' && url.pathname === '/api/trending') {
    const posts = db.prepare('SELECT * FROM posts WHERE published = 1 AND trending = 1 ORDER BY date DESC LIMIT 6').all().map(postMap);
    return sendJson(res, 200, posts);
  }

  if (req.method === 'GET' && url.pathname === '/api/popular') {
    const posts = db.prepare('SELECT * FROM posts WHERE published = 1 ORDER BY views DESC, date DESC LIMIT 5').all().map(postMap);
    return sendJson(res, 200, posts);
  }

  if (req.method === 'GET' && url.pathname === '/api/info') {
    const infoItems = db.prepare('SELECT id, title, message, created_at AS createdAt FROM info_notices ORDER BY id DESC').all();
    return sendJson(res, 200, infoItems);
  }

  if (req.method === 'GET' && url.pathname === '/api/settings/ads') return sendJson(res, 200, getAdsConfig());

  if (req.method === 'POST' && url.pathname === '/api/posts/view') {
    return getRequestBody(req, (err, payload) => {
      if (err || !payload.id) return sendJson(res, 400, { message: 'Invalid payload.' });
      db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(payload.id);
      return sendJson(res, 200, { message: 'View recorded.' });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/newsletter') {
    if (!applyNewsletterRateLimit(req)) return sendJson(res, 429, { message: 'Too many requests. Please try again in a minute.' });
    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });
      const email = (payload.email || '').trim().toLowerCase();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) return sendJson(res, 400, { message: 'Please provide a valid email address.' });
      try {
        db.prepare('INSERT INTO newsletter_subscribers (email) VALUES (?)').run(email);
        return sendJson(res, 201, { message: 'Thanks for subscribing to Kenya Connect!' });
      } catch {
        return sendJson(res, 409, { message: 'This email is already subscribed.' });
      }
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/contact') {
    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });
      const name = (payload.name || '').trim();
      const email = (payload.email || '').trim().toLowerCase();
      const message = (payload.message || '').trim();
      if (!name || !email || !message) return sendJson(res, 400, { message: 'All fields are required.' });
      db.prepare('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)').run(name, email, message);
      return sendJson(res, 201, { message: 'Message sent successfully.' });
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/newsletter') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });
    const subscribers = db.prepare('SELECT id, email, subscribed_at AS subscribedAt FROM newsletter_subscribers ORDER BY id DESC').all();
    return sendJson(res, 200, subscribers);
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/posts') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });
    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });
      const title = (payload.title || '').trim();
      const summary = (payload.summary || '').trim();
      const content = (payload.content || '').trim();
      const category = (payload.category || '').trim();
      const authorName = (payload.author || '').trim() || 'Kenya Connect Team';
      const image = (payload.image || '').trim() || 'https://source.unsplash.com/7DS9AKLs23o/1200x800';
      if (!title || !summary || !category) return sendJson(res, 400, { message: 'title, summary, and category are required.' });

      const author = upsertAuthor(authorName);
      const slug = payload.slug ? slugify(payload.slug) : slugify(title);
      const metaTitle = (payload.metaTitle || `${title} | Kenya Connect`).trim();
      const metaDescription = (payload.metaDescription || summary).trim();

      db.prepare(`
        INSERT INTO posts (slug, title, summary, content, category, author, author_slug, date, image, meta_title, meta_description, og_image, trending, views, published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
      `).run(
        slug,
        title,
        summary,
        content || summary,
        category,
        author.name,
        author.slug,
        payload.date || new Date().toISOString().slice(0, 10),
        image,
        metaTitle,
        metaDescription,
        payload.ogImage || image,
        payload.trending ? 1 : 0,
        payload.published === false ? 0 : 1
      );

      return sendJson(res, 201, { message: 'Post saved successfully.', slug });
    });
  }

  if (req.method === 'PATCH' && url.pathname.startsWith('/api/admin/posts/')) {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });
    const postId = Number(url.pathname.split('/').pop());
    return getRequestBody(req, (err, payload) => {
      if (err || !postId) return sendJson(res, 400, { message: 'Invalid payload.' });
      db.prepare('UPDATE posts SET published = ? WHERE id = ?').run(payload.published ? 1 : 0, postId);
      return sendJson(res, 200, { message: payload.published ? 'Post published.' : 'Post unpublished.' });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/info') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });
    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });
      const title = (payload.title || '').trim();
      const message = (payload.message || '').trim();
      if (!title || !message) return sendJson(res, 400, { message: 'title and message are required.' });
      db.prepare('INSERT INTO info_notices (title, message) VALUES (?, ?)').run(title, message);
      return sendJson(res, 201, { message: 'Info notice added.' });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/settings/ads') {
    if (!isAdminRequest(req)) return sendJson(res, 401, { message: 'Unauthorized admin request.' });
    return getRequestBody(req, (err, payload) => {
      if (err) return sendJson(res, 400, { message: 'Invalid request payload.' });
      const upsert = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      [['ads_header', payload.header || ''], ['ads_sidebar', payload.sidebar || ''], ['ads_in_article', payload.inArticle || '']].forEach(([k, v]) => upsert.run(k, v));
      return sendJson(res, 200, { message: 'Ad settings updated.' });
    });
  }

  sendJson(res, 404, { message: 'API route not found.' });
}

function handleSpecialRoutes(req, res, url) {
  if (url.pathname === '/robots.txt') {
    return sendText(res, 200, MIME_TYPES['.txt'], `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);
  }

  if (url.pathname === '/sitemap.xml') {
    const posts = db.prepare('SELECT slug, date FROM posts WHERE published = 1 ORDER BY date DESC').all();
    const urls = [`<url><loc>${BASE_URL}/</loc></url>`]
      .concat(posts.map((post) => `<url><loc>${BASE_URL}/post/${post.slug}</loc><lastmod>${post.date}</lastmod></url>`))
      .join('');
    return sendText(res, 200, MIME_TYPES['.xml'], `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  }

  if (url.pathname.startsWith('/post/')) {
    const slug = decodeURIComponent(url.pathname.split('/').pop());
    const post = db.prepare('SELECT * FROM posts WHERE slug = ? AND published = 1').get(slug);
    if (!post) return sendText(res, 404, 'text/plain; charset=utf-8', 'Post not found');
    return sendText(res, 200, MIME_TYPES['.html'], renderPostPage(post));
  }

  if (url.pathname.startsWith('/category/')) {
    return serveStatic(res, path.join(PUBLIC_DIR, 'category.html'));
  }

  if (url.pathname.startsWith('/author/')) {
    return serveStatic(res, path.join(PUBLIC_DIR, 'author.html'));
  }

  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);

  if (handleSpecialRoutes(req, res, url) !== false) return;

  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Kenya Connect server running on http://localhost:${PORT}`);
});
