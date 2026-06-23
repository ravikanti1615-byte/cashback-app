const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const SCRAPER_API_KEY = '091d7d9afecd58eef448bdfc8c74bea4';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function scraperUrl(targetUrl) {
  return `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}&render=true&wait=5000`;
}

function scraperUrlNoRender(targetUrl) {
  return `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(targetUrl)}`;
}

async function getAllStores() {
  console.log('Fetching all stores via search...');
  const stores = [];
  const letters = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

  for (const letter of letters) {
    try {
      console.log(`  Searching stores starting with "${letter}"...`);
      const searchUrl = `https://www.cashbackmonitor.com/search-store/?q=${letter}`;
      const { data } = await axios.get(scraperUrlNoRender(searchUrl), { timeout: 120000 });
      const $ = cheerio.load(data);

      let found = 0;
      $('a[href*="/cashback-store/"]').each((i, el) => {
        const href = $(el).attr('href');
        const name = $(el).text().trim();
        const slug = href?.match(/\/cashback-store\/([^/]+)\//)?.[1];
        if (slug && name) {
          stores.push({ slug, name });
          found++;
        }
      });

      console.log(`  Found ${found} stores for "${letter}", running total: ${stores.length}`);
      await sleep(1500);

    } catch (err) {
      console.error(`  Failed for letter ${letter}: ${err.message}`);
      await sleep(3000);
    }
  }

  const unique = [...new Map(stores.map(s => [s.slug, s])).values()];
  console.log(`Found ${unique.length} unique stores total`);
  return unique;
}

async function scrapeStore(slug, retries = 3) {
  const url = `https://www.cashbackmonitor.com/cashback-store/${slug}/`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`  Fetching ${slug} (attempt ${attempt})...`);

      const { data } = await axios.get(scraperUrl(url), { timeout: 120000 });
      const $ = cheerio.load(data);
      const results = [];
      const seen = new Set();

      $('tr').each((i, el) => {
        const nameEl = $(el).find('td.l.lo a').first();
        const rateEl = $(el).find('span[id^="ra"]').first();
        const portal = nameEl.text().trim();
        const rate   = rateEl.text().trim();

        if (portal && rate && !seen.has(portal)) {
          seen.add(portal);
          results.push({ portal, rate });
        }
      });

      if (results.length > 0) {
        console.log(`  Found ${results.length} portals for ${slug}`);
        return results;
      }

      console.log(`  No results yet for ${slug}, retrying...`);
      await sleep(3000);

    } catch (err) {
      console.error(`  Attempt ${attempt} failed for ${slug}: ${err.message}`);
      if (attempt < retries) await sleep(5000);
    }
  }

  return [];
}

async function scrapeAll() {
  console.log('=============================');
  console.log('Starting full scrape at', new Date().toLocaleString());
  console.log('=============================');

  let existing = {};
  if (fs.existsSync('data.json')) {
    existing = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    console.log(`Loaded ${Object.keys(existing).length} existing stores`);
  }

  const stores = await getAllStores();

  if (stores.length === 0) {
    console.log('No stores found, aborting.');
    return;
  }

  fs.writeFileSync('stores.json', JSON.stringify(stores, null, 2));
  console.log(`Saved ${stores.length} stores to stores.json`);

  let done = 0;
  let success = 0;

  for (const store of stores) {
    done++;
    console.log(`\n[${done}/${stores.length}] ${store.slug}`);

    const results = await scrapeStore(store.slug);

    if (results.length > 0) {
      existing[store.slug] = {
        name: store.name,
        data: results,
        updatedAt: new Date().toISOString()
      };
      success++;
    }

    if (done % 50 === 0) {
      fs.writeFileSync('data.json', JSON.stringify(existing, null, 2));
      console.log(`\n--- Progress saved: ${done}/${stores.length} done, ${success} with data ---\n`);
    }

    await sleep(2000);
  }

  fs.writeFileSync('data.json', JSON.stringify(existing, null, 2));
  console.log('\n=============================');
  console.log(`Scrape complete! ${success}/${stores.length} stores with data`);
  console.log('=============================');
}

module.exports = { scrapeAll, scrapeStore };