import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
	log,
	copyDir,
	findSeed,
	addSeedTemplateOption,
	registerTemplateInRegistry,
	assertEmdashProject,
} from "./utils.mjs";

export async function runAdd({ cwd, name, force }) {
	log.step(`emdash-template-switcher · add "${name}"`);
	assertEmdashProject(cwd);

	if (!/^[a-z][a-z0-9-]*$/.test(name)) {
		throw new Error("Template name must be lowercase kebab-case, e.g. `magazine` or `dark-pro`.");
	}
	const templateDir = join(cwd, "src", "template");
	if (!existsSync(templateDir)) {
		throw new Error("src/template not found. Run `emdash-template-switcher init` first.");
	}
	const dest = join(templateDir, name);
	if (existsSync(dest) && !force) {
		throw new Error(`src/template/${name} already exists. Pass --force to overwrite.`);
	}

	// 1. copy the minimal template as a starting point
	log.step("1. Scaffold template folder (from minimal)");
	const source = existsSync(join(templateDir, "minimal"))
		? join(templateDir, "minimal")
		: join(templateDir, "..", "template", "minimal");
	copyDir(source, dest, { force, cwd });

	// set meta.name in the new template's index.ts
	const idx = join(dest, "index.ts");
	if (existsSync(idx)) {
		let s = readFileSync(idx, "utf8").replace(
			/meta = \{[^}]*\}/,
			`meta = { name: "${name}", label: "${titleCase(name)}" }`,
		);
		writeFileSync(idx, s);
		log.ok(`set meta.name = "${name}"`);
	}

	// 2. register in the registry
	log.step("2. Register in src/template/index.ts");
	if (registerTemplateInRegistry(join(templateDir, "index.ts"), name))
		log.ok("registered in templates map");
	else log.skip("already registered");

	// 3. add to the admin dropdown options
	log.step("3. Admin dropdown option (seed)");
	const seed = findSeed(cwd);
	if (seed && addSeedTemplateOption(seed, name)) log.ok(`added "${name}" to appearance → template options`);
	else log.warn("could not patch seed — add the option manually and reseed.");

	log.step("Done ✓");
	console.log(`
  Edit your new template in:  src/template/${name}/
  Rebuild once so it's bundled:  npm run build   (new template code needs one build)
  Then switch to it live in the admin: Content → Appearance → Active template.
`);
}

function titleCase(name) {
	return name.replace(/(^|-)(\w)/g, (_, s, c) => (s ? " " : "") + c.toUpperCase());
}
