// Checks that convex/_generated is not stale, without a Convex login.
//
// `npx convex codegen` needs a deployment, so CI cannot run it. This script
// does two offline checks instead:
//
// 1. The modules listed in api.js and api.d.ts match the function files in
//    convex/. Convex skips schema files, dotfiles, files with more than one
//    dot (tests) and anything under _generated.
// 2. api.* and server.* match the templates shipped in the installed convex
//    package, ignoring whitespace and trailing commas. Real codegen runs
//    prettier, so a byte compare would fail on a regenerated tree.
//
// Check 2 uses internal files of the convex package. If they move, the script
// warns and skips check 2. Check 1 always runs.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dir = path.join(root, "convex");
const generated = path.join(dir, "_generated");
const errors = [];

const normalize = (text) =>
  text
    .replace(/\s+/g, "")
    .replace(/'/g, '"')
    .replace(/,([)}\]])/g, "$1");

function listModules(base) {
  const found = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const full = path.join(base, entry.name);
    const rel = path.relative(dir, full);
    if (entry.isDirectory()) {
      if (rel !== "_generated" && rel !== "node_modules") {
        found.push(...listModules(full));
      }
    } else if (
      /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) &&
      !entry.name.startsWith(".") &&
      !/^schema\.(ts|js)$/.test(entry.name) &&
      entry.name.split(".").length === 2 &&
      !rel.includes(" ")
    ) {
      found.push(rel.split(path.sep).join("/"));
    }
  }
  return found;
}

const modules = listModules(dir)
  .map((rel) => rel.replace(/\.[^/.]+$/, ""))
  .sort();

const apiDts = readFileSync(path.join(generated, "api.d.ts"), "utf8");
const listed = [
  ...apiDts.matchAll(/import type \* as \w+ from "\.\.\/(.+?)\.js"/g),
]
  .map((m) => m[1])
  .sort();

for (const name of modules.filter((m) => !listed.includes(m))) {
  errors.push(`convex/${name} is not in _generated/api.d.ts`);
}
for (const name of listed.filter((m) => !modules.includes(m))) {
  errors.push(`_generated/api.d.ts lists ${name}, which is not in convex/`);
}

let templates = null;
try {
  const req = createRequire(path.join(root, "package.json"));
  const pkgDir = path.dirname(req.resolve("convex/package.json"));
  const load = (file) =>
    req(path.join(pkgDir, "dist/cjs/cli/codegen_templates", file));
  templates = {
    api: load("api.js").apiCodegen(modules, { useTypeScript: false }),
    server: load("server.js").serverCodegen({ useTypeScript: false }),
  };
} catch (error) {
  console.log(
    `::warning::Could not load the convex codegen templates. Skipped the template compare. ${error.message}`,
  );
}

if (templates) {
  const expected = {
    "api.js": templates.api.JS,
    "api.d.ts": templates.api.DTS,
    "server.js": templates.server.JS,
    "server.d.ts": templates.server.DTS,
  };
  for (const [file, want] of Object.entries(expected)) {
    const have = readFileSync(path.join(generated, file), "utf8");
    if (normalize(have) !== normalize(want)) {
      errors.push(
        `_generated/${file} differs from the convex codegen template`,
      );
    }
  }
}

if (errors.length > 0) {
  for (const message of errors) console.log(`::error::${message}`);
  console.log(
    "Run `npx convex dev` (or `npx convex codegen`) and commit convex/_generated.",
  );
  process.exit(1);
}
console.log(`convex/_generated is up to date (${modules.length} modules).`);
