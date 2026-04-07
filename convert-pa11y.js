const fs = require("fs");

// Get filename from command line argument
const filename = process.argv[2];

if (!filename) {
  console.error("❌ Please provide the Pa11y JSON filename to convert");
  console.error("Usage: node convert-pa11y.js audit.json");
  process.exit(1);
}

// Read the JSON file
let data;
try {
  data = JSON.parse(fs.readFileSync(filename, "utf8"));
} catch (err) {
  console.error("❌ Failed to read or parse file:", err.message);
  process.exit(1);
}

const rows = [];

// Helper to extract WCAG number (e.g. 4.1.1)
function extractWCAG(code) {
  const match = code.match(/(\d+_\d+_\d+)/);
  return match ? match[0].replace(/_/g, ".") : "";
}

// Helper to extract WCAG level (A / AA / AAA)
function extractLevel(code) {
  const match = code.match(/^WCAG2(AAA|AA|A)/);
  return match ? match[1] : "";
}

// Map severity (simple example)
function mapSeverity(code) {
  if (/Guideline1_4\.1_4_3/.test(code)) return "Medium"; // contrast
  if (/Guideline1_1\.1/.test(code)) return "High";       // missing alt
  return "Low";
}

// Loop over results
for (const pageUrl in data.results) {
  const issues = data.results[pageUrl];
  issues.forEach(issue => {
    rows.push({
      pageUrl,
      issue: issue.message,
      wcag: extractWCAG(issue.code),
      level: extractLevel(issue.code),
      severity: mapSeverity(issue.code),
      selector: issue.selector
    });
  });
}

// CSV headers (match your Google Sheet)
const headers = [
  "Page URL",
  "Template",
  "Component",
  "Issue",
  "WCAG Criterion",
  "WCAG Level",
  "Severity",
  "Source",
  "Status",
  "Notes"
];

// Build CSV rows
const csvRows = [
  headers.join(","),
  ...rows.map(row => [
    `"${row.pageUrl}"`,
    `""`, // Template
    `""`, // Component
    `"${row.issue.replace(/"/g, '""')}"`,
    `"${row.wcag}"`,
    `"${row.level}"`,
    `"${row.severity}"`,
    `"Automated"`,
    `"To do"`,
    `"${row.selector}"`
  ].join(","))
];

// Output CSV filename based on input
const outputCsv = filename.replace(/\.json$/i, ".csv");
fs.writeFileSync(outputCsv, csvRows.join("\n"));

console.log(`✅ ${outputCsv} created from ${filename}!`);