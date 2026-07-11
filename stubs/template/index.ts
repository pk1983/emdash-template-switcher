/**
 * Template registry — runtime-switchable.
 *
 * All installed templates are bundled; the active one is chosen per request.
 * Switching between installed templates is LIVE (change the admin setting →
 * next request renders it). Adding a NEW template needs one rebuild to compile
 * its code into the bundle — the `add` command registers it here for you.
 *
 * Resolution precedence (see `resolveActiveTemplate`):
 *   1. PUBLIC_ACTIVE_TEMPLATE env var   (CI / hosting force)
 *   2. `template` cookie — LOGGED-IN EDITORS ONLY (admin preview)
 *   3. CMS admin choice                 (Appearance → "Active template")
 *   4. first installed template         (fallback)
 *
 * The cookie is honoured only for authenticated users, so anonymous requests —
 * incl. crawlers and anything behind a CDN — always get the CMS-elected
 * template. That avoids cache poisoning and cloaking.
 */
import { getEmDashEntry } from "emdash";
// @template-imports
import * as minimal from "./minimal";

export const templates = {
	minimal,
	// @template-map
} as const;

export type TemplateName = keyof typeof templates;
export type Template = (typeof templates)[TemplateName];

export const installedTemplates: string[] = Object.keys(templates);

/** First installed template — the safe fallback. */
const fallback = Object.values(templates)[0] as Template;

function pick(name?: string | null): Template | undefined {
	return name && name in templates
		? templates[name as TemplateName]
		: undefined;
}

type RequestCtx = {
	locals?: { user?: unknown };
	cookies?: { get(name: string): { value?: string } | undefined };
};

/** Resolve the active template for the current request. Pass `Astro`. */
export async function resolveActiveTemplate(
	astro?: RequestCtx,
): Promise<Template> {
	const env =
		typeof process !== "undefined"
			? process.env?.PUBLIC_ACTIVE_TEMPLATE
			: undefined;
	const byEnv = pick(env);
	if (byEnv) return byEnv;

	// cookie override — editors only; public visitors are never affected
	if (astro?.locals?.user) {
		const byCookie = pick(astro.cookies?.get("template")?.value);
		if (byCookie) return byCookie;
	}

	return pick(await cmsTemplateName()) ?? fallback;
}

async function cmsTemplateName(): Promise<string | undefined> {
	try {
		const { entry } = await getEmDashEntry("appearance", "appearance");
		return (entry?.data as { template?: string } | undefined)?.template;
	} catch {
		return undefined;
	}
}
