# Kenya Connect — Professional Blog Platform

Kenya Connect is now a dynamic, AdSense-ready blog platform with:
- SQLite-backed content storage
- Admin CMS dashboard
- SEO-ready routes (`sitemap.xml`, `robots.txt`)
- Social sharing and monetization slot support

## Core upgrades
- ✅ Dynamic database backend (`node:sqlite`) instead of JSON-only runtime storage
- ✅ CMS-style admin dashboard for posts, notices, ad slots, and newsletter export
- ✅ Monetization-ready ad slot configuration (header, sidebar, in-article)
- ✅ Newsletter rate limiting for abuse protection
- ✅ Privacy and cookie policy pages

## Tech stack
- **Backend:** Node.js HTTP server (`server.js`)
- **Database:** SQLite (`data/kenya_connect.db` via `db.js`)
- **Frontend:** HTML/CSS/JS (`public/`)

## Run locally
```bash
ADMIN_KEY=your-secret-key node server.js
```

Open:
- Website: `http://localhost:3000`
- Admin CMS: `http://localhost:3000/admin.html`
- Sitemap: `http://localhost:3000/sitemap.xml`
- Robots: `http://localhost:3000/robots.txt`

## Public APIs
- `GET /api/posts?category=<category>&q=<query>`
- `GET /api/trending`
- `GET /api/popular`
- `GET /api/info`
- `GET /api/settings/ads`
- `POST /api/posts/view`
- `POST /api/newsletter`

## Admin APIs (`x-admin-key` required)
- `POST /api/admin/posts`
- `PATCH /api/admin/posts/:id`
- `POST /api/admin/info`
- `POST /api/admin/settings/ads`
- `GET /api/admin/newsletter`

## Blueprint
For the full architecture, endpoint map, schema, and roadmap:
- `docs/ARCHITECTURE.md`
