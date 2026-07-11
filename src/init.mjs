import { join } from "node:path";
import { existsSync } from "node:fs";
import {
	STUBS,
	log,
	copyDir,
	copyFile,
	assertEmdashProject,
	findSeed,
	patchSeedAppearance,
	ensureScript,
} from "./utils.mjs";

export async function runInit({ cwd, force }) {
	log.step("emdash-template-switcher · init");
	assertEmdashProject(cwd);

	// 1. registry + minimal template + shared lib
	log.step("1. Template registry + minimal template");
	copyDir(join(STUBS, "template"), join(cwd, "src", "template"), { force, cwd });

	// 2. page routers (back up any that already exist)
	log.step("2. Page routers (src/pages)");
	if (!force) log.info("existing pages are skipped; pass --force to replace them (originals kept as *.orig)");
	copyDir(join(STUBS, "pages"), join(cwd, "src", "pages"), { force, cwd });

	// 3. SEO contract check script + npm script
	log.step("3. SEO contract check");
	copyFile(
		join(STUBS, "scripts", "check-templates.cjs"),
		join(cwd, "scripts", "check-templates.cjs"),
		{ force, cwd },
	);
	if (ensureScript(cwd, "template:check", "node scripts/check-templates.cjs"))
		log.ok('added npm script "template:check"');
	else log.skip('npm script "template:check" already present');

	// 4. seed: appearance collection + Active template field
	log.step("4. Admin control (seed)");
	const seed = findSeed(cwd);
	if (seed) {
		patchSeedAppearance(seed, ["minimal"]);
		log.ok(`patched seed: ${seed.replace(cwd + "/", "")} (appearance → template=minimal)`);
	} else {
		log.warn("no seed file found — add an `appearance` collection with a `template` select manually.");
	}

	// 5. done
	log.step("Done ✓  Next steps:");
	console.log(`
  1. Apply the schema:      npx emdash seed
  2. Regenerate types:      npx emdash types
  3. Start the site:        npm run dev
  4. In the admin: Content → Appearance → Active template

  Add another template:     npx emdash-template-switcher add <name>
  Verify SEO contract:      npm run template:check   (with the site running)

  ${force ? "Replaced files were backed up as *.orig." : "Existing pages were skipped — re-run with --force to convert them into routers (originals saved as *.orig)."}
`);

	if (!force && anyStockPageExists(cwd)) {
		log.warn("Some src/pages/* already existed and were left untouched. To switch templates they must delegate to the active template — re-run with --force, or move their markup into src/template/minimal/.");
	}
}

function anyStockPageExists(cwd) {
	return ["src/pages/index.astro", "src/pages/posts/[slug].astro"].some((p) =>
		existsSync(join(cwd, p)),
	);
}
