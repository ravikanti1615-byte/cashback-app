const API = 'https://cashback-app-production-dc7f.up.railway.app';

function getStoreSlug() {
  const hostname = window.location.hostname
    .replace('www.', '')
    .replace('.com', '')
    .replace('.net', '')
    .replace('.org', '')
    .replace('.co', '')
    .replace('.uk', '')
    .toLowerCase()
    .trim();
  return hostname;
}

function storeExists(slug) {
  return fetch(`${API}/api/suggest/${encodeURIComponent(slug)}`)
    .then(r => r.json())
    .then(suggestions => suggestions.length > 0 && suggestions[0].slug.includes(slug))
    .catch(() => false);
}

function createBadge(slug, matchSlug) {
  const existing = document.getElementById('cashback-compare-badge');
  if (existing) existing.remove();

  const badge = document.createElement('div');
  badge.id = 'cashback-compare-badge';
  badge.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #16a34a;
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 600;
    z-index: 999999;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    max-width: 280px;
    line-height: 1.4;
  `;

  badge.innerHTML = `
    <div style="font-size:11px;opacity:0.85;margin-bottom:4px;">💰 CASHBACK AVAILABLE</div>
    <div style="font-size:15px;">Click to see best rates</div>
    <div style="font-size:11px;opacity:0.75;margin-top:4px;">Compare all portals →</div>
  `;

  badge.addEventListener('click', () => {
    window.open(`${API}?store=${matchSlug}`, '_blank');
    badge.remove();
  });

  const close = document.createElement('div');
  close.style.cssText = `
    position: absolute;
    top: 6px;
    right: 10px;
    font-size: 16px;
    opacity: 0.7;
    cursor: pointer;
    line-height: 1;
  `;
  close.textContent = '×';
  close.addEventListener('click', e => {
    e.stopPropagation();
    badge.remove();
    sessionStorage.setItem('cashback-dismissed-' + slug, '1');
  });
  badge.appendChild(close);

  document.body.appendChild(badge);
}

async function checkCashback() {
  const slug = getStoreSlug();
  if (!slug || slug.length < 2) return;

  const dismissed = sessionStorage.getItem('cashback-dismissed-' + slug);
  if (dismissed) return;

  try {
    const res = await fetch(`${API}/api/suggest/${encodeURIComponent(slug)}`);
    const suggestions = await res.json();
    if (!suggestions || suggestions.length === 0) return;

    const match = suggestions[0];
    if (!match.slug.includes(slug) && !slug.includes(match.slug)) return;

    createBadge(slug, match.slug);
  } catch(e) {
    console.log('[Cashback Compare] Error:', e.message);
  }
}

setTimeout(checkCashback, 2000);