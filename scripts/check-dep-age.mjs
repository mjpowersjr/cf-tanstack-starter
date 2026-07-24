#!/usr/bin/env node
// Fails if any (name, version) added to pnpm-lock.yaml versus the base ref was
// published less than MIN_AGE_DAYS ago. Supply-chain mitigation: compromised
// publishes are typically yanked within days, so we wait them out.
//
// Usage:  node scripts/check-dep-age.mjs [baseRef]
// Default baseRef: origin/main (override with BASE_REF env or first arg).
//
// Runtime: Node 22+ (uses global fetch). No npm deps — runnable with no install.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MIN_AGE_DAYS = 7;
const MIN_AGE_MS = MIN_AGE_DAYS * 24 * 60 * 60 * 1000;
const LOCKFILE = "pnpm-lock.yaml";
const BASE_REF = process.env.BASE_REF || process.argv[2] || "origin/main";
const REGISTRY = "https://registry.npmjs.org";
const CONCURRENCY = 8;

// Parse the `packages:` section of pnpm-lock.yaml v9 and return Map<name, Set<version>>.
// Keys look like `'@scope/name@1.2.3':` or `name@1.2.3:` at 2-space indent.
function extractPackages(lockfile) {
  const byName = new Map();
  const lines = lockfile.split("\n");
  let inPackages = false;
  for (const line of lines) {
    if (line === "packages:") {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    if (line.length > 0 && !line.startsWith(" ") && !line.startsWith("\t")) break;
    const m = line.match(/^ {2}(?:'([^']+)'|([^\s:'"]+)):$/);
    if (!m) continue;
    const key = m[1] ?? m[2];
    // Skip peer-suffixed snapshot keys (these don't appear in `packages:` but be safe)
    if (key.includes("(")) continue;
    const at = key.lastIndexOf("@");
    if (at <= 0) continue;
    const name = key.slice(0, at);
    const version = key.slice(at + 1);
    // Skip non-registry specs (link:, file:, http(s):, git etc.)
    if (version.includes("/") || version.includes(":")) continue;
    let set = byName.get(name);
    if (!set) {
      set = new Set();
      byName.set(name, set);
    }
    set.add(version);
  }
  return byName;
}

function getBaseLockfile(ref) {
  try {
    return execSync(`git show ${ref}:${LOCKFILE}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

async function fetchPublishTimes(name) {
  // Scoped packages: the slash is allowed unencoded.
  const url = `${REGISTRY}/${name}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`registry HTTP ${res.status} for ${name}`);
  const data = await res.json();
  return data.time ?? {};
}

async function main() {
  const current = readFileSync(LOCKFILE, "utf8");
  const base = getBaseLockfile(BASE_REF);
  if (base === null) {
    console.log(`No baseline lockfile at ${BASE_REF}:${LOCKFILE} — skipping age check.`);
    return;
  }

  const cur = extractPackages(current);
  const old = extractPackages(base);

  const added = new Map(); // name -> Set<version>
  for (const [name, versions] of cur) {
    const oldVers = old.get(name) ?? new Set();
    for (const v of versions) {
      if (oldVers.has(v)) continue;
      let set = added.get(name);
      if (!set) {
        set = new Set();
        added.set(name, set);
      }
      set.add(v);
    }
  }

  const addedCount = [...added.values()].reduce((n, s) => n + s.size, 0);
  if (addedCount === 0) {
    console.log("No new package versions added to pnpm-lock.yaml.");
    return;
  }

  console.log(
    `Checking ${addedCount} newly-added version(s) across ${added.size} package(s) against npm registry...`,
  );

  const names = [...added.keys()];
  const timesByName = new Map();
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < names.length) {
        const name = names[cursor++];
        try {
          timesByName.set(name, await fetchPublishTimes(name));
        } catch (err) {
          console.warn(`warn: failed to fetch times for ${name}: ${err.message}`);
          timesByName.set(name, {});
        }
      }
    }),
  );

  const now = Date.now();
  const violations = [];
  const unknown = [];
  for (const [name, versions] of added) {
    const times = timesByName.get(name) ?? {};
    for (const version of versions) {
      const published = times[version];
      if (!published) {
        unknown.push(`${name}@${version}`);
        continue;
      }
      const age = now - Date.parse(published);
      if (age < MIN_AGE_MS) {
        violations.push({ name, version, published, ageMs: age });
      }
    }
  }

  // Fail closed: a version we can't verify (registry error or missing publish
  // time) must not silently pass a supply-chain gate.
  if (unknown.length > 0) {
    console.error(
      `\nERROR: ${unknown.length} version(s) could not be verified against the registry:`,
    );
    for (const u of unknown) console.error(`  - ${u}`);
    console.error("Re-run when the registry is reachable, or pin a verifiable version.");
  }

  if (violations.length === 0) {
    if (unknown.length > 0) process.exit(1);
    console.log(`OK — all ${addedCount} newly-added version(s) are ≥${MIN_AGE_DAYS} days old.`);
    return;
  }

  console.error(
    `\nERROR: ${violations.length} package version(s) violate the ${MIN_AGE_DAYS}-day cooldown:`,
  );
  for (const v of violations) {
    const days = (v.ageMs / (24 * 60 * 60 * 1000)).toFixed(1);
    console.error(`  - ${v.name}@${v.version}  published ${v.published}  (${days} days old)`);
  }
  console.error(
    `\nTo override: pin to an older version, wait, or add an exclusion under ` +
      `'minimumReleaseAgeExclude' in pnpm-workspace.yaml with justification in the PR description.`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
