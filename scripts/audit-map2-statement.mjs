/**
 * Audits the Map 2 Plot Area Statement metadata and writes a durable report.
 *
 * The statement is the source of truth: the stated length, width and area are
 * transcribed verbatim and are NEVER recomputed or adjusted. Survey dimensions
 * are rounded, so `length * width` will not reproduce the stated area exactly.
 * This script quantifies that gap so it stays documented instead of becoming a
 * "fix" someone applies later.
 *
 *   node scripts/audit-map2-statement.mjs
 *
 * Writes:
 *   data/map2_area_statement_discrepancies.json
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const QA_PATH = join(process.cwd(), "data", "map2_qa.json");
const OUT_PATH = join(
  process.cwd(),
  "data",
  "map2_area_statement_discrepancies.json"
);

/** A row is "off" when L*W misses the stated area by more than this many sq.ft. */
const TOLERANCE = 0.01;
/** Deltas at or above this are called out as needing a human look. */
const OUTLIER = 35;

const qa = JSON.parse(readFileSync(QA_PATH, "utf-8"));

const withStatement = qa.plots.filter(
  (p) =>
    p.length != null && p.width != null && p.area_sq_ft != null
);

const rows = withStatement.map((p) => {
  const product = p.length * p.width;
  const delta = round(product - p.area_sq_ft);
  return {
    label: p.label,
    plot_number: p.plot_number,
    plot_type: p.plot_type,
    length: p.length,
    length_is_avg: p.length_is_avg,
    width: p.width,
    width_is_avg: p.width_is_avg,
    length_x_width: round(product),
    area_sq_ft: p.area_sq_ft,
    delta,
    pct_of_area: round((Math.abs(delta) / p.area_sq_ft) * 100),
  };
});

const off = rows
  .filter((r) => Math.abs(r.delta) > TOLERANCE)
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

const outliers = off.filter((r) => Math.abs(r.delta) >= OUTLIER);

const statement = qa.summary?.statement ?? {};
const officialTotal = statement.official_total_sq_ft ?? null;
const calculatedTotal = round(
  qa.plots.reduce((s, p) => s + (p.area_sq_ft ?? 0), 0)
);

const report = {
  generated_from: "data/map2_qa.json",
  policy: {
    authority: "The Plot Area Statement is the source of truth.",
    treatment:
      "Stated length, width and area are preserved verbatim. No value was recomputed, rounded or redistributed.",
    reason_for_delta:
      "Survey dimensions are recorded to 0.01 ft, so length x width only approximates the stated area.",
  },
  thresholds: { tolerance_sq_ft: TOLERANCE, outlier_sq_ft: OUTLIER },
  summary: {
    rows_with_statement: rows.length,
    rows_reconciling: rows.length - off.length,
    rows_with_delta: off.length,
    outliers: outliers.length,
    max_abs_delta: off.length ? round(off[0].delta) : 0,
  },
  area_reconciliation: {
    official_stated_total: officialTotal,
    official_total_basis: statement.official_total_basis ?? null,
    calculated_total: calculatedTotal,
    variance: officialTotal == null ? null : round(calculatedTotal - officialTotal),
    treatment: statement.variance_treatment ?? null,
  },
  discrepancies: off,
  outliers,
};

writeFileSync(OUT_PATH, JSON.stringify(report, null, 2) + "\n");

console.log(`rows with statement : ${report.summary.rows_with_statement}`);
console.log(`rows reconciling    : ${report.summary.rows_reconciling}`);
console.log(`rows with delta     : ${report.summary.rows_with_delta}`);
console.log(`outliers (>${OUTLIER})   : ${report.summary.outliers}`);
console.log(`max |delta|         : ${report.summary.max_abs_delta} sq.ft`);
console.log(`\nwritten: ${OUT_PATH}`);

function round(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
