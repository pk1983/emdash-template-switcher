# emdash-template-switcher

Live, admin-switchable **site templates** for [EmDash](https://emdashcms.com)
CMS. A shadcn-style CLI: it scaffolds a small **template registry** and a
**minimal** template into your EmDash/Astro site, converts your pages into thin
routers, and wires an admin control so you can switch the whole site's
layout + components — live for installed templates, one rebuild for new ones.

> It stays **upgrade-compatible** with EmDash: everything is scaffolded into your
> own `src/`, consuming EmDash only through its public APIs. Nothing patches or
> forks EmDash core.

## Why a CLI (and not a plugin)

EmDash plugins extend the admin/server; they **can't** render your Astro
pages/layouts — those are your site's source. So a template switcher is partly
scaffolded source (registry + routers + templates) plus an admin setting. This
CLI copies that source in for you, shadcn-style, so you own and can edit it.

## Requirements

An EmDash site (e.g. `npm create emdash@latest`, or the blog starter) with the
standard `posts` + `pages` collections.

## Install & init

From inside your EmDash site:

```bash
npm i -D emdash-template-switcher
npx emdash-template-switcher init
```

`init` will:

1. Create `src/template/` — the registry (`index.ts`) + a `minimal` template +
   shared `lib/`.
2. Convert `src/pages/*` into thin routers that render the active template
   (existing pages are skipped unless you pass `--force`; originals are kept as
   `*.orig`).
3. Add `scripts/check-templates.cjs` and an npm script `template:check`.
4. Patch your seed with an `appearance` collection (an **Active template**
   dropdown).

Then:

```bash
npx emdash seed        # apply the appearance schema
npx emdash types
npm run dev
```

In the admin: **Content → Appearance → Active template**. Switching between
installed templates is **live** (no rebuild).

## Add a template

```bash
npx emdash-template-switcher add magazine
```

This copies `minimal` to `src/template/magazine/`, registers it, and adds it to
the admin dropdown. Edit it, then:

```bash
npm run build   # one rebuild so the new template's code is bundled
```

After that it's live-switchable from the admin like the others.

## How switching works

All installed templates are bundled; `resolveActiveTemplate` (in
`src/template/index.ts`) picks per request:

1. `PUBLIC_ACTIVE_TEMPLATE` env (CI/hosting force)
2. `template` cookie — **logged-in editors only** (admin preview)
3. CMS `appearance.template` (site-wide default)
4. first installed template (fallback)

The cookie is honoured only for authenticated users, so **anonymous visitors,
crawlers, and CDNs always get the CMS-elected template** — no cache poisoning,
no cloaking.

## The template contract

See `src/template/README.md` after `init`. Each template exports:
`Layout, Home, PostList, Post, Page, Archive, Search, NotFound` + `meta`.
Templates are presentation-only (routes do the data fetching). `Layout` must
include `<EmDashHead>` — `npm run template:check` enforces the SEO head contract
across every template.

## Caveats

- **Build-time compilation:** adding/changing template *code* needs a rebuild;
  only *switching* between built templates is live.
- **All templates bundle:** every installed template's CSS ships (the cost of
  live switching). Namespace your template's classes to avoid collisions.
- `init` converts the **standard blog pages**. If you've customised your pages,
  run without `--force` and move your markup into a template folder instead of
  overwriting.

## License

MIT
