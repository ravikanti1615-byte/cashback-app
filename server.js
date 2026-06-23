const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const fs      = require('fs');
const { scrapeStore } = require('./scraper');

const app = express();
app.use(cors());
app.use(express.json());
app.use(require('express').static('.', { etag: false, maxAge: 0 }));

function getData() {
  if (fs.existsSync('data.json')) {
    return JSON.parse(fs.readFileSync('data.json', 'utf8'));
  }
  return {};
}

function saveData(data) {
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

function isStale(store) {
  if (!store || !store.updatedAt) return true;
  const age = Date.now() - new Date(store.updatedAt).getTime();
  return age > 24 * 60 * 60 * 1000;
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/api/stores', (req, res) => {
  const data = getData();
  res.json(Object.keys(data));
});

app.get('/api/cashback/:store', async (req, res) => {
  const slug  = req.params.store.toLowerCase().replace(/\s+/g, '-');
  const data  = getData();

  if (data[slug] && !isStale(data[slug])) {
    console.log(`Cache hit: ${slug}`);
    return res.json(data[slug]);
  }

  console.log(`Cache miss: ${slug} — scraping now...`);

  try {
    const results = await scrapeStore(slug);

    if (results.length > 0) {
      data[slug] = {
        name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        data: results,
        updatedAt: new Date().toISOString()
      };
      saveData(data);
      console.log(`Scraped and cached: ${slug} (${results.length} portals)`);
      return res.json(data[slug]);
    } else {
      return res.status(404).json({ error: 'Store not found or no cashback available' });
    }

  } catch (err) {
    console.error(`Scrape failed for ${slug}:`, err.message);

    if (data[slug]) {
      console.log(`Returning stale data for ${slug}`);
      return res.json(data[slug]);
    }

    return res.status(500).json({ error: 'Failed to fetch cashback data' });
  }
});

app.get('/api/search/:query', (req, res) => {
  const data    = getData();
  const query   = req.params.query.toLowerCase();
  const matches = Object.keys(data).filter(s => s.includes(query));
  const results = {};
  matches.forEach(s => results[s] = data[s]);
  res.json(results);
});

cron.schedule('0 3 * * *', () => {
  console.log('Refreshing cached stores...');
  const data = getData();
  const slugs = Object.keys(data);
  (async () => {
    for (const slug of slugs) {
      try {
        const results = await scrapeStore(slug);
        if (results.length > 0) {
          data[slug].data = results;
          data[slug].updatedAt = new Date().toISOString();
          saveData(data);
          console.log(`Refreshed: ${slug}`);
        }
        await new Promise(r => setTimeout(r, 3000));
      } catch(e) {
        console.error(`Refresh failed for ${slug}:`, e.message);
      }
    }
    console.log('Daily refresh complete!');
  })();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('On-demand scraping enabled — stores are scraped on first search and cached for 24 hours');
});