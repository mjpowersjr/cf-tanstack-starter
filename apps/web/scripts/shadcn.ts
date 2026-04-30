/**
 * Tooling for keeping shadcn UI components in sync with upstream.
 *
 * shadcn's model is "you own these files" — there is no `update` command.
 * The upgrade workflow is `shadcn add <name> -o` which overwrites the local
 * file with the latest from the registry. This script automates that across
 * every component currently installed in `app/components/ui/`.
 *
 * Subcommands:
 *
 *   tsx scripts/shadcn.ts diff
 *     Print upstream-vs-local diffs for each installed component. Read-only.
 *
 *   tsx scripts/shadcn.ts update [--all] [name...]
 *     Overwrite local components with the upstream version. With names,
 *     only those components are updated. With --all (and no names), every
 *     installed component is updated. With no args, errors out — explicit
 *     opt-in required.
 *
 * Customizations are nuked on update. Commit your work first; the diff
 * after `update` is your safety net.
 */

import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const uiDir = resolve(webRoot, "app/components/ui");

function listInstalled(): string[] {
  return readdirSync(uiDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
}

function shadcn(args: string): { stdout: string; status: number } {
  try {
    const stdout = execSync(`pnpm dlx shadcn@latest ${args}`, {
      cwd: webRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, status: 0 };
  } catch (err) {
    const e = err as { stdout?: Buffer; status?: number };
    return { stdout: e.stdout?.toString() ?? "", status: e.status ?? 1 };
  }
}

function diff() {
  const components = listInstalled();
  console.log(`Checking ${components.length} components for upstream changes...\n`);

  const changed: string[] = [];
  for (const name of components) {
    process.stdout.write(`  ${name}... `);
    const { stdout } = shadcn(`add ${name} --diff --silent`);
    // shadcn embeds a unified diff when there are changes; the headers
    // `--- a/` and `+++ b/` only appear in that mode.
    const hasChanges = /---\s+a\//.test(stdout) && /\+\+\+\s+b\//.test(stdout);
    if (hasChanges) {
      console.log("CHANGED");
      changed.push(name);
    } else {
      console.log("up to date");
    }
  }

  console.log("");
  if (changed.length === 0) {
    console.log("All components match upstream.");
    return;
  }
  console.log(`${changed.length} component(s) have upstream changes:`);
  for (const c of changed) console.log(`  - ${c}`);
  console.log("\nRun `pnpm shadcn:update --all` or `pnpm shadcn:update <name>` to apply.");
}

function update(args: string[]) {
  const installed = listInstalled();
  const all = args.includes("--all");
  const names = args.filter((a) => !a.startsWith("--"));

  if (!all && names.length === 0) {
    console.error("Error: pass component names or --all\n");
    console.error("Examples:");
    console.error("  pnpm shadcn:update button");
    console.error("  pnpm shadcn:update button card dialog");
    console.error("  pnpm shadcn:update --all");
    process.exit(1);
  }

  const targets = all ? installed : names;
  const unknown = targets.filter((n) => !installed.includes(n));
  if (unknown.length > 0) {
    console.error(`Error: not installed: ${unknown.join(", ")}`);
    console.error(`Installed: ${installed.join(", ")}`);
    process.exit(1);
  }

  console.log(`Updating ${targets.length} component(s) by overwriting from upstream...\n`);
  for (const name of targets) {
    process.stdout.write(`  ${name}... `);
    const { status } = shadcn(`add ${name} -o -y --silent`);
    console.log(status === 0 ? "ok" : "FAILED");
  }
  console.log("\nDone. Review the diff with `git diff app/components/ui/`.");
}

const [command, ...rest] = process.argv.slice(2);
switch (command) {
  case "diff":
    diff();
    break;
  case "update":
    update(rest);
    break;
  default:
    console.error("Usage: tsx scripts/shadcn.ts <diff | update [--all] [name...]>");
    process.exit(1);
}
