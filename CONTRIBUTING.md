# Contributing

Thanks for your interest in improving **emdash-template-switcher**! 🎉

## Ways to help

- Report bugs or request features via [Issues](https://github.com/pk1983/emdash-template-switcher/issues).
- Improve the docs (`README.md`, the scaffolded `stubs/template/README.md`).
- Add or improve templates in `stubs/template/`.
- Improve the CLI (`bin/`, `src/`).

## Project layout

```
bin/cli.mjs            CLI entry (init | add | --help)
src/{init,add,utils}.mjs   command logic (Node built-ins only — no runtime deps)
stubs/                 the source copied into a user's site
  template/            registry (index.ts) + lib/ + minimal/
  pages/               thin page routers
  scripts/             SEO contract check
```

## Local checks

```bash
npm run check    # node --check on all CLI sources (syntax)
npm run smoke    # prints the CLI help
```

## Manual end-to-end test

Because the CLI scaffolds into a real project, please verify against a throwaway
EmDash site before opening a PR:

```bash
npm create emdash@latest my-test-site
cd my-test-site
npm install
node /path/to/emdash-template-switcher/bin/cli.mjs init
npx emdash seed && npm run dev
# in another terminal:
npm run template:check
node /path/to/emdash-template-switcher/bin/cli.mjs add magazine
npm run build
```

## Guidelines

- Keep the CLI **dependency-free** (Node built-ins only) so it stays fast and safe
  to run with `npx`.
- Scaffolded templates must satisfy the SEO contract (`Layout` includes
  `<EmDashHead>`; every page renders `<title>` + a `<h1>`). `template:check` must
  pass.
- Only touch the user's `src/`, seed, and `package.json` — never anything under
  `node_modules/emdash` (upgrade-safety).
- Use conventional-ish commit messages (`feat:`, `fix:`, `docs:`, `chore:`).

## License

By contributing, you agree that your contributions are licensed under the
project's [MIT License](./LICENSE).
