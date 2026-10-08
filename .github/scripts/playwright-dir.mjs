// Prints the directory of the first package that depends on Playwright. It
// looks at the root, apps/* and packages/*. Exits 1 when there is none.
import { existsSync, readdirSync, readFileSync } from "node:fs";

const dirs = ["."];
for (const parent of ["apps", "packages"]) {
  if (!existsSync(parent)) continue;
  for (const name of readdirSync(parent)) dirs.push(`${parent}/${name}`);
}

for (const dir of dirs) {
  const file = `${dir}/package.json`;
  if (!existsSync(file)) continue;
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps["@playwright/test"] || deps["playwright"]) {
    console.log(dir);
    process.exit(0);
  }
}
process.exit(1);
