const fs = require("fs");
// Same axe-core that pa11y ran, so rule tags match the audit
const axe = require("axe-core");

const filename = process.argv[2];

if (!filename) {
  console.error("❌ Please provide the Pa11y JSON filename");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(filename, "utf8"));

const BEST_PRACTICE = "Best practice";

/**
 * WCAG mapping, read from axe-core's own rule tags
 * e.g. "wcag143" -> "1.4.3", "wcag1412" -> "1.4.12"
 * Rules with no success criterion tag are best practice, not WCAG failures.
 */
const ruleTags = {};
axe.getRules().forEach(rule => {
  ruleTags[rule.ruleId] = rule.tags;
});

function extractWCAG(issue = {}) {
  const tags = ruleTags[issue.code];
  if (!tags) return null; // not an axe rule (e.g. page failed to load)

  const criteria = tags
    .map(t => t.match(/^wcag(\d)(\d)(\d+)$/))
    .filter(Boolean)
    .map(m => `${m[1]}.${m[2]}.${m[3]}`)
    .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));

  return criteria.length ? criteria.join(", ") : BEST_PRACTICE;
}

function getLevel(issue = {}) {
  const tags = ruleTags[issue.code] || [];
  if (tags.some(t => /^wcag2\d*a$/.test(t))) return "A";
  if (tags.some(t => /^wcag2\d*aa$/.test(t))) return "AA";
  if (tags.some(t => /^wcag2\d*aaa$/.test(t))) return "AAA";
  return "";
}

/**
 * POUR principle ordering
 */
function getPrinciple(wcag) {
  if (wcag === BEST_PRACTICE) return BEST_PRACTICE;
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
    Robust: 4,
    [BEST_PRACTICE]: 5
  };
  return order[p] || 99;
}

// WCAG rows first (numeric SC order), best practice last
function compareWCAG(a, b) {
  const p = getPrincipleOrder(getPrinciple(a)) - getPrincipleOrder(getPrinciple(b));
  if (p !== 0) return p;
  return a.localeCompare(b, undefined, { numeric: true });
}

function getSeverity(issue = {}) {
  const impact = issue?.runnerExtras?.impact;

  if (impact === "critical") return "C";
  if (impact === "serious") return "H";
  if (impact === "moderate") return "M";
  return "L";
}

/**
 * Component = "<area> – <element>", e.g. "Navigation – Link"
 * Area: innermost landmark tag, or a recognisable id/class, in the selector.
 * Element: tag of the flagged element (from its HTML, as id-only selectors hide it).
 */
const AREA_TAGS = {
  header: "Header",
  nav: "Navigation",
  footer: "Footer",
  aside: "Sidebar",
  form: "Form"
};

const AREA_KEYWORDS = [
  [/cookie/, "Cookie banner"],
  [/search/, "Search"],
  [/header|masthead/, "Header"],
  [/nav|menu/, "Navigation"],
  [/footer/, "Footer"]
];

function getArea(selector) {
  const parts = selector.toLowerCase().split(/\s*>\s*|\s+/).filter(Boolean);
  let area = "";

  parts.forEach(part => {
    const tag = (part.match(/^[a-z][a-z0-9-]*/) || [""])[0];
    if (tag === "main") area = "Main content";
    if (AREA_TAGS[tag]) area = AREA_TAGS[tag];

    // ids and classes only, so tag names like "main" don't match keywords
    const names = (part.match(/[#.][\w-]+/g) || []).join(" ");
    const hit = AREA_KEYWORDS.find(([re]) => re.test(names));
    if (hit) area = hit[1];
  });

  return area || "Page content";
}

function getElement(selector, context) {
  const html = context.toLowerCase();
  let tag = (html.match(/^<([a-z][a-z0-9-]*)/) || [])[1];

  if (!tag) {
    const last = selector.toLowerCase().split(/\s*>\s*|\s+/).pop() || "";
    tag = (last.match(/^[a-z][a-z0-9-]*/) || [""])[0];
  }

  if (tag === "a") return "Link";
  if (tag === "button") return "Button";
  if (tag === "input" && /type="?(submit|button|image|reset)/.test(html)) return "Button";
  if (["input", "select", "textarea", "label"].includes(tag)) return "Form field";
  if (["img", "svg", "picture"].includes(tag)) return "Image";
  if (["video", "audio"].includes(tag)) return "Media";
  if (tag === "iframe") return "Embed";
  if (/^h[1-6]$/.test(tag)) return "Heading";
  if (["html", "body"].includes(tag)) return "Whole page";

  const role = (html.match(/^<[^>]*\brole="([\w-]+)"/) || [])[1];
  if (role) return `Widget (role=${role})`;
  return "Text";
}

function inferComponent(selector = "", context = "") {
  return `${getArea(selector)} – ${getElement(selector, context)}`;
}

function clean(arr, sep = " | ") {
  return [...new Set(arr)].filter(Boolean).join(sep);
}

function getFix(wcag, issue = {}) {
  if (wcag === "1.4.3") return "Increase contrast to 4.5:1 minimum";
  if (wcag === "1.1.1") return "Add meaningful alt text or aria-label";
  if (wcag.startsWith("2.4.4")) return "Use descriptive link text";
  if (wcag === "4.1.2") return "Ensure controls have accessible names";
  const helpUrl = issue?.runnerExtras?.helpUrl;
  return helpUrl ? `See ${helpUrl}` : "Review WCAG guidance";
}

/**
 * -------------------------
 * COLLECT DATA
 * -------------------------
 */
const grouped = {};
const actionRows = []; // IMPORTANT: per-infringement rows
const untested = []; // pages pa11y could not load

for (const pageUrl in data.results) {
  const issues = data.results[pageUrl];

  issues.forEach(issue => {
    const wcag = extractWCAG(issue);
    if (!wcag) {
      untested.push(`${pageUrl} :: ${issue.message || "unknown error"}`);
      return;
    }

    const principle = getPrinciple(wcag);

    const selector =
      issue.selector ||
      issue?.nodes?.[0]?.target?.[0] ||
      "";

    const message = issue.message || "";

    const components = inferComponent(selector, issue.context || "");

    /**
     * -------------------------
     * SUMMARY GROUPING (unchanged)
     * -------------------------
     */
    // Best practice rules are grouped per rule, WCAG ones per success criterion
    const key = wcag === BEST_PRACTICE ? `${wcag}|${issue.code}` : wcag;
    const level = getLevel(issue);

    if (!grouped[key]) {
      grouped[key] = {
        wcag,
        level,
        count: 0,
        pages: new Set(),
        components: new Set(),
        messages: new Set()
      };
    }

    grouped[key].count++;
    grouped[key].pages.add(pageUrl);
    grouped[key].components.add(components);
    grouped[key].messages.add(message);

    /**
     * -------------------------
     * ACTION PLAN (1 row per issue)
     * -------------------------
     */
    actionRows.push({
      wcag,
      level,
      title: message || `WCAG ${wcag}`,
      principle,
      severity: getSeverity(issue),
      message,
      components,
      selector,
      page: pageUrl.replace(/^https?:\/\//, ""),
      fix: getFix(wcag, issue)
    });
  });
}

/**
 * -------------------------
 * SORT ACTION PLAN BY POUR
 * -------------------------
 */
actionRows.sort((a, b) => compareWCAG(a.wcag, b.wcag));

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
  "Level",
  "Result",
  "Observations",
  "Components",
  "Pages",
  "Title",
  "Description",
  "Priority"
];

const summaryRows = Object.values(grouped)
  .sort((a, b) => compareWCAG(a.wcag, b.wcag))
  .map(issue => [
    issue.wcag,
    issue.level,
    issue.wcag === BEST_PRACTICE ? "Best practice (not a WCAG failure)" : "Fail",
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
  "Level",
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
  r.level,
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

if (untested.length) {
  console.warn(`\n⚠️  ${untested.length} page(s) could not be tested:`);
  untested.forEach(u => console.warn(`   ${u}`));
}