const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const axios   = require('axios');
const cheerio = require('cheerio');
const { scrapeStore } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());
app.use(require('express').static('.', { etag: false, maxAge: 0 }));

const STORES = require('./stores.json');

function getData() {
  if (fs.existsSync('data.json')) {
    return JSON.parse(fs.readFileSync('data.json', 'utf8'));
  }
  return {};
}

function saveData(data) {
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/api/stores', (req, res) => {
  res.json(STORES.map(s => s.slug));
});

app.get('/api/suggest/:query', (req, res) => {
  const query = req.params.query.toLowerCase();
  const matches = STORES
    .filter(s => s.name.toLowerCase().includes(query) || s.slug.includes(query))
    .slice(0, 8);
  res.json(matches);
});

app.get('/api/cashback/:store', async (req, res) => {
  const slug = req.params.store.toLowerCase().replace(/\s+/g, '-');
  console.log(`Fetching live data for: ${slug}`);
  try {
    const results = await scrapeStore(slug);
    if (results.length > 0) {
      const storeData = {
        name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        data: results,
        updatedAt: new Date().toISOString()
      };
      const data = getData();
      data[slug] = storeData;
      saveData(data);
      console.log(`Done: ${slug} (${results.length} portals)`);
      return res.json(storeData);
    } else {
      return res.status(404).json({ error: 'Store not found or no cashback available' });
    }
  } catch (err) {
    console.error(`Failed for ${slug}:`, err.message);
    const data = getData();
    if (data[slug]) {
      console.log(`Returning last known data for ${slug}`);
      return res.json(data[slug]);
    }
    return res.status(500).json({ error: 'Failed to fetch cashback data' });
  }
});

app.get('/api/search/:query', (req, res) => {
  const data  = getData();
  const query = req.params.query.toLowerCase();
  const matches = Object.keys(data).filter(s => s.includes(query));
  const results = {};
  matches.forEach(s => results[s] = data[s]);
  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Loaded ${STORES.length} stores for suggestions`);
  console.log('Live scraping mode — every search fetches fresh data from CashbackMonitor');
});