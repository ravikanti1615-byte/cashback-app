const API = 'https://cashback-app-production-dc7f.up.railway.app';
let suggestTimer = null;

const input = document.getElementById('searchInput');

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') { clearSuggestions(); doSearch(); }
});

input.addEventListener('input', e => {
  const val = e.target.value.trim();
  clearTimeout(suggestTimer);
  if (val.length < 2) { clearSuggestions(); return; }
  suggestTimer = setTimeout(() => fetchSuggestions(val), 400);
});

function clearSuggestions() {
  const el = document.getElementById('suggestions');
  if (el) el.remove();
}

async function fetchSuggestions(query) {
  try {
    const res = await fetch(`${API}/api/suggest/${encodeURIComponent(query)}`);
    const list = await res.json();
    if (!list.length) return;
    const div = document.createElement('div');
    div.id = 'suggestions';
    div.className = 'suggestions';
    list.forEach(s => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = s.name;
      item.addEventListener('mousedown', () => {
        input.value = s.name;
        clearSuggestions();
        doSearch(s.slug);
      });
      div.appendChild(item);
    });
    document.querySelector('.search-bar').after(div);
  } catch(e) {}
}

function getType(rate) {
  if (rate.includes('mi.')) return 'Miles';
  if (rate.includes('pt.') || rate.includes('SB')) return 'Points';
  return 'Cashback';
}

function parseRate(rate) {
  return parseFloat(rate.replace(/[^0-9.]/g, '')) || 0;
}

async function doSearch(slugOverride) {
  const raw = input.value.trim();
  if (!raw && !slugOverride) return;
  const slug = slugOverride || raw.toLowerCase().replace(/\s+/g, '-');
  clearSuggestions();
  const content = document.getElementById('content');
  content.innerHTML = '<div class="state-box"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const res = await fetch(`${API}/api/cashback/${slug}`);
    if (!res.ok) throw new Error('Not found');
    const store = await res.json();
    let data = [...store.data].sort((a,b) => parseRate(b.rate) - parseRate(a.rate));
    let html = `<div class="store-header">${store.name} — ${data.length} portals</div>`;
    data.forEach((item, i) => {
      const isBest = i === 0;
      const link = `https://www.cashbackmonitor.com/go-to/${encodeURIComponent(item.portal)}/${slug}/`;
      html += `
        <a href="${link}" target="_blank" class="portal-card ${isBest ? 'best' : ''}">
          <div>
            <div class="portal-name">${item.portal}</div>
            <div class="portal-type">${getType(item.rate)}</div>
          </div>
          <div class="rate-badge">${item.rate}</div>
        </a>
      `;
    });
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = `<div class="state-box"><p>No results found for "${raw || slugOverride}"</p></div>`;
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const url = tabs[0]?.url || '';
  const hostname = url.replace('https://','').replace('http://','').replace('www.','').split('/')[0].replace('.com','').replace('.net','').replace('.org','');
  if (hostname && hostname.length > 2) {
    input.value = hostname;
    doSearch(hostname);
  }
});