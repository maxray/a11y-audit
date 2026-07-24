const fs = require("fs");

const filename = process.argv[2];

if (!filename) {
  console.error("❌ Please provide the Pa11y JSON filename");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filename, "utf8"));

/**
 * WCAG mapping
 */
function extractWCAG(issue = {}) {
  const map = {
    "color-contrast": "1.4.3",
    "image-alt": "1.1.1",
    "label": "3.3.2",
    "button-name": "4.1.2",
    "link-name": "2.4.4",
    "heading-order": "1.3.1",
    "landmark-one-main": "1.3.1",
    "aria-roles": "4.1.2",
    "aria-valid-attr": "4.1.2"
  };

  return map[issue.code] || "";
}

/**
 * POUR principle ordering
 */
function getPrinciple(wcag) {
  if (wcag.startsWith("1.")) return "Perceivable";
  if (wcag.startsWith("2.")) return "Operable";
  if (wcag.startsWith("3.")) return "Understandable";
  if (wcag.startsWith("4.")) return "Robust";
  return "Unknown";
}

function getPrincipleOrder(p) {
  const order = {
    Perceivable: 1,
    Operable: 2,
    Understandable: 3,
    Robust: 4
  };
  return order[p] || 99;
}

function getSeverity(issue = {}) {
  const impact = issue?.runnerExtras?.impact;

  if (impact === "critical") return "C";
  if (impact === "serious") return "H";
  if (impact === "moderate") return "M";
  return "L";
}

function inferComponent(selector = "") {
  const s = selector.toLowerCase();

  if (s.includes("header")) return "Header";
  if (s.includes("nav")) return "Navigation";
  if (s.includes("footer")) return "Footer";
  if (s.includes("form")) return "Form";
  if (s.includes("button")) return "Button";
  if (s.includes("a")) return "Link";

  return "Page Content";
}

function clean(arr, sep = " | ") {
  return [...new Set(arr)].filter(Boolean).join(sep);
}

function getFix(wcag) {
  if (wcag === "1.4.3") return "Increase contrast to 4.5:1 minimum";
  if (wcag === "1.1.1") return "Add meaningful alt text or aria-label";
  if (wcag === "2.4.4") return "Use descriptive link text";
  if (wcag === "4.1.2") return "Ensure controls have accessible names";
  return "Review WCAG guidance";
}

/**
 * -------------------------
 * COLLECT DATA
 * -------------------------
 */
const grouped = {};
const actionRows = []; // IMPORTANT: per-infringement rows

for (const pageUrl in data.results) {
  const issues = data.results[pageUrl];

  issues.forEach(issue => {
    const wcag = extractWCAG(issue);
    if (!wcag) return;

    const principle = getPrinciple(wcag);

    const selector =
      issue.selector ||
      issue?.nodes?.[0]?.target?.[0] ||
      "";

    const message = issue.message || "";

    const components = inferComponent(selector);

    /**
     * -------------------------
     * SUMMARY GROUPING (unchanged)
     * -------------------------
     */
    if (!grouped[wcag]) {
      grouped[wcag] = {
        wcag,
        count: 0,
        pages: new Set(),
        components: new Set(),
        messages: new Set()
      };
    }

    grouped[wcag].count++;
    grouped[wcag].pages.add(pageUrl);
    grouped[wcag].components.add(components);
    grouped[wcag].messages.add(message);

    /**
     * -------------------------
     * ACTION PLAN (1 row per issue)
     * -------------------------
     */
    actionRows.push({
      wcag,
      title: message || `WCAG ${wcag}`,
      principle,
      severity: getSeverity(issue),
      message,
      components,
      selector,
      page: pageUrl.replace(/^https?:\/\//, ""),
      fix: getFix(wcag)
    });
  });
}

/**
 * -------------------------
 * SORT ACTION PLAN BY POUR
 * -------------------------
 */
actionRows.sort((a, b) => {
  const p = getPrincipleOrder(a.principle) - getPrincipleOrder(b.principle);
  if (p !== 0) return p;

  return a.wcag.localeCompare(b.wcag, undefined, { numeric: true });
});

/**
 * -------------------------
 * CSV HELPERS
 * -------------------------
 */
function toCSV(headers, rows) {
  return [
    headers.join(","),
    ...rows.map(row =>
      row.map(v =>
        `"${String(v || "").replace(/"/g, '""')}"`
      ).join(",")
    )
  ].join("\n");
}

/**
 * -------------------------
 * CSV 1: SUMMARY
 * -------------------------
 */
const summaryHeaders = [
  "WCAG",
  "Result",
  "Observations",
  "Components",
  "Pages",
  "Title",
  "Description",
  "Priority"
];

const summaryRows = Object.values(grouped)
  .sort((a, b) =>
    a.wcag.localeCompare(b.wcag, undefined, { numeric: true })
  )
  .map(issue => [
    issue.wcag,
    "Fail",
    `${issue.count} issue(s)`,
    clean(issue.components),
    `${issue.pages.size} page(s)`,
    [...issue.messages][0] || "",
    clean(issue.messages),
    "TBD"
  ]);

/**
 * -------------------------
 * CSV 2: ACTION PLAN (POUR, PER ISSUE)
 * -------------------------
 */
const actionHeaders = [
  "WCAG",
  "Title",
  "Principle",
  "Severity",
  "Message",
  "Component",
  "Selector",
  "Page",
  "Fix"
];

const actionCsvRows = actionRows.map(r => [
  r.wcag,
  r.title,
  r.principle,
  r.severity,
  r.message,
  r.components,
  r.selector,
  r.page,
  r.fix
]);

/**
 * -------------------------
 * WRITE FILES
 * -------------------------
 */
const summaryFile = filename.replace(/\.json$/i, "-audit-summary.csv");
const actionFile = filename.replace(/\.json$/i, "-audit-action-plan.csv");

fs.writeFileSync(summaryFile, toCSV(summaryHeaders, summaryRows));
fs.writeFileSync(actionFile, toCSV(actionHeaders, actionCsvRows));

console.log(`✅ Created ${summaryFile}`);
console.log(`📊 Summary rows: ${summaryRows.length}`);

console.log(`\n✅ Created ${actionFile}`);
console.log(`📋 Action rows: ${actionCsvRows.length}`);