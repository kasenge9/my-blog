const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_FILE = path.join(__dirname, 'data', 'kenya_connect.db');
const POSTS_SEED_FILE = path.join(__dirname, 'data', 'posts.json');
const INFO_SEED_FILE = path.join(__dirname, 'data', 'info.json');

const db = new DatabaseSync(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    category TEXT NOT NULL,
    author TEXT NOT NULL,
    date TEXT NOT NULL,
    image TEXT,
    trending INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

function readSeed(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function seedIfEmpty() {
  const postCount = db.prepare('SELECT COUNT(*) AS count FROM posts').get().count;
  if (postCount === 0) {
    const posts = readSeed(POSTS_SEED_FILE);
    const stmt = db.prepare(`
      INSERT INTO posts (title, summary, category, author, date, image, trending, views, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const post of posts) {
      stmt.run(
        post.title,
        post.summary,
        post.category,
        post.author || 'Kenya Connect Team',
        post.date || new Date().toISOString().slice(0, 10),
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

  const defaults = {
    ads_header: '',
    ads_sidebar: '',
    ads_in_article: ''
  };

  const upsert = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  Object.entries(defaults).forEach(([key, value]) => upsert.run(key, value));
}

seedIfEmpty();

module.exports = { db };
