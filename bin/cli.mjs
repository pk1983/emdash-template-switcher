#!/usr/bin/env node
import process from "node:process";
import { runInit } from "../src/init.mjs";
import { runAdd } from "../src/add.mjs";

const HELP = `emdash-template-switcher — live, admin-switchable templates for EmDash

Usage:
  npx emdash-template-switcher init            Scaffold the template registry + a
                                               "minimal" template, convert pages to
                                               routers, and wire the admin control.

  npx emdash-template-switcher add <name>      Add a new template (starts from a copy
                                               of "minimal") and register it.

Options:
  --force       Overwrite existing files instead of skipping/backing up.
  -h, --help    Show this help.

After 'init': run your seed (npx emdash seed) then npm run dev, and pick the
template in the admin under Content -> Appearance -> Active template.`;

const argv = process.argv.slice(2);
const cmd = argv[0];
const force = argv.includes("--force");

async function main() {
	if (!cmd || cmd === "-h" || cmd === "--help") {
		console.log(HELP);
		return;
	}
	const cwd = process.cwd();
	if (cmd === "init") {
		await runInit({ cwd, force });
	} else if (cmd === "add") {
		const name = argv.slice(1).find((a) => !a.startsWith("-"));
		if (!name) {
			console.error("✗ Usage: emdash-template-switcher add <name>");
			process.exit(1);
		}
		await runAdd({ cwd, name, force });
	} else {
		console.error(`✗ Unknown command "${cmd}"\n`);
		console.log(HELP);
		process.exit(1);
	}
}

main().catch((err) => {
	console.error("\n✗", err.message);
	process.exit(1);
});
