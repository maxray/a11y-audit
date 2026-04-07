# Accessibility Audit Toolkit (Pa11y CI)

A little toolkit for running automated accessibility audits using **Pa11y CI**, crawling sites, and exporting results to CSV for reporting and fixing using Google Sheets to manage.

---

## Features

- Crawl a website (including localhost) to generate URLs
- Run accessibility audits using **Pa11y CI**
- Convert results into a **clean CSV format** for Google Sheets
- Supports WCAG A / AA / AAA
- Works with any site (Wagtail, WordPress, static, etc.)

---

## Project Structure


- accessibility-audit
    - package.json
    - generate-pa11yci.js # crawler
    - convert-pa11y.js # JSON → CSV
    - run-audit.js # full pipeline runner
    - README.md # documentation


**Output files** (not committed):

- pa11yci-generated.json
- audit.json
- audit.csv


---

## Setup

npm install

This will install:

- axios and cheerio → crawler
- pa11y-ci → audit tool (devDependency)

### Step 1 — Crawl a site

Generate a list of URLs automatically:

node generate-pa11yci.js https://example.com/

**Output:**

- pa11yci-generated.json

**This includes:**

- Internal pages only
- Filters out junk links:
- mailto:
- tel:
- #anchors
- cdn-cgi (Cloudflare)
- javascript: links


### Step 2 — Run accessibility audit

npx pa11y-ci --config pa11yci-generated.json --reporter json > audit.json

### Step 3 — Convert JSON → CSV

node convert-pa11y.js audit.json

**Output:**

- audit.csv

Ready for Google Sheets or internal audit documentation


### Running on localhost

Works exactly the same:

node generate-pa11yci.js http://localhost:8000/
npx pa11y-ci --config pa11yci-generated.json --reporter json > audit.json
node convert-pa11y.js audit.json

### Recommended Workflow
npm run crawl https://example.com/
npm run audit
npm run convert
