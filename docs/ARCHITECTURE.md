# Kenya Connect System Blueprint (AdSense-Ready)

## 1) Architecture Overview
- **Frontend:** Vanilla JS web client (upgrade path to Next.js/Nuxt)
- **Backend:** Node.js HTTP API (`server.js`)
- **Database:** SQLite (`data/kenya_connect.db`) via `node:sqlite`
- **Admin/CMS:** `/admin.html` with secured admin APIs (`x-admin-key`)
- **Monetization:** Configurable ad slots (`ads_header`, `ads_sidebar`, `ads_in_article`)

## 2) Database Schema
### posts
- `id` (PK)
- `title`, `summary`, `category`, `author`, `date`, `image`
- `trending` (0/1)
- `views` (for popularity ranking)
- `published` (0/1)

### info_notices
- `id` (PK)
- `title`, `message`, `created_at`

### newsletter_subscribers
- `id` (PK)
- `email` (unique)
- `subscribed_at`

### site_settings
- `key` (PK)
- `value`
- Current keys:
  - `ads_header`
  - `ads_sidebar`
  - `ads_in_article`

## 3) API Layout
### Public APIs
- `GET /api/posts?category=&q=`
- `GET /api/trending`
- `GET /api/popular`
- `GET /api/info`
- `GET /api/settings/ads`
- `POST /api/posts/view`
- `POST /api/newsletter`

### Admin APIs
- `POST /api/admin/posts`
- `PATCH /api/admin/posts/:id` (publish/unpublish)
- `POST /api/admin/info`
- `POST /api/admin/settings/ads`
- `GET /api/admin/newsletter`

## 4) Frontend Pages
- `/` Home + listing + sharing + ads slots
- `/admin.html` Admin dashboard (posts, notices, ads, newsletter export)
- `/privacy.html`
- `/cookies.html`

## 5) SEO & Discovery
- Dynamic `sitemap.xml` from published posts
- `robots.txt` with sitemap pointer
- Open Graph tags in homepage head

## 6) Monetization Logic
- Ad scripts saved in `site_settings`
- Public page requests `GET /api/settings/ads`
- Script snippets are rendered into header/sidebar/in-article ad containers

## 7) Security & Compliance
- Admin routes protected with `x-admin-key`
- Newsletter endpoint rate-limited (in-memory, per-IP, 5 req/min)
- Privacy and cookie policy pages provided

## 8) Recommended Next Upgrades
- Replace admin key with JWT + hashed users
- Add moderation and comments tables
- Move to Postgres for production scale
- Add analytics events table + dashboard charts
- Migrate frontend to Next.js for SSR and richer SEO control
