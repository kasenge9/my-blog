const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, 'data', 'kenya_connect.db');
const POSTS_SEED_FILE = path.join(__dirname, 'data', 'posts.json');
const INFO_SEED_FILE = path.join(__dirname, 'data', 'info.json');

const db = new DatabaseSync(DB_FILE);

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content TEXT DEFAULT '',
    category TEXT NOT NULL,
    author TEXT NOT NULL,
    author_slug TEXT DEFAULT '',
    date TEXT NOT NULL,
    image TEXT,
    meta_title TEXT DEFAULT '',
    meta_description TEXT DEFAULT '',
    og_image TEXT DEFAULT '',
    trending INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    bio TEXT NOT NULL,
    image TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS info_notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    subscribed_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    comment TEXT NOT NULL,
    approved INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(post_id) REFERENCES posts(id)
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function ensureColumn(table, name, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
}

function runMigrations() {
  ensureColumn('posts', 'slug', 'TEXT');
  ensureColumn('posts', 'content', "TEXT DEFAULT ''");
  ensureColumn('posts', 'author_slug', "TEXT DEFAULT ''");
  ensureColumn('posts', 'meta_title', "TEXT DEFAULT ''");
  ensureColumn('posts', 'meta_description', "TEXT DEFAULT ''");
  ensureColumn('posts', 'og_image', "TEXT DEFAULT ''");
}

function readSeed(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function upsertAuthor(name) {
  const slug = slugify(name);
  const existing = db.prepare('SELECT * FROM authors WHERE slug = ?').get(slug);
  if (existing) return existing;

  db.prepare('INSERT INTO authors (slug, name, bio, image) VALUES (?, ?, ?, ?)').run(
    slug,
    name,
    `${name} writes for Kenya Connect on culture, opportunities, and modern Kenyan life.`,
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80'
  );

  return db.prepare('SELECT * FROM authors WHERE slug = ?').get(slug);
}

function seedIfEmpty() {
  const postCount = db.prepare('SELECT COUNT(*) AS count FROM posts').get().count;
  if (postCount === 0) {
    const posts = readSeed(POSTS_SEED_FILE);
    const stmt = db.prepare(`
      INSERT INTO posts (slug, title, summary, content, category, author, author_slug, date, image, meta_title, meta_description, og_image, trending, views, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const post of posts) {
      const author = upsertAuthor(post.author || 'Kenya Connect Team');
      const slug = post.slug || slugify(post.title);
      const metaTitle = `${post.title} | Kenya Connect`;
      const metaDescription = post.summary;
      const content = post.content || `${post.summary}\n\nKenya Connect brings verified insights and practical context for readers across Kenya and beyond.`;

      stmt.run(
        slug,
        post.title,
        post.summary,
        content,
        post.category,
        author.name,
        author.slug,
        post.date || new Date().toISOString().slice(0, 10),
        post.image || '',
        metaTitle,
        metaDescription,
        post.image || '',
        post.trending ? 1 : 0,
        post.views || 0
      );
    }
  }

  const noticeCount = db.prepare('SELECT COUNT(*) AS count FROM info_notices').get().count;
  if (noticeCount === 0) {
    const notices = readSeed(INFO_SEED_FILE);
    const stmt = db.prepare('INSERT INTO info_notices (title, message, created_at) VALUES (?, ?, ?)');
    for (const notice of notices) {
      stmt.run(notice.title, notice.message, notice.createdAt || new Date().toISOString());
    }
  }

  const defaults = { ads_header: '', ads_sidebar: '', ads_in_article: '' };
  const upsert = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  Object.entries(defaults).forEach(([key, value]) => upsert.run(key, value));
}

runMigrations();
seedIfEmpty();

module.exports = { db, slugify, upsertAuthor };
