<div align="center">

# emdash-template-switcher

**Live, admin-switchable site templates for [EmDash CMS](https://emdashcms.com).**

A shadcn-style CLI that scaffolds a template registry and a minimal template into
your EmDash + Astro site, so an admin can switch the whole site's layout &
components from the dashboard — live for installed templates, one rebuild for new
ones.

[![npm](https://img.shields.io/npm/v/emdash-template-switcher.svg)](https://www.npmjs.com/package/emdash-template-switcher)
[![CI](https://github.com/pk1983/emdash-template-switcher/actions/workflows/ci.yml/badge.svg)](https://github.com/pk1983/emdash-template-switcher/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](#requirements)

</div>

---

## Table of contents

- [What it does](#what-it-does)
- [Why a CLI (not a plugin)](#why-a-cli-not-a-plugin)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
  - [`init`](#npx-emdash-template-switcher-init)
  - [`add <name|url|id@version>`](#npx-emdash-template-switcher-add-nameurlidversion)
  - [`upgrade`](#npx-emdash-template-switcher-upgrade)
- [How switching works](#how-switching-works)
- [The template contract](#the-template-contract)
- [SEO contract check](#seo-contract-check)
- [Caveats & trade-offs](#caveats--trade-offs)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## What it does

EmDash is an Astro-native CMS. Your site's front-end (pages, layouts, components)
is *your* source code. This tool adds a small, upgrade-safe layer on top so you
can ship **multiple full-site templates** and switch between them:

- **Switch installed templates live** from the admin — no rebuild.
- **Add a new template** with one command; one rebuild bundles its code, then it
  joins the live-switchable set.
- **Upgrade-safe**: everything lives in your `src/` and only calls EmDash's public
  APIs. Nothing forks or patches EmDash core — upgrading EmDash is a version bump.

## Why a CLI (not a plugin)

EmDash plugins extend the admin/server and can inject `<head>` tags or scripts,
but they **cannot** render your Astro pages/layouts — those are compiled from your
repo. So a template switcher is inherently *scaffolded source* (a registry, thin
page routers, template folders) plus an admin setting. This CLI copies that source
into your project, shadcn-style, so you own and can freely edit it.

## Requirements

- An **EmDash + Astro** site (e.g. `npm create emdash@latest`, or the blog
  starter) with the standard `posts` and `pages` collections.
- **Node.js >= 18.**

## Installation

From inside your EmDash site:

```bash
npm install -D emdash-template-switcher
npx emdash-template-switcher init
```

If you want to use it before publishing to npm, install straight from git:

```bash
npm install -D git+https://github.com/pk1983/emdash-template-switcher.git
npx emdash-template-switcher init
```

Then apply the schema and start:

```bash
npx emdash seed        # adds the "Appearance" collection with the template picker
npx emdash types
npm run dev
```

Open the admin → **Content → Appearance → Active template**, pick a template, save.
Switching between installed templates is **live**.

> Prefer not to add a dependency? Run it one-off:
> ```bash
> npx emdash-template-switcher@latest init
> ```

## Usage

### `npx emdash-template-switcher init`

Scaffolds the switcher into your site:

1. `src/template/` — the registry (`index.ts`), a **minimal** template, and shared
   `lib/` helpers.
2. `src/pages/*` — converts the standard blog pages into thin routers that render
   the active template. Existing pages are **skipped** unless you pass `--force`
   (originals are kept as `*.orig`).
3. `scripts/check-templates.cjs` + a `template:check` npm script.
4. Patches your seed with an `appearance` collection (the **Active template**
   dropdown, defaulting to `minimal`).

Flags: `--force` (overwrite existing files, backing them up as `*.orig`).

### `npx emdash-template-switcher add <name|url|id@version>`

Adds a new template, starting from a copy of `minimal` or by installing a package archive:

```bash
npx emdash-template-switcher add magazine
npx emdash-template-switcher add https://noblox.app/packages/shopvibe.tar.gz
npx emdash-template-switcher add shopvibe@latest
npx emdash-template-switcher add shopvibe@0.1.0
```

For a template name, it scaffolds `src/template/<name>/`, sets its `meta`,
**registers it** in `src/template/index.ts`, and adds it to the admin dropdown.
For a package URL or `.tar.gz` path, it installs the files listed in the
package manifest, then registers the package `id` and adds it to the admin
dropdown. For `id@version`, it resolves the template from the marketplace
catalog first, then installs the package archive it points to. In every case it
also refreshes the local EmDash schema cache, generated types, and database so
the new template appears in the admin immediately.

Then:

```bash
npm run build   # one rebuild so the new template's code is bundled
```

After that it's live-switchable from the admin like the others.

### `npx emdash-template-switcher upgrade`

Upgrades the switcher in the current project to the latest published version.
It detects your package manager when possible and runs the matching install
command for `emdash-template-switcher@latest`.

```bash
npx emdash-template-switcher upgrade
```

If you prefer to do it manually, use one of these:

```bash
npm install -D emdash-template-switcher@latest
pnpm add -D emdash-template-switcher@latest
yarn add -D emdash-template-switcher@latest
bun add -d emdash-template-switcher@latest
```

## How switching works

All installed templates are bundled; `resolveActiveTemplate` (in
`src/template/index.ts`) picks per request, in this order:

1. `PUBLIC_ACTIVE_TEMPLATE` env var — CI / hosting force.
2. `template` cookie — **logged-in editors only** (admin preview).
3. CMS `appearance.template` — the site-wide default (the admin dropdown).
4. The first installed template — fallback.

Because the cookie is honoured **only for authenticated users**, anonymous
visitors — including search-engine crawlers and anything behind a CDN — always
receive the CMS-elected template. That keeps every public response deterministic,
avoiding **cache poisoning** and **cloaking**.

## The template contract

Each template is a folder exporting the same components (+ a `meta`):

| Export     | Rendered on             | Props                                                              |
| ---------- | ----------------------- | ----------------------------------------------------------------- |
| `Layout`   | every page (the shell)  | `title`, `description`, `image`, `canonical`, `type`, `content`, … |
| `Home`     | `/`                     | `siteTitle`, `siteTagline`, `posts`                               |
| `PostList` | `/posts`                | `posts`, `count`                                                 |
| `Post`     | `/posts/[slug]`         | `post`, `bylines`, `tags`, `otherPosts`                          |
| `Page`     | `/pages/[slug]`         | `title`, `content`, `editTitle`                                   |
| `Archive`  | `/category/*`, `/tag/*` | `kind`, `label`, `posts`                                         |
| `Search`   | `/search`               | `query`, `results`                                               |
| `NotFound` | `/404`                  | —                                                                |

Templates are **presentation-only** — the routes do all the EmDash queries and
pass plain props, which keeps templates insulated from EmDash internals. The one
hard requirement: `Layout` must include `<EmDashHead>` (see
`src/template/minimal/Layout.astro`) so SEO tags render.

## SEO contract check

`init` installs a smoke test. With your site running:

```bash
npm run template:check
```

It activates each installed template in turn and asserts every representative page
returns **200** with a non-empty `<title>`, at least one `<h1>`, and EmDashHead's
SEO tags (canonical / og: / description), then restores the active template. A
template that forgot `<EmDashHead>` fails it. Wire it into CI.

## Caveats & trade-offs

- **Build-time compilation.** Adding or changing template *code* needs a rebuild;
  only *switching* between already-built templates is live.
- **All templates bundle.** Every installed template's CSS ships on every page —
  the cost of live switching. Namespace your template's class names (e.g. a
  per-template prefix) to avoid collisions.
- **`init` converts the standard blog pages.** If you've customised your pages,
  run without `--force` and move your markup into a template folder rather than
  overwriting.

## FAQ

**Does this modify EmDash core?** No. It only writes into your `src/`, your seed,
and your `package.json`, and calls EmDash's public APIs.

**Can a non-developer install a brand-new template with no rebuild?** No —
Astro compiles templates at build time. Non-devs can *switch* between installed
templates live; shipping new template *code* is a developer + rebuild step.

**Will it survive EmDash upgrades?** Yes, as long as EmDash keeps its public
query/render APIs. Pin your EmDash version and run `npm run template:check` after
upgrades.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Run `npm run
check` (syntax) and `npm run smoke` locally, and please test `init` + `add`
against a scaffolded EmDash site.

## License

[MIT](./LICENSE) © Huankai Chen
