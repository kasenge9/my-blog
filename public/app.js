const latestEl = document.getElementById('latest-posts');
const trendingEl = document.getElementById('trending-posts');
const popularEl = document.getElementById('popular-posts');
const heroEl = document.getElementById('hero');
const infoItemsEl = document.getElementById('info-items');
const searchInput = document.getElementById('search-input');
const categoriesEl = document.getElementById('category-filters');
const newsletterForm = document.getElementById('newsletter-form');
const messageEl = document.getElementById('newsletter-message');
const themeToggle = document.getElementById('theme-toggle');
const adsHeaderEl = document.getElementById('ads-header');
const adsSidebarEl = document.getElementById('ads-sidebar');

const categories = ['All', 'Culture', 'Tech', 'Lifestyle', 'Education', 'Entertainment'];
let currentCategory = 'All';
const HERO_IMAGE = 'https://source.unsplash.com/7DS9AKLs23o/1200x800';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function socialShareLinks(post) {
  const postUrl = encodeURIComponent(`https://kenyaconnect.example/posts/${post.id}`);
  const text = encodeURIComponent(`${post.title} — via Kenya Connect`);

  return [
    { label: 'X', url: `https://twitter.com/intent/tweet?url=${postUrl}&text=${text}` },
    { label: 'Facebook', url: `https://www.facebook.com/sharer/sharer.php?u=${postUrl}` },
    { label: 'WhatsApp', url: `https://wa.me/?text=${text}%20${postUrl}` },
    { label: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${postUrl}` }
  ];
}

function maybeInArticleAd(adHtml) {
  if (!adHtml) return '';
  return `<div class="ad-slot inline-ad">${adHtml}</div>`;
}

function postCard(post, adHtml = '') {
  const shareLinks = socialShareLinks(post)
    .map((item) => `<a href="${item.url}" onclick="fetch('/api/post/${post.slug}/share',{method:'POST'})" target="_blank" rel="noopener noreferrer">${item.label}</a>`)
    .join('');

  return `
    <article class="post-card">
      <img src="${post.image}" alt="${post.title}" loading="lazy" />
      <div class="post-body">
        <p class="meta"><a href="/category/${post.category.toLowerCase()}">${post.category}</a> · ${formatDate(post.date)}</p>
        <h3><a href="/post/${post.slug}">${post.title}</a></h3>
        <p>${post.summary}</p>
        ${maybeInArticleAd(adHtml)}
        <div class="share-row">
          <span class="meta">Share:</span>
          ${shareLinks}
        </div>
      </div>
    </article>
  `;
}

function renderHero(post) {
  if (!post) return;
  heroEl.innerHTML = `
    <img src="${HERO_IMAGE}" alt="Lighthouse at sunset" />
    <div class="hero-content">
      <p class="meta">Featured · ${post.category} · ${formatDate(post.date)}</p>
      <h1>${post.title}</h1>
      <p>${post.summary}</p>
      <a class="cta" href="#">Read More</a>
    </div>
  `;
}

async function fetchAds() {
  const res = await fetch('/api/settings/ads');
  const ads = await res.json();

  if (ads.header) {
    adsHeaderEl.innerHTML = ads.header;
    adsHeaderEl.classList.remove('hidden');
  }

  if (ads.sidebar) {
    adsSidebarEl.innerHTML = ads.sidebar;
    adsSidebarEl.classList.remove('hidden');
  }

  return ads;
}

async function fetchInfoNotices() {
  const res = await fetch('/api/info');
  const infoItems = await res.json();
  if (!infoItems.length) {
    infoItemsEl.innerHTML = '<p class="meta">No notices yet.</p>';
    return;
  }

  infoItemsEl.innerHTML = infoItems
    .map(
      (item) => `
        <article class="info-item">
          <h3>${item.title}</h3>
          <p>${item.message}</p>
          <p class="meta">${formatDate(item.createdAt)}</p>
        </article>
      `
    )
    .join('');
}

async function fetchPosts(ads = { inArticle: '' }) {
  const q = encodeURIComponent(searchInput.value.trim());
  const category = encodeURIComponent(currentCategory);
  const res = await fetch(`/api/posts?category=${category}&q=${q}`);
  const posts = await res.json();

  latestEl.innerHTML = posts
    .map((post, index) => postCard(post, index === 1 ? ads.inArticle : ''))
    .join('') || '<p>No posts found.</p>';

  if (posts[0]) {
    renderHero(posts[0]);
    fetch('/api/posts/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: posts[0].id })
    });
  }
}

async function fetchTrending(ads = { inArticle: '' }) {
  const res = await fetch('/api/trending');
  const posts = await res.json();
  trendingEl.innerHTML = posts.map((post, index) => postCard(post, index === 0 ? ads.inArticle : '')).join('');
}

async function fetchPopular() {
  const res = await fetch('/api/popular');
  const posts = await res.json();
  popularEl.innerHTML = posts
    .map((post) => `<li><strong>${post.title}</strong><br /><span class="meta">${post.category}</span></li>`)
    .join('');
}

function renderCategories() {
  categoriesEl.innerHTML = categories
    .map(
      (name) =>
        `<button class="chip ${name === currentCategory ? 'active' : ''}" data-category="${name}">${name}</button>`
    )
    .join('');

  categoriesEl.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', async () => {
      currentCategory = chip.dataset.category;
      renderCategories();
      const ads = await fetchAds();
      await fetchPosts(ads);
    });
  });
}

searchInput.addEventListener('input', async () => {
  const ads = await fetchAds();
  await fetchPosts(ads);
});

newsletterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.getElementById('email').value;

  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  const payload = await res.json();
  messageEl.textContent = payload.message;
  messageEl.style.color = res.ok ? '#15803D' : '#C8102E';

  if (res.ok) newsletterForm.reset();
});

themeToggle.addEventListener('click', () => {
  const darkEnabled = document.documentElement.classList.toggle('dark');
  themeToggle.textContent = darkEnabled ? '☀️' : '🌙';
});

(async function init() {
  renderCategories();
  const ads = await fetchAds();
  await Promise.all([fetchInfoNotices(), fetchPosts(ads), fetchTrending(ads), fetchPopular()]);
})();
