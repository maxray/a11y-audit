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

npm run crawl https://example.com/


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

npm run audit

### Step 3 — Convert JSON → CSV

npm run convert

**Output:**

- audit.csv

Ready for Google Sheets or internal audit documentation


### Running on localhost

Works exactly the same!

