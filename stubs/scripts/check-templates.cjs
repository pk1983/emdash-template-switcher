#!/usr/bin/env node
/**
 * Template SEO/head contract smoke test.
 *
 * Discovers installed templates (folders in src/template/), then for each one
 * makes it the CMS-active template and asserts every representative page:
 *   - responds 200,
 *   - has a non-empty <title>,
 *   - has at least one <h1>,
 *   - renders EmDashHead's SEO tags (canonical / og: / meta description).
 *
 * That last check catches a template that forgot <EmDashHead>. Restores the
 * original active template when done.
 *
 * Usage: start the site (npm run dev / preview), then: npm run template:check
 *   BASE_URL=https://staging.example npm run template:check
 */
const Database = require("better-sqlite3");
const { readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const BASE = process.env.BASE_URL || "http://127.0.0.1:4321";
const DB = process.env.EMDASH_DB || "./data.db";

function installed() {
	const dir = "src/template";
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter(
		(n) => n !== "lib" && existsSync(join(dir, n, "index.ts")),
	);
}
function firstSlug(table) {
	try {
		const db = new Database(DB, { readonly: true });
		const r = db.prepare(`SELECT slug FROM ${table} WHERE status='published' LIMIT 1`).get();
		db.close();
		return r && r.slug;
	} catch {
		return null;
	}
}
function setTemplate(name) {
	const db = new Database(DB);
	db.prepare("UPDATE ec_appearance SET template = ? WHERE slug = 'appearance'").run(name);
	db.close();
}
function getTemplate() {
	const db = new Database(DB, { readonly: true });
	const r = db.prepare("SELECT template FROM ec_appearance WHERE slug = 'appearance'").get();
	db.close();
	return r && r.template;
}

async function checkPage(url) {
	const res = await fetch(BASE + url);
	const html = await res.text();
	const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1]?.trim();
	const h1 = (html.match(/<h1[\s>]/gi) || []).length;
	const head = /rel="canonical"|property="og:|name="description"/i.test(html);
	const problems = [];
	if (res.status !== 200) problems.push(`status ${res.status}`);
	if (!title) problems.push("missing/empty <title>");
	if (h1 < 1) problems.push("no <h1>");
	if (!head) problems.push("no EmDashHead SEO tags");
	return { url, ok: problems.length === 0, problems, h1 };
}

(async () => {
	const templates = installed();
	if (templates.length === 0) {
		console.error("✗ No templates found in src/template/");
		process.exit(1);
	}
	const postSlug = firstSlug("ec_posts");
	const pageSlug = firstSlug("ec_pages");
	const pages = ["/", "/posts",
		postSlug ? `/posts/${postSlug}` : null,
		pageSlug ? `/pages/${pageSlug}` : null,
	].filter(Boolean);

	const original = getTemplate() || templates[0];
	let failed = 0;
	try {
		for (const t of templates) {
			setTemplate(t);
			await new Promise((r) => setTimeout(r, 300));
			console.log(`\n▶ template: ${t}`);
			for (const p of pages) {
				const r = await checkPage(p);
				if (r.ok) console.log(`  ✓ ${p}  (h1×${r.h1})`);
				else { failed++; console.log(`  ✗ ${p}  → ${r.problems.join(", ")}`); }
			}
		}
	} finally {
		setTemplate(original);
		console.log(`\nrestored active template = ${original}`);
	}
	if (failed) { console.error(`\n✗ ${failed} check(s) failed`); process.exit(1); }
	console.log("\n✓ All templates satisfy the SEO head contract");
})();
