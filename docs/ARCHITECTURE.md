# Kenya Connect Elite Architecture

## Platform Shape
- Home feed + category hubs + author profiles + individual post pages.
- Server-rendered post pages for SEO metadata quality.

## Database
- `posts` with `slug`, `content`, meta fields, publish status, author linkage.
- `authors` for profile pages and E-E-A-T trust signals.
- `comments` for engagement on each post.
- `contacts` for trust and editorial communication.
- `site_settings` for monetization slots.

## URL Design
- `/post/:slug`
- `/category/:name`
- `/author/:slug`

## SEO
- Dynamic `<title>`, `<meta description>`, OG tags per post.
- `sitemap.xml` generated from published post slugs.
- `robots.txt` points to sitemap.

## CMS
- Admin can create content with:
  - slug
  - body/content
  - meta title/description
  - og image
  - draft/publish status
- Admin can manage ad slots and notices.

## Engagement + Trust
- Comment posting and listing per post.
- About + Contact pages and contact API.
- Privacy and Cookies pages remain available.


## Admin Security
- `/admin.html` is protected; unauthenticated users are redirected to `/admin-login.html`.
- Login via `/api/admin/login` issues an HttpOnly session cookie.
- Admin APIs require a valid session (or fallback x-admin-key).
