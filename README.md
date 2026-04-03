# Kenya Connect — Elite Content Platform

Kenya Connect has been upgraded from a basic blog into a dynamic content platform with:
- SEO-friendly post URLs (`/post/:slug`)
- Category pages (`/category/:name`)
- Author pages (`/author/:slug`)
- Dynamic per-post SEO metadata
- Comments system
- Contact + About trust pages
- SQLite-backed CMS/API

## Run
```bash
ADMIN_KEY=your-secret-key node server.js
```

## Key URLs
- Home: `/`
- Post page: `/post/:slug`
- Category page: `/category/:name`
- Author page: `/author/:slug`
- Admin CMS: `/admin.html`
- About: `/about.html`
- Contact: `/contact.html`
- SEO: `/sitemap.xml`, `/robots.txt`

## Core APIs
### Public
- `GET /api/posts`
- `GET /api/post/:slug`
- `GET /api/category/:name`
- `GET /api/author/:slug`
- `GET /api/post/:slug/comments`
- `POST /api/post/:slug/comments`
- `POST /api/contact`

### Admin
- `POST /api/admin/posts` (supports slug, content, meta fields)
- `PATCH /api/admin/posts/:id` (draft/publish)
- `POST /api/admin/info`
- `POST /api/admin/settings/ads`
- `GET /api/admin/newsletter`

## Notes
- DB file is `data/kenya_connect.db` (ignored in git).
- Seed content still comes from `data/posts.json` and `data/info.json` when DB is empty.
