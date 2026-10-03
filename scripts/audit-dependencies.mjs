// Dependency audit with a narrow, expiring exception list.
//
//   npm run audit:dependencies                         # fail on any advisory
//   npm run audit:dependencies -- --audit-level=high   # what CI runs
//
// Two audits run:
//
//   1. Production dependencies (`--omit=dev`). No exceptions, ever.
//   2. The full tree. An advisory listed in .github/audit-exceptions.json is
//      tolerated only if it does not reach production (audit 1 must not report
//      it) and its exception has not expired. Every other advisory at or above
//      the audit level fails, exactly as plain `npm audit` would.
//
// An exception records why the advisory is accepted and when to look again.
// It is a reviewed decision with a deadline, not a silencer.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const LEVELS = ["info", "low", "moderate", "high", "critical"];
const levelArg = process.argv.find((a) => a.startsWith("--audit-level="));
const level = levelArg ? levelArg.split("=")[1] : "low";
if (!LEVELS.includes(level)) {
  console.error(`Unknown audit level: ${level}`);
  process.exit(2);
}
const atOrAbove = (severity) => LEVELS.indexOf(severity) >= LEVELS.indexOf(level);

function audit(extraArgs) {
  let out;
  try {
    out = execFileSync("npm", ["audit", "--json", ...extraArgs], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
    out = error.stdout;
    if (!out) throw error;
  }
  const report = JSON.parse(out);
  if (report.error) {
    throw new Error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`);
  }
  // Direct advisories appear as objects in `via`; strings only point at other packages.
  const advisories = new Map();
  for (const vuln of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vuln.via) {
      if (typeof via !== "object" || !atOrAbove(via.severity)) continue;
      const id = via.url?.split("/").pop() ?? String(via.source);
      const entry = advisories.get(id) ?? { id, severity: via.severity, title: via.title, packages: new Set() };
      entry.packages.add(via.name);
      advisories.set(id, entry);
    }
  }
  return advisories;
}

const exceptions = JSON.parse(readFileSync(new URL("../.github/audit-exceptions.json", import.meta.url), "utf8"));
const today = new Date().toISOString().slice(0, 10);

const production = audit(["--omit=dev"]);
const full = audit([]);
const failures = [];
const tolerated = [];

for (const advisory of production.values()) {
  failures.push(`${advisory.id} (${advisory.severity}, ${[...advisory.packages].join(", ")}) reaches production dependencies: ${advisory.title}`);
}
for (const advisory of full.values()) {
  if (production.has(advisory.id)) continue; // already reported above
  const exception = exceptions.find((e) => e.id === advisory.id);
  if (!exception) {
    failures.push(`${advisory.id} (${advisory.severity}, ${[...advisory.packages].join(", ")}): ${advisory.title}`);
  } else if (exception.expires < today) {
    failures.push(`${advisory.id}: exception expired on ${exception.expires}. Re-evaluate: ${exception.reason}`);
  } else {
    tolerated.push(`${advisory.id} (${advisory.severity}, dev-only) tolerated until ${exception.expires}: ${exception.reason}`);
  }
}
const stale = exceptions.filter((e) => !full.has(e.id));

console.log(`Dependency audit (level: ${level})`);
console.log(`  production advisories: ${production.size}`);
console.log(`  full-tree advisories:  ${full.size}`);
for (const t of tolerated) console.log(`  EXCEPTION ${t}`);
for (const s of stale) console.log(`  NOTE ${s.id} no longer reported; remove its exception.`);
for (const f of failures) console.error(`  FAIL ${f}`);
if (failures.length) {
  console.error(`\n${failures.length} advisory finding(s) not covered by a valid exception.`);
  process.exit(1);
}
console.log("  OK");
