// generate-pa11yci.js
// Usage: node generate-pa11yci.js https://substrakt.com/

const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

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

// -----------------------------
// Helper: normalise URL
// -----------------------------
function normaliseUrl(raw) {
  try {
    const url = new URL(raw);

    // remove hash
    url.hash = "";

    // remove trailing slash (except homepage)
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return null;
  }
}

// -----------------------------
// Crawl
// -----------------------------
async function crawl() {
  while (toVisit.length > 0) {
    const currentRaw = toVisit.shift();
    const current = normaliseUrl(currentRaw);

    if (!current || visited.has(current)) continue;

    visited.add(current);

    try {
      const { data } = await axios.get(current, {
        timeout: 15000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; A11yAuditBot/1.0; +https://example.com/bot)"
        }
      });

      const $ = cheerio.load(data);

      $("a[href]").each((_, el) => {
        let link = $(el).attr("href");
        if (!link) return;

        try {
          link = new URL(link, current).href;

          // ignore junk links
          if (ignorePatterns.some((p) => p.test(link))) return;

          // only internal links
          if (!link.startsWith(domain)) return;

          const clean = normaliseUrl(link);
          if (!clean) return;

          // skip already seen
          if (visited.has(clean)) return;

          // skip obvious non-pages
          const pathname = new URL(clean).pathname;
          const isAsset = pathname.match(
            /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|doc|docx|xls|xlsx)$/i
          );

          if (isAsset) return;

          toVisit.push(clean);
        } catch {}
      });
    } catch (err) {
      const status = err.response?.status;

      if (status === 404) {
        console.warn(`Skipped 404: ${current}`);
        continue;
      }

      console.warn(`Failed to fetch ${current}: ${err.message}`);
    }
  }

  // -----------------------------
  // Final pa11y config
  // -----------------------------
  const pa11yci = {
  defaults: {
    runners: ["axe"],
    standard: "WCAG2AA",
    includeWarnings: true,
    includeNotices: false,
    timeout: 60000,
    wait: 1500,

    hideElements: [
      "#djDebug"
    ]
  },

  urls: [...visited]
};

  fs.writeFileSync(
    "pa11yci-generated.json",
    JSON.stringify(pa11yci, null, 2)
  );

  console.log(
    `Crawled ${visited.size} pages. Saved to pa11yci-generated.json`
  );
}

crawl();