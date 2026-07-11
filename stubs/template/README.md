# Site templates

Each template is a self-contained folder that owns the site's presentation
(layout + page components). `src/pages/*` are thin routers: they fetch data and
render the **active** template's components. All installed templates are bundled;
the active one is resolved per request (`resolveActiveTemplate` in `index.ts`).

- **Switching between installed templates is live** — change the admin setting
  (Content → Appearance → Active template). No rebuild.
- **Adding a new template needs one rebuild** to compile its code into the
  bundle. Use `npx emdash-template-switcher add <name>`.

## The component contract

Every template's `index.ts` exports these + `meta`:

| Export     | Rendered on             | Props                                                              |
| ---------- | ----------------------- | ----------------------------------------------------------------- |
| `Layout`   | every page (the shell)  | `title`, `description`, `image`, `canonical`, `type`, `content`, … |
| `Home`     | `/`                     | `siteTitle`, `siteTagline`, `posts`                               |
| `PostList` | `/posts`                | `posts` (`[{ post, tags, bylines }]`), `count`                    |
| `Post`     | `/posts/[slug]`         | `post`, `bylines`, `tags`, `publishDate`, `otherPosts`            |
| `Page`     | `/pages/[slug]`         | `title`, `content`, `editTitle`                                   |
| `Archive`  | `/category/*`, `/tag/*` | `kind`, `label`, `posts`                                          |
| `Search`   | `/search`               | `query`, `results`                                               |
| `NotFound` | `/404`                  | —                                                                |

Templates are **presentation-only** — routes do the EmDash queries. The one
requirement for SEO: `Layout` must include `<EmDashHead>` (see `minimal/Layout.astro`).
`npm run template:check` enforces this for every template.

Shared helpers live in `./lib/` (reading time, date formatting).
