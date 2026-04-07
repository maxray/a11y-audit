# Accessibility Audit Toolkit (Pa11y CI)

A lightweight toolkit for running automated accessibility audits using **Pa11y CI**, crawling sites, and exporting results to CSV for reporting.

---

## 🚀 Features

- Crawl a website (including localhost) to generate URLs
- Run accessibility audits using **Pa11y CI**
- Convert results into a **clean CSV format** for Google Sheets
- Supports WCAG A / AA / AAA
- Works with any site (Wagtail, WordPress, static, etc.)

---

## 📁 Project Structure


/accessibility-audit
├── package.json
├── generate-pa11yci.js # crawler
├── convert-pa11y.js # JSON → CSV
├── run-audit.js # full pipeline runner
└── README.md # documentation


**Output files** (not committed):

pa11yci-generated.json
audit.json
audit.csv


---

## Setup

npm install

This will install:

axios and cheerio → crawler
pa11y-ci → audit tool (devDependency)

Step 1 — Crawl a site

Generate a list of URLs automatically:

node generate-pa11yci.js https://example.com/

Output:

pa11yci-generated.json

This includes:

Internal pages only
Filters out junk links:
mailto:
tel:
#anchors
cdn-cgi (Cloudflare)
javascript: links


🧪 Step 2 — Run accessibility audit
npx pa11y-ci --config pa11yci-generated.json --reporter json > audit.json
📊 Step 3 — Convert JSON → CSV
node convert-pa11y.js audit.json

Output:

audit.csv
Ready for Google Sheets or internal audit documentation


🌐 Running on localhost

Works exactly the same:

node generate-pa11yci.js http://localhost:8000/
npx pa11y-ci --config pa11yci-generated.json --reporter json > audit.json
node convert-pa11y.js audit.json

Requirements:



npm run audit:full https://example.com/

This runs:

Crawl site → pa11yci-generated.json
Run Pa11y CI → audit.json
Convert → audit.csv
Scripts in package.json
{
  "scripts": {
    "crawl": "node generate-pa11yci.js",
    "audit": "pa11y-ci --config pa11yci-generated.json --reporter json > audit.json",
    "convert": "node convert-pa11y.js audit.json",
    "audit:full": "node run-audit.js"
  }
}
📄 CSV Output Format
Column	Description
Page URL	Page tested
Template	(manual)
Component	(manual)
Issue	Description of issue
WCAG Criterion	e.g. 4.1.1
WCAG Level	A / AA / AAA
Severity	High / Medium / Low
Source	Automated
Status	To do
Notes	CSS selector
⚠️ Known Limitations
Does not crawl JS-rendered links (SPA navigation)
Requires public access or dev server without auth
Some false positives — manual review still required
Pa11y CI reports most issues as "error"
✅ Recommended Workflow
npm run crawl https://example.com/
npm run audit
npm run convert

Or with full pipeline:

npm run audit:full https://example.com/

