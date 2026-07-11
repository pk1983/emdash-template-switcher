# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-11

### Added

- `init` command — scaffolds the template registry, a `minimal` template, thin
  page routers, an `appearance` seed collection (Active-template picker), and a
  `template:check` SEO smoke test.
- `add <name>` command — scaffolds a new template from `minimal`, registers it in
  the registry, and adds it to the admin dropdown.
- Runtime template resolution with editor-only cookie preview (public requests are
  deterministic — no cache poisoning / cloaking).
- SEO head-contract check (`scripts/check-templates.cjs`).
- Zero runtime dependencies (Node built-ins only).

[0.1.0]: https://github.com/pk1983/emdash-template-switcher/releases/tag/v0.1.0
