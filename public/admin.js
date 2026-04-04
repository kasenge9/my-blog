const postForm = document.getElementById('post-form');
const infoForm = document.getElementById('info-form');
const adsForm = document.getElementById('ads-form');
const newsletterForm = document.getElementById('newsletter-form');

const postMessage = document.getElementById('post-message');
const infoMessage = document.getElementById('info-message');
const adsMessage = document.getElementById('ads-message');
const newsletterMessage = document.getElementById('newsletter-message');
const newsletterExport = document.getElementById('newsletter-export');

function setMessage(element, message, ok) {
  element.textContent = message;
  element.style.color = ok ? '#15803D' : '#C8102E';
}

postForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(postForm);

  const response = await fetch('/api/admin/posts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': formData.get('adminKey')
    },
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

  const result = await response.json();
  setMessage(postMessage, result.message || 'Request processed.', response.ok);
  if (response.ok) postForm.reset();
});

infoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(infoForm);

  const response = await fetch('/api/admin/info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': formData.get('adminKey')
    },
    body: JSON.stringify({
      title: formData.get('title'),
      message: formData.get('message')
    })
  });

  const result = await response.json();
  setMessage(infoMessage, result.message || 'Request processed.', response.ok);
  if (response.ok) infoForm.reset();
});

adsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(adsForm);

  const response = await fetch('/api/admin/settings/ads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': formData.get('adminKey')
    },
    body: JSON.stringify({
      header: formData.get('header'),
      sidebar: formData.get('sidebar'),
      inArticle: formData.get('inArticle')
    })
  });

  const result = await response.json();
  setMessage(adsMessage, result.message || 'Request processed.', response.ok);
});

newsletterForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(newsletterForm);

  const response = await fetch('/api/admin/newsletter', {
    headers: {
      'x-admin-key': formData.get('adminKey')
    }
  });

  const result = await response.json();
  if (!response.ok) {
    newsletterExport.value = '';
    return setMessage(newsletterMessage, result.message || 'Failed to load subscribers.', false);
  }

  const emails = result.map((subscriber) => subscriber.email).join('\n');
  newsletterExport.value = emails;
  setMessage(newsletterMessage, `Loaded ${result.length} subscribers.`, true);
});
