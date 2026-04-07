// generate-pa11yci.js
// Usage: node generate-pa11yci.js https://substrakt.com/

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const startUrl = process.argv[2];
if (!startUrl) {
  console.error("Usage: node generate-pa11yci.js https://example.com");
  process.exit(1);
}

const visited = new Set();
const toVisit = [startUrl];
const domain = new URL(startUrl).origin;

// Patterns to ignore
const ignorePatterns = [
  /^mailto:/i,
  /^tel:/i,
  /^#/i,
  /cdn-cgi/i,
  /javascript:/i
];

async function crawl() {
  while (toVisit.length > 0) {
    const current = toVisit.shift();
    if (visited.has(current)) continue;
    visited.add(current);

    try {
      const { data } = await axios.get(current);
      const $ = cheerio.load(data);

      $('a[href]').each((i, el) => {
        let link = $(el).attr('href');
        if (!link) return;

        try {
          link = new URL(link, domain).href;

          // skip ignored patterns
          if (ignorePatterns.some(p => p.test(link))) return;

          // only internal links
          if (link.startsWith(domain) && !visited.has(link)) {
            // optionally: only HTML pages
            if (link.match(/\/$|\.html$/)) {
              toVisit.push(link);
            }
          }
        } catch {}
      });
    } catch (err) {
      console.warn(`Failed to fetch ${current}: ${err.message}`);
    }
  }

  // Prepare pa11yci.json
  const pa11yci = {
    defaults: {
      standard: "WCAG2AA",
      includeNotices: false
    },
    urls: [...visited]
  };

  fs.writeFileSync('pa11yci-generated.json', JSON.stringify(pa11yci, null, 2));
  console.log(`Crawled ${visited.size} pages. Saved to pa11yci-generated.json`);
}

crawl();