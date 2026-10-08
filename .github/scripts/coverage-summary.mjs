// Prints a Markdown coverage table, one row per Vitest project.
// Reads coverage/coverage-summary.json. Append the output to
// $GITHUB_STEP_SUMMARY.
import { readFileSync } from "node:fs";
import path from "node:path";

const file = process.argv[2] ?? "coverage/coverage-summary.json";
const summary = JSON.parse(readFileSync(file, "utf8"));
const root = process.cwd();

const projects = [
  { name: "convex", prefix: "convex/" },
  { name: "shared", prefix: "packages/shared/" },
  { name: "desktop", prefix: "apps/desktop/" },
];
const metrics = ["statements", "branches", "functions", "lines"];

const empty = () =>
  Object.fromEntries(metrics.map((m) => [m, { covered: 0, total: 0 }]));
const totals = new Map(projects.map((p) => [p.name, empty()]));
const all = empty();

for (const [key, entry] of Object.entries(summary)) {
  if (key === "total") continue;
  const rel = path.relative(root, key).split(path.sep).join("/");
  const project = projects.find((p) => rel.startsWith(p.prefix));
  for (const m of metrics) {
    all[m].covered += entry[m].covered;
    all[m].total += entry[m].total;
    if (project) {
      totals.get(project.name)[m].covered += entry[m].covered;
      totals.get(project.name)[m].total += entry[m].total;
    }
  }
}

const pct = ({ covered, total }) =>
  total === 0 ? "n/a" : `${((covered / total) * 100).toFixed(1)}%`;
const row = (name, t) =>
  `| ${name} | ${metrics.map((m) => pct(t[m])).join(" | ")} |`;

console.log("## Coverage\n");
console.log("| Project | Statements | Branches | Functions | Lines |");
console.log("| --- | --- | --- | --- | --- |");
for (const p of projects) console.log(row(p.name, totals.get(p.name)));
console.log(row("**all**", all));
console.log(
  "\nv8 coverage of `convex/`, `packages/shared/src` and `apps/desktop/src`. Test files are excluded.",
);
