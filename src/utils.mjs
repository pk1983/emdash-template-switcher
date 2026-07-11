import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Root of this package (…/emdash-template-switcher). */
export const PKG_ROOT = join(__dirname, "..");
export const STUBS = join(PKG_ROOT, "stubs");

export const log = {
	info: (m) => console.log(`  ${m}`),
	ok: (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`),
	skip: (m) => console.log(`  \x1b[2m•\x1b[0m ${m}`),
	warn: (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`),
	step: (m) => console.log(`\n\x1b[1m${m}\x1b[0m`),
};

export function readJson(p) {
	return JSON.parse(readFileSync(p, "utf8"));
}
export function writeJson(p, obj) {
	writeFileSync(p, JSON.stringify(obj, null, "\t") + "\n");
}
export function ensureDir(p) {
	mkdirSync(p, { recursive: true });
}

/** Copy a file, honouring force / backup. Returns "written" | "skipped" | "backed-up". */
export function copyFile(from, to, { force, cwd }) {
	ensureDir(dirname(to));
	if (existsSync(to)) {
		if (!force) {
			log.skip(`skip (exists): ${relative(cwd, to)}`);
			return "skipped";
		}
		const bak = `${to}.orig`;
		if (!existsSync(bak)) copyFileSync(to, bak);
		copyFileSync(from, to);
		log.ok(`overwrite (backup .orig): ${relative(cwd, to)}`);
		return "backed-up";
	}
	copyFileSync(from, to);
	log.ok(`create: ${relative(cwd, to)}`);
	return "written";
}

/** Recursively copy a directory of stubs into the target. */
export function copyDir(fromDir, toDir, opts) {
	for (const name of readdirSync(fromDir)) {
		const from = join(fromDir, name);
		const to = join(toDir, name);
		if (statSync(from).isDirectory()) copyDir(from, to, opts);
		else copyFile(from, to, opts);
	}
}

/** Locate a project's seed file. Returns absolute path or null. */
export function findSeed(cwd) {
	// package.json → emdash.seed
	const pkgPath = join(cwd, "package.json");
	if (existsSync(pkgPath)) {
		try {
			const seed = readJson(pkgPath)?.emdash?.seed;
			if (seed && existsSync(join(cwd, seed))) return join(cwd, seed);
		} catch {}
	}
	for (const rel of ["seed/seed.json", ".emdash/seed.json", "seed.json"]) {
		if (existsSync(join(cwd, rel))) return join(cwd, rel);
	}
	return null;
}

/** Confirm this looks like an EmDash + Astro project. Throws otherwise. */
export function assertEmdashProject(cwd) {
	const pkgPath = join(cwd, "package.json");
	if (!existsSync(pkgPath)) {
		throw new Error(
			"No package.json here. Run this inside your EmDash site (e.g. after `npm create emdash@latest`).",
		);
	}
	const pkg = readJson(pkgPath);
	const deps = { ...pkg.dependencies, ...pkg.devDependencies };
	if (!deps.emdash) {
		throw new Error(
			'This does not look like an EmDash project (no "emdash" dependency). Run inside your EmDash site.',
		);
	}
	return pkg;
}

/** Add an npm script if missing. Returns true if changed. */
export function ensureScript(cwd, name, command) {
	const pkgPath = join(cwd, "package.json");
	const pkg = readJson(pkgPath);
	pkg.scripts ??= {};
	if (pkg.scripts[name]) return false;
	pkg.scripts[name] = command;
	writeJson(pkgPath, pkg);
	return true;
}

const APPEARANCE_COLLECTION = {
	slug: "appearance",
	label: "Appearance",
	labelSingular: "Appearance",
	description:
		"Site-wide appearance. Pick the active template — it switches live for existing templates.",
	supports: [],
	fields: [
		{ slug: "title", label: "Internal Title", type: "string", required: true },
		{
			slug: "template",
			label: "Active template",
			type: "select",
			validation: { options: ["minimal"] },
		},
	],
};

/** Ensure the seed has the `appearance` collection + entry with the given options. */
export function patchSeedAppearance(seedPath, templateNames) {
	const seed = readJson(seedPath);
	seed.collections ??= [];
	seed.content ??= {};

	let coll = seed.collections.find((c) => c.slug === "appearance");
	if (!coll) {
		coll = structuredClone(APPEARANCE_COLLECTION);
		seed.collections.push(coll);
	}
	const field = coll.fields.find((f) => f.slug === "template");
	if (field) {
		field.validation ??= {};
		field.validation.options = Array.from(
			new Set([...(field.validation.options ?? []), ...templateNames]),
		);
	}

	seed.content.appearance ??= [];
	if (!seed.content.appearance.find((e) => e.slug === "appearance")) {
		seed.content.appearance.push({
			id: "appearance",
			slug: "appearance",
			status: "published",
			data: { title: "Appearance", template: templateNames[0] ?? "minimal" },
		});
	}
	writeJson(seedPath, seed);
}

/** Add a template name to the seed appearance select options. */
export function addSeedTemplateOption(seedPath, name) {
	const seed = readJson(seedPath);
	const coll = seed.collections?.find((c) => c.slug === "appearance");
	const field = coll?.fields?.find((f) => f.slug === "template");
	if (!field) return false;
	field.validation ??= {};
	field.validation.options = Array.from(
		new Set([...(field.validation.options ?? []), name]),
	);
	writeJson(seedPath, seed);
	return true;
}

/** Register a template in src/template/index.ts via the marker comments. */
export function registerTemplateInRegistry(indexPath, name) {
	let src = readFileSync(indexPath, "utf8");
	const importLine = `import * as ${camel(name)} from "./${name}";`;
	const mapLine = `\t"${name}": ${camel(name)},`;
	if (src.includes(importLine)) return false;
	src = src.replace(
		"// @template-imports",
		`// @template-imports\n${importLine}`,
	);
	src = src.replace("\t// @template-map", `${mapLine}\n\t// @template-map`);
	writeFileSync(indexPath, src);
	return true;
}

export function camel(name) {
	return name.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}
