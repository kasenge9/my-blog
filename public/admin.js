const postForm = document.getElementById('post-form');
const infoForm = document.getElementById('info-form');
const adsForm = document.getElementById('ads-form');
const newsletterForm = document.getElementById('newsletter-form');
const logoutBtn = document.getElementById('logout-btn');
const aiForm = document.getElementById('ai-form');
const aiMessage = document.getElementById('ai-message');
const aiOutput = document.getElementById('ai-output');
const analyticsBtn = document.getElementById('analytics-btn');
const analyticsMessage = document.getElementById('analytics-message');
const analyticsOutput = document.getElementById('analytics-output');

const postMessage = document.getElementById('post-message');
const infoMessage = document.getElementById('info-message');
const adsMessage = document.getElementById('ads-message');
const newsletterMessage = document.getElementById('newsletter-message');
const newsletterExport = document.getElementById('newsletter-export');

function setMessage(element, message, ok) {
  element.textContent = message;
  element.style.color = ok ? '#15803D' : '#C8102E';
}

async function adminFetch(url, options = {}) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    location.href = '/admin-login.html';
    return null;
  }
  return response;
}

postForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(postForm);

  const response = await adminFetch('/api/admin/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: formData.get('title'),
      summary: formData.get('summary'),
      author: formData.get('author'),
      image: formData.get('image'),
      slug: formData.get('slug'),
      content: formData.get('content'),
      metaTitle: formData.get('metaTitle'),
      metaDescription: formData.get('metaDescription'),
      ogImage: formData.get('ogImage'),
      category: formData.get('category'),
      trending: formData.get('trending') === 'on',
      published: formData.get('published') === 'on'
    })
  });

  if (!response) return;
  const result = await response.json();
  setMessage(postMessage, result.message || 'Request processed.', response.ok);
  if (response.ok) postForm.reset();
});

infoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(infoForm);

  const response = await adminFetch('/api/admin/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: formData.get('title'),
      message: formData.get('message')
    })
  });

  if (!response) return;
  const result = await response.json();
  setMessage(infoMessage, result.message || 'Request processed.', response.ok);
  if (response.ok) infoForm.reset();
});

adsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(adsForm);

  const response = await adminFetch('/api/admin/settings/ads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      header: formData.get('header'),
      sidebar: formData.get('sidebar'),
      inArticle: formData.get('inArticle')
    })
  });

  if (!response) return;
  const result = await response.json();
  setMessage(adsMessage, result.message || 'Request processed.', response.ok);
});

newsletterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const response = await adminFetch('/api/admin/newsletter');
  if (!response) return;

  const result = await response.json();
  if (!response.ok) {
    newsletterExport.value = '';
    return setMessage(newsletterMessage, result.message || 'Failed to load subscribers.', false);
  }

  const emails = result.map((subscriber) => subscriber.email).join('\n');
  newsletterExport.value = emails;
  setMessage(newsletterMessage, `Loaded ${result.length} subscribers.`, true);
});


aiForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(aiForm);
  const response = await adminFetch('/api/admin/ai/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic: formData.get('topic'), content: formData.get('content') })
  });

  if (!response) return;
  const payload = await response.json();
  if (!response.ok) return setMessage(aiMessage, payload.message || 'Could not generate suggestions.', false);

  setMessage(aiMessage, 'AI suggestions generated.', true);
  aiOutput.innerHTML = `
    <strong>Titles:</strong> ${payload.suggestions.join(' | ')}<br/>
    <strong>Summary:</strong> ${payload.summary || 'N/A'}<br/>
    <strong>Tags:</strong> ${(payload.tags || []).join(', ')}
  `;
});

analyticsBtn.addEventListener('click', async () => {
  const response = await adminFetch('/api/admin/analytics');
  if (!response) return;
  const payload = await response.json();
  if (!response.ok) return setMessage(analyticsMessage, payload.message || 'Failed to load analytics.', false);

  setMessage(analyticsMessage, 'Analytics loaded.', true);
  analyticsOutput.textContent = JSON.stringify(payload, null, 2);
});

logoutBtn.addEventListener('click', async () => {
  const response = await fetch('/api/admin/logout', { method: 'POST' });
  if (response.ok) {
    location.href = '/admin-login.html';
  }
});
