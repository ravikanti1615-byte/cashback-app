const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const fs      = require('fs');
const { scrapeAll } = require('./scraper');

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

app.get('/', (req, res) => {
  res.json({ status: 'Cashback API is running' });
});

app.get('/api/stores', (req, res) => {
  const data = getData();
  res.json(Object.keys(data));
});

app.get('/api/cashback/:store', (req, res) => {
  const data  = getData();
  const store = req.params.store.toLowerCase().replace(/\s+/g, '-');
  
  if (data[store]) {
    res.json(data[store]);
  } else {
    res.status(404).json({ 
      error: 'Store not found',
      available: Object.keys(data)
    });
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

cron.schedule('0 6 * * *', () => {
  console.log('Daily refresh triggered');
  scrapeAll();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  if (!fs.existsSync('data.json')) {
    console.log('No data found, running first scrape...');
    scrapeAll();
  } else {
    console.log('Existing data loaded, next refresh at 6am daily');
  }
});