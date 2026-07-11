import {
	existsSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
	statSync,
	copyFileSync,
	rmSync,
} from "node:fs";
import { dirname, join, relative, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

export function isTemplatePackageSpec(spec) {
	if (/^https?:\/\//i.test(spec)) return true;
	if (spec.endsWith(".tar.gz") || spec.endsWith(".tgz")) return true;
	if (spec.includes("/") || spec.includes("\\")) return true;
	if (spec.includes("@")) return true;
	return false;
}

export async function installTemplatePackage({ cwd, spec, force }) {
	const { archivePath, cleanupDir } = await resolveArchiveSpec(spec);
	const tempDir = mkdtempSync(join(tmpdir(), "emdash-template-"));
	try {
		execFileSync("tar", ["-xzf", archivePath, "-C", tempDir]);
		const manifestPath = findFile(tempDir, "template.manifest.json");
		if (!manifestPath) {
			throw new Error("Package archive did not include template.manifest.json.");
		}
		const manifest = readJson(manifestPath);
		if (!manifest?.id || typeof manifest.id !== "string") {
			throw new Error("Package manifest is missing a string `id`.");
		}
		if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
			throw new Error(`Package ${manifest.id} does not list any files.`);
		}

		const packageRoot = dirname(manifestPath);
		for (const file of manifest.files) {
			if (typeof file !== "string") {
				throw new Error(`Package ${manifest.id} contains an invalid file entry.`);
			}
			const from = join(packageRoot, file);
			if (!existsSync(from)) {
				throw new Error(`Package ${manifest.id} is missing ${file}.`);
			}
			copyFile(from, join(cwd, file), { force, cwd });
		}
		return manifest;
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
		if (cleanupDir) rmSync(cleanupDir, { recursive: true, force: true });
	}
}

async function resolveArchiveSpec(spec) {
	const marketplaceRef = parseMarketplaceRef(spec);
	if (marketplaceRef) {
		const resolved = await resolveMarketplaceRef(marketplaceRef);
		return resolveArchiveSpec(resolved);
	}
	if (/^https?:\/\//i.test(spec)) {
		const response = await fetch(spec);
		if (!response.ok) {
			throw new Error(`Failed to download package: ${response.status} ${response.statusText}`);
		}
		const tempArchive = mkdtempSync(join(tmpdir(), "emdash-template-archive-"));
		const archivePath = join(tempArchive, "package.tar.gz");
		writeFileSync(archivePath, Buffer.from(await response.arrayBuffer()));
		return { archivePath, cleanupDir: tempArchive };
	}
	const resolved = isAbsolute(spec) ? spec : join(process.cwd(), spec);
	if (!existsSync(resolved)) {
		throw new Error(`Package archive not found: ${spec}`);
	}
	return { archivePath: resolved, cleanupDir: null };
}

function parseMarketplaceRef(spec) {
	if (/^https?:\/\//i.test(spec)) return null;
	if (spec.endsWith(".tar.gz") || spec.endsWith(".tgz")) return null;
	if (spec.includes("/") || spec.includes("\\")) return null;
	const at = spec.lastIndexOf("@");
	if (at <= 0) return null;
	const id = spec.slice(0, at).trim();
	const version = spec.slice(at + 1).trim();
	if (!id || !version) return null;
	return { id, version };
}

async function resolveMarketplaceRef({ id, version }) {
	const catalogUrl =
		process.env.EMDASH_TEMPLATE_MARKETPLACE_CATALOG ||
		"https://raw.githubusercontent.com/pk1983/emdash-template-marketplace/main/catalog/index.json";
	const response = await fetch(catalogUrl);
	if (!response.ok) {
		throw new Error(`Failed to load marketplace catalog: ${response.status} ${response.statusText}`);
	}
	const catalog = await response.json();
	const entries = Array.isArray(catalog?.templates) ? catalog.templates : [];
	const matches = entries.filter((item) => item?.id === id);
	if (matches.length === 0) {
		const available = entries.map((item) => item?.id).filter(Boolean).join(", ");
		throw new Error(
			`No marketplace template found for "${id}".${available ? ` Available: ${available}.` : ""}`,
		);
	}

	let chosen;
	if (version === "latest") {
		chosen = matches
			.filter((item) => item?.status === "available" && item?.install?.url)
			.sort((a, b) => compareVersions(b.version, a.version))[0] ?? matches[0];
	} else {
		chosen = matches.find((item) => item?.version === version) ?? null;
	}

	if (!chosen?.install?.url) {
		throw new Error(`Marketplace template "${id}@${version}" does not have a downloadable package URL.`);
	}

	return chosen.install.url;
}

function compareVersions(a, b) {
	const pa = parseVersion(a);
	const pb = parseVersion(b);
	if (!pa || !pb) return String(a).localeCompare(String(b), undefined, { numeric: true });
	for (let i = 0; i < 3; i += 1) {
		if (pa[i] !== pb[i]) return pa[i] - pb[i];
	}
	return 0;
}

function parseVersion(value) {
	if (typeof value !== "string") return null;
	const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!match) return null;
	return match.slice(1).map((n) => Number(n));
}

function findFile(rootDir, fileName) {
	for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
		const full = join(rootDir, entry.name);
		if (entry.isDirectory()) {
			const found = findFile(full, fileName);
			if (found) return found;
		} else if (entry.isFile() && entry.name === fileName) {
			return full;
		}
	}
	return null;
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

/**
 * Keep EmDash's local caches in sync with the updated seed so the admin UI
 * reflects a newly-added template immediately.
 */
export function syncEmdashTemplateCaches(cwd, seedPath) {
	const templateNames = getAppearanceTemplateOptions(seedPath);
	const schemaPath = join(cwd, ".emdash", "schema.json");
	const typesPath = join(cwd, ".emdash", "types.ts");
	const dbPath = join(cwd, "data.db");

	const result = {
		schemaPresent: false,
		typesPresent: false,
		databasePresent: false,
		schemaChanged: false,
		typesChanged: false,
		databaseChanged: false,
	};
	if (existsSync(schemaPath)) {
		result.schemaPresent = true;
		result.schemaChanged = patchEmdashSchemaCache(schemaPath, templateNames);
	}
	if (existsSync(typesPath)) {
		result.typesPresent = true;
		result.typesChanged = patchEmdashTypesCache(typesPath, templateNames);
	}
	if (existsSync(dbPath)) {
		result.databasePresent = true;
		result.databaseChanged = patchEmdashDatabase(dbPath, templateNames);
	}
	return result;
}

function getAppearanceTemplateOptions(seedPath) {
	const seed = readJson(seedPath);
	const field = seed.collections
		?.find((c) => c.slug === "appearance")
		?.fields?.find((f) => f.slug === "template");
	const options = field?.validation?.options;
	if (Array.isArray(options) && options.length > 0) {
		return options.filter((value) => typeof value === "string" && value.trim());
	}
	return ["minimal"];
}

function patchEmdashSchemaCache(schemaPath, templateNames) {
	const schema = readJson(schemaPath);
	const field = schema.collections
		?.find((c) => c.slug === "appearance")
		?.fields?.find((f) => f.slug === "template");
	const next = Array.from(new Set(templateNames));
	const current = Array.isArray(field?.validation?.options) ? field.validation.options : [];
	if (arraysEqual(current, next)) return false;
	if (field) {
		field.validation ??= {};
		field.validation.options = next;
		writeJson(schemaPath, schema);
		return true;
	}
	return false;
}

function patchEmdashTypesCache(typesPath, templateNames) {
	let src = readFileSync(typesPath, "utf8");
	const next = templateNames.map((name) => JSON.stringify(name)).join(" | ");
	const pattern = /(export interface Appearance \{[\s\S]*?\n\s*template\?\s*:\s*)([^;\n]+)(;)/m;
	if (!pattern.test(src)) return false;
	const replaced = src.replace(pattern, `$1${next}$3`);
	if (replaced === src) return false;
	writeFileSync(typesPath, replaced);
	return true;
}

function patchEmdashDatabase(dbPath, templateNames) {
	const optionsJson = JSON.stringify(Array.from(new Set(templateNames)));
	const script = `
		const Database = require("better-sqlite3");
		const db = new Database(${JSON.stringify(dbPath)});
		try {
			db.prepare(\`
				UPDATE _emdash_fields
				SET validation = json_set(coalesce(validation, '{}'), '$.options', json(?))
				WHERE slug = 'template'
				  AND collection_id = (SELECT id FROM _emdash_collections WHERE slug = 'appearance')
			\`).run(${JSON.stringify(optionsJson)});
		} finally {
			db.close();
		}
	`;
	try {
		execFileSync("node", ["-e", script], { cwd: dirname(dbPath) });
		return true;
	} catch {
		return false;
	}
}

function arraysEqual(a, b) {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i += 1) {
		if (a[i] !== b[i]) return false;
	}
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
